import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
        'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
        'process.env.VITE_SQUARE_ACCESS_TOKEN': JSON.stringify(env.VITE_SQUARE_ACCESS_TOKEN),
        'process.env.VITE_SQUARE_ENV': JSON.stringify(env.VITE_SQUARE_ENV),
        'process.env.VITE_SQUARE_APPLICATION_ID': JSON.stringify(env.VITE_SQUARE_APPLICATION_ID),
        'process.env.VITE_SQUARE_REDIRECT_URI': JSON.stringify(env.VITE_SQUARE_REDIRECT_URI),
      },
      resolve: {
        alias: {
          // FIX: Replaced `__dirname` with `process.cwd()` to avoid "Cannot find name '__dirname'" error in modern JS/TS environments.
          '@': path.resolve(process.cwd(), '.'),
        }
      }
    };
});