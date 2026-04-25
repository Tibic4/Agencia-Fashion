/**
 * CriaLook — Storage Garbage Collector (Expurgo Automático)
 *
 * Regra de Negócio:
 *   Exclui imagens (product-photos, campaign-outputs, model-previews)
 *   de campanhas com mais de 25 dias que NÃO foram favoritadas pelo lojista.
 *
 * Execução: CronJob via Inngest — roda 1x/dia às 03:00 UTC (00:00 BRT)
 *
 * Buckets varridos:
 *   - product-photos   → fotos originais do produto (upload do lojista)
 *   - campaign-outputs  → imagens geradas pelo pipeline (v3_image_1/2/3.webp)
 *   - assets           → model-previews de modelos que não existem mais
 */

import { createAdminClient } from "@/lib/supabase/admin";

// ═══════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════

/** Dias de retenção antes do expurgo (campanhas não-favoritadas) */
const RETENTION_DAYS = 25;

/** Batch size para queries e deletes */
const BATCH_SIZE = 100;

/** Máximo de arquivos para deletar por rodada (safety valve) */
const MAX_DELETES_PER_RUN = 500;

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export interface GCStats {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  campaignsScanned: number;
  campaignsPurged: number;
  filesDeleted: number;
  bytesFreed: number; // estimativa
  errors: string[];
  dryRun: boolean;
}

interface CampaignGCCandidate {
  id: string;
  store_id: string;
  product_photo_storage_path: string;
  created_at: string;
  output: {
    version?: string;
    image_urls?: (string | null)[];
  } | null;
}

// ═══════════════════════════════════════════════════════════
// CORE: Garbage Collector
// ═══════════════════════════════════════════════════════════

/**
 * Executa o ciclo completo de Garbage Collection.
 *
 * @param dryRun - Se true, apenas loga sem deletar (para testes/auditoria)
 * @returns Estatísticas do ciclo
 */
export async function runStorageGC(dryRun = false): Promise<GCStats> {
  const startedAt = new Date();
  const supabase = createAdminClient();
  const stats: GCStats = {
    startedAt: startedAt.toISOString(),
    completedAt: "",
    durationMs: 0,
    campaignsScanned: 0,
    campaignsPurged: 0,
    filesDeleted: 0,
    bytesFreed: 0,
    errors: [],
    dryRun,
  };

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
  const cutoffISO = cutoffDate.toISOString();

  console.log(`[GC] 🗑️ Storage Garbage Collector iniciado (dryRun=${dryRun})`);
  console.log(`[GC] 📅 Cutoff: ${cutoffISO} (${RETENTION_DAYS} dias atrás)`);

  try {
    // ─── Campanhas expiradas não-favoritadas ───
    let offset = 0;
    let hasMore = true;
    let totalDeleted = 0;

    while (hasMore && totalDeleted < MAX_DELETES_PER_RUN) {
      const { data: campaigns, error } = await supabase
        .from("campaigns")
        .select("id, store_id, product_photo_storage_path, created_at, output")
        .eq("is_favorited", false)
        .in("status", ["completed", "failed"])
        .lt("created_at", cutoffISO)
        .order("created_at", { ascending: true })
        .range(offset, offset + BATCH_SIZE - 1);

      if (error) {
        stats.errors.push(`Query campaigns: ${error.message}`);
        console.error(`[GC] ❌ Query error: ${error.message}`);
        break;
      }

      if (!campaigns || campaigns.length === 0) {
        hasMore = false;
        break;
      }

      stats.campaignsScanned += campaigns.length;

      for (const campaign of campaigns as CampaignGCCandidate[]) {
        if (totalDeleted >= MAX_DELETES_PER_RUN) break;

        const filesToDelete = collectCampaignFiles(campaign);

        if (filesToDelete.length === 0) continue;

        // agrupar por bucket e fazer batch remove (reduz N+1 para ~2 calls por campanha)
        const byBucket = new Map<string, string[]>();
        for (const { bucket, path } of filesToDelete) {
          if (!byBucket.has(bucket)) byBucket.set(bucket, []);
          byBucket.get(bucket)!.push(path);
        }

        for (const [bucket, paths] of byBucket) {
          if (totalDeleted >= MAX_DELETES_PER_RUN) break;
          const paths_to_delete = paths.slice(0, Math.max(0, MAX_DELETES_PER_RUN - totalDeleted));

          // Estimar tamanho: 300KB por arquivo (suficiente para reporting)
          const estimatedSize = 300 * 1024 * paths_to_delete.length;

          try {
            if (!dryRun) {
              const { error: delError } = await supabase.storage
                .from(bucket)
                .remove(paths_to_delete);
              if (delError && !/not found/i.test(delError.message)) {
                stats.errors.push(`Batch delete ${bucket}: ${delError.message}`);
              }
            }

            stats.filesDeleted += paths_to_delete.length;
            totalDeleted += paths_to_delete.length;
            stats.bytesFreed += estimatedSize;

            console.log(`[GC] ${dryRun ? "🔍 DRY" : "🗑️ DEL"} batch ${bucket}: ${paths_to_delete.length} arquivos`);
          } catch (e) {
            stats.errors.push(`Batch ${bucket}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }

        // Limpar referências no banco (NÃO deleta o registro, apenas limpa URLs)
        if (!dryRun && filesToDelete.length > 0) {
          try {
            // 1 UPDATE em vez de 2 (mescla purge de campaigns + output)
            const output = campaign.output;
            const patchedOutput = output?.image_urls
              ? {
                  ...output,
                  image_urls: output.image_urls.map(() => "[purged]"),
                  purged_at: new Date().toISOString(),
                }
              : output;

            await supabase
              .from("campaigns")
              .update({
                product_photo_url: "[purged]",
                product_photo_storage_path: "[purged]",
                is_archived: true,
                ...(patchedOutput !== output ? { output: patchedOutput } : {}),
              })
              .eq("id", campaign.id);

            // Limpar campaign_outputs (URLs de imagens geradas pelo pipeline v2)
            await supabase
              .from("campaign_outputs")
              .update({
                product_image_clean_url: null,
                model_image_url: null,
                creative_feed_url: null,
                creative_stories_url: null,
              })
              .eq("campaign_id", campaign.id);
          } catch (e) {
            stats.errors.push(`DB cleanup ${campaign.id}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }

        stats.campaignsPurged++;
      }

      offset += BATCH_SIZE;
      if (campaigns.length < BATCH_SIZE) hasMore = false;
    }

    // ─── Model previews órfãs ───
    await purgeOrphanedModelPreviews(supabase, stats, dryRun);

  } catch (e) {
    stats.errors.push(`Fatal: ${e instanceof Error ? e.message : String(e)}`);
    console.error("[GC] ❌ Fatal error:", e);
  }

  const completedAt = new Date();
  stats.completedAt = completedAt.toISOString();
  stats.durationMs = completedAt.getTime() - startedAt.getTime();

  // Log final
  console.log(`[GC] ✅ Garbage Collection ${dryRun ? "(DRY RUN) " : ""}completo:`);
  console.log(`[GC]    📊 Campanhas varridas: ${stats.campaignsScanned}`);
  console.log(`[GC]    🗑️ Campanhas purgadas: ${stats.campaignsPurged}`);
  console.log(`[GC]    📁 Arquivos deletados: ${stats.filesDeleted}`);
  console.log(`[GC]    💾 Espaço liberado (est.): ${(stats.bytesFreed / 1024 / 1024).toFixed(1)}MB`);
  console.log(`[GC]    ⏱️ Duração: ${stats.durationMs}ms`);
  if (stats.errors.length > 0) {
    console.warn(`[GC]    ⚠️ Erros: ${stats.errors.length}`);
  }

  // Salvar stats no admin_settings para dashboard
  if (!dryRun) {
    try {
      await supabase
        .from("admin_settings")
        .upsert({
          key: "gc_last_run",
          value: stats,
          description: "Última execução do Storage Garbage Collector",
          updated_at: new Date().toISOString(),
        });
    } catch { /* non-critical */ }
  }

  return stats;
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

/**
 * Coleta todos os paths de arquivos associados a uma campanha
 */
function collectCampaignFiles(
  campaign: CampaignGCCandidate
): { bucket: string; path: string }[] {
  const files: { bucket: string; path: string }[] = [];

  // 1. Foto original do produto
  const productPath = campaign.product_photo_storage_path;
  if (productPath && productPath !== "[purged]" && !productPath.startsWith("upload-failed://") && !productPath.startsWith("pending-upload://")) {
    files.push({ bucket: "product-photos", path: productPath });
  }

  // 2. Imagens geradas (v3: campaign-outputs/<campaign_id>/v3_image_1.webp etc.)
  // Geramos sempre 3 slots (1, 2, 3)
  for (let i = 1; i <= 3; i++) {
    files.push({
      bucket: "campaign-outputs",
      path: `campaigns/${campaign.id}/v3_image_${i}.webp`,
    });
  }

  // 3. Verificar image_urls no output JSONB (podem ter paths personalizados)
  const output = campaign.output;
  if (output?.image_urls) {
    for (const url of output.image_urls) {
      if (url && url !== "[purged]" && url !== "pending") {
        const extractedPath = extractStoragePath(url, "campaign-outputs");
        if (extractedPath && !files.some(f => f.path === extractedPath)) {
          files.push({ bucket: "campaign-outputs", path: extractedPath });
        }
      }
    }
  }

  return files;
}

/**
 * Extrai o path relativo de uma URL pública do Supabase Storage
 */
function extractStoragePath(url: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  return idx >= 0 ? url.substring(idx + marker.length) : null;
}

/**
 * Remove previews de modelos que não existem mais no banco
 */
async function purgeOrphanedModelPreviews(
  supabase: ReturnType<typeof createAdminClient>,
  stats: GCStats,
  dryRun: boolean
) {
  try {
    // Listar todos os modelos válidos
    const { data: models } = await supabase
      .from("store_models")
      .select("id, store_id");

    if (!models || models.length === 0) return;

    // Criar set de model IDs válidos e stores que têm modelos
    const validModelIds = new Set(models.map(m => m.id));
    const storeIdsWithModels = [...new Set(models.map(m => m.store_id))];

    // Só escanear stores que realmente têm/tinham modelos (não todas)
    for (const storeId of storeIdsWithModels) {
      const { data: files } = await supabase.storage
        .from("assets")
        .list(`model-previews/${storeId}`, { limit: 100 });

      if (!files) continue;

      for (const file of files) {
        // Extrair modelId do nome do arquivo (formato: <modelId>.png)
        const modelId = file.name.split(".")[0];
        if (modelId && !validModelIds.has(modelId)) {
          const path = `model-previews/${storeId}/${file.name}`;
          if (!dryRun) {
            await supabase.storage.from("assets").remove([path]);
          }
          stats.filesDeleted++;
          stats.bytesFreed += file.metadata?.size || 200 * 1024;
          console.log(`[GC] ${dryRun ? "🔍 DRY" : "🗑️ DEL"} assets/${path} (modelo órfã)`);
        }
      }
    }
  } catch (e) {
    stats.errors.push(`Orphan models: ${e instanceof Error ? e.message : String(e)}`);
  }
}
