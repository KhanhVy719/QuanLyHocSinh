# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
RUN echo "Build with VITE_SUPABASE_URL=${VITE_SUPABASE_URL}" && npm run build

# Production stage
FROM nginx:alpine
# Remove nginx's auto-entrypoint scripts (prevents template auto-processing)
RUN rm -rf /docker-entrypoint.d/ && \
    rm -f /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# Keep template for HTTPS/VPS mode
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh
RUN mkdir -p /var/www/certbot
ENV PORT=80
EXPOSE 80 443
CMD ["/docker-entrypoint.sh"]
