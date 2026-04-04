import { createClient } from '@supabase/supabase-js';

// Admin client — usa service_role key, bypassa RLS
// NUNCA expor no client-side
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
