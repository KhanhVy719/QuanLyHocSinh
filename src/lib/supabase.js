import { createClient } from '@supabase/supabase-js';

const isProduction = window.location.hostname !== 'localhost';

// Production: use nginx proxy (hides Supabase URL + anon key)
// Development: direct connection to Supabase
const supabaseUrl = isProduction ? window.location.origin : import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = isProduction ? 'proxy' : import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, isProduction ? {
  global: {
    headers: { apikey: 'proxy' },
  },
  realtime: {
    params: { apikey: 'proxy' },
  },
  // Custom fetch to rewrite URLs through proxy
  db: { schema: 'public' },
  auth: { autoRefreshToken: true, persistSession: true },
} : undefined);

// Override REST/Auth/Realtime URLs for production proxy
if (isProduction) {
  // Supabase JS client uses these internally:
  // REST:     {url}/rest/v1/  → we proxy at /supaapi/
  // Auth:     {url}/auth/v1/  → we proxy at /supaauth/
  // Realtime: {url}/realtime/v1/ → we proxy at /suparealtime/
  // Storage:  {url}/storage/v1/ → we proxy at /supastorage/
  
  // The supabase-js client constructs URLs like:
  // ${supabaseUrl}/rest/v1/tablename
  // Since supabaseUrl = window.location.origin, these become:
  // https://stem.khanhwiee.site/rest/v1/tablename
  // But our proxy is at /supaapi/ not /rest/v1/
  // So we need a custom fetch wrapper
  
  const originalFetch = window.fetch;
  window.fetch = function(url, options = {}) {
    if (typeof url === 'string') {
      const origin = window.location.origin;
      // Rewrite Supabase paths to proxy paths
      url = url.replace(`${origin}/rest/v1/`, `${origin}/supaapi/`);
      url = url.replace(`${origin}/auth/v1/`, `${origin}/supaauth/`);
      url = url.replace(`${origin}/storage/v1/`, `${origin}/supastorage/`);
      
      // Remove fake apikey header (nginx injects real one)
      if (url.startsWith(origin + '/supa')) {
        const headers = new Headers(options.headers || {});
        headers.delete('apikey');
        options = { ...options, headers };
      }
    }
    return originalFetch.call(this, url, options);
  };
}
