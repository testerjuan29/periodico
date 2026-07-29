# Setup desde cero

Guía completa para instalar el sistema en una máquina limpia. Estimado: **60-90 minutos** la primera vez.

## Pre-requisitos

Instalado en el sistema:

| Software | Versión mínima | Notas |
|---|---|---|
| Docker Desktop | 4.x | Windows/Mac/Linux |
| Python | 3.8+ | Para el script de import de taxonomía |
| ngrok | 3.x | Para exponer N8N a internet |
| Git | 2.x | Para clonar el repo |

Cuentas necesarias:

| Servicio | Para qué | Cuándo la necesitas |
|---|---|---|
| **Huawei Cloud** | DeepSeek vía ModelArts MaaS | Antes de configurar N8N |
| **Meta Business + App** | WhatsApp Cloud API + FB/IG publishing | Después de setup básico |
| **ngrok** | Túnel público | Para el webhook de WhatsApp |
| **Mailgun o Postmark** | Ingesta de emails | Sprint 2 (opcional) |

## Paso 1 — Clonar el repo y configurar `.env`

```powershell
git clone <repo-url> periodicoAutomatico
cd periodicoAutomatico

# Copiar plantilla y editar
copy .env.example .env
notepad .env
```

Los valores mínimos a llenar en el `.env`:

```env
# Postgres
POSTGRES_USER=periodico
POSTGRES_PASSWORD=<inventa una password segura>
POSTGRES_DB=periodico
N8N_DB=n8n

# N8N (deprecated pero se leen por compatibilidad)
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

# WhatsApp verify token (inventa uno cualquiera)
WA_VERIFY_TOKEN=periodico-verify-2026
```

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

En el orden correcto (por dependencias):

1. `n8n/workflows/03_generate_content.json`
2. `n8n/workflows/04_publish_wordpress.json`
3. `n8n/workflows/08_approval_router_wp_only.json` (o el completo cuando existan 05/06)
4. `n8n/workflows/02_ingest_whatsapp.json` (si vas a usar WA)

Para cada workflow:
- Después del import, aparecen credentials en rojo → asocia manualmente cada nodo
- En los nodos `executeWorkflow` (llaman a sub-workflows): borrar la selección actual y **re-seleccionar del dropdown** — sin esto, no se puede publicar (ver [gotcha #7](troubleshooting.md#gotcha-7))
- **Save + Publish** (el "Publish" azul es el nuevo "Active" de v2.30)

Orden de publicación: primero los hoja (03, 04), después los intermedios (08), al final los con webhook externo (02).

## Paso 5 — Setup ngrok (para WhatsApp)

En una **terminal nueva** (déjala abierta mientras trabajas):

```powershell
ngrok http 5678
```

Copia la URL de `Forwarding` (ej: `https://xxxx.ngrok-free.app`). La usarás en Meta.

Dashboard local con requests en vivo: http://localhost:4040

## Paso 6 — Configurar WhatsApp Cloud API en Meta

Ver [Guía de integraciones — WhatsApp](guia-integraciones.md#whatsapp-cloud-api).

## Verificación final

Con todo lo anterior configurado:

1. Envía un WhatsApp de prueba desde tu número personal al número sandbox de Meta
2. En N8N → **Executions** debe aparecer una ejecución del `02 Ingest WhatsApp` (verde) y otra del `03 Generate Content` (5-15s)
3. En http://localhost:3000 aparece una publicación nueva con contenido generado
4. Clic en la publicación → **Aprobar y publicar ahora**
5. En http://localhost:8080/wp-admin/edit.php debe aparecer el post publicado con categorías, tags e imagen destacada

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
