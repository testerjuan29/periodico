# Scripts de mantenimiento

## `import_taxonomy.py`

Descarga las **categorías y tags de PaginaUno.Do** (vía su API REST pública) y las crea en el WordPress local. Respeta la jerarquía padre-hijo de las categorías.

### Prerequisitos

1. WordPress local corriendo (`http://localhost:8080`) con instalador completado.
2. Un **Application Password** para el usuario admin del WP local:
   - Login en http://localhost:8080/wp-admin
   - Menú **Usuarios → Perfil**
   - Baja hasta **Contraseñas de aplicación** → Nombre: `taxonomy-import` → **Añadir nueva**
   - Copia la contraseña generada (formato `xxxx xxxx xxxx xxxx xxxx xxxx`) — solo se muestra una vez.
3. Añadir al `.env`:
   ```
   WP_LOCAL_URL=http://localhost:8080
   WP_LOCAL_USER=admin
   WP_LOCAL_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
   ```

### Ejecutar

```powershell
python scripts/import_taxonomy.py
```

Salida esperada:
```
=== CATEGORIES ===
Descargando desde https://paginauno.do/wp-json/wp/v2 ...
  → 98 categories en el remoto
Descargando existentes en http://localhost:8080/wp-json/wp/v2 ...
  → 1 categories ya existen en local
    + Actualidad (id remoto 68 → local 2)
    + Nacionales (id remoto 66 → local 3)
    ...
  ✓ 98 categories sincronizados

=== TAGS ===
  ...

Mapping guardado en scripts/id_mapping.json
```

El archivo `scripts/id_mapping.json` guarda la correspondencia `id_remoto → id_local` — útil si más adelante importamos artículos que referencian esos IDs.

### Idempotencia

El script es **seguro de re-ejecutar**. Detecta por `slug` qué categorías/tags ya existen y las salta.

### Solo Python stdlib

No requiere instalar dependencias (`pip install ...`). Usa solo módulos de la biblioteca estándar: `urllib`, `json`, `base64`.
