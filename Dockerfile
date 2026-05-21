# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Stage 2: Install Python dependencies
FROM python:3.12-slim AS backend-builder
WORKDIR /build
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Final stage: combined nginx + uvicorn runtime
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    supervisor \
    smartmontools \
    nvme-cli \
    udev \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default

# Python runtime deps
COPY --from=backend-builder /install /usr/local

# Backend application
WORKDIR /app
COPY backend/ .

# Built frontend assets
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Configuration
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/drivemap.conf

# Persistent data directory
RUN mkdir -p /app/data

EXPOSE 80

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/drivemap.conf"]
