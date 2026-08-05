# Documentación — Periódico Automático

Sistema de automatización para publicar noticias en WordPress, Facebook e Instagram, con aprobación humana (human-in-the-loop) y generación de contenido por IA.

## Propósito de esta carpeta

Estas guías te permiten **entender y operar** el sistema sin conocimiento previo. Están escritas en orden de complejidad — arranca por [Arquitectura](arquitectura.md) para tener el mapa, luego sigue por [Setup desde cero](setup-desde-cero.md) si vas a instalar todo en una máquina nueva, o salta directamente a la guía que necesites.

## Índice

| # | Guía | Cuándo leerla |
|---|---|---|
| 1 | [Arquitectura](arquitectura.md) | Primero. Diagrama de servicios, decisiones técnicas y por qué. |
| 2 | [Setup desde cero](setup-desde-cero.md) | Instalar el sistema en una máquina nueva. |
| 3 | [Flujo end-to-end](flujo-end-to-end.md) | Entender el journey de una publicación desde que llega hasta que se publica. |
| 4 | [Guía de N8N](guia-n8n.md) | Cuando toques workflows, credentials o webhooks. |
| 5 | [Guía de integraciones](guia-integraciones.md) | Setup de WhatsApp Cloud API, DeepSeek/Huawei y WordPress. |
| 6 | [Guía del backoffice](guia-backoffice.md) | Cómo usar la UI de aprobación (Next.js). |
| 7 | [Referencia de la DB](referencia-db.md) | Schema, estados, queries útiles. |
| 8 | [Troubleshooting](troubleshooting.md) | Errores comunes y cómo resolverlos. |

## Estado del sistema

**MVP funcional end-to-end**:
- Ingesta desde **WhatsApp** (con soporte multi-mensaje + comando `LISTO`) y **Email** (Postmark)
- Generación con **DeepSeek** (título, cuerpo HTML, categorías, tags, captions FB/IG, hashtags) + imagen destacada renderizada con Puppeteer
- **Backoffice** de aprobación con acciones: publicar ahora / programar / rechazar
- Publicación en **WordPress + Facebook + Instagram** desde el mismo botón
- **Publicación programada** con cron cada minuto (workflow 07)
- **Bitácora de auditoría** con actor, acción, timestamp y payload

**Limitaciones conocidas** (por dependencias externas, no bugs):
- Descarga de imagen adjunta de WhatsApp deshabilitada (`WA_MEDIA_DOWNLOAD_ENABLED=false`) por bug de Meta en cuentas sandbox — se habilita al pasar a Live mode
- Backoffice sin auth real (usa `ADMIN_EMAIL` como actor fijo) — para operación en producción hay que agregar NextAuth
- WordPress en dev es local (`http://localhost:8080`) — cambiar a URL pública del cliente al deployar

## Convenciones

- Los ejemplos de comandos asumen PowerShell (Windows).
- Rutas absolutas usan formato Windows (`c:\Users\...`).
- Los identificadores UUID de ejemplo son ficticios — reemplaza por los reales.
- Cuando algo dependa del entorno del cliente (PaginaUno.Do), se marca como *(cliente-específico)*.

## Convención de nombres de servicios (Docker)

| Nombre servicio | Container | Puerto host | Rol |
|---|---|---|---|
| `postgres` | `pa_postgres` | 5432 | DB principal (publications + n8n internal) |
| `wp_db` | `pa_wp_db` | — | MariaDB solo para WordPress |
| `wordpress` | `pa_wordpress` | 8080 | CMS del periódico |
| `n8n` | `pa_n8n` | 5678 | Orquestador de workflows |
| `image-renderer` | `pa_image_renderer` | 3001 | Microservicio Puppeteer |
| `backoffice` | `pa_backoffice` | 3000 | Next.js para aprobación humana |

## Referencias externas

- [Cliente actual: PaginaUno.Do](https://paginauno.do/)
- [WhatsApp Cloud API — Docs Meta](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [DeepSeek en Huawei ModelArts MaaS](https://console.huaweicloud.com/modelarts/)
- [WordPress REST API Handbook](https://developer.wordpress.org/rest-api/)
- [N8N Docs](https://docs.n8n.io/)
