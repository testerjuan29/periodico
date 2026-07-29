# Workflows de N8N

8 workflows JSON listos para importar. Después de importarlos hay que **conectarles las 3 credentials** que N8N usa (los JSON traen placeholders `REPLACE_WITH_*_CRED_ID`, pero N8N los asocia automáticamente por nombre cuando la credential existe con el mismo nombre que aparece en el nodo).

## 1. Crear las credentials en N8N (una sola vez)

Entra a http://localhost:5678 → **Credentials** → **New**:

### a) Postgres Periodico (tipo: Postgres)

| Campo | Valor |
|---|---|
| Host | `postgres` |
| Database | `periodico` |
| User | valor de `POSTGRES_USER` del `.env` |
| Password | valor de `POSTGRES_PASSWORD` |
| Port | `5432` |
| SSL | disable |

### b) DeepSeek Bearer (tipo: Header Auth)

| Campo | Valor |
|---|---|
| Name | `Authorization` |
| Value | `Bearer ` + tu `DEEPSEEK_API_KEY` (ojo con el espacio después de Bearer) |

### c) WordPress Basic (tipo: Basic Auth)

| Campo | Valor |
|---|---|
| User | usuario de WordPress (ej. `admin`) |
| Password | **Application Password** creado en `/wp-admin/profile.php` (formato `xxxx xxxx xxxx xxxx xxxx xxxx`) |

### d) Meta Graph Bearer (tipo: Header Auth)

| Campo | Valor |
|---|---|
| Name | `Authorization` |
| Value | `Bearer ` + tu Page Access Token de Meta Graph API (el mismo token sirve para publicar en FB Page y en la cuenta de IG Business vinculada) |

## 2. Variables de entorno adicionales en N8N

Añade estas al `.env` y reinicia `docker compose up -d n8n`:

```
META_PAGE_ID=123456789012345          # ID numérico de tu Facebook Page
META_IG_USER_ID=17841400000000000     # IG Business User ID (lo obtienes con /me/accounts?fields=instagram_business_account)
```

Docker-compose las pasa como variables de entorno al contenedor de N8N, y los workflows las leen con `{{ $env.META_PAGE_ID }}`.

## ⚠️ Gotcha importante para N8N v2.30+

Después de importar cualquier workflow que tenga un nodo **Execute Workflow** (los sub-workflows `04`, `05`, `06` invocados por `08`; `03` invocado por `01/02`, etc.), hay que **re-seleccionar el sub-workflow desde el dropdown**:

1. Doble click en el nodo `Execute Workflow` (ej: `→ WordPress` dentro de `08`)
2. En el campo **Workflow**, click en la X del chip para borrar la selección actual
3. Abre el dropdown → busca y **selecciona el workflow** de la lista
4. Save

Sin este paso, al intentar Publicar el workflow padre sale:
> Cannot publish workflow: Node "X" references workflow Y which is not published

Aunque el sub-workflow SÍ esté publicado. Es porque el JSON importado usa `mode: "name"` y N8N necesita `mode: "id"` con el ID interno de esta instalación (que es distinto en cada N8N).

## 3. Importar los workflows

En N8N: **Workflows → ⋮ (menú) → Import from File** — importar los 8 archivos en este orden (por dependencias):

1. `03_generate_content.json`
2. `04_publish_wordpress.json`
3. `05_publish_facebook.json`
4. `06_publish_instagram.json`
5. `08_approval_router.json`  (invoca 04, 05, 06)
6. `01_ingest_email.json`     (invoca 03)
7. `02_ingest_whatsapp.json`  (invoca 03)
8. `07_scheduled_publisher.json`  (invoca 08)

## 4. Activar los workflows con trigger externo

Los que hay que **activar con el toggle Active** (los demás son llamados por otros y no necesitan activarse):

- `01 Ingest Email`
- `02 Ingest WhatsApp`
- `07 Scheduled Publisher`
- `08 Approval Router`

## 5. Webhooks públicos

Estas 3 URLs necesitan ser accesibles desde internet (usa Cloudflare Tunnel, ngrok o un dominio propio):

| Workflow | URL en N8N |
|---|---|
| Email | `POST /webhook/email-inbound` |
| WhatsApp | `POST /webhook/whatsapp-inbound` |
| Approval (interno, desde el backoffice) | `POST /webhook/publication-approved` |

Con la URL pública en la mano:
- **Mailgun/Postmark**: configura una "route" o "inbound" que haga POST a `/webhook/email-inbound`
- **WhatsApp Business Cloud**: en Meta for Developers → tu App → WhatsApp → Configuration → **Callback URL** = `.../webhook/whatsapp-inbound`; Verify Token = el que pusiste en `WA_VERIFY_TOKEN`

## Mapa de flujo

```
Email ─┐                       ┌─→ 04 WordPress ─┐
       ├─→ 03 Generate ─→ [pending]              │
WA ────┘         ↑                               │
                 │      ┌─────────────────────────┤
    [Backoffice aprueba]│                        │
                 │      ↓                        │
                 └─ 08 Approval Router ──────────┼─→ 05 Facebook ──┼─→ [published]
                        ↑                        │
                        │                        └─→ 06 Instagram ─┘
                        │
                 07 Scheduled (cron 1 min)
                 (busca status=scheduled, dispara 08)
```

## Notas técnicas

- **Ejecución en paralelo**: el nodo `Mark Publishing` de `08` envía en paralelo a WP/FB/IG. Cada publisher (04/05/06) hace su UPDATE independiente en `publications`, y `Merge Results` espera a los 3 antes de marcar `status='published'`.
- **Errores parciales**: si un publisher falla, el `publish_errors` JSONB en `publications` queda vacío por ahora. Para MVP no bloqueamos el flujo — se puede añadir manejo con nodo `Error Trigger` en cada publisher si se necesita.
- **Foto original**: el workflow `03` hoy usa `https://picsum.photos/1080/720` como foto placeholder. Cuando se defina cómo extraer la imagen del correo/WA (adjunto → guardarlo → URL pública), reemplazar ese valor por `{{ $json.source_media[0].url }}` o similar.
- **Prompt de DeepSeek**: está inline en el JSON del workflow `03`. Es un buen punto de partida — se itera desde la UI de N8N y se re-exporta el JSON para versionar cambios.
