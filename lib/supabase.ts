import { createClient, SupabaseClient } from '@supabase/supabase-js';

// FIX: Revert to import.meta.env, the standard Vite mechanism for environment variables.
// FIX: Cast `import.meta` to `any` to resolve TypeScript error "Property 'env' does not exist on type 'ImportMeta'".
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);


// FIX: Renamed to avoid redeclaring the exported 'supabase' const.
let supabaseInstance: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient => {
  if (supabaseInstance) return supabaseInstance;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are missing');
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  return supabaseInstance;
};

export const supabase = getSupabaseClient();