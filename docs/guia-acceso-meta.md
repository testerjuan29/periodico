# Guía: acceso a Meta para la automatización — PaginaUno.Do

> Para enviar al cliente. Tiempo total de su parte: ~30 minutos + la
> verificación de negocio (Meta tarda 1–5 días en aprobarla).
> Regla de oro: **nunca pedimos contraseñas personales de Facebook/Instagram** —
> todo se otorga desde el Business Manager y el cliente puede revocarlo cuando
> quiera.

## Qué vamos a lograr

1. El cliente nos da acceso a su **Business Manager** (el "portafolio" que agrupa
   su página de Facebook, su Instagram y su WhatsApp)
2. Creamos una **app** en Meta for Developers dentro de ese portafolio
3. Conectamos el **número de WhatsApp** que recibirá las noticias de los
   corresponsales
4. Generamos un **token permanente** para que el sistema publique y reciba

---

## PARTE A — Lo que hace el cliente (~30 min)

### A1. Verificar que existe el Business Manager

1. Entrar a **https://business.facebook.com** con la cuenta de Facebook del
   dueño/administrador del periódico
2. Si al entrar ve su página de PaginaUno.Do y un menú de "Configuración del
   negocio" (Business settings), ya tiene portafolio → seguir a A2
3. Si no tiene: **Crear cuenta** → nombre "PaginaUno.Do", su nombre y correo del
   negocio. Luego, en Configuración del negocio → **Cuentas → Páginas → Agregar**
   → reclamar su página de Facebook (y en **Cuentas de Instagram** vincular el
   perfil @paginaunodo)

### A2. Invitarnos como persona con acceso

1. **Configuración del negocio** (engranaje) → **Usuarios → Personas**
2. Botón **Agregar** → escribir nuestro correo: `_________________` (el correo
   con el que entramos a Facebook)
3. Rol: **Acceso de empleado** (no hace falta admin del negocio)
4. En el paso de activos, asignarnos:
   - **Página de Facebook** de PaginaUno.Do → activar **"Contenido"** (crear y
     administrar publicaciones)
   - **Cuenta de Instagram** → activar **"Contenido"**
5. Enviar invitación → nosotros la aceptamos desde el correo

### A3. Iniciar la verificación del negocio (el trámite lento — hacerlo YA)

1. **Configuración del negocio → Centro de seguridad** (Security Center)
2. Botón **Iniciar verificación**
3. Meta pide: nombre legal, **RNC / registro mercantil**, dirección, teléfono y
   sitio web (paginauno.do). El teléfono recibe un código de confirmación
4. Estado esperado: aprobado en **1 a 5 días**. Sin esto, WhatsApp queda en modo
   de prueba (máximo 5 remitentes)

### A4. Decidir el número de WhatsApp

- El número que se conecta a la API **no puede estar activo en la app de
  WhatsApp** (ni personal ni Business). Si hoy tiene WhatsApp abierto en un
  teléfono, hay que darlo de baja primero — o mejor: **usar una línea nueva**
- El número debe poder **recibir un SMS o llamada** de verificación
- Tenerlo a mano para la Parte B (la hacemos juntos)

---

## PARTE B — Lo que hacemos juntos en una llamada (~30 min)

> El cliente comparte pantalla o nos da 30 minutos de su tiempo; nosotros guiamos.

### B1. Crear la app en Meta for Developers

1. El administrador del negocio entra a **https://developers.facebook.com**
   (misma cuenta de Facebook) → **Mis apps → Crear app**
2. Caso de uso: **"Otro"** → tipo **"Negocios" (Business)**
3. Nombre: `PaginaUno Automatizacion` · correo de contacto del periódico
4. **Vincular la app al Business Portfolio** de PaginaUno.Do (menú desplegable
   en la creación — clave para que la app pueda usar los activos del negocio)
5. En el panel de la app → **Roles de la app → Roles → Agregar desarrolladores**
   → invitarnos → aceptamos la invitación

### B2. Activar WhatsApp en la app

1. En el panel de la app → **Agregar producto → WhatsApp → Configurar**
2. Meta crea (o vincula) la **cuenta de WhatsApp Business (WABA)** dentro del
   portafolio del cliente
3. **WhatsApp → API Setup → Agregar número de teléfono**: se ingresa el número
   decidido en A4, llega el código por SMS/llamada, se confirma
4. **Nombre para mostrar**: "PaginaUno.Do" (Meta lo revisa en horas)

### B3. Configurar el webhook (lo hacemos nosotros)

- **WhatsApp → Configuration → Webhook**:
  - Callback URL: `https://n8n.paginauno.do/webhook/whatsapp-inbound`
    (en SQA: la URL del servidor de pruebas)
  - Verify token: el que generamos para producción
  - Suscribirse al campo **`messages`**

### B4. Generar el token permanente (usuario de sistema)

1. **Configuración del negocio → Usuarios → Usuarios del sistema → Agregar**
2. Nombre: `paginauno-automatizacion` · rol: **Administrador**
3. **Asignar activos** al usuario de sistema: la app, la Página de Facebook, la
   cuenta de Instagram y la WABA
4. **Generar token** seleccionando la app y estos permisos exactos:
   - `pages_manage_posts` · `pages_read_engagement`
   - `instagram_basic` · `instagram_content_publish`
   - `whatsapp_business_messaging` · `whatsapp_business_management`
5. Duración: **Nunca caduca** (por eso se usa usuario de sistema y no un token
   personal)
6. El token se copia UNA sola vez → va directo al `.env` del servidor. No se
   guarda en chats ni correos

---

## Después de esto

- Los corresponsales escriben al número desde su WhatsApp normal — no instalan
  nada
- El cliente puede **revocar todo** cuando quiera: Configuración del negocio →
  Usuarios (quitarnos) o Usuarios del sistema (invalidar el token)
- Si Meta rechaza la verificación (pasa con documentos incompletos), se
  reintenta con el documento corregido — avisarnos y los acompañamos

## Resumen de lo que necesitamos recibir

| Qué | Cómo nos llega |
|---|---|
| Invitación al Business Manager (A2) | Correo de Meta → aceptamos |
| Invitación como developer de la app (B1) | Correo de Meta → aceptamos |
| Token del usuario de sistema (B4) | Se genera en la llamada, va directo al servidor |
| Número de WhatsApp conectado (B2) | Queda configurado en la llamada |
