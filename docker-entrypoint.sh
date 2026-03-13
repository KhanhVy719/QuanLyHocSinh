#!/bin/sh
set -e

CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"

# Extract Supabase host from URL (remove https://)
if [ -n "$SUPABASE_URL" ]; then
  export SUPABASE_HOST=$(echo "$SUPABASE_URL" | sed 's|https://||')
fi

# Use PORT env var if set (Railway), otherwise default to 80
PORT=${PORT:-80}

# Clean up any existing configs to prevent conflicts
rm -f /etc/nginx/templates/default.conf.template
rm -f /etc/nginx/conf.d/default.conf

echo "=== Config: PORT=${PORT}, SUPABASE_URL=${SUPABASE_URL:-[not set]} ==="

# Check if cert is readable (not just exists)
if [ -f "$CERT_PATH" ] && [ -r "$CERT_PATH" ]; then
  echo "Mode: HTTPS + Supabase proxy"
  envsubst '${DOMAIN} ${SUPABASE_URL} ${SUPABASE_HOST} ${SUPABASE_ANON_KEY}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

elif [ -n "$SUPABASE_URL" ]; then
  echo "Mode: HTTP + Supabase proxy"

  cat > /etc/nginx/conf.d/default.conf << NGINXEOF
server {
    listen ${PORT};
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location /supaapi/ {
        if (\$http_x_app_request = '') { return 403 '{"error":"Forbidden"}'; }
        proxy_pass ${SUPABASE_URL}/rest/v1/;
        proxy_set_header Host ${SUPABASE_HOST};
        proxy_set_header apikey ${SUPABASE_ANON_KEY};
        proxy_set_header Authorization "Bearer ${SUPABASE_ANON_KEY}";
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_ssl_server_name on;
    }

    location /supaauth/ {
        if (\$http_x_app_request = '') { return 403 '{"error":"Forbidden"}'; }
        proxy_pass ${SUPABASE_URL}/auth/v1/;
        proxy_set_header Host ${SUPABASE_HOST};
        proxy_set_header apikey ${SUPABASE_ANON_KEY};
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_ssl_server_name on;
    }

    location /auth/v1/ {
        proxy_pass ${SUPABASE_URL}/auth/v1/;
        proxy_set_header Host ${SUPABASE_HOST};
        proxy_set_header apikey ${SUPABASE_ANON_KEY};
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_ssl_server_name on;
    }

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

    location /supastorage/ {
        if (\$http_x_app_request = '') { return 403 '{"error":"Forbidden"}'; }
        proxy_pass ${SUPABASE_URL}/storage/v1/;
        proxy_set_header Host ${SUPABASE_HOST};
        proxy_set_header apikey ${SUPABASE_ANON_KEY};
        proxy_ssl_server_name on;
    }

    location /supafunc/ {
        if (\$http_x_app_request = '') { return 403 '{"error":"Forbidden"}'; }
        proxy_pass ${SUPABASE_URL}/functions/v1/;
        proxy_set_header Host ${SUPABASE_HOST};
        proxy_set_header apikey ${SUPABASE_ANON_KEY};
        proxy_set_header Authorization "Bearer ${SUPABASE_ANON_KEY}";
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_ssl_server_name on;
    }

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

else
  echo "Mode: Simple static (Railway)"

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

echo "=== Generated nginx config ==="
cat /etc/nginx/conf.d/default.conf
echo "=== Testing nginx config ==="
nginx -t
echo "=== Starting nginx ==="
exec nginx -g "daemon off;"
