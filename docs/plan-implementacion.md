# Plan de implementación en producción — PaginaUno.Do

> Fecha: agosto 2026 · Complementa a [costos-produccion.md](costos-produccion.md)
> (12–19 h de esfuerzo técnico estimado).
>
> **Diseño del plan**: dividido en 6 etapas para ajustarse a la disponibilidad
> del cliente. Las etapas 0 y 2 son mayormente nuestras (avanzan sin depender de
> su agenda); las etapas 1, 4 y 5 requieren al cliente presente. Los dos trámites
> con tiempos externos (verificación de Meta y DNS) se disparan temprano para que
> no bloqueen el final.

## Vista rápida del timeline

| Etapa | Nombre | Duración | ¿Quién? | Calendario estimado |
|---|---|---|---|---|
| 0 | Preparación técnica | 1–2 días | Nosotros | Semana 1 |
| 1 | Kickoff con el cliente | 1 reunión (2 h) | Ambos | Semana 1 |
| 2 | Adaptación editorial (prompts) | 2–4 días | Nosotros + feedback | Semana 1–2 |
| 3 | Integraciones reales | 2–3 días | Nosotros (+2 gestiones del cliente) | Semana 2 |
| 4 | Piloto asistido | 5 días hábiles | Ambos (cliente opera, nosotros supervisamos) | Semana 3 |
| 5 | Go-live y capacitación | 1 día | Ambos | Semana 3–4 |

**Total: 3 a 4 semanas calendario** (≈ 6–9 días de trabajo efectivo nuestro).
El rango depende sobre todo de la velocidad de respuesta del cliente en las
etapas 2 y 4, y de la verificación de negocio de Meta (1–5 días, externo).

---

## Etapa 0 — Preparación técnica (sin el cliente) · 1–2 días

Todo esto se hace ya, sin esperar agenda de nadie:

- [ ] Solicitar la **cuota Azure B2als_v2** (trámite gratuito; si se aprueba, el
      costo mensual baja de ~US$ 93 a ~US$ 72)
- [ ] Crear la **VM de producción** (estándar, no Spot) y migrar el stack
- [ ] **Rotar todos los secretos** de la POC (token de Meta, contraseñas del
      panel y de las bases, NEXTAUTH_SECRET, UPLOAD_TOKEN)
- [ ] Replicar el Logic App anti-caídas y Azure Backup en la VM nueva
- [ ] Dejar la POC actual congelada como entorno de referencia (se apaga para no
      duplicar gasto; se borra tras el go-live)

**Entregable**: servidor de producción listo, circuito completo funcionando
contra el WordPress de demostración.

## Etapa 1 — Kickoff con el cliente · 1 reunión de ~2 horas

Una sola reunión donde el cliente trae/decide todo lo que solo él puede dar.
Checklist para enviarle **antes** de la reunión:

- [ ] **Línea editorial**: sus prompts/guías de estilo (ya entregados — se
      repasan juntos), ejemplos de 5–10 notas publicadas que consideren "bien
      escritas" y 2–3 que NO les gusten
- [ ] **Acceso al WordPress real** de paginauno.do (usuario administrador para
      generar la Application Password) y catálogo definitivo de categorías/tags
- [ ] **Número de WhatsApp** que usarán los corresponsales (¿línea nueva o
      existente?) y acceso al Meta Business Manager del periódico
- [ ] **DNS**: quién administra el dominio paginauno.do (para crear
      `panel.paginauno.do` y `n8n.paginauno.do`)
- [ ] **Las 2 personas** que operarán el panel: nombres y correos
- [ ] Decisión editorial: ¿WordPress recibe la foto limpia o la imagen compuesta
      1080×1080? (recomendación: foto limpia en WP, compuesta en redes)

**Entregable**: acta con accesos, decisiones y responsables. Se disparan ese
mismo día los dos trámites lentos: **verificación de negocio en Meta** y
**registros DNS**.

## Etapa 2 — Adaptación editorial · 2–4 días (iterativo)

Adaptar el prompt del generador (workflow 03) a la línea editorial real del
cliente usando el material del kickoff:

- [ ] Integrar sus guías de estilo al prompt de sistema (tono, estructura,
      muletillas prohibidas, manejo de fuentes y citas)
- [ ] Ajustar el catálogo de categorías/tags al de su WordPress real
- [ ] **Corrida de calidad**: regenerar 10–15 noticias históricas reales y
      compararlas con las versiones publicadas por sus redactores
- [ ] Ronda de feedback con el cliente (por correo/WhatsApp, no requiere
      reunión) → ajustar → segunda corrida
- [ ] Ajustar también las plantillas de copys FB/IG y la imagen 1080×1080
      (colores/marca del periódico en el template)

**Entregable**: prompt de producción aprobado por el cliente por escrito.
**Dependencia de agenda**: solo el feedback (≤30 min por ronda); si el cliente
tarda en responder, esta etapa se estira sin costo.

## Etapa 3 — Integraciones reales · 2–3 días

- [ ] **WordPress real**: Application Password, publicación de prueba en
      borrador, mapeo de categorías, retirar el WP demo de la VM
- [ ] **Dominios propios**: `panel.paginauno.do` y `n8n.paginauno.do` → HTTPS
      automático (DNS ya propagado desde la etapa 1)
- [ ] **Número real de WhatsApp** en Meta (sale del sandbox; requiere la
      verificación de negocio disparada en la etapa 1)
- [ ] **Webhooks definitivos**: Meta y Postmark apuntando a producción
- [ ] Prueba end-to-end interna: correo con foto → nota → aprobación →
      WP real (en borrador) + redes de prueba

**Entregable**: circuito completo contra los sistemas reales del cliente.
**Riesgo externo**: si la verificación de Meta se atrasa, el canal WhatsApp
puede entrar unos días después que el de correo — no bloquea el resto.

## Etapa 4 — Piloto asistido · 5 días hábiles

El cliente opera con noticias reales; nosotros supervisamos a diario:

- [ ] Día 1: sesión de arranque (1 h) — las 2 personas mandan sus primeras
      notas por correo y WhatsApp con nosotros conectados
- [ ] Días 1–3: publicación **en borrador** en el WP real (nada sale al aire
      sin revisión de sus editores)
- [ ] Días 4–5: publicación directa si la calidad de los días previos lo
      justifica
- [ ] Revisión diaria de 15 min: ejecuciones fallidas, calidad de notas,
      ajustes finos al prompt
- [ ] Criterio de salida: **20 notas reales publicadas** con ≤10% de
      regeneraciones manuales y cero incidentes técnicos

**Dependencia de agenda**: el cliente debe generar volumen real esta semana.
Si su semana está cargada, el piloto se corre completo — por eso es una etapa
separada.

## Etapa 5 — Go-live y cierre · 1 día

- [ ] Retirar restricciones del piloto (borradores → publicación normal)
- [ ] **Capacitación formal** (2 h): panel, edición, foto por correo, qué hacer
      ante errores, a quién escalar
- [ ] Entregar: lista de accesos definitiva, guía de usuario de 1 página,
      documento de costos y este plan con lo ejecutado
- [ ] Apagar y borrar la POC (`rg-periodico` de la POC) — desde aquí solo
      factura producción
- [ ] Acordar ventana de **soporte post-arranque** (sugerido: 2 semanas de
      respuesta prioritaria)

---

## Reglas del plan

1. **Nada se publica en las redes/WP reales sin aprobación explícita del
   cliente en el piloto** — los primeros días todo entra como borrador.
2. Cada etapa cierra con un entregable verificable; si el cliente pausa, se
   retoma exactamente donde quedó.
3. Los dos relojes externos (Meta y DNS) arrancan en la etapa 1 justamente
   porque no dependen de nosotros.
4. La POC actual sigue disponible como demo durante todo el proceso — las
   etapas 0–3 no la tocan.

## Calendario tipo (si el cliente tiene disponibilidad normal)

```
Semana 1:  [E0 preparación][E1 kickoff][E2 prompts →
Semana 2:   ← E2 feedback/ajustes][E3 integraciones reales]
Semana 3:  [E4 piloto asistido — 5 días hábiles]
Semana 4:  [E5 go-live + capacitación]  ✅ en producción
```
