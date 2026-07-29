"""
Importa categorías y tags desde la API pública del sitio de PaginaUno.Do
al WordPress local del proyecto.

Uso:
  python scripts/import_taxonomy.py

Requiere:
  - Python 3.8+
  - Variables de entorno (leídas del .env):
      WP_LOCAL_URL          (default: http://localhost:8080)
      WP_LOCAL_USER         usuario WP con permisos para crear categorías/tags
      WP_LOCAL_APP_PASSWORD Application Password del usuario (formato 'xxxx xxxx xxxx xxxx xxxx xxxx')
"""
from __future__ import annotations

import base64
import json
import os
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path
from typing import Any


REMOTE_SITE = "https://paginauno.do"
LOCAL_DEFAULT = "http://localhost:8080"


def load_env(env_path: Path) -> None:
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip())


def http_get_json(url: str, headers: dict[str, str] | None = None) -> Any:
    req = urllib.request.Request(url, headers=headers or {"User-Agent": "pa-importer/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def http_post_json(url: str, data: dict[str, Any], headers: dict[str, str]) -> Any:
    body = json.dumps(data).encode("utf-8")
    h = {"Content-Type": "application/json", "User-Agent": "pa-importer/1.0", **headers}
    req = urllib.request.Request(url, data=body, headers=h, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        payload = e.read().decode("utf-8", errors="replace")
        try:
            info = json.loads(payload)
        except json.JSONDecodeError:
            info = {"raw": payload}
        return {"__error__": True, "status": e.code, "body": info}


def basic_auth(user: str, password: str) -> str:
    token = base64.b64encode(f"{user}:{password}".encode("utf-8")).decode("ascii")
    return f"Basic {token}"


def detect_rest_style(site_root: str) -> str:
    """Devuelve 'pretty' (usa /wp-json/) o 'query' (usa ?rest_route=)."""
    try:
        http_get_json(f"{site_root}/wp-json/wp/v2/types?per_page=1")
        return "pretty"
    except urllib.error.HTTPError as e:
        if e.code in (403, 401):
            return "pretty"  # existe pero pide auth — el endpoint responde
        return "query"
    except urllib.error.URLError:
        return "query"


def wp_url(site_root: str, style: str, path: str, **params) -> str:
    """Construye URL de la REST API de WP en cualquiera de los dos estilos."""
    path = path.lstrip("/")
    if style == "pretty":
        base = f"{site_root.rstrip('/')}/wp-json/{path}"
        if params:
            base += "?" + urllib.parse.urlencode(params)
        return base
    # query style
    query = {"rest_route": "/" + path, **params}
    return f"{site_root.rstrip('/')}/?" + urllib.parse.urlencode(query)


def fetch_all_paginated(site_root: str, style: str, path: str, **base_params) -> list[dict]:
    out: list[dict] = []
    page = 1
    while True:
        url = wp_url(site_root, style, path, page=page, **base_params)
        try:
            batch = http_get_json(url)
        except urllib.error.HTTPError as e:
            if e.code == 400:
                break  # más allá del rango de páginas
            raise
        if not batch:
            break
        out.extend(batch)
        page += 1
        if len(batch) < base_params.get("per_page", 100):
            break
        time.sleep(0.2)
    return out


def import_terms(
    kind: str,           # 'categories' | 'tags'
    remote_site: str,
    remote_style: str,
    local_site: str,
    local_style: str,
    auth_header: str,
) -> dict[int, int]:
    """Descarga terms del remoto y los crea en el local. Devuelve mapping remote_id → local_id."""
    print(f"\n=== {kind.upper()} ===")
    print(f"Descargando desde {remote_site} ...")
    remote = fetch_all_paginated(
        remote_site, remote_style, f"wp/v2/{kind}",
        per_page=100, _fields="id,name,slug,parent,description",
    )
    print(f"  → {len(remote)} {kind} en el remoto")

    print(f"Descargando existentes en {local_site} ...")
    local = fetch_all_paginated(
        local_site, local_style, f"wp/v2/{kind}",
        per_page=100, _fields="id,name,slug,parent",
    )
    local_by_slug = {t["slug"]: t["id"] for t in local}
    print(f"  → {len(local)} {kind} ya existen en local")

    remote_to_local: dict[int, int] = {}
    # Categorías: crear primero las raíz (parent=0), luego pasadas siguientes hasta que todo se cree.
    if kind == "categories":
        pending = list(remote)
        for _pass in range(6):  # máx 6 niveles de anidamiento (paginauno tiene 2)
            still_pending = []
            for t in pending:
                slug = t["slug"]
                if slug in local_by_slug:
                    remote_to_local[t["id"]] = local_by_slug[slug]
                    continue
                parent_remote = t.get("parent", 0)
                if parent_remote and parent_remote not in remote_to_local:
                    still_pending.append(t)
                    continue
                payload = {
                    "name": t["name"],
                    "slug": slug,
                    "description": t.get("description", "") or "",
                    "parent": remote_to_local.get(parent_remote, 0),
                }
                res = http_post_json(
                    wp_url(local_site, local_style, "wp/v2/categories"),
                    payload, {"Authorization": auth_header},
                )
                if isinstance(res, dict) and res.get("__error__"):
                    if res["status"] == 400 and "term_exists" in json.dumps(res["body"]):
                        existing = http_get_json(wp_url(local_site, local_style, "wp/v2/categories", slug=slug))
                        if existing:
                            remote_to_local[t["id"]] = existing[0]["id"]
                            local_by_slug[slug] = existing[0]["id"]
                            continue
                    print(f"    ! Error creando '{t['name']}': HTTP {res['status']} {res['body']}")
                    continue
                remote_to_local[t["id"]] = res["id"]
                local_by_slug[slug] = res["id"]
                print(f"    + {t['name']} (id remoto {t['id']} → local {res['id']})")
            pending = still_pending
            if not pending:
                break
    else:  # tags
        for t in remote:
            slug = t["slug"]
            if slug in local_by_slug:
                remote_to_local[t["id"]] = local_by_slug[slug]
                continue
            payload = {"name": t["name"], "slug": slug, "description": t.get("description", "") or ""}
            res = http_post_json(
                wp_url(local_site, local_style, "wp/v2/tags"),
                payload, {"Authorization": auth_header},
            )
            if isinstance(res, dict) and res.get("__error__"):
                if res["status"] == 400 and "term_exists" in json.dumps(res["body"]):
                    existing = http_get_json(wp_url(local_site, local_style, "wp/v2/tags", slug=slug))
                    if existing:
                        remote_to_local[t["id"]] = existing[0]["id"]
                        continue
                print(f"    ! Error creando '{t['name']}': HTTP {res['status']} {res['body']}")
                continue
            remote_to_local[t["id"]] = res["id"]

    print(f"  ✓ {len(remote_to_local)} {kind} sincronizados")
    return remote_to_local


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    load_env(root / ".env")

    local_site = os.environ.get("WP_LOCAL_URL", LOCAL_DEFAULT).rstrip("/")
    user = os.environ.get("WP_LOCAL_USER")
    app_pass = os.environ.get("WP_LOCAL_APP_PASSWORD")

    if not user or not app_pass:
        print(
            "\nERROR: faltan credenciales del WP local.\n"
            "Agrega a tu .env:\n"
            "  WP_LOCAL_USER=admin\n"
            "  WP_LOCAL_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx\n"
            "\nCómo obtener el Application Password:\n"
            "  http://localhost:8080/wp-admin/profile.php → sección 'Application Passwords'.\n",
            file=sys.stderr,
        )
        return 2

    auth = basic_auth(user, app_pass.replace(" ", ""))  # WP acepta con o sin espacios; quitamos por seguridad

    remote_style = detect_rest_style(REMOTE_SITE)
    local_style = detect_rest_style(local_site)

    print(f"Origen : {REMOTE_SITE}  (estilo REST: {remote_style})")
    print(f"Destino: {local_site}  (estilo REST: {local_style})")
    if local_style == "query":
        print("  ⓘ  El WP local usa '?rest_route=' porque no tiene pretty permalinks activados.")
        print("     Para activarlos: http://localhost:8080/wp-admin/options-permalink.php → 'Nombre de la entrada' → Guardar.")

    cat_map = import_terms("categories", REMOTE_SITE, remote_style, local_site, local_style, auth)
    tag_map = import_terms("tags",       REMOTE_SITE, remote_style, local_site, local_style, auth)

    # Guardar mapping (útil si más adelante importamos artículos que referencian estos IDs)
    mapping_path = root / "scripts" / "id_mapping.json"
    mapping_path.write_text(
        json.dumps({"categories": cat_map, "tags": tag_map}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"\nMapping guardado en {mapping_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
