#!/bin/sh
set -e

CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"

# Extract Supabase host from URL (remove https://)
if [ -n "$SUPABASE_URL" ]; then
  export SUPABASE_HOST=$(echo "$SUPABASE_URL" | sed 's|https://||')
fi

# Use PORT env var if set (Railway), otherwise default to 80
PORT=${PORT:-80}

# Check if cert is readable (not just exists)
if [ -f "$CERT_PATH" ] && [ -r "$CERT_PATH" ]; then
  echo "SSL cert found and readable, starting HTTPS mode with Supabase proxy..."
  envsubst '${DOMAIN} ${SUPABASE_URL} ${SUPABASE_HOST} ${SUPABASE_ANON_KEY}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

elif [ -n "$SUPABASE_URL" ]; then
  echo "SSL cert not found, starting HTTP mode with Supabase proxy..."

  cat > /etc/nginx/conf.d/default.conf << NGINXEOF
server {
    listen ${PORT};
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # REST API proxy
    location /supaapi/ {
        if (\$http_x_app_request = '') {
            return 403 '{"error":"Forbidden"}';
        }
        proxy_pass ${SUPABASE_URL}/rest/v1/;
        proxy_set_header Host ${SUPABASE_HOST};
        proxy_set_header apikey ${SUPABASE_ANON_KEY};
        proxy_set_header Authorization "Bearer ${SUPABASE_ANON_KEY}";
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_ssl_server_name on;
    }

    # Auth API proxy (fetch calls)
    location /supaauth/ {
        if (\$http_x_app_request = '') {
            return 403 '{"error":"Forbidden"}';
        }
        proxy_pass ${SUPABASE_URL}/auth/v1/;
        proxy_set_header Host ${SUPABASE_HOST};
        proxy_set_header apikey ${SUPABASE_ANON_KEY};
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_ssl_server_name on;
    }

    # Auth API proxy (browser redirects - Google OAuth)
    location /auth/v1/ {
        proxy_pass ${SUPABASE_URL}/auth/v1/;
        proxy_set_header Host ${SUPABASE_HOST};
        proxy_set_header apikey ${SUPABASE_ANON_KEY};
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_ssl_server_name on;
    }

    # Realtime (WebSocket) proxy
    location /suparealtime/ {
        proxy_pass ${SUPABASE_URL}/realtime/v1/;
        proxy_set_header Host ${SUPABASE_HOST};
        proxy_set_header apikey ${SUPABASE_ANON_KEY};
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_ssl_server_name on;
        proxy_http_version 1.1;
        proxy_read_timeout 86400;
    }

    # Storage proxy
    location /supastorage/ {
        if (\$http_x_app_request = '') {
            return 403 '{"error":"Forbidden"}';
        }
        proxy_pass ${SUPABASE_URL}/storage/v1/;
        proxy_set_header Host ${SUPABASE_HOST};
        proxy_set_header apikey ${SUPABASE_ANON_KEY};
        proxy_ssl_server_name on;
    }

    # Edge Functions proxy
    location /supafunc/ {
        if (\$http_x_app_request = '') {
            return 403 '{"error":"Forbidden"}';
        }
        proxy_pass ${SUPABASE_URL}/functions/v1/;
        proxy_set_header Host ${SUPABASE_HOST};
        proxy_set_header apikey ${SUPABASE_ANON_KEY};
        proxy_set_header Authorization "Bearer ${SUPABASE_ANON_KEY}";
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_ssl_server_name on;
    }

    # SPA fallback
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 256;
}
NGINXEOF

else
  echo "No SUPABASE_URL set, starting simple static mode (Railway/simple deploy)..."

  cat > /etc/nginx/conf.d/default.conf << NGINXEOF
server {
    listen ${PORT};
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 256;
}
NGINXEOF
fi

exec nginx -g "daemon off;"

