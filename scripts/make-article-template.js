// Genera templates/article.html: foto de fondo + marco 1.png del cliente + titular.
const fs = require('node:fs');
const b64 = fs.readFileSync('templates/1.png').toString('base64');

const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>{{title}}</title>
  <style>
    /* Plantilla de portada de PaginaUno.Do (1080x1350, formato 4:5 de IG).
       El marco (bandera + degradado + logo + barra de redes) es el PNG oficial
       del cliente incrustado en base64 — la foto va DEBAJO y el titular ENCIMA. */
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 1080px; height: 1350px; }
    .canvas { position: relative; width: 1080px; height: 1350px; overflow: hidden; background: #111; }

    .foto {
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      object-fit: cover; object-position: center top;
    }

    .marco { position: absolute; inset: 0; width: 100%; height: 100%; }

    /* Chip de categoría: centrado en el degradado, justo sobre el logo del marco. */
    .chip {
      position: absolute;
      top: 906px; left: 50%;
      transform: translateX(-50%);
      background: #C8102E;
      color: #fff;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 21px; font-weight: 700;
      letter-spacing: 2.5px; text-transform: uppercase;
      padding: 5px 20px; border-radius: 999px;
      white-space: nowrap;
    }
    /* Zona de titular: entre el logo del marco y la barra negra inferior. */
    .titular {
      position: absolute;
      left: 60px; right: 60px;
      top: 1068px; height: 162px;
      display: flex; align-items: center; justify-content: center;
      text-align: center;
    }
    h1 {
      color: #fff;
      font-family: Arial, Helvetica, sans-serif;
      font-weight: 800;
      font-size: 44px; line-height: 1.14;
      text-shadow: 0 2px 10px rgba(0,0,0,0.55);
      display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
      overflow: hidden;
    }
    /* Titulares largos bajan de cuerpo para caber completos en 3 líneas. */
    h1.largo  { font-size: 38px; }
    h1.maximo { font-size: 33px; }
  </style>
</head>
<body>
  <div class="canvas">
    <img class="foto" src="{{image_url}}" alt="" />
    <img class="marco" src="data:image/png;base64,${b64}" alt="" />
    <span class="chip">{{category}}</span>
    <div class="titular">
      <h1 id="t">{{title}}</h1>
    </div>
  </div>
  <script>
    const t = document.getElementById('t');
    const n = (t.textContent || '').length;
    if (n > 100) t.classList.add('maximo');
    else if (n > 72) t.classList.add('largo');
  </script>
</body>
</html>
`;

fs.writeFileSync('templates/article.html', html);
console.log('templates/article.html generado:', Math.round(html.length / 1024), 'KB');
