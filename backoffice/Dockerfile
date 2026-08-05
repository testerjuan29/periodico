# =====================================================
#  backoffice — Next.js 15 + Prisma
# =====================================================
FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json .npmrc ./
RUN npm install

FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/prisma ./prisma

# Crear /uploads con dueño node ANTES de USER node.
# Docker adopta estos permisos cuando crea el named volume la PRIMERA vez.
# Si el volumen ya existe con dueño root, hay que borrarlo:
#   docker volume rm periodicoautomatico_uploads
RUN mkdir -p /uploads && chown node:node /uploads

USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
