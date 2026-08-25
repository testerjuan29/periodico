// Genera templates/slide-siguenos.html: el slide 2 del carrusel (2.png del
// cliente sobre fondo blanco, 1080x1350). Sin variables — es estático.
// Correr de nuevo si el cliente entrega un 2.png nuevo.
const fs = require('node:fs');
const b64 = fs.readFileSync('templates/2.png').toString('base64');

const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Siguenos</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 1080px; height: 1350px; background: #ffffff; }
    img { position: absolute; inset: 0; width: 1080px; height: 1350px; }
  </style>
</head>
<body>
  <img src="data:image/png;base64,${b64}" alt="" />
</body>
</html>
`;

fs.writeFileSync('templates/slide-siguenos.html', html);
console.log('templates/slide-siguenos.html generado:', Math.round(html.length / 1024), 'KB');
