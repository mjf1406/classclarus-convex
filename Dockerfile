# Build the Vite SPA and serve it with nginx.
FROM oven/bun:1.2-alpine AS build

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

ARG VITE_CONVEX_URL=http://127.0.0.1:3210
ENV VITE_CONVEX_URL=$VITE_CONVEX_URL

# Derived from host AUTH_PASSWORD_ENABLED (non-secret). Rebuild web after changing.
ARG VITE_AUTH_PASSWORD_ENABLED=false
ENV VITE_AUTH_PASSWORD_ENABLED=$VITE_AUTH_PASSWORD_ENABLED

RUN bun run build

FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
