import { createClient } from '@supabase/supabase-js';

const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

// VITE_ vars are baked at build time. If set, use direct Supabase connection.
const viteUrl = import.meta.env.VITE_SUPABASE_URL;
const viteKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Use proxy only in production when VITE_ vars are NOT set (VPS with nginx proxy)
const useProxy = !isLocalhost && !viteUrl;

let supabaseUrl, supabaseAnonKey, options;

if (useProxy) {
  // VPS mode: use nginx proxy (hides API key)
  supabaseUrl = window.location.origin;
  supabaseAnonKey = 'proxy-key';

  options = {
    db: { schema: 'public' },
    auth: { autoRefreshToken: true, persistSession: true },
  };

  const originalFetch = window.fetch.bind(window);
  window.fetch = function(url, opts = {}) {
    if (typeof url === 'string') {
      const origin = window.location.origin;
      url = url.replace(origin + '/rest/v1/', origin + '/supaapi/');
      url = url.replace(origin + '/auth/v1/', origin + '/supaauth/');
      url = url.replace(origin + '/storage/v1/', origin + '/supastorage/');
      url = url.replace(origin + '/functions/v1/', origin + '/supafunc/');

      if (url.includes('/supa')) {
        const headers = new Headers(opts.headers || {});
        headers.delete('apikey');
        const auth = headers.get('Authorization');
        if (auth && auth.includes('proxy-key')) {
          headers.delete('Authorization');
        }
        headers.set('X-App-Request', '1');
        opts = { ...opts, headers };
      }
    }
    return originalFetch(url, opts);
  };
} else {
  // Direct mode: localhost dev OR Railway/Vercel (VITE_ vars baked in)
  supabaseUrl = viteUrl;
  supabaseAnonKey = viteKey;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, options);
