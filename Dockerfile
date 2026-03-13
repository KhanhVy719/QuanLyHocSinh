# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
RUN npm run build

# Production stage - use plain nginx, NOT nginx's default entrypoint
FROM nginx:alpine
# Remove nginx default config and entrypoint scripts
RUN rm -f /etc/nginx/conf.d/default.conf && \
    rm -rf /docker-entrypoint.d/ && \
    rm -rf /etc/nginx/templates/
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh
RUN mkdir -p /var/www/certbot
ENV PORT=80
EXPOSE 80 443
CMD ["/docker-entrypoint.sh"]
