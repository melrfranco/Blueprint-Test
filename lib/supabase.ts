import { createClient } from '@supabase/supabase-js';

// IMPORTANT:
// Do NOT throw at build time.
// Vite injects env vars at runtime in the browser.

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY ?? '';

let supabaseClient: ReturnType<typeof createClient> | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // REQUIRED for OAuth redirects
    },
  });
} else {
  console.warn(
    '[Supabase] Missing env vars at runtime:',
    { supabaseUrl, supabaseAnonKey }
  );
}

// Export nullable client — app must guard against null
export const supabase = supabaseClient;
