# =====================================================
#  image-renderer — microservicio Puppeteer
#  Recibe: { template: "article", vars: {...}, width, height }
#  Devuelve: { url: "/output/<uuid>.png" } (PNG en volumen)
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

COPY package.json ./
RUN npm install --omit=optional --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "dist/index.js"]
