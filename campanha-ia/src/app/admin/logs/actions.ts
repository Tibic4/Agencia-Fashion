"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

/**
 * Marca uma campanha presa (processing) como failed.
 */
export async function markCampaignFailed(campaignId: string) {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("campaigns")
    .update({
      status: "failed",
      error_message: "Marcada como falha manualmente via admin (campanha presa)",
    })
    .eq("id", campaignId)
    .eq("status", "processing"); // safety: só altera se está processing

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/logs");
  return { success: true };
}

/**
 * Marca TODAS as campanhas presas (processing > 5min) como failed.
 */
export async function markAllStuckFailed() {
  const supabase = createAdminClient();
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { error, count } = await supabase
    .from("campaigns")
    .update({
      status: "failed",
      error_message: "Marcada como falha manualmente via admin (campanha presa)",
    })
    .eq("status", "processing")
    .lt("created_at", fiveMinAgo);

  if (error) {
    return { success: false, error: error.message, count: 0 };
  }

  revalidatePath("/admin/logs");
  return { success: true, count: count || 0 };
}
