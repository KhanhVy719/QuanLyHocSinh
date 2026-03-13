import { createClient } from '@supabase/supabase-js';

const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

// Priority: 1) Runtime config (injected by entrypoint), 2) VITE_ build vars, 3) proxy mode
const runtimeUrl = typeof window !== 'undefined' && window.__SUPABASE_URL__;
const runtimeKey = typeof window !== 'undefined' && window.__SUPABASE_ANON_KEY__;
const viteUrl = import.meta.env.VITE_SUPABASE_URL;
const viteKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const directUrl = runtimeUrl || viteUrl;
const directKey = runtimeKey || viteKey;

// Use proxy only in production when no direct URL available (VPS with nginx proxy)
const useProxy = !isLocalhost && !directUrl;

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
  // Direct mode: localhost dev OR Railway/Vercel (runtime or build-time config)
  supabaseUrl = directUrl;
  supabaseAnonKey = directKey;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, options);
