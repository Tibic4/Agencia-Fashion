/**
 * CriaLook — Inngest CronJob: Storage Garbage Collector
 *
 * Executa automaticamente 1x/dia às 03:00 UTC (00:00 BRT)
 * para expurgar imagens de campanhas com >25 dias não-favoritadas.
 *
 * Também pode ser acionado manualmente via evento "storage/gc.requested"
 */

import { inngest } from "@/lib/inngest/client";
import { runStorageGC } from "@/lib/storage/garbage-collector";

/**
 * CronJob automático — roda todo dia às 03:00 UTC (meia-noite BRT)
 */
export const storageGarbageCollectorCron = inngest.createFunction(
  {
    id: "storage-garbage-collector",
    retries: 1,
    // concurrency:1 garante que nunca roda 2x em paralelo
    // (cron + acionamento manual poderia duplicar deleção).
    concurrency: { limit: 1, key: "storage-gc-global" },
    triggers: [
      { cron: "0 3 * * *" }, // Diário às 03:00 UTC
    ],
  },
  async ({ step }) => {
    // Step 1: Executar GC completo
    const stats = await step.run("run-gc", async () => {
      console.log("[CronGC] 🚀 Storage Garbage Collector iniciado via cron...");
      return await runStorageGC(false); // false = NÃO é dry run
    });

    // Step 2: Alertar se muitos erros
    if (stats.errors.length > 10) {
      await step.run("alert-errors", async () => {
        console.error(
          `[CronGC] ⚠️ ALERTA: ${stats.errors.length} erros durante GC. Primeiros 5:`,
          stats.errors.slice(0, 5)
        );
        // Aqui poderia enviar alerta via email/Slack com Inngest Send
      });
    }

    console.log(
      `[CronGC] ✅ GC finalizado — ${stats.filesDeleted} arquivos deletados, ` +
      `${(stats.bytesFreed / 1024 / 1024).toFixed(1)}MB liberados em ${stats.durationMs}ms`
    );

    return stats;
  }
);

/**
 * Trigger manual — permite rodar GC sob demanda via painel admin
 * Envia: inngest.send({ name: "storage/gc.requested", data: { dryRun: true } })
 */
export const storageGarbageCollectorManual = inngest.createFunction(
  {
    id: "storage-gc-manual",
    retries: 0,
    // mesmo key de concorrência que o cron — não roda em paralelo.
    concurrency: { limit: 1, key: "storage-gc-global" },
    triggers: [{ event: "storage/gc.requested" }],
  },
  async ({ event, step }) => {
    const dryRun = (event.data as { dryRun?: boolean })?.dryRun ?? true;

    const stats = await step.run("run-gc-manual", async () => {
      console.log(`[ManualGC] 🚀 Storage GC manual (dryRun=${dryRun})...`);
      return await runStorageGC(dryRun);
    });

    return stats;
  }
);
