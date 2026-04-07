import { createAdminClient } from "@/lib/supabase/admin";
import ShowcaseSection from "@/components/ShowcaseSection";

/**
 * Busca itens da vitrine no servidor (SSR/ISR).
 * Dados já chegam no HTML — sem cascata JS → fetch → render.
 */
async function getShowcaseItems() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("showcase_items")
      .select("id, before_photo_url, after_photo_url, caption, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}

export default async function ShowcaseSectionSSR() {
  const items = await getShowcaseItems();
  if (items.length === 0) return null;
  return <ShowcaseSection items={items} />;
}
