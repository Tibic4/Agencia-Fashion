import { createClient } from '@supabase/supabase-js';
import { env } from "@/lib/env";

// Admin client — usa service_role key, bypassa RLS
// NUNCA expor no client-side
export function createAdminClient() {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
