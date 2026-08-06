# Estimación de costos operativos — Automatización PaginaUno.Do

> Fecha de estimación: **agosto 2026** · Moneda: **USD** · Precios sin impuestos.
> Los precios de Azure corresponden a la región Central US (consultados vía la API
> oficial de precios); los demás son tarifas públicas de cada proveedor a la fecha.
> Todo es facturación por uso: no hay contratos ni permanencia.

## Resumen ejecutivo

| Escenario | Costo mensual aprox. |
|---|---|
| **POC / demo actual** (VM Spot + servicios gratuitos) | **~US$ 21/mes** |
| **Operación estable recomendada** (VM estándar + email pago) | **~US$ 75–85/mes** |
| Punto medio (VM burstable B2als_v2, requiere aprobación de cuota de Azure) | ~US$ 50–65/mes |

La inteligencia artificial —que suele asumirse como el gasto principal— es en la
práctica el rubro **más barato**: menos de US$ 2/mes incluso publicando 20 notas
diarias, gracias a que DeepSeek cobra centavos por millón de tokens.

---

## 1. Alojamiento (Azure)

Una sola máquina virtual corre todo el sistema: n8n (orquestador), backoffice de
aprobación, generador de imágenes, base de datos y el WordPress de demostración.

| Componente | POC actual (Spot) | Producción (estándar) |
|---|---|---|
| VM 2 vCPU / 4 GB (D2als_v7) | ~US$ 11/mes * | ~US$ 59/mes |
| Disco SSD 64 GB | ~US$ 5/mes | ~US$ 5/mes |
| IP pública fija | ~US$ 4/mes | ~US$ 4/mes |
| **Subtotal** | **~US$ 20/mes** | **~US$ 68/mes** |

\* La modalidad *Spot* tiene ~80% de descuento a cambio de que Azure pueda
apagar la máquina esporádicamente cuando necesita capacidad (se reenciende en
minutos). Aceptable para demo; **no recomendada** cuando el sistema reciba
noticias reales 24/7, porque una interrupción nocturna puede perder mensajes
entrantes.

**Alternativa intermedia**: la VM burstable B2als_v2 (~US$ 38/mes + disco + IP ≈
US$ 47/mes) ofrece estabilidad de VM estándar a mitad de precio, pero la
suscripción actual necesita una aprobación de cuota de Azure (trámite gratuito,
resolución de minutos a días).

Notas:
- Apagar la VM de noche ahorra solo el cómputo (~la mitad del rubro VM); disco e
  IP se cobran igual, y los enlaces publicados quedarían caídos durante la noche.
- Si se sube a 8 GB de RAM (más holgura): +US$ 16/mes aprox. en cualquier modalidad.
- Cuando se publique en el WordPress real de PaginaUno.Do, el WordPress de
  demostración se elimina de la VM (el tamaño de VM no cambia, pero libera memoria).

## 2. Inteligencia artificial (DeepSeek)

Cada nota consume aproximadamente 5,000 tokens entre entrada (texto fuente +
instrucciones editoriales) y salida (artículo + copys de Facebook/Instagram +
hashtags), incluyendo alguna regeneración ocasional.

Con las tarifas públicas de DeepSeek (~US$ 0.27 por millón de tokens de entrada,
~US$ 1.10 por millón de salida):

| Volumen | Costo mensual estimado |
|---|---|
| 100 notas/mes (~3 por día) | < US$ 0.50 |
| 300 notas/mes (~10 por día) | ~US$ 1 |
| 600 notas/mes (~20 por día) | ~US$ 2 |

> El proveedor actual del POC (Huawei ModelArts) puede variar levemente estas
> tarifas. Aun duplicándolas, el rubro sigue siendo marginal. Si en el futuro se
> quisiera un modelo premium (p. ej. Claude o GPT de gama alta), multiplicar
> por 10–30: seguiría bajo (US$ 10–60/mes) para estos volúmenes.

## 3. Ingesta de contenido (WhatsApp y correo)

| Servicio | Costo |
|---|---|
| **WhatsApp Business Cloud API** — recepción de mensajes | **Gratis** (los mensajes entrantes no se cobran) |
| WhatsApp — confirmaciones automáticas al corresponsal | **Gratis** (respuestas dentro de la ventana de servicio de 24 h) |
| WhatsApp — mensajes proactivos con plantilla (si se quisieran a futuro, p. ej. campañas) | ~US$ 0.03–0.06 por mensaje según categoría (opcional, hoy no se usa) |
| **Postmark** (correo entrante → sistema) | Gratis hasta 100 correos/mes; **US$ 15/mes** el plan básico (10,000 correos) para operación seria |

## 4. Publicación (sin costo)

| Servicio | Costo |
|---|---|
| Facebook Pages API (publicar posts) | Gratis |
| Instagram Content Publishing API | Gratis |
| WordPress (API REST del sitio del cliente) | Gratis (el hosting de paginauno.do ya existe y es costo actual del cliente, no nuevo) |
| Certificados HTTPS (Let's Encrypt) | Gratis, renovación automática |
| Subdominio para el sistema (p. ej. `panel.paginauno.do`) | Gratis (el dominio ya es del cliente) |

## 5. Otros costos y consideraciones

| Concepto | Costo |
|---|---|
| n8n (orquestador, self-hosted community) | Gratis |
| Licencias de software (Docker, Postgres, etc.) | Gratis (open source) |
| Verificación de negocio en Meta (requisito para WhatsApp API en producción) | Trámite gratuito |
| Número telefónico dedicado para WhatsApp Business (si no se reutiliza uno existente) | Costo local de una línea (~US$ 5–10/mes, según operador) |
| Respaldos automáticos de la VM (opcional, recomendado en producción) | ~US$ 2–5/mes |
| Transferencia de datos saliente de Azure | Incluida en la práctica (volúmenes de este sistema son mínimos) |

## Totales por escenario

| Rubro | POC / demo | Producción recomendada |
|---|---|---|
| Alojamiento Azure | ~US$ 20 (Spot) | ~US$ 68 (estándar) |
| IA (hasta 20 notas/día) | ~US$ 1 | ~US$ 2 |
| Correo entrante (Postmark) | US$ 0 (plan gratuito) | US$ 15 |
| WhatsApp / Facebook / Instagram | US$ 0 | US$ 0 |
| Respaldos | — | ~US$ 3 |
| **Total mensual** | **~US$ 21** | **~US$ 85–90** |

### Lectura rápida para la decisión

1. **Hoy la demo cuesta ~US$ 21/mes** y ya publica de punta a punta.
2. El salto a producción estable (~US$ 85/mes) lo explican dos cosas: cambiar la
   VM Spot por una estándar (disponibilidad 24/7 garantizada) y el plan pago de
   correo. Ambas se activan cuando el cliente decida pasar a operación real.
3. La IA no es un factor de costo a estos volúmenes — no tiene sentido
   optimizarla antes que el alojamiento.
4. Todo es cancelable de inmediato: borrar el grupo de recursos de Azure detiene
   el 100% de la facturación el mismo día.
