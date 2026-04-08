import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { inngest } from "@/lib/inngest/client";

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || "").split(",").filter(Boolean);

/**
 * POST /api/admin/storage-gc
 *
 * Dispara o Storage Garbage Collector manualmente via painel admin.
 *
 * Body JSON: { "dryRun": true | false }
 *   - dryRun=true: apenas simula, sem deletar (default)
 *   - dryRun=false: executa o expurgo real
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session.userId || !ADMIN_USER_IDS.includes(session.userId)) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // Default: dry run

    // Disparar via Inngest (assíncrono)
    await inngest.send({
      name: "storage/gc.requested",
      data: { dryRun },
    });

    console.log(`[Admin:GC] 🚀 Storage GC disparado por ${session.userId} (dryRun=${dryRun})`);

    return NextResponse.json({
      success: true,
      message: dryRun
        ? "GC simulação iniciada — verifique os logs do Inngest"
        : "GC expurgo real iniciado — verifique os logs do Inngest",
      dryRun,
    });
  } catch (error: unknown) {
    console.error("[Admin:GC] Erro:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

/**
 * GET /api/admin/storage-gc
 *
 * Retorna as estatísticas da última execução do GC.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session.userId || !ADMIN_USER_IDS.includes(session.userId)) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();

    const { data } = await supabase
      .from("admin_settings")
      .select("value, updated_at")
      .eq("key", "gc_last_run")
      .single();

    return NextResponse.json({
      lastRun: data?.value || null,
      lastRunAt: data?.updated_at || null,
    });
  } catch (error: unknown) {
    console.error("[Admin:GC] Erro GET:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
