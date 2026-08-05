# Arquitectura

## Vista de alto nivel

```
                     ┌─────────────┐
                     │  Ngrok      │  ← túnel para exponer N8N a Meta y Postmark
                     └──────┬──────┘
                            │
        Meta WhatsApp ──────┤
        Postmark Email ─────┤
                            ▼
                   ┌────────────────┐
                   │      N8N       │  ← orquestador de workflows
                   │  (contenedor)  │
                   └──┬────────────┬┘
                      │            │
      ┌───────────────▼┐          ┌▼──────────────────┐
      │  DeepSeek V3.2 │          │  image-renderer   │
      │  (Huawei MaaS) │          │  Puppeteer 1080²  │
      └────────────────┘          └───────┬───────────┘
                      │                   │
                      │                   ▼
                      │           volumen compartido (PNG)
                      │                   │
                      ▼                   │
              ┌──────────────┐            │
              │  PostgreSQL  │            │
              │ publications │            │
              └──────┬───────┘            │
                     │                    │
                     ▼                    │
              ┌─────────────┐  ← muestra ─┘
              │  Backoffice │  (Next.js 15 + Prisma)
              │  aprobación │
              └──────┬──────┘
                     │  webhook al aprobar (o cron 07)
                     ▼
                ┌────────────────┐
                │   N8N publica  │  ← fan-out paralelo a 3 canales
                └────────────────┘
                 │      │        │
                 ▼      ▼        ▼
             WordPress  FB      IG (Graph)
              (v6.6)  (Graph)   ↑
                                │
                          ┌─────┴─────┐
                          │   ImgBB   │  ← host público de imagen
                          │  (IG lo   │     (IG requiere URL HTTPS)
                          │ requiere) │
                          └───────────┘
```

## Servicios en Docker Compose

6 servicios, definidos en [`docker-compose.yml`](../docker-compose.yml):

| Servicio | Imagen | Volúmenes | Depende de |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | `postgres_data` + `db/init.sql` | — |
| `wp_db` | `mariadb:11` | `wp_db_data` | — |
| `wordpress` | `wordpress:6.6-php8.3-apache` | `wp_data` | `wp_db` |
| `n8n` | `n8nio/n8n:latest` | `n8n_data`, `n8n/workflows`, `templates` | `postgres` (healthy) |
| `image-renderer` | build local | `templates` (ro), `image_output` | — |
| `backoffice` | build local | `image_output` (ro) | `postgres` (healthy) |

**Red interna**: `pa_net` (bridge). Los servicios se llaman entre sí por nombre DNS (ej: `http://wordpress`, `http://postgres:5432`).

**Volumen compartido crítico**: `image_output` — lo escribe `image-renderer` y lo lee `backoffice` para servir las imágenes generadas.

## Base de datos

- **`postgres` (contenedor)** hospeda 2 bases:
  - `periodico` — tabla `publications` (dominio del proyecto), `users`, `audit_log`
  - `n8n` — schema interno de N8N (workflows, executions, credentials)

Schema completo en [`db/init.sql`](../db/init.sql). Ver [referencia DB](referencia-db.md) para detalle de columnas.

## Decisiones técnicas clave

### Por qué N8N como orquestador
- Cliente pidió N8N explícitamente en el brief.
- Buena UI visual para debug (Executions muestra el flujo nodo por nodo con inputs y outputs).
- Ecosistema maduro de nodos para APIs externas (HTTP, Postgres, WordPress, Meta, etc.).
- Deployable en Docker sin configuración adicional.

### Por qué Next.js 15 para el backoffice
- Cliente pidió framework JS/TS.
- App Router permite SSR/RSC — el dashboard con lista de publicaciones se renderiza server-side con Prisma sin necesidad de API intermedia.
- Ecosystem grande de UI (Tailwind, shadcn/ui) para prototipar rápido.

### Por qué DeepSeek vía Huawei ModelArts
- El cliente ya tenía cuenta y crédito en Huawei Cloud.
- OpenAI-compatible API — se usa como si fuera OpenAI SDK.
- Buena calidad en español y precio muy bajo.
- **Ojo**: el modelo autorizado es `DeepSeek-V3.2`, no `DeepSeek-V3` (ver [gotcha](troubleshooting.md)).

### Por qué Puppeteer para las imágenes
- Template en HTML/CSS es más fácil de iterar que Photoshop.
- El cliente puede pasar un diseño Figma → HTML y funciona.
- Renderiza a 1080×1080 (formato IG cuadrado) sin dependencias externas.

### Por qué WordPress dockerizado
- Cliente usa WordPress en producción (JNews theme).
- Poder simular su instancia local acelera el desarrollo del prompt y validación editorial.
- Import de taxonomía real vía script Python ([`import_taxonomy.py`](../scripts/import_taxonomy.py)).

### Por qué schema PG administrado por SQL, no por Prisma migrations
- Prisma actúa solo como cliente tipado del backoffice.
- El schema real vive en [`db/init.sql`](../db/init.sql) y lo administra el DBA.
- Prisma tiene una copia espejada en [`prisma/schema.prisma`](../backoffice/prisma/schema.prisma) sin migrations.
- Simplifica el arranque (`docker-entrypoint-initdb.d` corre `init.sql` al primer arranque).
- Migraciones ad-hoc se hacen con `ALTER TABLE` directo desde `docker exec`.

## Flujo de datos crítico: la imagen

La imagen generada por el `image-renderer` viaja por 3 sitios:

1. **image-renderer** genera el PNG y lo guarda en `/output/<uuid>.png` (dentro del volumen `image_output`).
2. **backoffice** lee ese volumen (montado como `/image-output` ro) y sirve el PNG via `/api/image?path=/output/<uuid>.png`.
3. **N8N** (workflow 04) descarga el PNG desde `http://backoffice:3000/api/image?path=...` y lo re-uploadea a WordPress via `/wp/v2/media`.

**Por qué no montar el volumen directamente en WordPress**: cambiar el volumen requeriría recrear el contenedor de WP y ajustar permisos. La ruta actual mantiene WP autocontenido (solo interactúa por REST API).

## Human-in-the-loop

**Requisito editorial del cliente**: nada se publica sin aprobación explícita.

Implementación:
- `status='pending'` al insertar la publicación
- Backoffice muestra pending → cliente aprueba/programa/rechaza
- Solo al aprobar se dispara el webhook a N8N que publica

**Estado `scheduled`**: si el cliente elige "Programar", la publicación queda en `scheduled` con `scheduled_at`. El workflow `07 Scheduled Publisher` (cron cada minuto) reclama las que ya vencieron y las dispara.

## Persistencia y auditoría

Toda acción del backoffice (aprobar, rechazar, programar) genera una fila en `audit_log` con actor, timestamp y payload. Trazabilidad completa de quién publicó qué.

## Dependencias externas

Servicios externos de los que depende el MVP en runtime:

| Servicio | Rol | Free tier | Fallback si falla |
|---|---|---|---|
| **Meta Graph API** | WhatsApp inbound + FB/IG publishing | Ilimitado en sandbox | — (bloqueante) |
| **Huawei ModelArts** | DeepSeek para generar contenido | Cuota mensual gratis (~1M tokens) | — (bloqueante) |
| **Postmark** | Email inbound | 100 correos/mes | — (bloqueante para ingesta email) |
| **ImgBB** | Host público de imágenes para IG | Ilimitado | IG falla, WP y FB siguen |
| **ngrok** | Túnel público para webhooks (WA + Email) | 1 túnel simultáneo | — (bloqueante para ingesta externa) |

## Lo que NO está en el MVP

- **Multi-usuario en el backoffice** — hay login con un usuario estático (`ADMIN_USER`/`ADMIN_PASSWORD`, cookie firmada, sin roles). Para varios editores con identidad propia, migrar a NextAuth con magic link
- **Notificaciones al editor** — cuando llega una nueva publicación no se avisa por WA/email
- **Deploy a producción** — todo corre en Docker local; falta config para servidor + dominio HTTPS público para WordPress
- **Manejo de errores parciales en publicación** — si FB publica pero IG falla, la publicación queda en `publishing` en vez de `partial/failed`. Falta lógica de reconciliación en el 08
- **Retry automático de publicaciones fallidas** — hoy hay que re-aprobar manualmente
- **Tests automatizados** — no hay suite de tests unitarios ni e2e
