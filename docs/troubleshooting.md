# Troubleshooting

Errores conocidos que hemos encontrado y cómo resolverlos.

## N8N — gotchas de v2.30

### Gotcha 1 — `executeWorkflowTrigger` no recibe input del botón "Execute Workflow"

**Síntoma**: al ejecutar manualmente un workflow que empieza con `executeWorkflowTrigger`, el input llega vacío `[{}]` y los nodos siguientes fallan porque `$json.id` es `undefined`.

**Causa**: en N8N v2.30 el JSON que pegas al hacer clic en "Execute Workflow" **no se pasa al trigger** — solo se pasa cuando el workflow es invocado desde otro workflow.

**Solución**: usar **Pin Data** en el trigger para tests manuales.
1. Doble click en el trigger
2. Panel OUTPUT → ícono **📌** arriba a la derecha → **Edit output**
3. Pega el JSON: `[{"id": "<uuid>"}]`
4. Save
5. Ahora Execute Workflow usa ese output pinneado

Alternativa permanente: definir un **Workflow Input Schema** en el trigger, así N8N muestra un formulario al ejecutar manualmente.

---

### Gotcha 2 — `queryReplacement` del nodo Postgres v2.5 falla con `undefined`

**Síntoma**: error críptico *"Query Parameters must be a string of comma-separated values or an array of values"*.

**Causa**: la expresión de `queryReplacement` se evaluó a `undefined` (porque el input no tiene el field esperado).

**Solución**: interpolación directa en el SQL en vez de bindings.

---

### Gotcha 2b (CRÍTICO) — node-postgres NO respeta el dollar-quoting de PG

**Síntoma**: error *"Variable $18092598816 exceeds supported maximum of $100000"* (o similar con otro número).

**Causa**: el driver `node-postgres` de N8N parsea la query buscando `$N` (placeholders) ANTES de mandarla al server. Cualquier `$` seguido de dígitos lo interpreta como parámetro numérico, aunque esté DENTRO de un dollar-quoting `$sql$...$sql$`. Los números de teléfono como `18092598816` en el JSON payload causan esto.

**Solución**: NO usar `$tag$...$tag$`. Usar comillas simples con escape estándar:

```
-- Malo:
INSERT ... VALUES ($sql${{ $json.text }}$sql$);

-- Bueno:
INSERT ... VALUES ('{{ String($json.text).replace(/'/g, "''") }}');
```

Aplicar a TODAS las queries INSERT/UPDATE que interpolen datos externos.

---

### Gotcha 3 — Set node v3.4 con `type: object` y expresión que retorna objeto

**Síntoma**: error *"'content' expects a object but we got '=[object Object]'"*.

**Causa**: bug del Set node — cuando el value es una expresión que retorna un objeto, N8N lo serializa como string `"=[object Object]"` en vez de guardar el objeto real.

**Solución**: reemplazar el Set node por un **Code node** (JavaScript, Run Once for All Items). El Code node maneja objetos correctamente.

Ejemplo del `Parse JSON` del workflow 03 — pasó de Set a Code:
```javascript
const raw = $input.first().json.choices[0].message.content;
const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
return { content: JSON.parse(clean) };
```

---

### Gotcha 4 — Huawei ModelArts ignora `response_format: json_object`

**Síntoma**: el prompt pide JSON, `response_format` está configurado, pero la respuesta viene envuelta en ```` ```json ... ``` ```` y `JSON.parse` falla silenciosamente.

**Causa**: DeepSeek oficial respeta `response_format`, pero Huawei ModelArts lo ignora.

**Solución**: limpiar los fences antes de parsear (ya implementado en el Code node `Parse JSON` del workflow 03).

```javascript
const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
JSON.parse(clean);
```

---

### Gotcha 5 — Huawei error `ModelArts.81004`

**Síntoma**: 403 con body `{"error":{"code":"ModelArts.81004","message":"Invalid request because you do not have access to it."}}`

**Causa**: la key es válida (por eso NO es 401) pero no tienes acceso al modelo específico. Puede ser:
- Cuota gratuita agotada
- Suscripción al modelo expiró
- Nombre del modelo en el body no coincide con el alias exacto de Huawei (case-sensitive)
- **Muy común**: usar `DeepSeek-V3` cuando tu cuenta tiene `DeepSeek-V3.2` (o viceversa)

**Solución**: en la consola Huawei → **ModelArts → MaaS → My Subscriptions**, verifica:
- Qué modelo está autorizado en tu cuenta
- Si hay cuota disponible

Actualizar `DEEPSEEK_MODEL` en `.env` y el body del nodo DeepSeek en el workflow 03.

---

### Gotcha 6 — N8N v2.30: `Publish` reemplazó a `Active`

**Síntoma**: no encuentras el toggle "Active" en la UI.

**Causa**: N8N v2.30 renombró el toggle a **Publish** (botón azul arriba a la derecha).

**Solución**: click en **Publish** para activar el workflow. El contador `0/1` cambia a `1/1`.

---

### Gotcha 7 — Sub-workflows por nombre no permite Publicar

**Síntoma**: al intentar Publish, error *"Cannot publish workflow: Node X references workflow Y which is not published"*, aunque Y esté publicado.

**Causa**: el JSON importado tiene el `executeWorkflow` referenciando el sub-workflow por **nombre** (`mode: "name"`), pero N8N v2.30 requiere binding por **ID** para publicar.

**Solución**:
1. Abre el workflow padre
2. Doble click en el nodo `executeWorkflow`
3. En el campo Workflow, click en la **X** del chip actual
4. Abre el dropdown → **re-selecciona** el sub-workflow de la lista
5. Save
6. Ahora sí puedes Publish

También necesitas publicar los sub-workflows PRIMERO. Orden general: hoja → intermedios → los con trigger externo.

---

### Gotcha 8 — Code node: `process`, `require`, `fetch` bloqueados

**Síntoma**: `process is not defined`, `require is not defined`, `fetch is not defined`.

**Causa**: el sandbox VM2 del Code node bloquea acceso a globales de Node por seguridad.

**Solución**:
- Env vars: usar `$env.NOMBRE` (helper de N8N). Requiere `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` en el `.env` del contenedor.
- HTTP: usar `this.helpers.httpRequest({...})` en lugar de `fetch`.
- Utilidades básicas: `Buffer`, `crypto`, `JSON`, `Math` sí están disponibles.
- Módulos como `http`, `fs`: no. Si los necesitas, mejor extraer esa lógica a un nodo HTTP Request nativo.

---

### Gotcha 9 — `this.helpers.httpRequest` con binary body falla en WP media upload

**Síntoma**: al hacer POST binary con Content-Type: image/png desde el Code node, WordPress devuelve 500 aunque el body es correcto.

**Causa**: `this.helpers.httpRequest` serializa mal el Buffer cuando no hay `json: true`.

**Solución**: usar dos nodos **HTTP Request nativos** de N8N (no dentro del Code):
1. **Download Image**: HTTP GET con Response Format = File → genera un `binary.data`
2. **Upload Media**: HTTP POST con `sendBody: true`, `contentType: 'binaryData'`, `inputDataFieldName: 'data'` → sabe manejar el binary correctamente

Ya implementado en el workflow 04 actual.

## WordPress

### Application Password no aparece en el perfil

**Síntoma**: en `/wp-admin/profile.php` aparece *"The application password feature requires HTTPS"*.

**Causa**: WordPress requiere HTTPS para Application Passwords por defecto. Como usamos HTTP local, hay que decirle que es un entorno de desarrollo.

**Solución**: en `docker-compose.yml`, servicio `wordpress`:
```yaml
environment:
  WORDPRESS_CONFIG_EXTRA: |
    define( 'WP_ENVIRONMENT_TYPE', 'local' );
```

Recrear el contenedor: `docker compose up -d --force-recreate wordpress`.

---

### API REST devuelve 404

**Síntoma**: `GET http://localhost:8080/wp-json/wp/v2/categories` devuelve 404.

**Causa**: WordPress no tiene pretty permalinks activados. Sin ellos, la REST API solo responde en `?rest_route=...`.

**Solución**:
- Opción rápida: **Ajustes → Enlaces permanentes → "Nombre de la entrada" → Guardar**
- O usar el fallback `http://localhost:8080/?rest_route=/wp/v2/categories`

El script `import_taxonomy.py` detecta automáticamente cuál usar.

---

### Upload de media devuelve 500

**Síntoma**: `POST /wp/v2/media` devuelve 500 sin body claro.

**Diagnóstico**: probar el upload manualmente con Node fetch desde el contenedor de n8n:
```powershell
docker compose exec -T n8n sh -c 'node -e "..."'
```

Si el upload manual funciona pero desde el Code node no → ver [Gotcha 9](#gotcha-9). Solución: mover el upload a un nodo HTTP Request nativo.

## WhatsApp / Meta

### Meta valida el webhook pero no llega ningún mensaje

**Síntoma**: `Verify and save` en Meta funciona (verde), pero al mandar un WA de prueba no llega nada a N8N.

**Causa**: no suscribiste al campo `messages` en los Webhook fields.

**Solución**: en Meta → WhatsApp → Configuration → **Webhook fields** → al lado de **`messages`** → click **Subscribe** (checkbox verde).

---

### Meta lookaside devuelve 500 al descargar media de WhatsApp

**Síntoma**: `GET https://graph.facebook.com/v20.0/{media-id}` (paso 1) devuelve **200 OK** con un JSON válido que incluye `url`, `mime_type`, `file_size`, etc. Pero al hacer `GET <url>` a esa URL de `lookaside.fbsbx.com` (paso 2), Meta responde **500 Internal Server Error** con body de 21 bytes: `Internal Server Error`.

**Causas verificadas** (nuestro caso, jul 2026):
- No es tema de código: reproducido con node fetch nativo, N8N HTTP node, Python urllib, **Postman**
- No es tema de IP: reproducido desde contenedor Docker, Windows host con ISP normal, y hotspot celular (3 IPs distintas)
- No es media corrupto: reproducido con 3 media-ids distintos, todos con el mismo error
- No es tema de headers ni redirect handling: Postman envía User-Agent + Accept correctos y sigue redirects preservando Auth → también falla con 500
- Bearer token es correcto (los permisos `whatsapp_business_messaging` están granted y el paso 1 los usa OK)
- **Response de Meta**: `500` con header `proxy-status: http_request_error` — indica que el propio proxy interno de Meta falla al procesar el request

**Diagnóstico**: bug conocido de Meta en cuentas WhatsApp Cloud API en **modo Development / sandbox**. El endpoint `lookaside.fbsbx.com` no sirve el binary correctamente para ciertas cuentas sandbox.

**Se resuelve típicamente cuando**:
- La Meta App pasa de **Development → Live mode** (requiere Business Verification)
- Se usa un **número WhatsApp Business real** (no el sandbox provisto por Meta)
- Meta pushea un fix (a veces sin previo aviso)

**Mitigación en el proyecto**:
- Flag `WA_MEDIA_DOWNLOAD_ENABLED` en el `.env` (default `false`) que deshabilita el brazo de descarga en el workflow 03
- El template usa placeholder aleatorio de `picsum.photos` mientras el flag esté en false
- Cuando Meta resuelva o pasemos a Live mode → cambiar a `true` y recrear el contenedor n8n

Reproductor de diagnóstico: `python scripts/test_wa_download.py <media-id>`

### IG rechaza publicación por URL de imagen no pública

**Síntoma**: al invocar `POST /{ig-user-id}/media`, Facebook responde error 100 o similar diciendo que no pudo descargar la imagen.

**Causa**: IG Content Publishing API requiere que `image_url` sea una URL HTTPS accesible desde internet. No acepta `localhost`, IPs internas de Docker, ni HTTP simple.

**Solución actual del proyecto**: **ImgBB** — el workflow 06 sube la imagen a `https://api.imgbb.com/1/upload` y le pasa a IG la URL pública devuelta (`https://i.ibb.co/xxx.jpg`). Ver [guia-integraciones.md — ImgBB](guia-integraciones.md#imgbb--host-p%C3%BAblico-de-im%C3%A1genes-para-instagram).

**Producción** (WP con dominio público): cambiar a usar el `source_url` que devuelve `POST /wp/v2/media` — evita el intermediario ImgBB y ahorra un round-trip.

**Alternativas evaluadas y descartadas**:
- **litterbox.catbox.moe**: cae ~30% del tiempo con 500. Se usó al inicio, se migró a ImgBB tras fallos consecutivos en publicaciones programadas
- **catbox.moe/user/api.php**: Cloudflare bloquea requests programáticos (412 Precondition Failed)
- **tmpfiles.org**: downtime frecuente
- **Segundo ngrok** al backoffice: requiere plan Pro para 2 túneles

### ImgBB responde "Invalid API v1 key"

**Síntoma**: al probar el nodo `Upload to ImgBB` en workflow 06, sale error `Bad request - please check your parameters` con body `Invalid API v1 key.`

**Causa**: la variable `IMGBB_API_KEY` no llegó al contenedor de N8N. Puede ser: (a) key mal copiada con espacios o comillas en `.env`, (b) no está mapeada en `docker-compose.yml`, o (c) N8N no se recreó después de editar `.env`.

**Solución**:

1. Verifica el `.env` — sin comillas ni espacios:
   ```
   IMGBB_API_KEY=0f00example00key00000000000000ab
   ```

2. Verifica que esté mapeada en `docker-compose.yml`, sección `n8n → environment`:
   ```yaml
   IMGBB_API_KEY: ${IMGBB_API_KEY}
   ```

3. Recrea el contenedor (`restart` no basta — hay que releer el compose):
   ```powershell
   docker compose up -d --force-recreate n8n
   ```

4. Verifica que llegó:
   ```powershell
   docker exec pa_n8n printenv IMGBB_API_KEY
   ```
   Debe imprimir tu key. Si sale vacío → algo pasó al editar `.env` o `docker-compose.yml`.

### Workflow 07 lanza ejecuciones cada minuto sin datos

**Síntoma**: en `07 Scheduled Publisher` aparecen ejecuciones cada minuto y algunas fallan con `invalid input syntax for type uuid: "null"` en el `Mark Publishing` del workflow 08.

**Causa (histórica)**: el nodo Postgres del 07 emite un item con `id` vacío/null cuando no hay publicaciones vencidas, y ese null se propagaba al webhook a 08.

**Solución**: ya implementada — el 07 tiene un nodo IF `Has Due Row?` entre `Claim Due` y `Notify 08 via Webhook` que filtra items sin `id`. Si sigues viendo el error, verifica que la versión activa del workflow 07 tenga el nodo IF (reimporta `n8n/workflows/07_scheduled_publisher.json` si falta).

**Nota**: es NORMAL ver ejecuciones cada minuto del 07 en la lista de Executions (es el cron). Lo importante es que:
- Los minutos vacíos: verde end-to-end sin llegar al HTTP
- Los minutos con publicaciones: verde end-to-end incluyendo el webhook a 08

### Al generar el System User Token, no aparecen los permisos `pages_*` (o `instagram_*`)

**Síntoma**: en Meta Business Settings → Usuarios del sistema → Generar token, la lista de "Permisos disponibles" solo muestra permisos de WhatsApp (`whatsapp_business_management`, `whatsapp_business_messaging`) y algún genérico como `manage_app_solution`. Los `pages_show_list`, `pages_manage_posts`, `pages_read_engagement` **no aparecen** para marcar.

Meta muestra un mensaje sutil arriba del selector:
> *"Si los permisos que quieres seleccionar no están disponibles, un administrador de la app tendrá que personalizar o agregar un caso de uso a esta app."*

**Causa**: la Meta App no tiene el caso de uso de Pages agregado. Solo tiene WhatsApp habilitado.

**Solución**:
1. Meta for Developers → tu App → sidebar **Casos de uso** (Use Cases)
2. **Agregar caso de uso** → buscar y marcar según lo que necesites:
   - Para publicar en **Facebook Pages**: **"Administrar todos los aspectos de tu página"** (ícono de bandera) → habilita `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `pages_manage_metadata`, `pages_manage_engagement`
   - Para publicar en **Instagram**: **"Administrar mensajes y contenido en Instagram"** (ícono IG) → habilita `instagram_basic`, `instagram_content_publish`, `business_management`
3. Confirmar y habilitar
4. Volver al modal de Generar token → ahora sí aparecen los nuevos permisos

Después de regenerar el System User Token, siempre hay que **obtener el Page Access Token nuevo** con `GET /me/accounts?access_token=<system-user-token>`. Ese Page Token es el que va en `META_PAGE_ACCESS_TOKEN` y sirve tanto para FB como para IG (mientras la cuenta IG esté vinculada a la Page en Business Portfolio).

### `(#200) This app is not allowed to publish to other users' timelines`

**Síntoma**: al hacer `POST /{page-id}/photos` desde Bruno o N8N, Facebook responde 200 con `{"error":{"code":200,"message":"This app is not allowed to publish to other users' timelines"}}`.

**Causa**: estás usando un **User Access Token** o el **System User Token directamente**, en vez de un **Page Access Token**. Aunque el token tenga los scopes `pages_manage_posts` correctos, hay un paso extra.

**Solución** — obtener el Page Access Token real:

```
GET https://graph.facebook.com/v20.0/me/accounts?access_token=<user-or-system-user-token>
```

Devuelve un array con cada Page y su `access_token` propio. Ese `access_token` es el Page Token que va en `META_PAGE_ACCESS_TOKEN`.

Si `/me/accounts` devuelve `{"data":[]}` → el usuario/System User no tiene ninguna Page asignada. Volver a Business Settings → Users → asignar la Page al usuario con "Create content" / "Manage".

### `Invalid Scopes: manage_pages, pages_show_list`

**Síntoma**: al intentar autorizar permisos en Graph API Explorer o Facebook Login, aparece un popup con *"Invalid Scopes: manage_pages, pages_show_list. This message is only shown to developers."*

**Causa**: la app tiene configurado el scope deprecated `manage_pages` (removido por Meta en 2021). El flujo OAuth lo pide y Facebook lo rechaza.

**Solución**: usar el System User Token en lugar del flujo OAuth de Graph API Explorer. El System User no pasa por el flujo OAuth público — genera el token internamente con los permisos que asignes explícitamente. Ver [guia-integraciones.md](guia-integraciones.md#setup-del-system-user).

Alternativamente (más difícil): buscar dónde está configurado `manage_pages` en la App y quitarlo — típicamente en un manifest de Facebook Login desactualizado.

### Meta reporta "No se pudo validar el webhook"

**Síntoma**: al configurar el Callback URL, Meta dice *"No se pudo validar la URL de devolución de llamada o el token de verificación"*.

**Causas posibles y diagnóstico**:

1. **Workflow 02 no publicado**: prueba local:
   ```powershell
   curl "http://localhost:5678/webhook/whatsapp-inbound?hub.mode=subscribe&hub.verify_token=periodico-verify-2026&hub.challenge=test123"
   ```
   Debe devolver `test123`. Si devuelve 404 → publica el workflow 02.

2. **URL de ngrok cambió**: verifica que el Callback URL en Meta apunte a tu URL actual de ngrok (la de la sesión activa, no una vieja).

3. **Verify Token no coincide**: el token en el `.env` (`WA_VERIFY_TOKEN`) debe coincidir literalmente con el que pusiste en Meta.

---

### El caption de mensajes con imagen queda vacío

**Síntoma**: mandas un WA con imagen + caption y en la DB `source_text` es `""`.

**Causa**: el caption de mensajes tipo `image`, `video`, `document` NO está en `messages[0].caption`, sino en `messages[0].image.caption` (o `.video.caption`, `.document.caption`).

**Solución**: ya arreglada en el workflow 02. El campo `text` del Normalize usa:
```javascript
m.text?.body || m.image?.caption || m.video?.caption || m.document?.caption || ''
```

## Ngrok

### El túnel se cayó / la URL cambió

**Síntoma**: los webhooks dejaron de llegar; ngrok dashboard (localhost:4040) no responde.

**Causa**: cerraste la terminal de ngrok, o el plan free tiene alguna restricción.

**Solución**: levanta uno nuevo:
```powershell
ngrok http 5678
```

Copia la nueva URL de Forwarding. Actualiza el Callback URL en Meta (con la nueva URL) y re-verifica.

**Recomendación permanente**: pagar ngrok Pro (~$8/mes) para tener URL fija, o usar Cloudflare Tunnel gratis con dominio propio.

## Docker

### `docker compose up` tarda mucho

**Causa**: primera vez, `image-renderer` compila Chromium para Puppeteer (~5 min) y `backoffice` compila Next.js (~3 min).

**Solución**: espera. En reboots subsecuentes tarda 30-60s.

Si algo falla en el build:
```powershell
docker compose logs image-renderer
docker compose logs backoffice
```

---

### El backoffice se reinicia en loop

**Síntoma**: `docker compose ps` muestra `Restarting`.

**Diagnóstico**:
```powershell
docker compose logs backoffice --tail 50
```

Causas comunes:
- **Prisma P3005** ("schema is not empty") → antes teníamos `prisma migrate deploy` en el CMD; ya lo quitamos. Si vuelves a verlo, revisa el `Dockerfile` del backoffice.
- **Falta env var** → revisa el `.env` y compara con `.env.example`.

---

### El schema PG no se aplicó

**Síntoma**: `SELECT * FROM publications` devuelve *"relation does not exist"*.

**Causa**: el `db/init.sql` solo se ejecuta si el volumen `postgres_data` está VACÍO al arrancar por primera vez.

**Solución**: aplicar el schema manualmente:
```powershell
docker compose exec -T postgres psql -U periodico -d periodico < db/init.sql
```

O nuke y rearranca (⚠️ pierdes datos):
```powershell
docker compose down -v
docker compose up -d
```

## Cómo diagnosticar cualquier problema

1. **Logs del contenedor sospechoso**:
   ```powershell
   docker compose logs <nombre_servicio> --tail 100
   ```
2. **En N8N**: **Executions** — ver qué nodo se puso rojo y click para ver el error específico
3. **En el backoffice**: `docker compose logs backoffice -f` para ver requests en vivo
4. **DB directamente**:
   ```powershell
   docker compose exec -T postgres psql -U periodico -d periodico
   ```
5. **Ngrok dashboard**: http://localhost:4040 muestra cada request que entra por el túnel con status y body
