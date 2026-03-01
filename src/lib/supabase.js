import { createClient } from '@supabase/supabase-js';

const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const isProduction = hostname !== 'localhost' && hostname !== '127.0.0.1';

let supabaseUrl, supabaseAnonKey, options;

if (isProduction) {
  supabaseUrl = window.location.origin;
  supabaseAnonKey = 'proxy-key';

  options = {
    db: { schema: 'public' },
    auth: { autoRefreshToken: true, persistSession: true },
  };

  // Intercept fetch to rewrite Supabase URLs to proxy paths
  const originalFetch = window.fetch.bind(window);
  window.fetch = function(url, opts = {}) {
    if (typeof url === 'string') {
      const origin = window.location.origin;
      url = url.replace(origin + '/rest/v1/', origin + '/supaapi/');
      url = url.replace(origin + '/auth/v1/', origin + '/supaauth/');
      url = url.replace(origin + '/storage/v1/', origin + '/supastorage/');

      // For proxy requests: clean up fake auth headers
      // Nginx will inject the real apikey + Authorization
      if (url.includes('/supa')) {
        const headers = new Headers(opts.headers || {});
        headers.delete('apikey');
        // Remove fake Authorization, keep real JWT tokens
        const auth = headers.get('Authorization');
        if (auth && auth.includes('proxy-key')) {
          headers.delete('Authorization');
        }
        // Add secret header — nginx rejects requests without it
        headers.set('X-App-Request', '1');
        opts = { ...opts, headers };
      }
    }
    return originalFetch(url, opts);
  };
} else {
  supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, options);
