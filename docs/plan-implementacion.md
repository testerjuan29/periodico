# Plan de implementación en producción — PaginaUno.Do

> Fecha: agosto 2026 · Complementa a [costos-produccion.md](costos-produccion.md).
>
> **Diseño del plan**: 6 etapas para ajustarse a la disponibilidad del cliente.
> Las etapas 0 y 2 son mayormente nuestras; las 1, 4 y 5 requieren al cliente.
> Los trámites con tiempos externos (verificación de Meta, DNS) se disparan en
> el kickoff para que no bloqueen el final.

## Vista rápida del timeline

| Etapa | Nombre | Duración | ¿Quién? | Calendario |
|---|---|---|---|---|
| 0 | Preparación técnica | 1–2 días | Nosotros | Semana 1 |
| 1 | Kickoff con el cliente | 1 reunión (2 h) | Ambos | Semana 1 |
| 2 | Adaptación editorial + plantilla de imagen | 2–4 días | Nosotros + feedback | Semana 1–2 |
| 3 | Integraciones reales (WP, Meta, Postmark, DNS) | 2–3 días | Nosotros (+gestiones del cliente) | Semana 2 |
| 4 | Piloto asistido | 5 días hábiles | Ambos | Semana 3 |
| 5 | Go-live y capacitación | 1 día | Ambos | Semana 3–4 |

**Total: 3 a 4 semanas calendario** (≈ 6–9 días de trabajo efectivo nuestro).

---

## Etapa 0 — Preparación técnica (sin el cliente) · 1–2 días

- [ ] Solicitar cuota Azure **B2als_v2** (gratis; baja el mensual de ~US$ 93 a ~US$ 72)
- [ ] Crear la **VM de producción** (estándar, no Spot), Ubuntu 24.04, Docker
- [ ] Desplegar el stack (`docker-compose.prod.yml`) con **secretos nuevos**:
      token de Meta, contraseñas del panel/bases, `NEXTAUTH_SECRET`, `UPLOAD_TOKEN`,
      Application Password de WP
- [ ] Replicar **Logic App** de reinicio y activar **Azure Backup** diario
- [ ] Importar los 9 workflows de n8n + 3 credenciales (procedimiento ya
      documentado y probado en la POC)
- [ ] POC actual queda como demo hasta el go-live (luego se borra)

**Entregable**: producción funcionando contra el WordPress de demostración.

---

## Etapa 1 — Kickoff con el cliente · 1 reunión de ~2 h

### Lo que el cliente debe traer (checklist para enviarle antes)

| # | Qué necesitamos | Para qué | Nivel de acceso |
|---|---|---|---|
| 1 | Guías de estilo / prompts internos + 5–10 notas "bien escritas" y 2–3 que no les gusten | Adaptar el prompt de IA (Etapa 2) | Solo documentos |
| 2 | Usuario **Administrador temporal** en su WordPress (o sesión compartida con su webmaster) | Crear el usuario del sistema y la Application Password (Etapa 3) | Admin por 1 día; queda solo un usuario **Editor** |
| 3 | Acceso de **Socio (Partner)** a su **Meta Business Manager** o disposición a crear un usuario de sistema juntos | Página de FB, cuenta de IG y WhatsApp (Etapa 3) | Ver detalle de Meta en Etapa 3 |
| 4 | Acceso al **panel DNS** de paginauno.do (o su webmaster disponible 30 min) | Crear subdominios (Etapa 3) | Solo crear 2 registros A |
| 5 | **Número de teléfono** para WhatsApp (nuevo o existente) | Canal de corresponsales | Ver advertencia abajo |
| 6 | Logo en alta calidad (SVG o PNG ≥1000px), paleta de colores (códigos hex) y handle de IG | Plantilla de imagen 1080×1080 (Etapa 2) | Solo archivos |
| 7 | Nombres y correos de las **2 personas** que operarán el panel | Accesos y capacitación | — |
| 8 | Documentos de la empresa: **RNC / registro mercantil**, dirección, teléfono, sitio web | Verificación de negocio en Meta | Solo copias |

> ⚠️ **Advertencia sobre el número de WhatsApp**: el número que se conecte a la
> API **no puede estar en uso en la app de WhatsApp** (ni personal ni Business).
> Si el cliente quiere usar un número que hoy tiene WhatsApp activo, hay que
> darlo de baja de la app primero (proceso de Meta, ~5 min pero irreversible
> mientras esté en la API). Recomendación: una línea nueva/secundaria (~US$ 5–10/mes).

### Decisiones a tomar en la reunión

- [ ] ¿WordPress recibe la **foto limpia** o la imagen compuesta 1080×1080?
      (recomendación: foto limpia en WP, compuesta solo en redes)
- [ ] Dirección de correo para los corresponsales: ¿`redaccion@paginauno.do`
      (elegante, requiere 1 paso extra de DNS/reenvío) o la dirección técnica de
      Postmark? (ver Etapa 3 — Postmark)
- [ ] Horario de publicación del scheduler (¿se publica de madrugada o se
      retiene hasta la mañana?)

**Al cerrar la reunión se disparan los 2 relojes externos**: verificación de
negocio en Meta (1–5 días) y registros DNS (minutos a 24 h de propagación).

---

## Etapa 2 — Adaptación editorial y plantilla · 2–4 días

### 2a. Prompt de IA

- [ ] Integrar las guías del cliente al prompt de sistema del workflow 03:
      tono, estructura, tratamiento de fuentes/citas, palabras prohibidas,
      formato de la entradilla (hoy: "Santo Domingo. – ...")
- [ ] Sustituir el catálogo de categorías/tags por el real de paginauno.do
- [ ] **Corrida de calidad**: regenerar 10–15 noticias históricas del cliente y
      comparar lado a lado con lo que publicaron sus redactores
- [ ] Ronda de feedback (≤30 min del cliente, por correo) → ajustar → repetir
- [ ] Aprobación del prompt **por escrito**

### 2b. Plantilla de imagen (1080×1080)

La plantilla actual (`templates/article.html`) es HTML/CSS — se rebrandea con:

- [ ] Logo del cliente en el pie (reemplaza "EL PERIÓDICO"; se incrusta como
      base64 dentro del HTML para no depender de URLs externas)
- [ ] Color de marca (reemplaza el rojo `#b91c1c` actual en franja de categoría
      y borde del pie) + tipografía si tienen una definida
- [ ] Handle real de Instagram y formato de fecha
- [ ] Generar **3 variantes de muestra** con noticias reales → el cliente elige
      y aprueba (misma mecánica de mockups que usamos en el backoffice)
- [ ] La foto real del corresponsal ya entra como fondo automáticamente
      (funcionalidad probada); verificar que el degradado y la legibilidad del
      titular funcionen con fotos claras y oscuras

**Entregable**: prompt aprobado + plantilla de marca aprobada.

---

## Etapa 3 — Integraciones reales · 2–3 días

### 3a. WordPress del cliente (paginauno.do)

Nivel de acceso permanente que queda configurado: **un usuario dedicado con rol
"Editor"** (NO administrador). Ese rol alcanza para todo lo que hace el sistema:
crear posts, subir la imagen destacada, crear tags y asignar categorías.

- [ ] Con el admin temporal del kickoff: crear usuario `automatizacion` (rol
      Editor, correo nuestro de sistema)
- [ ] En el perfil de ese usuario: generar la **Application Password**
      (WordPress ≥5.6 con HTTPS — paginauno.do cumple) → va al `.env` del
      servidor (`WP_APP_USER` / `WP_APP_PASSWORD`, `WP_INTERNAL_URL=https://paginauno.do`)
- [ ] **Checklist de compatibilidad** (causa #1 de fricción en WP reales):
  - [ ] La API REST responde: `https://paginauno.do/wp-json/wp/v2/posts`
  - [ ] Plugins de seguridad (Wordfence, iThemes, etc.): permitir Application
        Passwords y la API REST para el usuario del sistema
  - [ ] Si hay Cloudflare/WAF delante: poner en lista blanca la IP fija de
        nuestra VM
- [ ] Publicación de prueba **en estado borrador** con categorías y foto
- [ ] Retirar el WordPress demo de la VM (libera memoria)

### 3b. Meta (Facebook + Instagram + WhatsApp)

Requisito previo: **verificación de negocio** (disparada en el kickoff con los
documentos del punto 8). Sin ella, la API de WhatsApp queda limitada al sandbox.

Accesos, del menos al más invasivo (usaremos el mínimo necesario):

1. El cliente nos otorga acceso de **Socio (Partner)** en su Business Manager a
   3 activos: la **Página de Facebook** (tareas: crear contenido), la **cuenta
   de Instagram profesional** (debe estar vinculada a la Página — verificar) y
   la **cuenta de WhatsApp Business (WABA)**.
2. Juntos creamos un **usuario de sistema** en su Business Manager y generamos
   un **token permanente** (no caduca, a diferencia de los tokens de usuario)
   con estos permisos exactos: `pages_manage_posts`, `pages_read_engagement`,
   `instagram_basic`, `instagram_content_publish`,
   `whatsapp_business_messaging`, `whatsapp_business_management`.
3. Ese token va al `.env` del servidor. El cliente puede **revocarlo cuando
   quiera** desde su Business Manager — nunca les pedimos contraseñas de
   Facebook/Instagram de ninguna persona.

Configuración de WhatsApp (con el número del kickoff):

- [ ] Alta del número en la WABA (verificación por SMS/llamada al número)
- [ ] Nombre para mostrar ("PaginaUno.Do Redacción") — Meta lo aprueba en horas
- [ ] Webhook: `https://n8n.paginauno.do/webhook/whatsapp-inbound` + verify
      token nuevo + suscripción al campo `messages`
- [ ] Los corresponsales NO necesitan nada especial: escriben al número desde
      su WhatsApp normal (con número real ya no existe el límite de 5
      remitentes del sandbox)

### 3c. Postmark (correo entrante)

- [ ] Crear cuenta Postmark **a nombre del cliente** (con su tarjeta — plan
      US$ 15/mes; así el servicio queda suyo) y nosotros como usuario invitado
- [ ] En el server → **Default Inbound Stream** → webhook:
      `https://n8n.paginauno.do/webhook/email-inbound`
- [ ] Dirección para los corresponsales — 2 opciones (decisión del kickoff):
  - **Opción simple**: usar la dirección técnica que da Postmark
    (`<hash>@inbound.postmarkapp.com`). Cero configuración; menos elegante.
  - **Opción recomendada**: `redaccion@paginauno.do`. Se logra con un reenvío
    desde su correo actual (si ya tienen Google Workspace/cPanel: crear alias
    que reenvía al hash de Postmark — 10 min) o con un **dominio inbound**
    en Postmark (registro MX en un subdominio, p. ej. `entradas.paginauno.do`,
    y la dirección queda `redaccion@entradas.paginauno.do`)
- [ ] Probar: correo con foto → nota en el panel con la foto de portada

### 3d. Dominios y DNS

**No hay que comprar nada**: el cliente ya posee `paginauno.do`. Solo se crean
subdominios (gratis, en su panel DNS):

| Registro | Tipo | Valor | Para qué |
|---|---|---|---|
| `panel.paginauno.do` | A | IP fija de la VM | El backoffice de aprobación |
| `n8n.paginauno.do` | A | IP fija de la VM | Webhooks de Meta/Postmark (y admin técnico) |
| `entradas.paginauno.do` | MX | `inbound.postmarkapp.com` | Solo si eligen esa opción de correo |

El HTTPS es automático (Let's Encrypt vía Caddy) apenas el DNS propaga — sin
costo ni renovaciones manuales.

*Solo por referencia, si algún día quisieran un dominio aparte*: un `.com` en
Cloudflare Registrar o Namecheap cuesta **US$ 10–15/año** (evitar promociones de
primer año con renovaciones caras); un `.do` se registra en **NIC.do** y ronda
los **US$ 35–60/año**. Para este proyecto no se necesita.

### 3e. Cierre de la etapa

- [ ] Prueba end-to-end interna: correo con foto → nota → aprobación → borrador
      en el WP real + publicación en redes de prueba
- [ ] **Riesgo externo**: si la verificación de Meta se atrasa, WhatsApp entra
      unos días después que el correo — no bloquea el resto del plan

---

## Etapa 4 — Piloto asistido · 5 días hábiles

- [ ] Día 1: sesión de arranque (1 h) — las 2 personas mandan sus primeras
      notas reales por correo y WhatsApp con nosotros conectados
- [ ] Días 1–3: todo entra al WP real **en borrador** (sus editores dan el
      visto bueno final antes de publicar)
- [ ] Días 4–5: publicación directa si la calidad lo justifica
- [ ] Revisión diaria de 15 min: fallos, calidad, ajustes finos del prompt
- [ ] Criterio de salida: **20 notas reales** con ≤10% de regeneraciones y cero
      incidentes técnicos

---

## Etapa 5 — Go-live y cierre · 1 día

- [ ] Quitar el modo borrador → publicación normal
- [ ] Capacitación formal (2 h) a las 2 personas: panel, edición, foto por
      correo, errores comunes, a quién escalar
- [ ] Entregar: accesos definitivos, guía de usuario de 1 página, documento de
      costos y este plan ejecutado
- [ ] Borrar la POC (deja de facturar) y acordar ventana de soporte
      post-arranque (sugerido: 2 semanas de respuesta prioritaria)

---

## Reglas del plan

1. Nada se publica en los sistemas reales sin aprobación explícita del cliente
   durante el piloto (borradores primero).
2. Cada etapa cierra con un entregable verificable; si el cliente pausa, se
   retoma donde quedó.
3. Los relojes externos (Meta, DNS) arrancan en el kickoff porque no dependen
   de nosotros.
4. Nunca pedimos contraseñas personales de Facebook/Instagram; todo el acceso a
   Meta es vía Business Manager y revocable por el cliente.
5. La POC sigue disponible como demo durante todo el proceso.

## Calendario tipo

```
Semana 1:  [E0 preparación][E1 kickoff][E2 prompts+plantilla →
Semana 2:   ← E2 feedback][E3 WP real · Meta · Postmark · DNS]
Semana 3:  [E4 piloto asistido — 5 días hábiles]
Semana 4:  [E5 go-live + capacitación]  ✅ en producción
```
