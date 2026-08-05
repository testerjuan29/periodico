import Fastify from 'fastify';
import puppeteer, { Browser } from 'puppeteer';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync, createReadStream } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join, basename } from 'node:path';

const PORT = Number(process.env.PORT ?? 3001);
const TEMPLATES_DIR = process.env.TEMPLATES_DIR ?? '/templates';
const OUTPUT_DIR = process.env.OUTPUT_DIR ?? '/output';

const app = Fastify({ logger: true });

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browser && browser.connected) return browser;
  browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  return browser;
}

function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? '');
}

interface RenderBody {
  template: string;
  vars: Record<string, string>;
  width?: number;
  height?: number;
}

app.get('/health', async () => ({ ok: true }));

// Sirve los archivos renderizados por HTTP. Existe para plataformas donde los
// servicios NO comparten volumen (Railway, Fly, etc.): el backoffice hace
// proxy a este endpoint en vez de leer el filesystem.
app.get<{ Params: { file: string } }>('/output/:file', async (req, reply) => {
  const file = basename(req.params.file); // corta cualquier path traversal
  const full = join(OUTPUT_DIR, file);
  if (!existsSync(full)) {
    return reply.code(404).send({ error: 'not found' });
  }
  const MIME_BY_EXT: Record<string, string> = {
    png: 'image/png',
    webp: 'image/webp',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
  };
  const ext = file.split('.').pop()?.toLowerCase() ?? '';
  reply.header('Content-Type', MIME_BY_EXT[ext] ?? 'image/jpeg');
  reply.header('Cache-Control', 'public, max-age=3600');
  return reply.send(createReadStream(full));
});

app.post<{ Body: RenderBody }>('/render', async (req, reply) => {
  const { template, vars, width = 1080, height = 1080 } = req.body ?? ({} as RenderBody);
  if (!template || !vars) {
    return reply.code(400).send({ error: 'template and vars are required' });
  }

  const templatePath = join(TEMPLATES_DIR, `${template}.html`);
  if (!existsSync(templatePath)) {
    return reply.code(404).send({ error: `template ${template} not found` });
  }

  const raw = await readFile(templatePath, 'utf8');
  const html = render(raw, vars);

  if (!existsSync(OUTPUT_DIR)) await mkdir(OUTPUT_DIR, { recursive: true });
  const id = randomUUID();
  // JPEG: soportado por Instagram Content Publishing API (PNG no).
  // Compatible con WordPress y Facebook Pages, así unificamos el formato.
  const outPath = join(OUTPUT_DIR, `${id}.jpg`);

  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const img = await page.screenshot({ type: 'jpeg', quality: 92, fullPage: false });
    await writeFile(outPath, img);
  } finally {
    await page.close();
  }

  return { id, path: outPath, url: `/output/${id}.jpg` };
});

app.listen({ port: PORT, host: '0.0.0.0' })
  .then(() => app.log.info(`image-renderer listening on ${PORT}`))
  .catch((err) => { app.log.error(err); process.exit(1); });

process.on('SIGTERM', async () => {
  if (browser) await browser.close();
  process.exit(0);
});
