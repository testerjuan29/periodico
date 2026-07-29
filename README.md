# Periódico Automático — MVP

Automatización end-to-end para un periódico:

```
Email/WhatsApp  →  N8N + DeepSeek  →  Borrador en 3 formatos  →  Backoffice (aprobación)  →  WordPress + Facebook + Instagram
```

## Arquitectura

| Servicio | Puerto | Rol |
|---|---|---|
| `postgres` | 5432 | Datos de publicaciones + storage de N8N |
| `n8n` | 5678 | Orquestador (ingesta, generación IA, publicación) |
| `wordpress` | 8080 | CMS del periódico |
| `wp_db` | — | MariaDB solo para WordPress |
| `image-renderer` | 3001 | Microservicio Puppeteer: recibe HTML → devuelve PNG |
| `backoffice` | 3000 | Next.js — aprobación humana |

## Requisitos

- Docker Desktop
- Cuenta en [Meta for Developers](https://developers.facebook.com) (WhatsApp Cloud API + Graph API)
- Cuenta en [DeepSeek](https://platform.deepseek.com) (API key)
- Dominio con Mailgun/Postmark configurado para inbound email (o un alias de reenvío al webhook de N8N)

## Arranque

```powershell
# 1. Copiar y editar variables de entorno
copy .env.example .env
notepad .env   # rellenar credenciales

# 2. Levantar todo
docker compose up -d --build

# 3. Aplicar migraciones de Prisma en el backoffice
docker compose exec backoffice npx prisma migrate deploy
```

Servicios disponibles:

- Backoffice: http://localhost:3000
- N8N: http://localhost:5678
- WordPress: http://localhost:8080

## Estructura

```
├── docker-compose.yml
├── db/init.sql              # schema de la tabla publications
├── image-renderer/          # microservicio Puppeteer
├── templates/               # plantillas HTML para la imagen
├── n8n/workflows/           # workflows JSON versionados
└── backoffice/              # Next.js + Prisma + shadcn/ui
```

## Flujo end-to-end

1. Llega mensaje al email o WhatsApp del periódico
2. N8N (`01_ingest_email` / `02_ingest_whatsapp`) recibe el webhook y hace `INSERT` en `publications` con `status='pending'`
3. N8N (`03_generate_content`) llama a DeepSeek con el prompt 3-en-1 → genera `wp_body_html`, `fb_caption`, `ig_caption` + hashtags
4. N8N llama a `image-renderer` con el template + datos → PNG guardado en volumen compartido
5. El backoffice lista los `pending` y muestra los 3 previews
6. El cliente aprueba → `status='approved'` o `status='scheduled'` con `scheduled_at`
7. El backoffice dispara webhook a N8N (`04/05/06`) que publica en cada plataforma

## Simular el WordPress del cliente (PaginaUno.Do)

Para que el WP local se parezca al del cliente y así calibrar el flujo antes de producción:

### 1. Importar taxonomía real (categorías + tags)

Ver [scripts/README.md](scripts/README.md). Requiere Application Password del WP local.

```powershell
python scripts/import_taxonomy.py
```

Descarga las ~100 categorías (con jerarquía padre-hijo: Actualidad, Nacionales, Internacionales, provincias RD, países) y los top tags del sitio real vía su API pública.

### 2. Theme gratuito parecido a JNews

El cliente usa **JNews** (ThemeForest, $59). Como alternativa gratuita, recomiendo **ColorMag** de ThemeGrill:

- Layout multi-columna clásico de periódico digital
- Sección de "breaking news" superior
- Widgets pre-configurados para portada tipo magazine
- Muy popular (400k+ instalaciones) → mucha documentación
- Instalable directamente desde el buscador de temas de WordPress

**Instalación**:
1. http://localhost:8080/wp-admin/theme-install.php
2. Buscar `ColorMag` → **Instalar** → **Activar**
3. Apariencia → Personalizar → Site Identity: Nombre `PaginaUno.Do`, Tagline `Toda la información oficial en un solo lugar`
4. Ajustes → Lectura: mostrar posts recientes

Alternativas equivalentes: **Newspaper X** (Tagdiv, free), **Publisher** (Tishonator, free).

Si más adelante el cliente entrega la licencia oficial de JNews (.zip), instalar vía Apariencia → Temas → Subir tema.

## Próximos pasos

- [ ] Configurar credenciales en N8N (DeepSeek, WhatsApp, Meta Graph, WordPress)
- [ ] Crear Application Password en WordPress para el usuario del bot
- [ ] Suscribir el webhook de WhatsApp Cloud API a `https://<n8n-public>/webhook/whatsapp-inbound`
- [ ] Configurar Mailgun/Postmark route → `https://<n8n-public>/webhook/email-inbound`
- [ ] Diseñar el template HTML final con la identidad visual del periódico
