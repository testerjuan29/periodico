# Guía de N8N

Todo lo que necesitas saber sobre los workflows del proyecto.

## Qué es N8N y por qué lo usamos

N8N es un orquestador visual de workflows. Cada "workflow" es un grafo de nodos conectados donde:
- **Nodos trigger** disparan la ejecución (webhook, cron, manual, sub-workflow)
- **Nodos de acción** hacen algo (query a DB, HTTP request, transformación de datos)
- Los datos fluyen del output de un nodo al input del siguiente

En este proyecto N8N es el "sistema nervioso" que conecta todo: recibe webhooks de Meta, llama a DeepSeek, invoca al image-renderer, guarda en Postgres, publica en WordPress.

## Versión y particularidades

Estamos en **N8N v2.30.x**. Cambios importantes vs versiones anteriores:
- El toggle "Active" se llama **"Publish"** (botón azul arriba a la derecha)
- Los sub-workflows llamados por `executeWorkflow` **también deben estar publicados** — antes no era necesario
- Env vars en Code node requieren `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`
- `fetch()` NO está disponible en el Code node → usar `this.helpers.httpRequest`

Ver [Troubleshooting](troubleshooting.md) para todos los gotchas.

## Los 8 workflows

| # | Nombre | Trigger | Qué hace |
|---|---|---|---|
| 01 | `01 Ingest Email` | Webhook `POST /webhook/email-inbound` | Recibe correo de Mailgun/Postmark → normaliza → inserta en DB → invoca 03 |
| 02 | `02 Ingest WhatsApp` | Webhook `GET/POST /webhook/whatsapp-inbound` | GET valida token con Meta. POST recibe mensaje → normaliza → inserta → invoca 03 |
| 03 | `03 Generate Content` | Interno (executeWorkflowTrigger) | SELECT publicación → DeepSeek 3-en-1 → parse JSON → renderiza imagen → UPDATE con contenido |
| 04 | `04 Publish WordPress` | Interno | SELECT → resuelve categorías/tags a IDs → descarga PNG → sube a WP Media → POST post → UPDATE con wp_post_id |
| 05 | `05 Publish Facebook` | Interno | Similar a 04 pero contra Meta Graph API (pendiente ampliar como 04) |
| 06 | `06 Publish Instagram` | Interno | 2 pasos: crear container + publish (Meta Graph API) |
| 07 | `07 Scheduled Publisher` | Cron cada minuto | Busca `status='scheduled' AND scheduled_at <= NOW()` → dispara 08 |
| 08 | `08 Approval Router` | Webhook `POST /webhook/publication-approved` | Recibe aviso del backoffice → fan-out a 04, 05, 06 → merge → marca published |

**Versión simplificada disponible**: `08_approval_router_wp_only.json` — solo con WordPress, para probar mientras FB/IG no están.

## Cómo importar workflows

1. En N8N: **Workflows** (sidebar) → botón **⋮** arriba a la derecha → **Import from File**
2. Selecciona el archivo JSON de `n8n/workflows/`
3. Se abre el editor con el workflow

## Cómo conectar credentials

Después de importar, los nodos que necesitan credentials aparecen con **borde rojo** y un aviso.

1. **Doble click** en el nodo
2. En el campo **Credential** hay un dropdown vacío
3. Selecciona la credential correspondiente (`Postgres Periodico`, `DeepSeek Bearer`, `WordPress Basic`)
4. Cierra el modal → el borde rojo desaparece

Ver [Setup desde cero — Paso 4](setup-desde-cero.md#41--credentials) para crear las credentials.

## Cómo publicar un workflow

Botón azul **Publish** arriba a la derecha.

**⚠️ Regla de dependencias**: para publicar un workflow con webhook, sus sub-workflows (los invocados con `executeWorkflow`) también deben estar publicados. Orden correcto:

```
1. Publica 03 Generate Content
2. Publica 04 Publish WordPress
3. Publica 08 Approval Router  ← depende de 03 y 04
4. Publica 02 Ingest WhatsApp  ← depende de 03
5. Publica 07 Scheduled Publisher  ← depende de 08
```

Si te sale *"Cannot publish workflow: Node X references workflow Y which is not published"*:
- Verifica que Y esté publicado
- Si Y sí lo está pero sigue el error → el nodo `executeWorkflow` está referenciando por nombre en vez de por ID. Fix: doble click en ese nodo → borrar la selección del campo Workflow → re-seleccionar Y del dropdown (esto lo cambia a binding por ID).

## Cómo debugear un workflow

### Executions

Pestaña **Executions** dentro del workflow o global (**http://localhost:5678/home/executions**). Cada ejecución muestra el flujo nodo por nodo.

- Verde = OK
- Rojo = falló
- Gris = no se ejecutó (rama no tomada)

Click en una ejecución → ves los inputs y outputs de cada nodo.

### Execute step

En el editor, click en un nodo → botón **Execute step** arriba a la derecha (naranja). Corre solo ese nodo con el input del anterior. Útil para iterar rápido.

### Pin data

Para ejecutar manualmente un workflow que tiene trigger `executeWorkflowTrigger` (que normalmente recibe input de otro workflow), hay que "pinnear" un output al trigger:

1. Doble click en el trigger
2. Panel **OUTPUT** → ícono **📌** arriba a la derecha → **Edit output**
3. Pega el JSON de prueba: `[{"id": "<uuid>"}]`
4. Save
5. **Execute Workflow** → ahora el trigger devuelve ese dato pinneado

### Ver logs del contenedor

```powershell
docker compose logs n8n --tail 50
docker compose logs n8n -f    # follow en vivo
```

## Cómo modificar un workflow

Dos opciones:

**A) Editar in-place en la UI** — rápido, sin perder credentials/bindings. Recomendado para cambios pequeños.

**B) Editar el archivo JSON del repo + re-importar** — pierdes credentials y bindings, hay que reconectarlos. Recomendado cuando el cambio es grande y quieres versionarlo bien.

En ambos casos: **Save + Publish** para que los cambios apliquen.

## Ejecutar workflows manualmente (test)

Para probar el flujo sin recibir un mensaje real:

```powershell
# Insertar una publicación fake
docker compose exec -T postgres psql -U periodico -d periodico -f scripts/test_insert.sql

# Copia el UUID que devuelve
# En N8N: workflow 03 → pin data al trigger con {"id": "<uuid>"} → Execute Workflow
```

Después puedes probar el circuito de aprobación con Bruno o curl:

```powershell
curl -X POST http://localhost:5678/webhook/publication-approved `
  -H "Content-Type: application/json" `
  -d '{"publicationId": "<uuid>", "event": "approved"}'
```

## Estructura de un workflow (para versionar)

Los archivos JSON en `n8n/workflows/` son la fuente de verdad **como plantilla**. Al importarlos en N8N:
- Los IDs de credentials se pierden — hay que reconectar
- Los IDs de sub-workflows referenciados por nombre no se resuelven — hay que re-seleccionar del dropdown

Por eso los JSONs sirven para:
- Levantar el sistema en una máquina nueva
- Ver el diseño y las queries versionadas
- Compartir cambios (ej: prompt de DeepSeek, SQL de un INSERT)

Pero NO son "importables al 100%" en cada actualización. Ver [gotcha #7](troubleshooting.md#gotcha-7).

## Variables de entorno accesibles en N8N

Todo lo que pongas en el `.env` (y esté referenciado en `docker-compose.yml`) está disponible como:
- `$env.NOMBRE` desde el Code node (requiere `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`)
- `{{ $env.NOMBRE }}` desde cualquier expresión

Variables actualmente disponibles en n8n:
- `DEEPSEEK_API_KEY`, `DEEPSEEK_API_URL`
- `WP_INTERNAL_URL` (=`http://wordpress`), `WP_APP_USER`, `WP_APP_PASSWORD`
- `WA_VERIFY_TOKEN`
- `IMAGE_RENDERER_URL` (=`http://image-renderer:3001`)
- `BACKOFFICE_INTERNAL_URL` (=`http://backoffice:3000`)

## Best practices aprendidas

1. **No usar `$sql$...$sql$`** (dollar-quoting de PG) en queries — node-postgres no lo respeta y rompe con valores tipo `$número`. Usar `'{{ String(x).replace(/'/g, "''") }}'` en su lugar.
2. **Cada sub-workflow debe ser tolerante a inputs con distintos nombres de key**. Ej: `$json.publicationId || $json.id` porque a veces se invoca con un nombre y a veces con el otro.
3. **Publish luego de cada cambio** — Save no es suficiente, el webhook usa la versión publicada.
4. **Ojo con re-importar** — pierdes bindings y credentials. Editar in-place es más seguro para cambios pequeños.
