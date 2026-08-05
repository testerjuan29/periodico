"""
Test de descarga de media de WhatsApp Cloud API desde el HOST (no desde Docker).
Sirve para descartar si el 500 de lookaside.fbsbx.com es específico a la IP del contenedor.

Uso:
  python scripts/test_wa_download.py <media-id>

Si no se pasa media-id, usa uno hardcoded de ejemplo.

Requiere en .env:
  META_PAGE_ACCESS_TOKEN=EAA...
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path


def load_env(env_path: Path) -> None:
    if not env_path.exists():
        print(f"ERROR: no encuentro {env_path}", file=sys.stderr)
        sys.exit(1)
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip())


def http_get(url: str, headers: dict[str, str]) -> tuple[int, dict[str, str], bytes]:
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            body = r.read()
            return r.status, dict(r.headers), body
    except urllib.error.HTTPError as e:
        body = e.read()
        return e.code, dict(e.headers), body


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    load_env(root / ".env")

    token = os.environ.get("META_PAGE_ACCESS_TOKEN")
    if not token:
        print("ERROR: falta META_PAGE_ACCESS_TOKEN en .env", file=sys.stderr)
        return 2

    media_id = sys.argv[1] if len(sys.argv) > 1 else "1566268371694199"
    print(f"Probando descarga del media: {media_id}")
    print(f"Token (últimos 8 chars): ...{token[-8:]}\n")

    # PASO 1: obtener URL fresca
    print("=" * 60)
    print("PASO 1 — GET /v20.0/{media-id}")
    print("=" * 60)
    status1, headers1, body1 = http_get(
        f"https://graph.facebook.com/v20.0/{media_id}",
        {"Authorization": f"Bearer {token}", "User-Agent": "PeriodicoBot/1.0 (test)"},
    )
    print(f"Status: {status1}")
    if status1 != 200:
        print(f"Body: {body1.decode('utf-8', errors='replace')[:500]}")
        return 3

    info = json.loads(body1)
    print(f"URL fresca:  {info.get('url', '(sin url)')}")
    print(f"MIME:        {info.get('mime_type')}")
    print(f"File size:   {info.get('file_size')} bytes")
    print(f"SHA256:      {info.get('sha256')}\n")

    if not info.get("url"):
        print("ERROR: paso 1 no devolvió url", file=sys.stderr)
        return 4

    # PASO 2: descargar el binary
    print("=" * 60)
    print("PASO 2 — GET la URL de lookaside")
    print("=" * 60)
    status2, headers2, body2 = http_get(
        info["url"],
        {
            "Authorization": f"Bearer {token}",
            "User-Agent": "Mozilla/5.0 (compatible; PeriodicoBot/1.0)",
            "Accept": "image/*, */*",
        },
    )
    print(f"Status:       {status2}")
    print(f"Content-Type: {headers2.get('Content-Type', headers2.get('content-type', '?'))}")
    print(f"Bytes:        {len(body2)}")

    if status2 == 200:
        print(f"Primeros 20 bytes (hex): {body2[:20].hex()}")
        # Guardar la imagen para inspección visual
        out_path = root / "scripts" / f"wa_test_{media_id}.jpg"
        out_path.write_bytes(body2)
        print(f"\n✓ Imagen guardada en: {out_path}")
        print(f"  Ábrela para verificar que es la foto correcta.")
        return 0
    else:
        print(f"\nBody de la respuesta:")
        print(body2.decode("utf-8", errors="replace")[:500])
        return 5


if __name__ == "__main__":
    sys.exit(main())
