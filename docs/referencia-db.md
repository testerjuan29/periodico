# Referencia de la base de datos

## Estructura general

PostgreSQL 16 en el contenedor `pa_postgres`, expuesto en el puerto 5432 del host. Contiene 2 bases:

- **`periodico`** — dominio del proyecto (esta guía)
- **`n8n`** — schema interno de N8N (workflows, executions, credentials). No la tocamos manualmente.

Conexión desde el host:
```
Host:     localhost
Port:     5432
User:     periodico  (valor de POSTGRES_USER)
Password: <POSTGRES_PASSWORD>
Database: periodico
SSL:      disable
```

Desde otros contenedores (N8N, backoffice): mismo user/pass/db, pero host es `postgres` (nombre DNS).

## Tabla principal: `publications`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | Identificador único, generado por `gen_random_uuid()` |
| `source_type` | TEXT | `'email'` o `'whatsapp'` |
| `source_raw` | JSONB | Payload original del webhook completo |
| `source_sender` | TEXT | Correo o número de teléfono |
| `source_subject` | TEXT | Asunto (solo email) |
| `source_text` | TEXT | Texto del mensaje (o caption si es imagen WA) |
| `source_media` | JSONB | Metadata de adjuntos: `{id, url, mime_type, caption}` |
| `received_at` | TIMESTAMPTZ | Momento de recepción |
| `wp_title` | TEXT | Título generado por DeepSeek |
| `wp_body_html` | TEXT | Cuerpo HTML del artículo (`<p>...`, sin `<h2>`) |
| `wp_excerpt` | TEXT | Resumen para SEO (≤200 chars) |
| `wp_category` | TEXT | **Legacy** — categoría singular; ahora se usa `wp_categories` |
| `wp_categories` | TEXT[] | Nombres de categorías (ej: `{Actualidad, Nacionales, Santo Domingo}`) |
| `wp_tags` | TEXT[] | Nombres de tags (ej: `{"Luis Abinader", INFOTEP}`) |
| `fb_caption` | TEXT | Post de Facebook |
| `ig_caption` | TEXT | Caption de Instagram (sin hashtags) |
| `hashtags` | TEXT[] | Hashtags para IG (sin `#`, minúsculas) |
| `image_url` | TEXT | Ruta al PNG en el volumen (ej: `/output/xxx.png`) |
| `image_meta` | JSONB | Metadata del render (dimensiones, template usado, etc.) |
| `status` | TEXT | Ver [estados](#estados) |
| `scheduled_at` | TIMESTAMPTZ | Si `status='scheduled'`, cuándo publicar |
| `approved_by` | TEXT | Email del cliente que aprobó |
| `approved_at` | TIMESTAMPTZ | Momento de aprobación |
| `rejected_reason` | TEXT | Motivo si se rechazó |
| `wp_post_id` | TEXT | ID del post en WordPress |
| `wp_post_url` | TEXT | URL pública del post |
| `fb_post_id` | TEXT | ID del post en Facebook Page |
| `fb_post_url` | TEXT | URL del post en FB |
| `ig_post_id` | TEXT | ID del post en Instagram |
| `ig_post_url` | TEXT | URL del post en IG |
| `publish_errors` | JSONB | Errores por plataforma si `status='partial'` o `'failed'` |
| `published_at` | TIMESTAMPTZ | Momento de publicación exitosa |
| `created_at` | TIMESTAMPTZ | Auto (default NOW) |
| `updated_at` | TIMESTAMPTZ | Auto (trigger `set_updated_at` al UPDATE) |

### Estados

Definidos como CHECK constraint. Transiciones posibles:

```
pending ──approve──► approved ──(N8N inicia)──► publishing ──► published
                                                             └─► partial
                                                             └─► failed
       ──schedule──► scheduled ──(cron 07)──► publishing ──► ...

       ──reject──► rejected
```

| Estado | Significado |
|---|---|
| `pending` | Recién generada por IA, esperando aprobación |
| `approved` | Cliente aprobó, N8N está a punto de procesarla |
| `scheduled` | Aprobada + programada para `scheduled_at` |
| `publishing` | N8N está publicando en las plataformas (bloqueo pesimista) |
| `published` | Publicada exitosamente en todas las plataformas configuradas |
| `partial` | Publicada en algunas plataformas, error en otras (ver `publish_errors`) |
| `failed` | Falló completamente (ver `publish_errors`) |
| `rejected` | Cliente rechazó |

### Índices

- `idx_publications_status` — para filtrar por estado en el dashboard
- `idx_publications_received_at` (DESC) — para el orden natural
- `idx_publications_scheduled_due` — partial index sobre `scheduled_at WHERE status='scheduled'` para el cron

## Tabla `users` — login del backoffice

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | — |
| `email` | TEXT UNIQUE | Login |
| `name` | TEXT | Nombre para mostrar |
| `role` | TEXT | `admin` \| `approver` \| `viewer` |
| `created_at` | TIMESTAMPTZ | — |

**Todavía no se usa** — pendiente auth (NextAuth). La tabla existe para cuando se implemente.

## Tabla `audit_log` — trazabilidad

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | — |
| `publication_id` | UUID FK → publications | Puede ser NULL para acciones no ligadas a una publicación |
| `actor_email` | TEXT | Quién hizo la acción |
| `action` | TEXT | `approve`, `schedule`, `reject`, etc. |
| `payload` | JSONB | Datos adicionales (ej: motivo del reject, scheduled_at) |
| `created_at` | TIMESTAMPTZ | — |

Cada acción del backoffice inserta una fila aquí.

## Queries útiles

### Ver últimas 5 publicaciones con estado
```sql
SELECT id, source_type, status, wp_title, received_at
FROM publications ORDER BY received_at DESC LIMIT 5;
```

### Contar por estado
```sql
SELECT status, COUNT(*) FROM publications GROUP BY status;
```

### Publicaciones programadas por publicar
```sql
SELECT id, wp_title, scheduled_at
FROM publications
WHERE status = 'scheduled' AND scheduled_at <= NOW()
ORDER BY scheduled_at;
```

### Ver el detalle completo de una publicación
```sql
SELECT * FROM publications WHERE id = '<uuid>';
```

### Auditoría de una publicación
```sql
SELECT a.action, a.actor_email, a.created_at, a.payload
FROM audit_log a
WHERE a.publication_id = '<uuid>'
ORDER BY a.created_at;
```

### Resetear una publicación para reprocesarla
```sql
UPDATE publications
SET status = 'approved',
    wp_post_id = NULL, wp_post_url = NULL,
    fb_post_id = NULL, fb_post_url = NULL,
    ig_post_id = NULL, ig_post_url = NULL,
    published_at = NULL, publish_errors = NULL
WHERE id = '<uuid>';
```

Luego disparar el webhook de aprobación desde Bruno/curl para que N8N la re-publique.

### Ver publicaciones fallidas
```sql
SELECT id, wp_title, status, publish_errors, received_at
FROM publications
WHERE status IN ('failed', 'partial')
ORDER BY received_at DESC;
```

## Cómo ejecutar queries

### Desde tu terminal (host)

```powershell
docker compose exec -T postgres psql -U periodico -d periodico -c "SELECT count(*) FROM publications;"
```

Para queries multilinea o con muchas comillas: usar redirect de archivo SQL:

```powershell
docker compose exec -T postgres psql -U periodico -d periodico < scripts/mi_query.sql
```

### Desde un cliente GUI (DBeaver, TablePlus)

- Host: `localhost`
- Port: `5432`
- User: `periodico`
- Password: `<POSTGRES_PASSWORD>` del `.env`
- Database: `periodico`
- SSL: disable

## Migraciones

**El schema real vive en `db/init.sql`**, que se ejecuta automáticamente la primera vez que arranca el contenedor `postgres` (por `docker-entrypoint-initdb.d`).

Después del primer arranque, los cambios se hacen con `ALTER TABLE` directo:

```powershell
docker compose exec -T postgres psql -U periodico -d periodico <<EOF
ALTER TABLE publications ADD COLUMN IF NOT EXISTS nueva_columna TEXT;
EOF
```

También actualiza:
- `db/init.sql` (para futuros deploys desde cero)
- `backoffice/prisma/schema.prisma` (para tipado en el backoffice)
- Rebuild backoffice: `docker compose up -d --build backoffice`

**No usamos Prisma migrations** — Prisma es solo cliente tipado, no dueño del schema.

## Backups

**No hay backup automático en el MVP**. Para hacer uno manual:

```powershell
docker compose exec -T postgres pg_dump -U periodico -d periodico > backup_$(Get-Date -Format 'yyyy-MM-dd').sql
```

Restore:
```powershell
docker compose exec -T postgres psql -U periodico -d periodico < backup_2026-07-22.sql
```

Para producción: cron externo que corra `pg_dump` diariamente y suba a S3 / drive.

## Volúmenes y persistencia

- `postgres_data` (Docker named volume) — contiene toda la DB
- Sobrevive a `docker compose down`, se pierde solo con `docker compose down -v` (peligroso — perderías todas las publicaciones)
