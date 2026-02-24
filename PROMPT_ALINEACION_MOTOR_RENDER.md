# Prompt: Alineación DisproOS con Motor Render

Copia y pega todo lo que está debajo de la línea "---" en una conversación con el agente para alinear la detección (backend), generate-SVG y el render 3D (frontend) de DisproOS con el comportamiento del Motor Render, manteniendo job id, almacén por job y flujo ROLLO/3D/OCR.

---

## 1. Contexto inicial

**DisproOS** es un sistema industrial web para cotización, nesting CNC y render 3D. El flujo es fijo: carga imagen → detección/clasificación → procesamiento geométrico → Smart Render 3D → cotización/PDF.

**Motor Render** es un módulo standalone en `C:\Users\aleja\Desktop\DisproOS OK\PTM\Motor render\Motor render`. La detección y el render 3D funcionan correctamente allí; debe ser la **referencia** para DisproOS.

### Rutas clave Motor Render

- **Backend:** `Motor render/Motor render/backend/main.py` — endpoints `detect-shapes`, `generate-svg`.
- **Frontend:** `Motor render/Motor render/frontend/src/App.jsx` — componentes ShapeMesh, Render3D: escala, extrusion, UV, pointLight, Bloom.

---

## 2. Contexto actual (DisproOS)

**Ya implementado:** Fase 1 (job id, almacén por job, preprocesar/analizar/generate-svg con job, validación, errores estructurados); Fase 2 (vectores CNC desde backend, GET /api/v1/vectores-cnc).

**Detección actual:** Modo por defecto 3D; ROLLO solo con cotas en imagen + una pieza que ocupe ≥80%; cajas en ROLLO; fallback “imagen completa”; candidatos “full image” en detección.

### Dónde está el código actual

- **Backend detección:** `dispro_os_web/backend/app/main.py` — `_detect_shapes_smart_render`, `_resolve_modo_final`, `preprocesar`.
- **Frontend render 3D:** `dispro_os_web/frontend/src/components/estudio/Render3DCanvas.jsx` y `dispro_os_web/frontend/src/components/Modelo3D.jsx` (deprecado pero con lógica de escala/profundidades).
- **Documento de discrepancias:** `docs/PLAN_MOTOR_RENDER.md` (tablas Backend vs DisproOS, Frontend Render 3D).

---

## 3. Diferencias concretas a cerrar (resumen para el prompt)

### Detección (backend)

| Aspecto | Motor Render | DisproOS actual |
|--------|--------------|------------------|
| Imagen | `gray = cv2.cvtColor(img, BGR2GRAY)`; sin tratar alpha | Alpha → blanco; varias rutas (alpha/gray) y umbral 200 por defecto |
| Umbral | `threshold(gray, 240, 255, THRESH_BINARY_INV)` | Umbral 200 (y 128 en fallback) |
| Filtro bbox | Solo `w<2 or h<2 or w>w_img*0.99` | Filtros + candidatos “full image”; lógica más compleja |
| is_master | Contención solo por X y esquina superior (`norm_x`, `norm_y`, `norm_x+norm_w`; no exige extent Y) | Jerarquía OpenCV (childrenIds); criterio distinto |
| Otros | Sin OCR, sin modo ROLLO/3D | OCR, ROLLO/3D, job store |

### Render 3D (frontend)

| Aspecto | Motor Render | DisproOS (Render3DCanvas/Modelo3D) |
|--------|--------------|------------------------------------|
| Escala grupo | `[0.02, -0.02, 0.02]` (SVG en px) | Escala según getScaleForRender: metros [1,-1,1] o px [0.02,-0.02,0.02] |
| depth | vinil 0.2, caja 8, letra 25 (px); bevel 0.4; curveSegments 96 | depth en m o px según useMeters; bevel más pequeño en m |
| UV impreso | `uv.setXY(j, x/imageWidth, 1.0 - y/imageHeight)` | Implementado en Render3DCanvas; verificar que imageWidth/Height lleguen en px cuando SVG esté en px |
| pointLight aluminio | position [0,0,zPos-1], distance=15, intensity 2.5, decay 2 | distance 15 o escalado; position con lightZ |
| polygonOffset vinil | -60 / -120 | -60 / -120 en Render3DCanvas |
| Bloom | intensity 1.0 (lightsOn), threshold 0.85 | Similar; revisar parámetros |

---

## 4. Plan a seguir (instrucciones dentro del prompt)

### Detección (backend)

En DisproOS, ofrecer un **“modo Motor”** o alinear la rama de detección 3D con Motor Render:

- Misma binarización: `gray`, threshold **240 INV** (no 200 ni 128 en esa rama).
- Mismo filtro bbox: solo `w<2 or h<2 or w>w_img*0.99` (sin área mínima extra ni candidatos full image en esa rama).
- Mismo criterio **is_master**: contención solo por X y esquina superior (`norm_x`, `norm_y`, `norm_x+norm_w`); **no exigir extent Y**.

Mantener job id y almacén por job; **no eliminar** flujo ROLLO/3D/OCR, pero que la rama que alimenta el 3D (contornos + cajas + generate-svg) reproduzca la lógica de Motor cuando se use para Letras 3D.

### Generate-SVG

- Mismo **EPSILON_FACTOR** (0.0001), approxPolyDP, huecos con **fill-rule evenodd**.
- En DisproOS el SVG puede estar en metros (analizar); si el frontend espera px para el render, **documentar o unificar** (viewBox y escala del grupo 3D).

### Render 3D (frontend)

Revisar **Render3DCanvas.jsx** y, si aplica, **Modelo3D.jsx**:

- Escala del grupo (px vs metros según origen del SVG).
- Depths, bevel, curveSegments (alinear con Motor: vinil 0.2, caja 8, letra 25 px; bevel 0.4; curveSegments 96 cuando se use px).
- UV impreso: `uv.setXY(j, x/imageWidth, 1.0 - y/imageHeight)`; asegurar que imageWidth/imageHeight lleguen en px cuando el SVG esté en px.
- pointLight aluminio: position [0,0,zPos-1], **distance 15**, **intensity 2.5**, **decay 2**.
- polygonOffset vinil: **-60 / -120**.
- Bloom: **intensity 1.0**, **threshold 0.85** cuando lightsOn.

Objetivo: que el resultado visual coincida con Motor Render.

### Restricciones

- **No cambiar** diseño ni paneles de DisproOS.
- **No tocar** pestañas Servicios ni Proyectos.
- Mantener estética y flujo en 5 fases.

---

Cuando termines, indica qué archivos modificaste y cómo comprobar que la detección 3D y el render coinciden con Motor Render (ej.: misma binarización, mismo is_master, mismos parámetros de luz y Bloom).
