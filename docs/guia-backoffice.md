# Guía del Backoffice

El backoffice es una app Next.js 15 que es la interfaz humana del sistema. Aquí el cliente aprueba, rechaza o programa publicaciones.

## URL y acceso

http://localhost:3000

**⚠️ No tiene auth todavía** — cualquiera con la URL entra. Pendiente añadir NextAuth (magic link al `ADMIN_EMAIL`). Para MVP local está OK.

## Pantallas

### Dashboard (`/`)

Lista de publicaciones ordenadas por `received_at DESC`. Filtros por status via query string:
- `/` → default: pending + approved + scheduled
- `/?status=pending` → solo pendientes
- `/?status=published` → solo publicadas
- `/?status=rejected` → rechazadas
- etc.

Cada tarjeta muestra:
- Thumbnail de la imagen (miniatura del PNG del template)
- Badge de status con color (amarillo pending, azul approved, verde published, gris rejected, rojo failed)
- Fuente (email / whatsapp) + sender
- Título generado por DeepSeek (o subject/text crudo si aún no se generó)
- Snippet del excerpt
- Timestamp de recepción

Click en una tarjeta → detalle.

### Detalle (`/publication/[id]`)

Layout 2 columnas:

**Izquierda — Previews en tabs**:
- **WordPress** — cómo se verá la nota: imagen destacada arriba, chips de categorías, título, excerpt como quote, cuerpo HTML renderizado, tags al pie
- **Facebook** — mockup del post: avatar del periódico, nombre, "Ahora", caption, imagen
- **Instagram** — mockup del feed: header con handle, imagen cuadrada, caption con hashtags

Debajo hay un `<details>` colapsable con el **mensaje original** (source_text tal como llegó).

**Derecha — Panel de acciones** (sticky):
- **Aprobar y publicar ahora** (botón rojo grande)
- **Programar publicación** — input `datetime-local` + botón "Programar"
- **Rechazar** — textarea de motivo (opcional) + botón "Rechazar"

Si la publicación ya está en estado final (published, rejected, failed), el panel muestra "Estado final — Esta publicación ya fue procesada".

## Acciones y qué hacen

| Acción | Cambia status a | Llama a | Efecto |
|---|---|---|---|
| **Aprobar y publicar ahora** | `approved` | `POST /api/publications/:id/approve` → webhook a N8N | N8N dispara workflow 08 → publica en WP (y FB/IG cuando estén) |
| **Programar** | `scheduled` | `POST /api/publications/:id/schedule` con `scheduledAt` | El workflow 07 (cron 1 min) recoge y dispara 08 cuando llegue la hora |
| **Rechazar** | `rejected` | `POST /api/publications/:id/reject` con `reason` | No dispara nada. La fila queda descartada |

Cada acción también inserta una fila en `audit_log` con actor, action, payload.

## Estructura del código

```
backoffice/
├── prisma/schema.prisma          # espejo tipado del schema PG (no dueño)
├── src/
│   ├── app/
│   │   ├── layout.tsx            # header + nav global
│   │   ├── page.tsx              # dashboard (RSC con Prisma directo)
│   │   ├── globals.css           # Tailwind base
│   │   ├── publication/[id]/
│   │   │   ├── page.tsx          # detalle (RSC)
│   │   │   ├── PreviewTabs.tsx   # componente cliente (tabs WP/FB/IG)
│   │   │   └── ApprovalPanel.tsx # componente cliente (botones + fetch)
│   │   └── api/
│   │       ├── image/route.ts    # sirve PNGs desde el volumen
│   │       └── publications/[id]/
│   │           ├── approve/route.ts
│   │           ├── schedule/route.ts
│   │           └── reject/route.ts
│   └── lib/
│       ├── prisma.ts             # singleton PrismaClient
│       ├── notifyN8n.ts          # helper para llamar al webhook de N8N
│       └── statusBadge.tsx       # componente del chip de status
└── Dockerfile                    # multi-stage build (deps, builder, runner)
```

## Cómo se sirven las imágenes

El PNG del template está en un volumen Docker compartido `image_output` (escrito por `image-renderer`, montado como read-only en `backoffice` en `/image-output`).

El endpoint `/api/image?path=/output/xxx.png`:
1. Valida que el path sea relativo al mount `/image-output` (previene path traversal con `normalize`)
2. Abre el archivo con `createReadStream`
3. Devuelve el stream con `Content-Type: image/png` y `Cache-Control: public, max-age=3600`

**⚠️ Sin auth**. Al abrir el backoffice a internet, este endpoint también queda expuesto. Añadir chequeo de sesión antes de deployar.

## Cómo modificar la UI

### Cambiar los previews

Editar [`PreviewTabs.tsx`](../backoffice/src/app/publication/[id]/PreviewTabs.tsx). Los 3 tabs son componentes JSX independientes, se pueden ajustar libremente.

### Añadir una acción nueva

1. Crear la route: `src/app/api/publications/[id]/nueva-accion/route.ts`
2. Añadir el botón en `ApprovalPanel.tsx`
3. Si la acción requiere notificar a N8N, importar y usar `notifyN8n` de `lib/notifyN8n.ts`

### Cambiar el layout / colores

- Tailwind config: [`tailwind.config.ts`](../backoffice/tailwind.config.ts) — variables de color (`brand`, `ink`)
- CSS global: [`src/app/globals.css`](../backoffice/src/app/globals.css)

## Desarrollo local (fuera de Docker)

Si quieres iterar más rápido sin rebuild del contenedor:

```powershell
cd backoffice
npm install
# El .env debe apuntar a la DB del contenedor
$env:DATABASE_URL = "postgresql://periodico:changeme_postgres@localhost:5432/periodico"
$env:IMAGE_OUTPUT_MOUNT = "..."  # ruta al volumen si querés ver imágenes
npm run dev
```

Corre en http://localhost:3000 (mismo puerto que el del container — cuidado con conflictos, para el container antes).

Después de tus cambios, para volver al modo docker:

```powershell
docker compose up -d --build backoffice
```

## Base de datos: cómo lo lee el backoffice

Prisma se genera del `schema.prisma`. Cada campo tiene `@map("nombre_snake")` para hacer el mapping camelCase JS ↔ snake_case SQL:

```ts
model Publication {
  id           String   @id @db.Uuid
  wpCategories String[] @map("wp_categories")  // ← se lee como pub.wpCategories
  ...
}
```

**Ojo**: si añades una columna al `db/init.sql`, también hay que:
1. Ejecutar el `ALTER TABLE` en la DB corriendo
2. Agregar el campo en `schema.prisma`
3. Rebuild del backoffice: `docker compose up -d --build backoffice`

Prisma dentro del Docker se regenera durante `npm run build` (que corre en el Dockerfile).
