import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureError, logger } from "@/lib/observability";

export const dynamic = "force-dynamic";

/**
 * LGPD art. 18 VI (direito à eliminação) + Google Play Store policy.
 *
 * DELETE /api/me
 * Apaga, em ordem, tudo o que pertence ao usuário autenticado:
 *   1. Arquivos no Storage (product-photos, campaign-outputs, assets/model-previews)
 *   2. Linhas em todas as tabelas filhas da store
 *   3. A store em si
 *   4. O usuário no Clerk (email/senha/sessões — irrecuperável)
 *
 * Idempotente: chamar duas vezes não falha (segunda chamada apenas confirma "nothing to delete").
 *
 * Por que recolher os paths antes de apagar do DB?
 *   Depois do DELETE em campaigns/store_models nós perdemos a referência aos
 *   paths de storage. Se a chamada falhar no meio, o GC noturno limpa o que
 *   sobrou pelos buckets — mas só se conseguirmos enumerar agora.
 */
export async function DELETE() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Push tokens são vinculados ao Clerk user, não à store. Limpa primeiro
    // (sempre, independente de ter store) — evita orfãos se store nunca
    // foi criada ou se a RPC abaixo falhar.
    await supabase.from("push_tokens").delete().eq("clerk_user_id", userId);

    const { data: store } = await supabase
      .from("stores")
      .select("id")
      .eq("clerk_user_id", userId)
      .maybeSingle();

    // Sem store = só apaga o user no Clerk e responde OK
    if (!store) {
      await deleteClerkUser(userId);
      return NextResponse.json({ ok: true, message: "Conta apagada" });
    }

    const storeId = store.id;

    // ── 1. Coletar paths de storage ANTES de apagar do DB ────────────────
    const filesToDelete = await collectAllUserFiles(supabase, storeId);

    // ── 2. Apagar arquivos do Storage (best-effort, não bloqueia) ────────
    await deleteStorageFiles(supabase, filesToDelete);

    // ── 3. Apagar dados em cascata (RPC transacional) ────────────────────
    const { error: rpcError } = await supabase.rpc("delete_store_cascade", {
      p_store_id: storeId,
    });
    if (rpcError) {
      // Falha na RPC — tabelas podem ter ficado parciais. Loga e tenta seguir
      // com o delete do Clerk pra ao menos cumprir o "direito ao esquecimento".
      captureError(rpcError, { route: "DELETE /api/me", phase: "rpc_cascade" });
    }

    // ── 4. Apagar usuário no Clerk (último, irrecuperável) ───────────────
    await deleteClerkUser(userId);

    logger.info("user_self_delete", {
      user_id: userId,
      store_id: storeId,
      files_purged: filesToDelete.length,
    });

    return NextResponse.json({ ok: true, message: "Conta apagada" });
  } catch (e) {
    captureError(e, { route: "DELETE /api/me" });
    return NextResponse.json({ error: "Erro ao deletar" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

interface StorageFile {
  bucket: string;
  path: string;
}

/**
 * Enumera todos os arquivos de storage que pertencem à store.
 *
 * Buckets / convenções (ver lib/storage/garbage-collector.ts):
 *  - product-photos:   campaign.product_photo_storage_path
 *  - campaign-outputs: campaigns/<id>/v3_image_{1,2,3}.webp + paths em output.image_urls
 *  - assets:           model-previews/<store_id>/<model_id>.png
 */
async function collectAllUserFiles(
  supabase: ReturnType<typeof createAdminClient>,
  storeId: string,
): Promise<StorageFile[]> {
  const files: StorageFile[] = [];

  // Campanhas — fotos originais + imagens geradas
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, product_photo_storage_path, output")
    .eq("store_id", storeId);

  for (const c of campaigns || []) {
    const productPath = c.product_photo_storage_path;
    if (
      productPath &&
      productPath !== "[purged]" &&
      !productPath.startsWith("upload-failed://") &&
      !productPath.startsWith("pending-upload://")
    ) {
      files.push({ bucket: "product-photos", path: productPath });
    }

    // Slots fixos v3
    for (let i = 1; i <= 3; i++) {
      files.push({
        bucket: "campaign-outputs",
        path: `campaigns/${c.id}/v3_image_${i}.webp`,
      });
    }

    // Paths customizados em output.image_urls
    const output = c.output as { image_urls?: (string | null)[] } | null;
    if (output?.image_urls) {
      for (const url of output.image_urls) {
        if (!url || url === "[purged]" || url === "pending") continue;
        const extracted = extractStoragePath(url, "campaign-outputs");
        if (extracted && !files.some(f => f.path === extracted)) {
          files.push({ bucket: "campaign-outputs", path: extracted });
        }
      }
    }
  }

  // Model previews — listamos o folder inteiro do store
  try {
    const { data: previewFiles } = await supabase.storage
      .from("assets")
      .list(`model-previews/${storeId}`, { limit: 1000 });
    for (const f of previewFiles || []) {
      files.push({
        bucket: "assets",
        path: `model-previews/${storeId}/${f.name}`,
      });
    }
  } catch {
    /* folder pode não existir — ok */
  }

  return files;
}

/**
 * Apaga arquivos em batch por bucket (Supabase aceita até 1000 por chamada).
 * Best-effort: erros individuais são logados mas não interrompem o fluxo.
 */
async function deleteStorageFiles(
  supabase: ReturnType<typeof createAdminClient>,
  files: StorageFile[],
) {
  // Agrupa por bucket
  const byBucket = new Map<string, string[]>();
  for (const f of files) {
    const arr = byBucket.get(f.bucket) || [];
    arr.push(f.path);
    byBucket.set(f.bucket, arr);
  }

  for (const [bucket, paths] of byBucket) {
    // Chunks de 1000 por segurança
    for (let i = 0; i < paths.length; i += 1000) {
      const chunk = paths.slice(i, i + 1000);
      const { error } = await supabase.storage.from(bucket).remove(chunk);
      if (error) {
        captureError(error, {
          route: "DELETE /api/me",
          phase: "storage_remove",
          bucket,
          chunk_size: chunk.length,
        });
      }
    }
  }
}

function extractStoragePath(url: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  return idx >= 0 ? url.substring(idx + marker.length) : null;
}

/**
 * Apaga o user no Clerk via Backend API.
 *
 * Por que best-effort? Se o Clerk estiver fora ou o user já foi apagado
 * (404), preferimos retornar 200 — o usuário já viu "Conta apagada" no app
 * e qualquer retry vai cair no mesmo caminho. Erros vão pro Sentry pra
 * triagem manual.
 */
async function deleteClerkUser(userId: string) {
  try {
    const client = await clerkClient();
    await client.users.deleteUser(userId);
  } catch (e) {
    captureError(e, { route: "DELETE /api/me", phase: "clerk_delete", user_id: userId });
  }
}
