import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

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


/**
 * Clears all Supabase-related keys from localStorage to reset the session,
 * then reloads the page.
 */
export function clearSupabaseConfig() {
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('sb-')) {
      localStorage.removeItem(key);
    }
  });
  alert('Supabase configuration has been cleared. The application will now reload.');
  window.location.reload();
}
