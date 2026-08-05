# Deploy a producción — Azure VM

El sistema se despliega tal cual es: un `docker compose` en una VM. Sin App Service, sin AKS, sin Container Apps — n8n necesita cron residente, Puppeteer es un proceso de larga vida y los servicios comparten volúmenes; partirlos en PaaS sería re-arquitectura sin ganancia a esta escala.

Estimado: **60-90 min** la primera vez. Costo: **~$25-40/mes**.

## 1 — Recursos en Azure

| Recurso | Configuración |
|---|---|
| Resource Group | `rg-periodico`, región cercana (p. ej. East US) |
| Virtual Machine | **Ubuntu 24.04 LTS** · `Standard_B2s` (2 vCPU/4GB, ~$30/mes) o `Standard_B2als_v2` (~$16/mes) · autenticación por **SSH key** |
| Public IP | **Estática** (la default es dinámica — cambiarla al crear) |
| NSG (inbound) | `22` solo desde tu IP · `80` · `443`. **Nada más** — ni 3000, ni 5678, ni 5432: todo pasa por Caddy |
| Disco OS | Standard SSD 30 GB (default) |

> El puerto 22 abierto a "Any" es la fuente #1 de VMs comprometidas. Restringilo a tu IP en la regla del NSG.

## 2 — DNS

Tres registros **A** apuntando a la IP pública de la VM:

```
backoffice.tudominio.com  →  <IP de la VM>
n8n.tudominio.com         →  <IP de la VM>
wp.tudominio.com          →  <IP de la VM>
```

Caddy emite los certificados HTTPS automáticamente **si el DNS ya resuelve** — crear los registros antes de levantar los contenedores.

Si el dominio va a ser del cliente (`*.paginauno.do`), pedirles los 3 registros A.

## 3 — Preparar la VM

```bash
ssh azureuser@<IP>

# Docker + compose plugin (script oficial)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
exit   # y volver a entrar para que aplique el grupo
```

## 4 — Subir el proyecto

```bash
git clone <repo> periodicoAutomatico
cd periodicoAutomatico
cp .env.example .env
nano .env
```

En el `.env` de producción, **obligatorio cambiar**:

| Variable | Qué poner |
|---|---|
| `BACKOFFICE_DOMAIN` / `N8N_DOMAIN` / `WP_DOMAIN` | Los 3 subdominios del paso 2 |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` — firma las sesiones del login |
| `ADMIN_PASSWORD` | Contraseña fuerte nueva (la de dev quedó en chats/commits) |
| `POSTGRES_PASSWORD`, `N8N_PASSWORD`, `WP_DB_*` | Contraseñas nuevas |
| `META_PAGE_ACCESS_TOKEN` | **Regenerar el token en Meta** — el de dev se considera quemado |
| `N8N_WEBHOOK_URL` | `https://<N8N_DOMAIN>/` |

Lo demás (DeepSeek, ImgBB, WA, IG) se copia igual.

## 5 — Levantar

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps      # todo Up, postgres (healthy)
```

Primera vez: ~10 min (compila Puppeteer y Next.js).

## 6 — Post-deploy (los volúmenes arrancan vacíos)

La VM parte de cero — nada de lo configurado en local viaja solo:

1. **WordPress** (`https://wp.tudominio.com`): wizard de instalación → pretty permalinks → Application Password → `WP_LOCAL_APP_PASSWORD` en `.env` → `docker compose -f docker-compose.prod.yml up -d n8n` → `python scripts/import_taxonomy.py` (ajustando `WP_LOCAL_URL`).
2. **n8n** (`https://n8n.tudominio.com`): crear usuario owner → crear las 3 credentials (Postgres, DeepSeek Bearer, WordPress Basic) → **importar los 9 workflows** de `n8n/workflows/` → re-seleccionar sub-workflows en los nodos `executeWorkflow` (gotcha #7) → **Publish** en orden: 03, 04, 05, 06, 08, 01, 02, 07, 09.
3. **Webhooks externos** — acá muere ngrok:
   - Meta → WhatsApp → Configuration: Callback URL `https://<N8N_DOMAIN>/webhook/whatsapp-inbound` + verify token + suscribir `messages`
   - Postmark → Default Inbound Stream: `https://<N8N_DOMAIN>/webhook/email-inbound`
4. **Probar E2E**: WhatsApp de prueba → aparece en `https://backoffice.tudominio.com` (con login) → aprobar → verificar WP/FB/IG.

## 7 — Backups

Mínimo viable, cron diario en la VM:

```bash
# /etc/cron.daily/pa-backup (chmod +x)
#!/bin/sh
docker exec pa_postgres pg_dump -U periodico periodico | gzip > /home/azureuser/backups/periodico-$(date +%F).sql.gz
find /home/azureuser/backups -mtime +14 -delete
```

Mejor: activar **Azure Backup** sobre la VM (snapshot diario, ~$2-5/mes).

## 8 — Pasar del WP demo al WordPress real del cliente

Cuando el cliente autorice publicar en `paginauno.do`:

1. Pedirles una **Application Password** (usuario con rol Author/Editor)
2. En `docker-compose.prod.yml`, servicio `n8n`: `WP_INTERNAL_URL: https://paginauno.do` + las credenciales nuevas
3. Actualizar la credential "WordPress Basic" en n8n
4. Eliminar los servicios `wordpress` y `wp_db` y el bloque de WP del `Caddyfile`

## Actualizaciones

```bash
cd periodicoAutomatico
git pull
docker compose -f docker-compose.prod.yml up -d --build backoffice   # si cambió el backoffice
# workflows JSON: re-importar a mano en n8n (pierden bindings — gotcha #7)
```
