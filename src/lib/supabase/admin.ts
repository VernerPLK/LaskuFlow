import { createClient } from '@supabase/supabase-js';

export function getSupabaseAdmin() {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!projectUrl || !serverKey) {
    throw new Error('Missing Supabase server environment variables');
  }

  return createClient(projectUrl, serverKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
