/**
 * FASE M.10 — Helper para gerar URLs assinadas temporárias de buckets Supabase.
 *
 * Uso gradual: substitua chamadas de `supabase.storage.from(b).getPublicUrl(path)`
 * por `getSignedStorageUrl(supabase, b, path)` em endpoints que retornam URLs
 * para terceiros (preview público, e-mails, webhook MP).
 *
 * Para uso interno (dashboard do próprio lojista autenticado), public URL continua
 * aceitável porque o path já é previsível + RLS filtra por ownership.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Retorna URL assinada com TTL. Se falhar, faz fallback para public URL.
 * @param expiresIn segundos (default 1h)
 */
export async function getSignedStorageUrl(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  expiresIn = 3600,
): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);
    if (!error && data?.signedUrl) return data.signedUrl;
  } catch {
    /* fallthrough para public */
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
