# Guía de integraciones externas

Cómo configurar cada servicio externo del que depende el sistema.

## WhatsApp Cloud API

Meta ofrece la API oficial gratis hasta 1000 conversaciones/mes.

### 1 — Requisitos previos

- Cuenta Meta Business (https://business.facebook.com)
- App creada en Meta for Developers (https://developers.facebook.com/apps)
- Producto **WhatsApp** agregado a esa app

### 2 — Obtener credenciales del sandbox

En Meta Developers → tu App → **WhatsApp → API Setup**:

| Dato | Dónde sale | Usarlo para |
|---|---|---|
| **Temporary access token** | Aparece en la parte superior (válido 24h) | Descargar imágenes de mensajes entrantes |
| **Phone number ID** | Debajo del token | En workflows que envían mensajes (si el proyecto lo agrega) |
| **From** (número sandbox) | Sección "From" | Es a este número al que se le manda WA para probar |

### 3 — Registrar tu número como recipient (solo sandbox)

En sandbox, WhatsApp solo permite mandar mensajes DESDE el número sandbox HACIA destinatarios verificados.

- Sección **"To"** → agregar tu número personal → llegará código → introducirlo
- Ahora ese número puede mandar mensajes al sandbox y N8N los recibirá

### 4 — Configurar el Webhook

**Requisito**: N8N accesible desde internet. Local + ngrok:

```powershell
ngrok http 5678
```

Copia la URL de `Forwarding` (ej: `https://xxxx.ngrok-free.app`).

En Meta Developers → tu App → **WhatsApp → Configuration → Webhooks**:

| Campo | Valor |
|---|---|
| **Callback URL** | `https://xxxx.ngrok-free.app/webhook/whatsapp-inbound` |
| **Verify token** | El valor de `WA_VERIFY_TOKEN` del `.env` (ej: `periodico-verify-2026`) |

Click **Verify and save**. Meta hace un GET a esa URL con el token; N8N (workflow 02, rama GET) valida y responde con el `hub.challenge`.

### 5 — Suscribirse al campo `messages`

En la misma pantalla, sección **Webhook fields**:

- Al lado de **`messages`** → **Subscribe**

Sin esta suscripción, Meta valida el webhook pero **no envía** eventos.

### 6 — Probar

Desde tu WhatsApp personal (el registrado como recipient), manda un mensaje al número sandbox. Debe aparecer:
- En **ngrok dashboard** (http://localhost:4040): un POST `/webhook/whatsapp-inbound`
- En **N8N → Executions**: una ejecución del workflow 02 y otra del 03
- En **http://localhost:3000**: la publicación nueva

### Estructura del payload de WhatsApp

```json
{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "18092598816",
          "type": "image",   // o "text", "video", "document"
          "text":  { "body": "..." },
          "image": { "caption": "...", "id": "...", "url": "https://lookaside.fbsbx.com/..." }
        }]
      }
    }]
  }]
}
```

El **caption** de mensajes con imagen/video/document está en `messages[0].image.caption` (no en `messages[0].caption`). El workflow 02 lo maneja.

### Descargar la imagen adjunta

La URL en `image.url` es de `lookaside.fbsbx.com` y requiere `Authorization: Bearer <access_token>` para descargar. El proyecto actual NO descarga la imagen — usa un placeholder de `picsum.photos`. Para implementarlo:

- Añadir un nodo HTTP Request en el workflow 02 después de Normalize
- Method GET, URL `={{ $json.media.url }}`, Response Format = File
- Añadir Header `Authorization: Bearer {{ $env.WA_ACCESS_TOKEN }}`
- Guardar el binary en el volumen del image-renderer (o pasarlo directamente)

---

## DeepSeek vía Huawei ModelArts MaaS

Estamos usando DeepSeek NO oficial: es el modelo hospedado por Huawei Cloud en el servicio MaaS (Model as a Service).

### 1 — Requisitos

- Cuenta Huawei Cloud
- Servicio ModelArts activado
- Modelo `DeepSeek-V3.2` suscrito (el `DeepSeek-V3` no es lo mismo — verificar cuál está autorizado en tu cuenta)

### 2 — Obtener credenciales

En consola Huawei → **ModelArts → MaaS → My Services**:

| Dato | Valor |
|---|---|
| **API URL** | `https://api-ap-southeast-1.modelarts-maas.com/openai/v1` (región AP Southeast 1) |
| **API Key** | Tab **API Access** o **Credentials** → generar API Key |
| **Model name** | `DeepSeek-V3.2` (el exacto que autorizó tu suscripción) |

La API key NO tiene formato `sk-...` como DeepSeek oficial — es un token largo de ~90 caracteres de Huawei Cloud.

### 3 — Configurar en el `.env`

```
DEEPSEEK_API_URL=https://api-ap-southeast-1.modelarts-maas.com/openai/v1
DEEPSEEK_API_KEY=<tu-key-de-huawei>
DEEPSEEK_MODEL=DeepSeek-V3.2
```

Recrear N8N para que tome las variables:
```powershell
docker compose up -d --force-recreate n8n
```

### 4 — Crear credential en N8N

**Credentials → New → Header Auth**:
- Name: `Authorization`
- Value: `Bearer <tu-key>` (con espacio después de Bearer)
- Nombre exacto: `DeepSeek Bearer`

### 5 — Verificar con Bruno o curl

```
POST https://api-ap-southeast-1.modelarts-maas.com/openai/v1/chat/completions
Authorization: Bearer <tu-key>
Content-Type: application/json

{
  "model": "DeepSeek-V3.2",
  "messages": [{ "role": "user", "content": "say ok" }],
  "max_tokens": 5
}
```

Respuestas esperadas:
- **200 OK** → todo bien
- **401** → key mala o formato incorrecto (¿le pusiste `Bearer ` con espacio?)
- **403 con `ModelArts.81004`** → no tienes acceso al modelo (cuota agotada, suscripción vencida, o nombre del modelo mal)

### Peculiaridades

- Huawei **ignora** `response_format: {"type": "json_object"}` — el modelo devuelve el JSON envuelto en ```` ```json ... ``` ````. El workflow 03 tiene un nodo Code (`Parse JSON`) que limpia esto antes de parsear.
- Latencia típica: 5-15s por request de una nota completa.
- No hay endpoint de streaming en esta cuenta (se puede usar pero no lo necesitamos).

---

## WordPress

Configuración del CMS local que simula el del cliente.

### 1 — Application Password

WP requiere una Application Password (no la del usuario) para el bot que publica via REST API.

Por defecto, WP bloquea Application Passwords en HTTP (no HTTPS). En desarrollo local añadimos:

En `docker-compose.yml`, servicio `wordpress`:
```yaml
environment:
  WORDPRESS_CONFIG_EXTRA: |
    define( 'WP_ENVIRONMENT_TYPE', 'local' );
```

Con eso, en **/wp-admin/profile.php** aparece la sección "Contraseñas de aplicación":

1. Nombre: `bot-periodico`
2. **Añadir nueva contraseña de aplicación**
3. Copia el valor (formato `xxxx xxxx xxxx xxxx xxxx xxxx`) — solo se muestra una vez

Guárdala en el `.env`:
```
WP_LOCAL_USER=admin
WP_LOCAL_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
```

### 2 — Pretty permalinks

**Ajustes → Enlaces permanentes → "Nombre de la entrada" → Guardar**

Sin esto:
- URLs feas (`/?p=123`)
- El script `import_taxonomy.py` funciona igual (usa `?rest_route=`), pero la UX es peor

### 3 — Categorías y tags reales

El cliente tiene ~200 categorías y muchos tags. Importarlos con:

```powershell
python scripts/import_taxonomy.py
```

Ver [`scripts/README.md`](../scripts/README.md) para detalles del script.

### 4 — Theme

Cliente usa **JNews** (ThemeForest, ~$59). Como alternativa gratis:

**Apariencia → Temas → Añadir nuevo → buscar `ColorMag` → Instalar → Activar**

Similar layout de periódico digital (breaking news, multi-columna, sizes de imagen predefinidas).

### 5 — API REST del cliente

El cliente tiene su API REST pública:
- Categorías: https://paginauno.do/wp-json/wp/v2/categories?per_page=100
- Tags: https://paginauno.do/wp-json/wp/v2/tags?per_page=100
- Posts: https://paginauno.do/wp-json/wp/v2/posts?per_page=20

Muy útil para:
- Bajar taxonomía real (`import_taxonomy.py`)
- Analizar el estilo editorial (leer 20 notas reales para calibrar el prompt)
- Extraer categorías nuevas cuando el cliente las cree

### Endpoints internos de WP local que usamos

Con pretty permalinks:
- `POST http://wordpress/wp-json/wp/v2/posts` — crear post
- `POST http://wordpress/wp-json/wp/v2/media` — subir imagen
- `GET  http://wordpress/wp-json/wp/v2/categories?slug=X` — buscar categoría
- `POST http://wordpress/wp-json/wp/v2/tags` — crear tag

Sin pretty permalinks (fallback): reemplazar `/wp-json/` por `/?rest_route=/`.

---

## Mailgun / Postmark (email inbound) — PENDIENTE

*(Sprint 2 - Fase 2)*

### Plan

1. Crear cuenta gratis en Mailgun (100 emails/día en sandbox)
2. Configurar un "Route" que reenvíe emails entrantes a `https://tu-ngrok.ngrok-free.app/webhook/email-inbound`
3. Configurar el DNS del dominio del cliente para que apunte a Mailgun (o usar el subdominio sandbox de Mailgun para pruebas)
4. Activar el workflow 01 (Ingest Email) en N8N

### Alternativa: forwarding directo

Si el cliente usa Gmail/Google Workspace, se puede:
1. Crear un filtro en Gmail que reenvíe correos a un webhook — requiere Google Apps Script
2. Más complicado que Mailgun/Postmark; solo si el cliente lo prefiere por temas de dominio

---

## Facebook Pages — Meta Graph API

### Requisitos previos

- Cuenta Meta Business
- Facebook Page (creada en facebook.com/pages/create o business.facebook.com)
- App en Meta for Developers (la misma que usas para WhatsApp o una nueva)
- Business Portfolio en Meta Business Suite con la Page y la App adjuntadas

### Setup del System User (recomendado — token permanente)

En https://business.facebook.com/settings/system-users:

1. **Crear System User**: rol Admin (nombre: `pa-publisher` o el que quieras)
2. **Asignar Page** al System User → permisos "Manage Page" + "Create content"
3. **Asignar App** al System User → permiso "Manage App"

### ⚠️ Paso crítico y no obvio: agregar el Caso de Uso "Administrar todos los aspectos de tu página" a la App

Sin este paso, al intentar generar el token del System User **NO aparecen los permisos `pages_*`** (solo aparecen los de WhatsApp si es una app compartida). Meta muestra un mensaje sutil: *"Si los permisos que quieres seleccionar no están disponibles, un administrador de la app tendrá que personalizar o agregar un caso de uso a esta app."*

Cómo agregarlo:
1. Meta for Developers → tu App
2. Sidebar → **Casos de uso** (Use Cases)
3. **Agregar caso de uso** → busca **"Administrar todos los aspectos de tu página"** (ícono de bandera)
4. Habilítalo → agrega los permisos que se muestren (`pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `pages_manage_metadata`, `pages_manage_engagement`)

Para **Instagram** (workflow 06, pendiente), agregar además el caso de uso **"Administrar mensajes y contenido en Instagram"**.

### Generar el token

En https://business.facebook.com/settings/system-users:

1. Selecciona el System User → **Generar token**
2. App: la que corresponde
3. Caducidad: **Nunca** (o 60 días si "Nunca" no aparece)
4. Permisos: marca los `pages_*` que necesitas (mínimo `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`)
5. **Copia el token inmediatamente** — solo se muestra 1 vez

### Verificar el token

En Bruno:

```
GET https://graph.facebook.com/v20.0/me/permissions?access_token=<tu-token>
```

Debe aparecer al menos:
```json
{"data": [
  {"permission": "pages_manage_posts", "status": "granted"},
  {"permission": "pages_show_list", "status": "granted"},
  {"permission": "pages_read_engagement", "status": "granted"}
]}
```

Si sale otro user token o falta algún scope → volver al paso "Caso de uso" arriba.

### ⚠️ Paso extra: el System User Token NO se usa directo — hay que obtener el Page Token

El token que generas en el System User es user-level (tiene los scopes pero apunta al System User, no a la Page). Si intentas publicar directamente con él, Facebook responde:

```
(#200) This app is not allowed to publish to other users' timelines
```

Para publicar en la Page hay que **cambiarlo por el Page Access Token** — se obtiene con:

```
GET https://graph.facebook.com/v20.0/me/accounts?access_token=<system-user-token>
```

Respuesta:
```json
{
  "data": [{
    "access_token": "EAA...ESTE-ES-EL-PAGE-TOKEN...",
    "id": "61592116626896",
    "name": "El Periodico",
    "tasks": ["CREATE_CONTENT", "MANAGE", ...]
  }]
}
```

Ese `access_token` del array es el **Page Access Token**. **Ese es el que va en `META_PAGE_ACCESS_TOKEN`**, no el del System User.

Ventaja del System User approach: ese Page Token no expira mientras el System User tenga la Page asignada. Ideal para producción.

### Variables en el `.env`

```
META_PAGE_ID=<page-id-numérico, ej: 61592116626896>
META_PAGE_ACCESS_TOKEN=<el-Page-Access-Token-obtenido-de-/me/accounts>
```

Después: `docker compose up -d --force-recreate n8n` para que N8N tome las nuevas variables.

### Endpoints usados por el workflow 05

- `POST /{page_id}/photos` — publica foto con caption (con multipart `source` = binary de la imagen, `caption`, `access_token`)
- Alternativas no usadas: `/{page_id}/feed` (solo texto o link), `/{page_id}/videos` (para video)

---

## Instagram — Meta Graph API

### Requisitos previos

- Setup de Facebook Pages completado (arriba)
- Facebook Page ya vinculada a un Business Portfolio

### Fase A — Crear cuenta Instagram Business

1. **Crea una cuenta IG** desde la app o web:
   - App móvil: instala Instagram → "Continuar con Facebook" → **Crear cuenta nueva**
   - Web: https://www.instagram.com/accounts/emailsignup
   - Usuario sugerido: algo consistente con el nombre de la Page (`elperiodico_do`, `elperiodicord`)
2. **Publica al menos 1 post** (foto random). Sin ninguna publicación, IG no permite convertir a Business.
3. **Convierte a Business y vincula a la Page**:
   - Puedes hacerlo desde el app de IG (`Configuración → Cuenta → Cambiar a cuenta profesional → Empresa`) — te ofrece vincular Page al final
   - **Ruta más robusta**: desde https://business.facebook.com → Configuración → Cuentas → **Cuentas de Instagram** → **Agregar** → *Reclamar cuenta de Instagram existente* → login con credenciales IG → vincular a la Page "El Periodico"

### Fase B — Asignar la cuenta IG al System User

En Business Settings → Cuentas → Cuentas de Instagram → tu cuenta IG:
1. Click **"Asignar personas"**
2. Selecciona **`Admin_WhatsApp`** (o el System User que uses para el bot)
3. Permisos: activa **"Administrar la cuenta de Instagram"** o el equivalente que aparezca
4. Guardar

### Fase C — Agregar Caso de Uso IG a la Meta App

**⚠️ Sin este paso, los permisos `instagram_*` NO aparecen** al generar el token del System User (mismo patrón que con Pages).

1. Meta for Developers → tu App
2. Sidebar → **Casos de uso**
3. **Agregar caso de uso** → busca y marca **"Administrar mensajes y contenido en Instagram"** (ícono IG)
4. Habilita → agrega los permisos que se listan

### Fase D — Regenerar el token con permisos IG

1. Business Settings → Usuarios del sistema → tu System User → **Generar token**
2. App: tu App
3. Caducidad: **Nunca**
4. Permisos: además de los `pages_*` (que ya tenías), marca:
   - `instagram_basic`
   - `instagram_content_publish`
   - `business_management`
5. Copia el token — es el nuevo System User Token
6. Cambia por el Page Token real con:
   ```
   GET https://graph.facebook.com/v20.0/me/accounts?access_token=<system-user-token>
   ```
   El `access_token` del array es el que va en `META_PAGE_ACCESS_TOKEN`. Ese mismo Page Token funciona para FB Pages Y para IG (si la cuenta IG está vinculada a la Page).

### Fase E — Obtener el IG User ID (Business Account ID)

```
GET https://graph.facebook.com/v20.0/{page-id}?fields=instagram_business_account,name&access_token=<page-token>
```

Respuesta:
```json
{
  "instagram_business_account": {
    "id": "17841444876777173"   ← este es tu META_IG_USER_ID
  },
  "name": "El Periodico",
  "id": "61592116626896"
}
```

Verifica que puedas leer info de la cuenta IG:
```
GET https://graph.facebook.com/v20.0/{ig-user-id}?fields=username,name&access_token=<page-token>
```

Debe devolver `username` y `name` de tu cuenta IG. Si sale 200 con esos campos → todo listo.

### Variables en el `.env`

```
META_IG_USER_ID=17841444876777173
```

(Los `META_PAGE_ID` y `META_PAGE_ACCESS_TOKEN` ya deberían estar del setup de FB)

### Endpoint de publicación (2 pasos)

**Paso 1 — Crear container:**
```
POST https://graph.facebook.com/v20.0/{ig-user-id}/media
Body:
  image_url:    <URL pública HTTPS del PNG>
  caption:      <texto + hashtags>
  access_token: <page-token>
```
Devuelve: `{ "id": "<container-id>" }`

**Paso 2 — Publicar container:**
```
POST https://graph.facebook.com/v20.0/{ig-user-id}/media_publish
Body:
  creation_id:  <container-id>
  access_token: <page-token>
```
Devuelve: `{ "id": "<ig-media-id>" }`

### ⚠️ Limitación crítica: `image_url` debe ser públicamente accesible por HTTPS

IG **NO acepta upload binary directo** (a diferencia de FB Pages). Facebook descarga la imagen de la URL que le pases.

- `http://backoffice:3000/api/image?path=...` → **no funciona** (URL interna Docker)
- `http://localhost:8080/wp-content/uploads/...` → **no funciona** (localhost no es público, además IG requiere HTTPS)

**Soluciones para producción**:
- Usar el `source_url` de WP cuando WP esté deployado en un dominio HTTPS público
- Storage externo tipo S3/CloudFront/Cloudinary

**Soluciones para desarrollo local**:
- **litterbox.catbox.moe** (RECOMENDADO): endpoint `POST https://litterbox.catbox.moe/resources/internals/api.php` con `reqtype=fileupload`, `time=24h` (1h/12h/24h/72h), `fileToUpload=<binary>`. Devuelve URL como texto plano tipo `https://litter.catbox.moe/xxxxx.jpg`. Sin Cloudflare estricto (funciona desde cualquier User-Agent), sin API key, sin registro. Los archivos duran hasta 72h — suficiente porque IG ya copia la imagen al publicar. Es el que usa el workflow 06 del proyecto.
- **tmpfiles.org**: alternativa parecida pero con downtime frecuente. Respuesta JSON en `data.url`; hay que transformar `tmpfiles.org/xxx` → `tmpfiles.org/dl/xxx` para obtener la URL directa del archivo.
- **catbox.moe/user/api.php**: mismo dueño que litterbox pero perpetuo. Problema: está detrás de Cloudflare con checks estrictos (JS challenge, TLS fingerprint) — bloquea requests programáticos incluso con User-Agent de browser.
- **imgbb.com** o **freeimage.host**: requieren API key (registro gratis). Respuesta JSON estructurada. Más robustos que catbox/litterbox si se necesita algo pro.
- **Segundo ngrok apuntando al backoffice** (`ngrok http 3000`): funciona pero requiere plan Pro para 2 túneles simultáneos.
- **Skip test local de IG**: dejar el workflow listo para cuando WP tenga dominio público y usar el `source_url` de WP directamente.

### Límites y consideraciones

- **25 posts / 24h** por cuenta IG (rate limit del Content Publishing API)
- Caption máximo **2200 caracteres**
- Máximo **30 hashtags** por post
- La imagen debe ser JPEG o PNG, min 320px, max 8192x8192px, aspect ratio entre 4:5 y 1.91:1
- Nuestro template es 1080x1080 (1:1) — dentro del rango
