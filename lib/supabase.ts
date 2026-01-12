import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

let supabaseClient: ReturnType<typeof createClient> | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false, // Square OAuth is removed.
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
