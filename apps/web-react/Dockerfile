FROM node:24-bookworm-slim AS builder

WORKDIR /app

ARG VITE_API_BASE_URL
ARG VITE_AGENT_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_AGENT_API_BASE_URL=$VITE_AGENT_API_BASE_URL

COPY package*.json ./
RUN npm ci

COPY index.html tsconfig*.json vite.config.ts ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM nginx:1.27-alpine AS runner

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
