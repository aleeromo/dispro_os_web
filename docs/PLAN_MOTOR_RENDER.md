# Plan de reemplazo: Motor Render → DisproOS

## 1. Discrepancias detectadas

### Backend – Detección y contornos

| Aspecto | Motor Render (referencia) | DisproOS (actual) |
|--------|----------------------------|--------------------|
| Transparencias | No trata alpha en el snippet | Sí: alpha=0 → blanco en preprocesar y analizar |
| Binarización | `gray`, threshold 240 INV, sin modificar binary | Igual en _seg_preview_contornos |
| findContours | `RETR_TREE`, `CHAIN_APPROX_SIMPLE` | Igual en _seg_preview_contornos |
| Filtros bbox | `w<2 or h<2 or w>w_img*0.99` (sin área mínima) | Añade `contourArea(cnt) < min_area_px` (min_area_px = max(25, area*0.00015)) → puede eliminar letras pequeñas |
| is_master | s1 contiene a s2 solo por X y esquina superior: `norm_x<=s2+0.005`, `norm_y<=s2+0.005`, `(norm_x+norm_w)>=(s2.norm_x+s2.norm_w)-0.005` (no exige extent Y) | Mismo criterio en preprocesar; en segmentation.py `segmentar_piezas_por_contornos` exige también extent en Y → discrepancia |
| SVG (generate) | approxPolyDP con EPSILON_FACTOR=0.0001, huecos con fill-rule evenodd, coords en px | _build_svg_motor_style igual con scale_x/scale_y; en analizar scale a metros |

### Backend – Respuesta /api/v1/analizar

- Motor no tiene endpoint “analizar”; tiene detect-shapes + generate-svg.
- DisproOS debe devolver: `svg_path_d` (SVG completo con data-type, data-mat, data-col) y colores detectados. Hoy `svg_path_d` se rellena cuando hay classifications o desde geo_o; `colores_dominantes` no se puebla en modo 3D.

### Frontend – Render 3D

| Aspecto | Motor Render | DisproOS Modelo3D |
|--------|--------------|-------------------|
| Escala | Grupo `[0.02, -0.02, 0.02]` (SVG en px) | Grupo `[1, -1, 1]` (SVG en m) → correcto si viewBox en m |
| ExtrudeGeometry | depth: vinil 0.2, caja 8, letra 25; bevel 0.4; curveSegments 96 | depth en m: vinil 0.002, caja 0.15, letra profCanto; bevel 0.004 |
| UV impreso | Explícito: `uv.setXY(j, x/imageWidth, 1.0 - y/imageHeight)` | No aplica UV por posición → textura impresa puede desalinearse |
| pointLight (halo aluminio) | position [0,0,zPos-1], distance 15, intensity 2.5, decay 2 | position con lightZ; distance 1.0 → en metros puede ser corto para halo visible |
| Materiales | MeshPhysicalMaterial, transmission/ior/thickness, emissive, polygonOffset -60/-120 para vinil | Similar; polygonOffset -1/-1 para vinil |
| Bloom | intensity 1.0 cuando lightsOn, threshold 0.85 | Igual |

## 2. Plan de reemplazo (solo motor interno)

### Backend

1. **preprocesar (_seg_preview_contornos)**  
   - Quitar o reducir mucho el filtro por área mínima para no descartar letras pequeñas: eliminar `min_area_px` o fijarlo en 4 px. Mantener RETR_TREE, threshold 240 INV e is_master exacto como Motor (solo condición X/esquina, sin exigir extent Y en containment).
2. **/api/v1/analizar**  
   - Garantizar que siempre se devuelva `svg_path_d` (SVG completo) cuando haya geometría 3D (con o sin classifications).  
   - Poblar `colores_dominantes` desde `geo_o` (lista de hex únicos por pieza).
3. **generate-svg**  
   - Sin cambios; ya usa _build_svg_motor_style y TEMP_CONTOURS_CACHE.

### Frontend (Modelo3D.jsx)

1. **ExtrudedSign / ShapeMesh**  
   - Recibir `imageWidth` e `imageHeight` en metros (anchoM, altoM) para UV.  
   - Aplicar UV para tipo impreso como en Motor: `uv.setXY(j, x/imageWidth, 1.0 - y/imageHeight)`.  
   - Mantener depth en metros (profCanto, caja, vinil).  
   - pointLight para aluminio: `distance` en escala métrica (p. ej. `1.0` o `2 * profCanto`) para que el halo sea visible.  
   - Opcional: alinear polygonOffset del vinil con Motor (-60/-120 en su escala equivale a valores más negativos en nuestra escala; si z-fighting persiste, ajustar).
2. **No tocar**  
   - Paneles laterales, diseño visual, SignModel (caja simple sin SVG). Solo se cambia el motor de render del canvas 3D (ExtrudedSign + luces + Bloom).

## 3. Restricción

- No modificar diseño visual ni paneles laterales de DisproOS.  
- Adaptar toda la lógica a props de DisproOS: anchoM, altoM, profCanto (escala real del cotizador).
