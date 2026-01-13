import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabaseClient: ReturnType<typeof createClient> | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // Enabled per patch request
    },
  });
} else {
  // The MissingCredentialsScreen handles this, so a console warn is sufficient.
  console.warn(
    'Supabase environment variables are missing. App will show configuration error screen.'
  );
}

// Export nullable client — app must guard against null
export const supabase = supabaseClient;