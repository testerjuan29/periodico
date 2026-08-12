# Análisis de costos — Puesta en producción PaginaUno.Do

> Fecha: **agosto 2026** · Moneda: **USD**, sin impuestos · Precios de Azure medidos
> vía su API oficial de precios (región Central US); IA y servicios según tarifas
> públicas vigentes. Todo el sistema factura por uso, sin contratos de permanencia.

**Parámetros del escenario** (definidos con el cliente):
- **900 entradas/mes** (~30 notas diarias) generadas con IA
- **2 personas** operando el panel de aprobación
- Ingesta de información por **correo (Postmark)** y WhatsApp
- Infraestructura sobre **Azure**
- Publicación en el WordPress real de PaginaUno.Do + Facebook + Instagram

---

## 1. Resumen ejecutivo

| Rubro | Mensual |
|---|---|
| Infraestructura Azure (VM estándar + disco + IP + respaldo) | ~US$ 70 |
| IA — generación de 900 notas (DeepSeek) | ~US$ 3 |
| Postmark (correo entrante, plan 10,000 mensajes) | US$ 15 |
| WhatsApp / Facebook / Instagram (APIs) | US$ 0 |
| Línea telefónica para WhatsApp Business (si es número nuevo) | ~US$ 5–10 |
| **Total operativo mensual** | **~US$ 93–103** |
| **Total anual** | **~US$ 1,100–1,250** |

Punto clave para la conversación: **la IA que redacta las 900 notas cuesta ~US$ 3
al mes** — menos que un almuerzo. El costo dominante es el servidor. El sistema
completo opera por el equivalente al salario de **menos de una hora mensual** de
un redactor.

---

## 2. Infraestructura Azure (producción)

A diferencia de la POC (VM "Spot" interrumpible, ~US$ 20/mes), producción exige
disponibilidad continua: los correos y WhatsApp llegan a cualquier hora y una VM
interrumpida pierde ese tráfico.

| Componente | Detalle | Mensual |
|---|---|---|
| VM D2als_v7 estándar | 2 vCPU / 4 GB — corre n8n, panel, renderer y base de datos | US$ 58.69 |
| Disco SSD 64 GB | Sistema + base de datos + fotos | ~US$ 5 |
| IP pública fija | Dominios y webhooks apuntan aquí | ~US$ 4 |
| Azure Backup (respaldo diario de la VM) | Recuperación ante desastre | ~US$ 3–5 |
| **Subtotal Azure** | | **~US$ 70** |

Notas de dimensionamiento:
- **2 usuarios simultáneos y 30 notas/día son carga liviana** para esta VM — el
  panel es una app web ligera y cada generación toma ~1 minuto. Hay margen de
  sobra; si el volumen creciera 3–4x, se escala a 8 GB (+US$ 16/mes) con un
  reinicio de 2 minutos.
- En producción el **WordPress de demostración se elimina de la VM** (se publica
  directo en el WordPress real de PaginaUno.Do, que ya es un costo existente del
  cliente). Eso libera memoria y confirma que 4 GB alcanzan.
- Alternativa de ahorro: la VM burstable **B2als_v2 (~US$ 38/mes)** rinde igual
  para esta carga y bajaría el subtotal Azure a ~US$ 50. Requiere una aprobación
  de cuota de Azure (trámite gratuito ya identificado; se solicita antes del
  pase a producción).
- **Almacenamiento de fotos**: ~900 fotos/mes ≈ 2–3 GB/mes. El disco de 64 GB
  dura ~1.5 años; luego, ampliar disco (~US$ 2–4/mes más) o depurar fotos ya
  publicadas.

---

## 3. Análisis de tokens de IA (900 notas/mes)

### 3.1 Consumo por nota

Medido sobre el prompt real del sistema (workflow de generación):

| Concepto | Tokens |
|---|---|
| Instrucciones editoriales fijas (prompt de sistema: estilo, formato JSON, catálogo de categorías) | ~1,100 |
| Noticia fuente (correo/WhatsApp típico de 200–500 palabras) | ~700 |
| **Entrada por nota** | **~1,800** |
| Salida: artículo (500–700 palabras) + copy de Facebook + caption de Instagram + hashtags + metadatos | **~1,600** |

Se añade un **15% de margen por regeneraciones** (notas que el editor pide
regenerar o reintentos técnicos).

### 3.2 Costo mensual con DeepSeek (motor actual)

Tarifas públicas de DeepSeek: US$ 0.27 por millón de tokens de entrada,
US$ 1.10 por millón de salida.

| | Tokens/mes (900 notas × 1.15) | Costo |
|---|---|---|
| Entrada | ~1.9 millones | ~US$ 0.50 |
| Salida | ~1.7 millones | ~US$ 1.85 |
| **Total IA** | ~3.6 millones | **~US$ 2.35 → presupuestar US$ 3–5** |

Sensibilidad: si las notas fuente fueran el doble de largas, o el margen de
regeneración subiera al 30%, el total seguiría **por debajo de US$ 6/mes**. A
este volumen, el motor de IA no es una variable financiera relevante.

### 3.3 ¿Y si se quisiera un modelo premium?

Para referencia, el mismo volumen (3.6M tokens/mes) con otros modelos, a tarifas
públicas de agosto 2026:

| Modelo | Costo mensual aprox. | Comentario |
|---|---|---|
| **DeepSeek V3 (actual)** | **~US$ 3** | Calidad validada en la POC para redacción periodística en español |
| Claude Haiku 4.5 | ~US$ 10 | Salto de calidad moderado, sigue marginal |
| Claude Sonnet 5 | ~US$ 31 | Redacción de gama alta |
| Claude Opus 5 | ~US$ 51 | Máxima calidad; innecesario para este caso de uso |

Conclusión: incluso el modelo más caro del mercado costaría ~US$ 50/mes a este
volumen. La decisión de motor puede tomarse por calidad editorial, no por precio.

---

## 4. Servicios externos

| Servicio | Plan | Mensual |
|---|---|---|
| **Postmark** — recepción de los correos de redacción | Básico: 10,000 mensajes (900 usados, margen 10x) | US$ 15 |
| **WhatsApp Business Cloud API** — recepción de noticias | Mensajes entrantes: sin costo | US$ 0 |
| WhatsApp — confirmaciones automáticas al corresponsal | Dentro de la ventana de servicio de 24 h: sin costo | US$ 0 |
| **Facebook Pages API** (publicación) | Sin costo | US$ 0 |
| **Instagram Content Publishing API** | Sin costo | US$ 0 |
| **Certificados HTTPS** (Let's Encrypt, renovación automática) | Sin costo | US$ 0 |
| Subdominios (panel.paginauno.do, n8n.paginauno.do) | El dominio ya es del cliente | US$ 0 |
| Línea telefónica para WhatsApp Business (si no reutilizan una) | Según operador local | ~US$ 5–10 |

---

## 5. Costos de implementación (una sola vez)

Ningún servicio cobra alta ni instalación. El costo de implementación es
**esfuerzo técnico**, estimado por tarea:

| Tarea | Detalle | Horas |
|---|---|---|
| VM de producción | Crear VM estándar (o tramitar cuota B2als_v2), migrar el stack, rotar todos los secretos de la POC | 3–4 |
| Dominios propios | Apuntar subdominios de paginauno.do + reconfigurar HTTPS | 1–2 |
| WordPress real | Application Password en paginauno.do, mapear categorías/tags reales, retirar el WP demo | 2–4 |
| Webhooks definitivos | Meta (WhatsApp) y Postmark hacia el servidor de producción; verificación de negocio Meta si falta | 1–2 |
| Número de WhatsApp productivo | Alta del número real en Meta (sale del sandbox de pruebas) | 1–2 |
| Pruebas end-to-end | Circuito completo con el WP real y las redes reales | 2–3 |
| Capacitación | Sesión con las 2 personas del cliente (panel, edición, aprobación, foto por correo) | 2 |
| **Total** | | **12–19 horas** (~2–3 días de trabajo) |

*(La tarifa por hora del trabajo de implementación se cotiza aparte.)*

Consideración sobre los 2 usuarios: hoy el panel usa **un acceso único
compartido** (decisión de la POC). Para dos personas funciona; si el cliente
quisiera cuentas individuales con trazabilidad por editor ("quién aprobó qué"),
es una mejora de ~1 día de desarrollo a cotizar aparte. El registro de auditoría
del sistema ya guarda cada acción con fecha y hora.

---

## 6. Comparativa POC vs. Producción

| | POC (hoy) | Producción |
|---|---|---|
| VM | Spot interrumpible | Estándar 24/7 |
| Correo | Postmark gratuito (100/mes) | Postmark US$ 15 (10,000/mes) |
| IA | ~US$ 1 (pruebas) | ~US$ 3 (900 notas) |
| WordPress | Demo en la VM | El real de PaginaUno.Do |
| WhatsApp | Número sandbox (5 remitentes máx.) | Número real verificado |
| Dominios | sslip.io (demo) | Subdominios de paginauno.do |
| **Costo mensual** | **~US$ 21** | **~US$ 93–103** |

### Palancas de ahorro disponibles

1. **VM B2als_v2 con cuota aprobada**: −US$ 21/mes → total ~US$ 72–82
2. Reutilizar una línea telefónica existente para WhatsApp: −US$ 5–10/mes
3. Postmark tiene margen 10x — no hay ahorro posible ahí sin perder el canal

**Escenario más económico realista: ~US$ 70/mes (~US$ 840/año) todo incluido.**
