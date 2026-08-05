# Flujo end-to-end de una publicación

De cómo un mensaje de WhatsApp (o un email) termina siendo un post publicado en WordPress + Facebook + Instagram con imagen, categorías y tags reales del cliente.

## Los 4 pasos

```
1. INGESTA          2. GENERACIÓN       3. APROBACIÓN       4. PUBLICACIÓN
   ─────────           ───────────         ────────────        ──────────────
   WhatsApp/Email  →   DeepSeek IA   →    Backoffice     →   WordPress
                       Puppeteer          (humano)          + Facebook
                                                            + Instagram
```

Cada paso deja rastro en la tabla `publications` cambiando el `status`.

## Estados de una publicación

```
pending → approved → publishing → published
    ↓        ↓                        ↓
 rejected  scheduled ─→ (cron 07) ─→ publishing → published/partial/failed
```

## Paso 1 — Ingesta

**Trigger**: llega un mensaje de WhatsApp al número sandbox de Meta, o un email al inbound address de Postmark.

**Vía Email (workflow 01)**:
1. El redactor manda un email a `<hash>@inbound.postmarkapp.com` (o al alias configurado tipo `redaccion@paginauno.do` si ya se configuró dominio propio)
2. Postmark hace `POST` con JSON a `https://<ngrok>/webhook/email-inbound`
3. `01 Ingest Email` normaliza el payload (soporta formatos Postmark, Mailgun y variantes) → extrae `sender`, `subject`, `text`, `media[]`
4. Inserta en `publications` con `status='pending'` y `source_type='email'`
5. Invoca workflow 03 con el `id`

**Vía WhatsApp (workflow 02)** — con soporte multi-mensaje:

1. Meta hace `POST` al webhook público de N8N: `https://tu-ngrok.ngrok-free.app/webhook/whatsapp-inbound`
2. Ngrok reenvía el request a `http://localhost:5678/webhook/whatsapp-inbound`
3. N8N recibe en el workflow **`02 Ingest WhatsApp`**:
   - **Webhook WhatsApp** captura el payload
   - **Is Inbound Message?** filtra: solo procesa si hay un mensaje real (ignora acks, deliveries, reads)
   - **Parse Message** (Code): extrae `sender`, `text` (con caption de imagen/video/document), `media` (como array), y detecta si el mensaje es solo `LISTO` (regex `/^\s*listo[\s!.✓✅👍]*$/i`)
   - **Upsert Draft** (Postgres CTE): busca si existe draft abierto de ese sender de las últimas 4h. Si existe → concatena texto (doble `\n`) y appendea media al array. Si no existe y el mensaje NO es LISTO → crea nuevo draft con `status='draft'`. Si no existe y ES LISTO → no crea nada (ignora)
   - **Is Closing?** (IF): valida `isClosing == true && upsert devolvió id`
   - **Close Draft** (Postgres): `UPDATE ... SET status='pending' WHERE id=X AND status='draft'`
   - **Trigger Generate Content** invoca el workflow 03 pasándole `{id: <uuid>}`

**Ejemplo real**:
```
09:31  Reportero → [foto] "Alcalde inaugura hospital en Santiago"    → draft creado
09:32  Reportero → "La obra costó 3,500 millones..."                  → append al draft
09:33  Reportero → "Presidieron el acto Víctor Atallah y..."          → append al draft
09:35  Reportero → "LISTO"                                            → draft → pending → 03
```

**Timeouts**:
- Si el reportero deja de escribir más de 4h y vuelve, se abre un draft nuevo (no mezcla eventos distintos).
- Si nunca manda LISTO, el draft queda huérfano en `status='draft'` (visible en la tab "En construcción" del backoffice).

**Resultado en la DB**:
```
id: <uuid>
status: pending
source_type: whatsapp
source_sender: 18092598816
source_text: "Reporte de la alcaldía..."
wp_title: NULL       ← todavía no
wp_body_html: NULL
```

Ver el registro:
```powershell
docker compose exec -T postgres psql -U periodico -d periodico -c "SELECT id, source_type, status, LEFT(source_text, 60) FROM publications ORDER BY received_at DESC LIMIT 3;"
```

## Paso 2 — Generación con IA

**Trigger**: el workflow 02 invoca `03 Generate Content` con el `id`.

**Qué pasa**:

1. **Load Publication** hace `SELECT` de la fila con el `id`
2. **DeepSeek 3-in-1** hace `POST` a `https://api-ap-southeast-1.modelarts-maas.com/openai/v1/chat/completions` con:
   - Modelo: `DeepSeek-V3.2`
   - System prompt: rol "redactor de PaginaUno.Do", tono formal, formato dominicano ("Ciudad. –"), sin H2, múltiples categorías, tags con nombres propios, hashtags para IG separados
   - User: el `source_text`, `source_sender`, `source_subject`
   - `response_format: json_object` (Huawei lo ignora pero se manda por si acaso)
3. **Parse JSON** (nodo Code) limpia el markdown wrapper (```` ```json ```` que Huawei mete) y parsea el JSON — devuelve `{content: {...}}`
4. **Render Image** hace `POST` al `image-renderer` con:
   - Template `article`
   - Variables `title`, `category`, `date`, `image_url` (placeholder `picsum.photos`)
   - Puppeteer renderiza el HTML → PNG 1080×1080 → guarda en `/output/<uuid>.png`
5. **Update Publication** hace `UPDATE` de la fila con:
   - `wp_title`, `wp_body_html`, `wp_excerpt`
   - `wp_categories` (array: ej `{Actualidad, Nacionales, Santo Domingo}`)
   - `wp_tags` (array: ej `{"Luis Abinader", "Ministerio Público"}`)
   - `fb_caption`, `ig_caption`, `hashtags`
   - `image_url` (ruta al PNG generado)

**Resultado en la DB**:
```
id: <uuid>
status: pending (sin cambiar — sigue esperando aprobación)
wp_title: "Abinader anuncia 500 becas del INFOTEP en Barahona, Azua y Bahoruco"
wp_body_html: "<p>Santo Domingo. – El presidente Luis Abinader..."
wp_categories: {Actualidad, Nacionales, Educación, Barahona, Azua}
wp_tags: {"Luis Abinader", INFOTEP, "Rafael Ovalles", Becas, ...}
image_url: /output/9b170092-....png
```

## Paso 3 — Aprobación humana

**Trigger**: el cliente entra al backoffice y ve la publicación en la lista de pendientes.

**Qué pasa técnicamente**:

1. Cliente abre http://localhost:3000
2. Next.js SSR hace `SELECT ... WHERE status IN ('pending', 'approved', 'scheduled')` con Prisma
3. Renderiza la lista con la imagen thumbnail + título + fuente
4. Cliente hace clic en una → `/publication/<uuid>`
5. Página de detalle muestra:
   - Los 3 previews (tabs WordPress, Facebook, Instagram) con la imagen, chips de categorías, tags
   - Panel derecho con botones **Aprobar / Programar / Rechazar**
6. Cliente decide:
   - **Aprobar y publicar ahora** → `POST /api/publications/<id>/approve`
   - **Programar** → `POST /api/publications/<id>/schedule` con `scheduledAt`
   - **Rechazar** → `POST /api/publications/<id>/reject` con `reason` opcional
7. La API route:
   - Actualiza la DB (`status='approved'` o `'scheduled'` o `'rejected'`)
   - Inserta en `audit_log`
   - Dispara el webhook de N8N: `POST http://n8n:5678/webhook/publication-approved` con `{publicationId, event}`

**Resultado en la DB**:
```
id: <uuid>
status: approved (o scheduled o rejected)
approved_by: admin@ejemplo.com
approved_at: 2026-07-22 04:38:58
```

Y en `audit_log` una fila con `action='approve'`.

## Paso 4 — Publicación

**Trigger**: N8N recibe el webhook `publication-approved`.

**Qué pasa**:

### Si `event=approved` (publicar ahora)

1. **Webhook Approval** en workflow `08 Approval Router` captura el request
2. **Extract** extrae `publicationId` y `event`
3. **Publish Now?** valida `event=='approved'` → sigue por rama true
4. **Mark Publishing** hace `UPDATE ... SET status='publishing'`
5. **Fan-out**: dispara EN PARALELO los 3 sub-workflows:
   - **→ WordPress** invoca `04 Publish WordPress`
   - **→ Facebook** invoca `05 Publish Facebook`
   - **→ Instagram** invoca `06 Publish Instagram`

### Dentro del workflow 04 (WordPress)

1. **Load** hace `SELECT` de la fila
2. **Resolve Taxonomy** (Code node):
   - Busca cada nombre de `wp_categories` en `/wp/v2/categories?slug=...` → obtiene IDs
   - Busca cada nombre de `wp_tags` en `/wp/v2/tags?slug=...` → obtiene IDs; los que no existen los CREA con `POST /wp/v2/tags`
3. **Download Image** hace `GET http://backoffice:3000/api/image?path=/output/xxx.png` — descarga el PNG como binary
4. **Upload Media** hace `POST /wp/v2/media` con `Content-Type: image/png` + el binary → WP devuelve `{id: <media_id>, source_url: ...}`
5. **Create Post** (Code node):
   - Hace `POST /wp/v2/posts` con `{title, content, excerpt, status:'publish', categories:[ids], tags:[ids], featured_media: media_id}`
   - Devuelve `{id, link, ...}`
6. **Save WP IDs** hace `UPDATE ... SET wp_post_id, wp_post_url`

### Dentro del workflow 05 (Facebook)

1. **Load** hace `SELECT` de la fila (usa `fb_caption`, `image_url`)
2. **Download Image** hace `GET` al backoffice → binary
3. **Publish Photo** hace `POST /{page_id}/photos` multipart con `source`=binary, `caption`=fb_caption, `access_token`=META_PAGE_ACCESS_TOKEN
4. **Save FB IDs** hace `UPDATE ... SET fb_post_id, fb_post_url`

### Dentro del workflow 06 (Instagram)

1. **Load** hace `SELECT` (usa `ig_caption`, `hashtags`, `image_url`)
2. **Build Caption** concatena `ig_caption` + `\n\n` + hashtags formateados con `#`
3. **Download Image** hace `GET` al backoffice → binary
4. **Upload to ImgBB** hace `POST https://api.imgbb.com/1/upload` multipart → devuelve URL pública HTTPS (`https://i.ibb.co/xxx.jpg`)
5. **Extract Public URL** parsea la respuesta JSON de ImgBB
6. **Create IG Container** hace `POST /{ig_user_id}/media` con `image_url`, `caption`, `access_token` → devuelve `container_id`
7. **Wait 5s** — IG necesita tiempo para descargar la imagen antes de publicar
8. **Publish IG** hace `POST /{ig_user_id}/media_publish` con `creation_id=container_id` → devuelve `ig_media_id`
9. **Save IG IDs** hace `UPDATE ... SET ig_post_id, ig_post_url`

### Volviendo al 08

7. **Merge Results** espera a los 3 sub-workflows (append de outputs)
8. **Mark Published** hace `UPDATE ... SET status='published', published_at=NOW()`

**Resultado final en la DB**:
```
id: <uuid>
status: published
wp_post_id: 42
wp_post_url: http://localhost:8080/abinader-anuncia-500-becas-.../
fb_post_id: 61592116626896_...
fb_post_url: https://www.facebook.com/...
ig_post_id: 18234...
ig_post_url: https://www.instagram.com/p/CxxxxYYY/
published_at: 2026-07-22 04:45:12
```

Y verificable en:
- **WordPress** → Escritorio → Entradas: aparece el post con imagen destacada y categorías
- **Facebook** → tu Page: aparece el post con la imagen
- **Instagram** → cuenta IG Business: aparece el post con caption + hashtags

## Ruta alternativa: publicación programada

Si el cliente presionó **Programar**:
- `status='scheduled'`, `scheduled_at='2026-07-25 09:00:00'`
- El backoffice notifica al 08 con `event='scheduled'` (que la ignora, solo actúa con `approved`)

Cada minuto, el workflow **`07 Scheduled Publisher`** (cron) hace:

```sql
UPDATE publications
SET status = 'publishing'
WHERE id IN (
  SELECT id FROM publications
  WHERE status = 'scheduled' AND scheduled_at <= NOW()
  ORDER BY scheduled_at
  LIMIT 20
  FOR UPDATE SKIP LOCKED
)
RETURNING id;
```

**Filtro anti-ruido**: después del UPDATE, un nodo IF (`Has Due Row?`) valida que `$json.id` no esté vacío. Sin este filtro, el nodo Postgres emite un item con `id=null` cuando no hay filas vencidas, lo que dispararía el webhook a 08 cada minuto con payload inválido y llenaría los logs de errores.

Para cada fila reclamada válida, dispara el workflow 08 con `event='approved'` — que hace el resto normal.

**Por qué `FOR UPDATE SKIP LOCKED`**: en el futuro cuando escales N8N a varias réplicas (queue mode), este SQL garantiza que ninguna publicación se procese dos veces.

## Diagrama de secuencia (aprobar → publicar)

```
User        Backoffice   N8N (08)      N8N (04)     WordPress   Postgres
 │              │            │            │             │           │
 │ click ─────► │            │            │             │           │
 │      Aprobar│UPDATE approved            │             │           │
 │              │──────────────────────────────────────► │           │
 │              │POST webhook│            │             │           │
 │              │───────────►│            │             │           │
 │              │            │UPDATE publishing         │           │
 │              │            │──────────────────────────────────────►│
 │              │            │executeWorkflow           │           │
 │              │            │───────────►│             │           │
 │              │            │            │SELECT       │           │
 │              │            │            │────────────────────────►│
 │              │            │            │GET categories│           │
 │              │            │            │────────────►│           │
 │              │            │            │GET+POST tags │           │
 │              │            │            │────────────►│           │
 │              │            │            │GET image     │           │
 │              │            │            │(backoffice) │           │
 │              │            │            │POST media    │           │
 │              │            │            │────────────►│           │
 │              │            │            │POST post     │           │
 │              │            │            │────────────►│           │
 │              │            │            │UPDATE wp_post_id         │
 │              │            │            │──────────────────────────►│
 │              │            │UPDATE published          │           │
 │              │            │──────────────────────────────────────►│
 │ refresh ──►  │            │            │             │           │
 │              │(SELECT muestra published)             │           │
```

## Cuánto tarda

- Ingesta WhatsApp (webhook → DB): **~200ms**
- Ingesta Email vía Postmark (send → webhook llega): **~5-15s** (depende del provider del remitente)
- Generación con DeepSeek: **5-15s** (Huawei es rápido)
- Render imagen: **~500ms**
- Backoffice ve la publicación: **inmediato** (cuando refresca)
- Aprobación → publicación en los 3 canales:
  - WordPress: ~3-5s (resolver taxonomía + upload media + crear post)
  - Facebook: ~1-2s (POST /photos multipart)
  - Instagram: ~8-12s (upload a ImgBB + create container + wait 5s + publish)
  - Como corren en paralelo, el total es el más lento (~10s)

**Total desde que llega un WA hasta ver el post en los 3 canales**: 15-30s + el tiempo humano de aprobación.
