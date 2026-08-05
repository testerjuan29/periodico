# =====================================================
#  image-renderer — microservicio Puppeteer
#  Recibe: { template: "article", vars: {...}, width, height }
#  Devuelve: { url: "/output/<uuid>.jpg" }
#
#  CONTEXTO DE BUILD = RAÍZ DEL REPO (no este directorio):
#  los templates viven en /templates del repo y se hornean en la
#  imagen para que funcione en plataformas sin mounts (Railway).
#  En compose: build.context: .  +  dockerfile: image-renderer/Dockerfile
# =====================================================
FROM node:20-bookworm-slim

# Dependencias del sistema para Chromium (Puppeteer las necesita)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    fonts-noto-color-emoji \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    wget \
    xdg-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY image-renderer/package.json ./
RUN npm install --omit=optional --no-audit --no-fund

COPY image-renderer/tsconfig.json ./
COPY image-renderer/src ./src
RUN npx tsc

# Templates horneados en la imagen. En dev el compose los monta encima
# (mismo path) para iterar sin rebuild.
COPY templates /templates

ENV NODE_ENV=production
ENV TEMPLATES_DIR=/templates
ENV OUTPUT_DIR=/output
EXPOSE 3001

CMD ["node", "dist/index.js"]
