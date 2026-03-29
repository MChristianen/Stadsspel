FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY frontend-react/package.json frontend-react/package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source code
COPY frontend-react/ ./

# Build for production - API calls go to /api (reverse proxied by Caddy)
ENV VITE_API_BASE_URL=/api
RUN npm run build

# --- Production stage: just the static files ---
FROM alpine:3.19
RUN mkdir -p /dist
COPY --from=build /app/dist /dist
# This stage only holds static files; Caddy will serve them via a volume
