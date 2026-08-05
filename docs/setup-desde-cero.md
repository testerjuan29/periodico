# Setup desde cero

Guía completa para instalar el sistema en una máquina limpia. Estimado: **90-120 minutos** la primera vez (mayormente configurando cuentas externas).

## Pre-requisitos

Instalado en el sistema:

| Software | Versión mínima | Notas |
|---|---|---|
| Docker Desktop | 4.x | Windows/Mac/Linux |
| Python | 3.8+ | Para el script de import de taxonomía |
| ngrok | 3.x | Para exponer N8N a internet (webhooks de WA + email) |
| Git | 2.x | Para clonar el repo |

Cuentas necesarias (todas gratis, sin tarjeta):

| Servicio | URL de signup | Para qué | Tiempo |
|---|---|---|---|
| **Huawei Cloud** | https://console.huaweicloud.com/ | DeepSeek vía ModelArts MaaS (IA) | 15 min |
| **Meta Business + App** | https://business.facebook.com + https://developers.facebook.com/apps | WhatsApp Cloud API + FB Pages + Instagram publishing | 30-45 min |
| **ngrok** | https://ngrok.com | Túnel público para webhooks (WA + email) | 5 min |
| **Postmark** | https://account.postmarkapp.com/sign_up | Ingesta de emails (100 correos/mes gratis) | 5 min |
| **ImgBB** | https://api.imgbb.com/ | Host público de imágenes (Instagram lo requiere) | 2 min |

**Detalles de setup de cada servicio**: [guia-integraciones.md](guia-integraciones.md).

## Paso 1 — Clonar el repo y configurar `.env`

```powershell
git clone <repo-url> periodicoAutomatico
cd periodicoAutomatico

# Copiar plantilla y editar
copy .env.example .env
notepad .env
```

Los valores mínimos a llenar en el `.env` para arrancar los contenedores (los tokens de servicios externos vienen después):

```env
# Postgres
POSTGRES_USER=periodico
POSTGRES_PASSWORD=<inventa una password segura>
POSTGRES_DB=periodico
N8N_DB=n8n

# N8N (basic auth interno de N8N)
N8N_USER=admin
N8N_PASSWORD=admin
N8N_HOST=localhost
N8N_PROTOCOL=http
N8N_WEBHOOK_URL=http://localhost:5678/
TZ=America/Bogota

# WordPress
WP_DB_ROOT_PASSWORD=<password>
WP_DB_PASSWORD=<password>

# Backoffice
BACKOFFICE_PUBLIC_URL=http://localhost:3000
NEXTAUTH_SECRET=<openssl rand -base64 32>
ADMIN_EMAIL=tu-email@dominio.com
N8N_APPROVAL_WEBHOOK=http://n8n:5678/webhook/publication-approved

# DeepSeek vía Huawei ModelArts
DEEPSEEK_API_URL=https://api-ap-southeast-1.modelarts-maas.com/openai/v1
DEEPSEEK_API_KEY=<tu-key-de-huawei-cloud>
DEEPSEEK_MODEL=DeepSeek-V3.2

# WordPress local (se llena en el Paso 3.2, después de crear la Application Password)
WP_LOCAL_URL=http://localhost:8080
WP_LOCAL_USER=admin
WP_LOCAL_APP_PASSWORD=

# WhatsApp — verify token (inventa uno, coincidir después en Meta)
WA_VERIFY_TOKEN=periodico-verify-2026
WA_MEDIA_DOWNLOAD_ENABLED=false

# Meta Graph API — se llenan en Paso 6 (Meta setup)
WA_PHONE_NUMBER_ID=
META_PAGE_ID=
META_IG_USER_ID=
META_PAGE_ACCESS_TOKEN=

# ImgBB — se llena en Paso 7
IMGBB_API_KEY=
```

Ver [`.env.example`](../.env.example) para la plantilla completa con comentarios y URLs de signup.

## Paso 2 — Arrancar los contenedores

```powershell
docker compose up -d --build
```

Primera vez tarda **5-10 min** (compila Puppeteer y Next.js). Después: 30-60s.

Verifica que arrancaron:

```powershell
docker compose ps
```

Los 6 servicios deben estar `Up`. El postgres debe tener `(healthy)`.

Smoke test:

```powershell
curl -s -o NUL -w "backoffice %{http_code}`n" http://localhost:3000/
curl -s -o NUL -w "n8n        %{http_code}`n" http://localhost:5678/
curl -s -o NUL -w "wordpress  %{http_code}`n" http://localhost:8080/
curl -s http://localhost:3001/health
```

Debe salir 200, 200, 302, `{"ok":true}`.

## Paso 3 — Configurar WordPress

1. Abre http://localhost:8080 → el instalador de WordPress
2. Idioma: Español
3. Datos del sitio:
   - Título: `PaginaUno.Do` (o el del cliente)
   - Usuario admin: `admin`
   - Password: **guárdala**, la necesitas después
   - Email: el tuyo
4. Login en http://localhost:8080/wp-admin

### 3.1 — Pretty permalinks

**Ajustes → Enlaces permanentes → "Nombre de la entrada" → Guardar**

Sin esto, las URLs de posts salen feas (`/?p=123`) y el theme no se ve bien.

### 3.2 — Application Password

Necesaria para el bot de publicación:

1. **Usuarios → Perfil** → baja a **"Contraseñas de aplicación"**
2. Nombre: `bot-periodico`
3. **Añadir nueva contraseña de aplicación**
4. Copia la password (formato `xxxx xxxx xxxx xxxx xxxx xxxx`) — solo se muestra 1 vez

Guárdala en el `.env`:

```
WP_LOCAL_USER=admin
WP_LOCAL_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
```

Y recreamos n8n para tomar la variable:

```powershell
docker compose up -d --force-recreate n8n
```

### 3.3 — Theme (opcional pero recomendado)

**Apariencia → Temas → Añadir nuevo tema → buscar `ColorMag`** (alternativa gratis a JNews que usa el cliente) → Instalar → Activar.

### 3.4 — Importar taxonomía real del cliente

```powershell
python scripts/import_taxonomy.py
```

Descarga las ~100 categorías y top tags de PaginaUno.Do via su API pública. Idempotente (se puede correr varias veces).

Ver [`scripts/README.md`](../scripts/README.md) para detalles.

## Paso 4 — Configurar N8N

Abre http://localhost:5678 → crea el usuario owner cuando te lo pida (email + password).

### 4.1 — Credentials

Ir a **Credentials → New**. Crear estas 3:

**Postgres Periodico** (tipo Postgres):
| Campo | Valor |
|---|---|
| Host | `postgres` |
| Database | `periodico` |
| User | `periodico` |
| Password | tu `POSTGRES_PASSWORD` |
| Port | `5432` |
| SSL | disable |

**DeepSeek Bearer** (tipo Header Auth):
| Campo | Valor |
|---|---|
| Name | `Authorization` |
| Value | `Bearer <tu DEEPSEEK_API_KEY>` (con espacio después de Bearer) |

**WordPress Basic** (tipo Basic Auth):
| Campo | Valor |
|---|---|
| User | `admin` |
| Password | tu Application Password de WP |

### 4.2 — Importar workflows

Todos los workflows del directorio `n8n/workflows/`. Impórtalos en este orden por dependencias:

1. `03_generate_content.json` (hoja — genera contenido con IA)
2. `04_publish_wordpress.json` (hoja — publica en WP)
3. `05_publish_facebook.json` (hoja — publica en FB)
4. `06_publish_instagram.json` (hoja — publica en IG, requiere `IMGBB_API_KEY`)
5. `08_approval_router.json` (fan-out a 04, 05, 06)
6. `01_ingest_email.json` (webhook público — requiere ngrok + Postmark)
7. `02_ingest_whatsapp.json` (webhook público — requiere ngrok + Meta WhatsApp)
8. `07_scheduled_publisher.json` (cron cada minuto — dispara 08 con publicaciones vencidas)

Para cada workflow:
- Después del import, aparecen credentials en rojo → asocia manualmente cada nodo
- En los nodos `executeWorkflow` (llaman a sub-workflows): borrar la selección actual y **re-seleccionar del dropdown** — sin esto, no se puede publicar (ver [gotcha #7](troubleshooting.md#gotcha-7))
- **Save + Publish** (el "Publish" azul es el nuevo "Active" de v2.30)

Orden de publicación: primero los hoja (03-06), después los intermedios (08), al final los con webhook externo (01, 02) y el cron (07).

## Paso 5 — Setup ngrok (para WhatsApp y Email)

En una **terminal nueva** (déjala abierta mientras trabajas):

```powershell
ngrok http 5678
```

Copia la URL de `Forwarding` (ej: `https://xxxx.ngrok-free.app`). La usarás como:
- **Callback URL de Meta** (WhatsApp): `https://xxxx.ngrok-free.app/webhook/whatsapp-inbound`
- **Inbound webhook de Postmark** (Email): `https://xxxx.ngrok-free.app/webhook/email-inbound`

Dashboard local con requests en vivo: http://localhost:4040

**⚠️ La URL de ngrok free cambia en cada arranque** — hay que actualizarla en Meta y Postmark cada vez, o pagar ngrok Pro (~$8/mes) para URL fija.

## Paso 6 — Configurar servicios externos

Los 4 servicios externos que se configuran en su propio panel (no en el `.env` directamente aún):

### 6.1 — WhatsApp Cloud API (Meta)

Ver [Guía de integraciones — WhatsApp](guia-integraciones.md#whatsapp-cloud-api).

Al final tendrás valores para: `WA_PHONE_NUMBER_ID`.

### 6.2 — Facebook Pages + Instagram (Meta Graph API)

Ver [Guía de integraciones — Facebook](guia-integraciones.md#facebook-pages--meta-graph-api) y [Instagram](guia-integraciones.md#instagram--meta-graph-api).

Al final tendrás valores para: `META_PAGE_ID`, `META_IG_USER_ID`, `META_PAGE_ACCESS_TOKEN`.

### 6.3 — Postmark (Email inbound)

Ver [Guía de integraciones — Postmark](guia-integraciones.md#email-inbound--postmark).

No se guarda ningún token en el `.env` — solo configuras el webhook URL en Postmark apuntando a tu ngrok.

### 6.4 — ImgBB (Host de imágenes para Instagram)

Ver [Guía de integraciones — ImgBB](guia-integraciones.md#imgbb--host-p%C3%BAblico-de-im%C3%A1genes-para-instagram).

Al final tendrás valor para: `IMGBB_API_KEY`.

## Paso 7 — Aplicar variables y recrear N8N

Después de llenar todos los tokens en el `.env`, recrea el contenedor de N8N para que los tome:

```powershell
docker compose up -d --force-recreate n8n
```

Verifica que llegaron al contenedor:

```powershell
docker exec pa_n8n printenv IMGBB_API_KEY META_PAGE_ACCESS_TOKEN WA_PHONE_NUMBER_ID
```

Los 3 valores deben imprimirse. Si sale vacío alguno → revisa que estén en `.env` sin comillas ni espacios, y que estén mapeados en `docker-compose.yml`.

## Verificación final

Con todo lo anterior configurado, prueba los 3 canales de entrada + los 3 de salida:

### Test 1 — WhatsApp → todos los canales

1. Envía un WhatsApp de prueba desde tu número personal al número sandbox de Meta con foto + texto
2. Manda `LISTO` para cerrar el draft
3. En N8N → **Executions** debe aparecer `02 Ingest WhatsApp` (verde) y luego `03 Generate Content` (5-15s)
4. En http://localhost:3000 aparece una publicación nueva con contenido generado
5. Clic → **Aprobar y publicar ahora**
6. En N8N → `08 Approval Router` dispara los 3 sub-workflows (04, 05, 06) en paralelo
7. Verifica:
   - **WordPress**: http://localhost:8080/wp-admin/edit.php → post con imagen, categorías, tags
   - **Facebook**: tu Page → aparece el post
   - **Instagram**: la cuenta IG Business → aparece el post

### Test 2 — Email → WordPress

1. Envía un email desde cualquier Gmail a tu `<hash>@inbound.postmarkapp.com`
2. ~15-20s después aparece en http://localhost:3000
3. Aprueba y publica

### Test 3 — Publicación programada

1. Desde el backoffice → click en una publicación pending → **Programar** para +2 min
2. Cada minuto, workflow 07 escanea. Cuando llegue la hora, dispara 08 → publica en los 3 canales
3. Después de ~1 min de la hora programada, verifica en WP/FB/IG

Si algo falla, ver [Troubleshooting](troubleshooting.md).

## Actualizaciones

Cuando actualices el código del repo:

```powershell
git pull

# Si cambió el backoffice o image-renderer:
docker compose up -d --build backoffice image-renderer

# Si cambió el schema SQL (raro):
# hacer ALTER TABLE manualmente con docker compose exec

# Si cambiaron workflows JSON:
# re-importar en N8N manualmente (borrar + import)
# NOTA: pierdes credentials y bindings de sub-workflows → hay que reconectar
```
