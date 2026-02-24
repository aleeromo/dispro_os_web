"""
Segmentación de imágenes para DisproOS.
- Elimina fondo con rembg (IA) o umbralización de respaldo.
- Agrupa colores dominantes con K-means en espacio LAB.
"""
import math
import numpy as np
import cv2
from typing import Optional

try:
    from rembg import remove as _rembg_remove
    _REMBG_OK = True
except ImportError:
    _REMBG_OK = False


def eliminar_fondo(img_bgr: np.ndarray) -> np.ndarray:
    """
    Elimina el fondo usando rembg (IA). Si no está disponible, usa
    umbralización adaptativa. Devuelve imagen BGRA (alfa = máscara).
    """
    if _REMBG_OK:
        try:
            import io
            from PIL import Image
            img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
            pil_in = Image.fromarray(img_rgb)
            pil_out = _rembg_remove(pil_in)
            rgba = np.array(pil_out)
            return cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGRA)
        except Exception:
            pass

    # Fallback: umbralización simple
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    if np.mean(gray) > 200:
        gray = cv2.bitwise_not(gray)
    _, mask = cv2.threshold(gray, 15, 255, cv2.THRESH_BINARY)
    bgra = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2BGRA)
    bgra[:, :, 3] = mask
    return bgra


def clustering_kmeans_lab(
    img_bgr: np.ndarray,
    mask: Optional[np.ndarray] = None,
    k: int = 5
) -> list:
    """
    K-means en espacio LAB para encontrar colores dominantes.

    Args:
        img_bgr: imagen fuente BGR.
        mask: máscara uint8 — sólo píxeles > 0 participan.
        k: número de clusters.

    Returns:
        Lista de dicts ordenados por porcentaje descendente:
        {'color_hex', 'porcentaje', 'lab': [L,a,b], 'bgr': [B,G,R]}
    """
    img_lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2Lab)

    if mask is not None:
        pixels = img_lab[mask > 0].reshape(-1, 3).astype(np.float32)
    else:
        pixels = img_lab.reshape(-1, 3).astype(np.float32)

    if len(pixels) == 0:
        return []

    k = max(1, min(k, len(pixels)))
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
    _, labels, centers = cv2.kmeans(
        pixels, k, None, criteria, 5, cv2.KMEANS_PP_CENTERS
    )

    labels_flat = labels.flatten()
    total = max(1, len(labels_flat))
    clusters = []

    for idx in range(k):
        count = int(np.sum(labels_flat == idx))
        if count == 0:
            continue
        lab_c = centers[idx]
        lab_pixel = np.uint8([[lab_c]])
        bgr_pixel = cv2.cvtColor(lab_pixel, cv2.COLOR_Lab2BGR)[0][0]
        b, g, r = int(bgr_pixel[0]), int(bgr_pixel[1]), int(bgr_pixel[2])
        clusters.append({
            'color_hex': '#{:02x}{:02x}{:02x}'.format(r, g, b),
            'porcentaje': round(float(count) / float(total) * 100.0, 2),
            'lab': [round(float(lab_c[0]), 2), round(float(lab_c[1]), 2), round(float(lab_c[2]), 2)],
            'bgr': [b, g, r],
        })

    clusters.sort(key=lambda c: c['porcentaje'], reverse=True)
    return clusters


def mascara_por_cluster(
    img_bgr: np.ndarray,
    colores_dominantes: list,
    mask_alfa: Optional[np.ndarray] = None,
    tolerancia_lab: float = 22.0,
) -> list:
    """
    Genera una máscara binaria independiente por cada cluster de color.
    Permite al motor de nesting tratar piezas de distintos colores como
    capas separadas (vinilo, acrílico de color, fondo, etc.).

    Algoritmo: para cada píxel visible, se asigna al cluster cuyo centro
    LAB esté más cercano en distancia euclidiana. Si la distancia supera
    `tolerancia_lab`, el píxel queda sin asignar.

    Args:
        img_bgr:            imagen fuente.
        colores_dominantes: salida de `clustering_kmeans_lab` o `segmentar_imagen`.
        mask_alfa:          máscara de píxeles visibles (None = todos).
        tolerancia_lab:     distancia LAB máxima para asignar píxel a cluster.

    Returns:
        Lista de dicts, uno por cluster, en el mismo orden que `colores_dominantes`:
        {
            'color_hex':  str,
            'porcentaje': float,
            'mask':       np.ndarray uint8 (H, W) — 255 = pertenece al cluster,
        }
    """
    if not colores_dominantes:
        return []

    img_lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2Lab).astype(np.float32)
    h, w = img_lab.shape[:2]

    # Matriz de centros LAB: (k, 3)
    centros = np.array([c['lab'] for c in colores_dominantes], dtype=np.float32)

    # Reshape imagen a (H*W, 3) para vectorizar la distancia
    pixels = img_lab.reshape(-1, 3)
    # Distancia de cada píxel a cada centro: (H*W, k)
    diffs = pixels[:, np.newaxis, :] - centros[np.newaxis, :, :]   # broadcasting
    dists = np.sqrt((diffs ** 2).sum(axis=2))                       # (H*W, k)

    asignaciones = np.argmin(dists, axis=1)          # índice del cluster más cercano
    dist_minima = dists[np.arange(len(dists)), asignaciones]

    # Píxeles con distancia > tolerancia no se asignan a ningún cluster
    sin_asignar = dist_minima > tolerancia_lab
    asignaciones[sin_asignar] = -1

    asignaciones_2d = asignaciones.reshape(h, w).astype(np.int32)

    resultado = []
    for idx, cluster in enumerate(colores_dominantes):
        mascara = np.zeros((h, w), dtype=np.uint8)
        mascara[asignaciones_2d == idx] = 255
        if mask_alfa is not None:
            mascara[mask_alfa == 0] = 0  # excluir fondo
        resultado.append({
            'color_hex': cluster['color_hex'],
            'porcentaje': cluster['porcentaje'],
            'mask': mascara,
        })

    return resultado


def segmentar_imagen(img_bgr: np.ndarray, k_colores: int = 5) -> dict:
    """
    Pipeline completo: elimina fondo y agrupa colores dominantes.

    Returns:
        {
            'img_sin_fondo': np.ndarray (BGRA),
            'mask_alfa':     np.ndarray (uint8 binaria),
            'colores_dominantes': list[dict]
        }
    """
    bgra = eliminar_fondo(img_bgr)
    mask_alfa = bgra[:, :, 3]
    colores = clustering_kmeans_lab(img_bgr, mask=mask_alfa, k=k_colores)
    return {
        'img_sin_fondo': bgra,
        'mask_alfa': mask_alfa,
        'colores_dominantes': colores,
    }


def segmentar_piezas(
    img_bgr: np.ndarray,
    ancho_m: float,
    alto_m: float,
    k: int = 6,  # mantenido por compatibilidad de firma; ya no se usa K-means
    exclusion_zones: Optional[list] = None,
) -> list:
    """
    Pipeline de visión basado en umbralización estricta + detección quirúrgica
    de líneas de acotación con HoughLinesP.

    Paso 1 – Binarización estricta:
        Umbral 240: pixel < 240 → diseño (255); pixel >= 240 → fondo (0).
        Garantiza que colores oscuros (azul, rojo, dorado) no sean confundidos
        con fondo blanco.

    Paso 2 – Borrado quirúrgico de cotas:
        a. Zonas OCR (exclusion_zones) → rectángulos blancos sobre la máscara.
        b. HoughLinesP sobre bordes Canny de la máscara: detecta ÚNICAMENTE
           segmentos perfectamente rectos (±5° de hor/vert) con longitud ≥ 20%
           del min(W,H). Nunca usa MORPH_OPEN global que destruye trazos horizontales
           de letras grandes como "#ViveFES" o "Construyendo una planta modelo".

    Paso 3 – Agrupación morfológica:
        Dilation proporcional para fusionar letras de la misma palabra.
        Kernel ligeramente mayor que antes (1.5%) para capturar inter-letra.

    Paso 4 – Componentes conexos + filtrado post-CC:
        connectedComponentsWithStats con área mínima de 15 px.
        Filtro geométrico extra: rechaza residuos de líneas (aspect_ratio > 18:1,
        posición periférica y área < 5% del componente principal).

    Returns:
        Lista de dicts [{mask, color_hex, bbox_px, cluster_idx, area_px}]
        ordenada por area_px descendente.
    """
    H, W = img_bgr.shape[:2]

    # ── Paso 1: Binarización estricta ─────────────────────────────────────────
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    _, mask = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY_INV)

    # ── Paso 2a: Borrado de zonas OCR ─────────────────────────────────────────
    if exclusion_zones:
        for (x1, y1, x2, y2) in exclusion_zones:
            cv2.rectangle(
                mask,
                (int(max(0, x1 - 6)), int(max(0, y1 - 6))),
                (int(min(W - 1, x2 + 6)), int(min(H - 1, y2 + 6))),
                0, -1,
            )

    # ── Paso 2b: Detección quirúrgica de líneas de acotación con HoughLinesP ──
    # Busca segmentos rectos largos (≥ 20 % del min(W,H)) y casi horizontales o
    # verticales (tolerancia ±5°). Solo esas geometrías corresponden a flechas de
    # cota; ningún trazo de letra cumple ambas condiciones simultáneamente.
    # MORPH_OPEN global fue eliminado porque destruía trazos de letras grandes.
    min_line_len = max(50, min(W, H) // 5)
    edges_hough = cv2.Canny(mask, 50, 150)
    hough_lines = cv2.HoughLinesP(
        edges_hough,
        rho=1,
        theta=np.pi / 180,
        threshold=40,
        minLineLength=min_line_len,
        maxLineGap=10,
    )
    if hough_lines is not None:
        dim_lines_mask = np.zeros((H, W), dtype=np.uint8)
        for seg in hough_lines:
            x1, y1, x2, y2 = seg[0]
            dx = float(x2 - x1)
            dy = float(y2 - y1)
            length = math.hypot(dx, dy)
            if length < min_line_len:
                continue
            angle_deg = math.degrees(math.atan2(abs(dy), abs(dx) + 1e-9))
            # Solo líneas casi horizontales (<5°) o casi verticales (>85°)
            if angle_deg < 5.0 or angle_deg > 85.0:
                cv2.line(dim_lines_mask, (x1, y1), (x2, y2), 255, 4)
        if cv2.countNonZero(dim_lines_mask) > 0:
            k_exp = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))
            dim_lines_mask = cv2.dilate(dim_lines_mask, k_exp, iterations=1)
            mask = cv2.bitwise_and(mask, cv2.bitwise_not(dim_lines_mask))

    # ── Paso 3: Agrupación morfológica para fusionar letras ───────────────────
    # Kernel proporcional a la resolución (1.5 % del min(H,W)), ligeramente más
    # agresivo que antes para bridgear el espacio inter-carácter de fuentes grandes.
    k_sz = max(5, min(20, int(min(H, W) * 0.015)))
    kernel_grupo = cv2.getStructuringElement(cv2.MORPH_RECT, (k_sz, k_sz))
    mask_dilated = cv2.dilate(mask, kernel_grupo, iterations=2)

    # ── Paso 4: Componentes conexos ───────────────────────────────────────────
    num_labels, label_map, stats, _ = cv2.connectedComponentsWithStats(
        mask_dilated, connectivity=8
    )

    area_min_px = max(15, int(H * W * 0.00003))

    # Área del componente más grande como referencia para el filtro relativo
    areas_validas = [
        int(stats[i, cv2.CC_STAT_AREA])
        for i in range(1, num_labels)
        if int(stats[i, cv2.CC_STAT_AREA]) >= area_min_px
    ]
    area_max_ref = max(areas_validas) if areas_validas else 1

    resultado = []
    for comp_idx in range(1, num_labels):
        area_d = int(stats[comp_idx, cv2.CC_STAT_AREA])
        if area_d < area_min_px:
            continue

        bx = int(stats[comp_idx, cv2.CC_STAT_LEFT])
        by = int(stats[comp_idx, cv2.CC_STAT_TOP])
        bw = int(stats[comp_idx, cv2.CC_STAT_WIDTH])
        bh = int(stats[comp_idx, cv2.CC_STAT_HEIGHT])

        # ── Filtro post-CC: rechazar residuos lineales que Hough no eliminó ──
        # Criterio: aspect ratio muy alto (>18:1) + posición periférica (borde
        # exterior 8 %) + área pequeña relativa al componente principal (<5 %).
        aspect = float(max(bw, bh)) / float(max(1, min(bw, bh)))
        is_peripheral = (
            bx < W * 0.08 or bx + bw > W * 0.92 or
            by < H * 0.08 or by + bh > H * 0.92
        )
        if aspect > 18.0 and is_peripheral and (area_d / area_max_ref) < 0.05:
            continue

        # Forma exacta: solo los píxeles originales (no dilatados) de la región
        region = (label_map == comp_idx)
        piece_mask = np.zeros((H, W), dtype=np.uint8)
        piece_mask[region & (mask > 0)] = 255

        area_px = int(np.sum(piece_mask > 0))
        if area_px < area_min_px:
            continue

        # Color representativo: mediana de los píxeles originales del componente
        pixels_color = img_bgr[piece_mask > 0]
        if len(pixels_color) == 0:
            continue
        median_bgr = np.median(pixels_color, axis=0).astype(int)
        b_c, g_c, r_c = int(median_bgr[0]), int(median_bgr[1]), int(median_bgr[2])
        color_hex = '#{:02x}{:02x}{:02x}'.format(r_c, g_c, b_c)

        ys, xs = np.where(piece_mask > 0)
        x = int(xs.min())
        y = int(ys.min())
        w_b = int(xs.max()) - x + 1
        h_b = int(ys.max()) - y + 1

        resultado.append({
            'mask': piece_mask,
            'color_hex': color_hex,
            'bbox_px': (x, y, w_b, h_b),
            'cluster_idx': 0,
            'area_px': area_px,
        })

    resultado.sort(key=lambda p: p['area_px'], reverse=True)
    return resultado


def segmentar_piezas_por_contornos(
    img_bgr: np.ndarray,
    ancho_m: float,
    alto_m: float,
    exclusion_zones: Optional[list] = None,
) -> list:
    """
    Detección por contornos: una caja por forma conectada (una por letra/elemento).
    Reutiliza binarización y borrado de cotas de segmentar_piezas, pero SIN dilatación
    que fusiona letras. Usa findContours para obtener un contorno por forma.

    Returns:
        Lista de dicts con id (int), x, y, w, h, norm_x, norm_y, norm_w, norm_h,
        color_hex, mask (máscara del contorno para vectorizar). Opcional is_master.
    """
    H, W = img_bgr.shape[:2]

    # ── Paso 1: Binarización estricta (igual que segmentar_piezas) ─────────────
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    _, mask = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY_INV)

    # ── Paso 2a: Borrado de zonas OCR ─────────────────────────────────────────
    if exclusion_zones:
        for (x1, y1, x2, y2) in exclusion_zones:
            cv2.rectangle(
                mask,
                (int(max(0, x1 - 6)), int(max(0, y1 - 6))),
                (int(min(W - 1, x2 + 6)), int(min(H - 1, y2 + 6))),
                0, -1,
            )

    # ── Paso 2b: Detección de líneas de acotación con HoughLinesP ────────────
    min_line_len = max(50, min(W, H) // 5)
    edges_hough = cv2.Canny(mask, 50, 150)
    hough_lines = cv2.HoughLinesP(
        edges_hough,
        rho=1,
        theta=np.pi / 180,
        threshold=40,
        minLineLength=min_line_len,
        maxLineGap=10,
    )
    if hough_lines is not None:
        dim_lines_mask = np.zeros((H, W), dtype=np.uint8)
        for seg in hough_lines:
            x1, y1, x2, y2 = seg[0]
            dx = float(x2 - x1)
            dy = float(y2 - y1)
            length = math.hypot(dx, dy)
            if length < min_line_len:
                continue
            angle_deg = math.degrees(math.atan2(abs(dy), abs(dx) + 1e-9))
            if angle_deg < 5.0 or angle_deg > 85.0:
                cv2.line(dim_lines_mask, (x1, y1), (x2, y2), 255, 4)
        if cv2.countNonZero(dim_lines_mask) > 0:
            k_exp = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))
            dim_lines_mask = cv2.dilate(dim_lines_mask, k_exp, iterations=1)
            mask = cv2.bitwise_and(mask, cv2.bitwise_not(dim_lines_mask))

    # ── Sin dilatación: findContours sobre la máscara tal cual ──────────────
    # Cualquier dilatación (incluso 1–2 px) une letras cercanas y genera cajas
    # por palabra en lugar de una caja por letra. Usar la máscara directa.
    contours, hierarchy = cv2.findContours(
        mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE
    )

    area_img = float(W * H)
    resultado = []
    for idx, cnt in enumerate(contours):
        # Solo contornos de nivel superior (evitar huecos interiores como el de "O")
        if hierarchy is not None and len(hierarchy) > 0:
            hi = hierarchy[0][idx] if hierarchy.ndim == 3 else hierarchy[idx]
            if int(hi[3]) != -1:
                continue
        x, y, w, h = cv2.boundingRect(cnt)
        if w < 2 or h < 2:
            continue
        if (w * h) >= area_img * 0.98:
            continue

        norm_x = x / float(W)
        norm_y = y / float(H)
        norm_w = w / float(W)
        norm_h = h / float(H)

        # Máscara solo de este contorno (píxeles originales de mask, no dilatados)
        piece_mask = np.zeros((H, W), dtype=np.uint8)
        cv2.drawContours(piece_mask, [cnt], 0, 255, -1)
        piece_mask = cv2.bitwise_and(piece_mask, mask)

        area_px = int(np.sum(piece_mask > 0))
        if area_px < 15:
            continue

        # Color representativo: mediana de píxeles del contorno en la imagen original
        pixels_color = img_bgr[piece_mask > 0]
        if len(pixels_color) == 0:
            continue
        median_bgr = np.median(pixels_color, axis=0).astype(int)
        b_c, g_c, r_c = int(median_bgr[0]), int(median_bgr[1]), int(median_bgr[2])
        color_hex = '#{:02x}{:02x}{:02x}'.format(r_c, g_c, b_c)

        is_master = False
        for other in resultado:
            on = other
            if (norm_x <= on['norm_x'] + 0.005 and norm_y <= on['norm_y'] + 0.005 and
                    (norm_x + norm_w) >= (on['norm_x'] + on['norm_w']) - 0.005 and
                    (norm_y + norm_h) >= (on['norm_y'] + on['norm_h']) - 0.005):
                is_master = True
                break

        resultado.append({
            'id': len(resultado),
            'x': int(x), 'y': int(y), 'w': int(w), 'h': int(h),
            'norm_x': norm_x, 'norm_y': norm_y, 'norm_w': norm_w, 'norm_h': norm_h,
            'color_hex': color_hex,
            'mask': piece_mask,
            'contour': cnt,
            'is_master': is_master,
        })

    return resultado
