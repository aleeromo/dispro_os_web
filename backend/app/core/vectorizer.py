"""
Vectorizador de contornos para DisproOS.
- Primera opción: pypotrace (bindings C de Potrace) → curvas Bézier de alta calidad.
- Fallback: OpenCV + Catmull-Rom → cúbicas SVG propias.

Función principal de uso externo:
    contorno_a_svg_d(contorno, scale_x, scale_y)  → str  (d= de un <path>)
    vectorizar_mask(mask, scale_x, scale_y)        → str  (todos los sub-paths)
    vectorizar_imagen(img_bgr, mask_alfa, scale_x, scale_y) → dict
"""
import numpy as np
import cv2
from typing import Optional

try:
    import potrace as _potrace
    _POTRACE_OK = True
except ImportError:
    _POTRACE_OK = False


# ─────────────────────────────────────────────────────────────────────────────
# Utilidades internas
# ─────────────────────────────────────────────────────────────────────────────

def _catmull_rom_a_bezier(pts: np.ndarray, scale_x: float, scale_y: float) -> str:
    """
    Convierte un array de puntos px (N,2) a path SVG cúbico usando
    la conversión Catmull-Rom → Bézier cúbico (alpha=1/6).
    Los puntos de salida están en las unidades dadas por scale_x/scale_y.
    """
    n = len(pts)
    if n < 2:
        return ""

    # Aplicar escala
    spx = pts[:, 0].astype(float) * scale_x
    spy = pts[:, 1].astype(float) * scale_y

    parts = [f"M {spx[0]:.4f} {spy[0]:.4f}"]
    alpha = 1.0 / 6.0

    if n < 3:
        # Sólo líneas
        for i in range(1, n):
            parts.append(f"L {spx[i]:.4f} {spy[i]:.4f}")
        parts.append("Z")
        return " ".join(parts)

    for i in range(n):
        p0x, p0y = spx[(i - 1) % n], spy[(i - 1) % n]
        p1x, p1y = spx[i], spy[i]
        p2x, p2y = spx[(i + 1) % n], spy[(i + 1) % n]
        p3x, p3y = spx[(i + 2) % n], spy[(i + 2) % n]

        cp1x = p1x + alpha * (p2x - p0x)
        cp1y = p1y + alpha * (p2y - p0y)
        cp2x = p2x - alpha * (p3x - p1x)
        cp2y = p2y - alpha * (p3y - p1y)

        parts.append(
            f"C {cp1x:.4f} {cp1y:.4f} {cp2x:.4f} {cp2y:.4f} {p2x:.4f} {p2y:.4f}"
        )

    parts.append("Z")
    return " ".join(parts)


def _potrace_mask(mask_bin: np.ndarray, scale_x: float, scale_y: float) -> Optional[str]:
    """
    Traza la máscara binaria con pypotrace y devuelve el atributo 'd' SVG.
    Retorna None si pypotrace no está disponible o falla.
    """
    if not _POTRACE_OK:
        return None
    try:
        bm = _potrace.Bitmap(mask_bin.astype(bool))
        path = bm.trace(
            turdsize=2,
            turnpolicy=_potrace.TURNPOLICY_MINORITY,
            alphamax=1.0,
            opticurve=True,
            opttolerance=0.2,
        )
        parts = []
        for curve in path:
            sp = curve.start_point
            parts.append(f"M {float(sp.x) * scale_x:.4f} {float(sp.y) * scale_y:.4f}")
            for seg in curve.segments:
                if seg.is_corner:
                    c = seg.c
                    ep = seg.end_point
                    parts.append(f"L {float(c.x)*scale_x:.4f} {float(c.y)*scale_y:.4f}")
                    parts.append(f"L {float(ep.x)*scale_x:.4f} {float(ep.y)*scale_y:.4f}")
                else:
                    c1, c2, ep = seg.c1, seg.c2, seg.end_point
                    parts.append(
                        f"C {float(c1.x)*scale_x:.4f} {float(c1.y)*scale_y:.4f}"
                        f" {float(c2.x)*scale_x:.4f} {float(c2.y)*scale_y:.4f}"
                        f" {float(ep.x)*scale_x:.4f} {float(ep.y)*scale_y:.4f}"
                    )
            parts.append("Z")
        return " ".join(parts) if parts else None
    except Exception:
        return None


# ─────────────────────────────────────────────────────────────────────────────
# API pública
# ─────────────────────────────────────────────────────────────────────────────

def contorno_a_svg_d(
    contorno: np.ndarray,
    scale_x: float = 1.0,
    scale_y: float = 1.0,
    usar_bezier: bool = True,
) -> str:
    """
    Convierte un contorno OpenCV (N,1,2) o (N,2) a cadena SVG path 'd'.

    Usa Catmull-Rom→Bézier cúbico o polilínea según `usar_bezier`.
    Las coordenadas de salida se multiplican por scale_x / scale_y.

    Args:
        contorno:   array de puntos del contorno (px).
        scale_x:    factor de escala para el eje X (p.ej. m_px_x).
        scale_y:    factor de escala para el eje Y (p.ej. m_px_y).
        usar_bezier: si True, genera curvas suaves.

    Returns:
        Cadena SVG para el atributo d= de un <path>.
    """
    pts = contorno.reshape(-1, 2)
    if len(pts) < 2:
        return ""

    if usar_bezier:
        return _catmull_rom_a_bezier(pts, scale_x, scale_y)

    # Polilínea simple
    spx = pts[:, 0].astype(float) * scale_x
    spy = pts[:, 1].astype(float) * scale_y
    parts = [f"M {spx[0]:.4f} {spy[0]:.4f}"]
    for i in range(1, len(pts)):
        parts.append(f"L {spx[i]:.4f} {spy[i]:.4f}")
    parts.append("Z")
    return " ".join(parts)


def vectorizar_mask(
    mask_bin: np.ndarray,
    scale_x: float = 1.0,
    scale_y: float = 1.0,
    usar_bezier: bool = True,
) -> str:
    """
    Vectoriza una máscara binaria entera a path SVG 'd' (múltiples sub-paths).

    1. Intenta Potrace (pypotrace) si está instalado.
    2. Fallback: contornos OpenCV con Catmull-Rom.

    Args:
        mask_bin:    imagen uint8 donde > 0 = forma.
        scale_x/y:   factores px → unidad deseada.
        usar_bezier: aplica a la ruta de fallback.

    Returns:
        Cadena SVG para el atributo d=.
    """
    resultado = _potrace_mask(mask_bin, scale_x, scale_y)
    if resultado:
        return resultado

    # RETR_CCOMP devuelve contornos externos (nivel 0) Y huecos interiores (nivel 1),
    # lo que preserva los contra-formas de letras como O, A, B, D, P, R, Q, etc.
    cnts, hierarchy = cv2.findContours(mask_bin, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_TC89_L1)
    if not cnts:
        return ""

    parts = []
    for i, cnt in enumerate(cnts):
        area = cv2.contourArea(cnt)
        if area < 4:
            continue
        epsilon = max(0.5, 0.001 * cv2.arcLength(cnt, True))
        approx = cv2.approxPolyDP(cnt, epsilon, True)
        d = contorno_a_svg_d(approx, scale_x=scale_x, scale_y=scale_y, usar_bezier=usar_bezier)
        if d:
            parts.append(d)

    return " ".join(parts)


def puntos_a_svg_d(pts_xy: np.ndarray, usar_bezier: bool = True) -> str:
    """
    Genera SVG path 'd' desde un array (N, 2) de puntos YA transformados
    (coordenadas en metros u otra unidad destino; scale=1.0 implícito).

    Uso principal: producir el svg_path_d del nesting a partir de `poly_n`
    cuyos puntos ya están en el plano de planchas (metros).

    Args:
        pts_xy:      numpy array float (N, 2) o lista de [x, y].
        usar_bezier: True → Catmull-Rom cúbico; False → polilínea.

    Returns:
        Cadena SVG para el atributo d=.
    """
    pts = np.asarray(pts_xy, dtype=float).reshape(-1, 2)
    if len(pts) < 2:
        return ""
    if usar_bezier:
        return _catmull_rom_a_bezier(pts, scale_x=1.0, scale_y=1.0)
    parts = [f"M {pts[0, 0]:.4f} {pts[0, 1]:.4f}"]
    for i in range(1, len(pts)):
        parts.append(f"L {pts[i, 0]:.4f} {pts[i, 1]:.4f}")
    parts.append("Z")
    return " ".join(parts)


def pieza_a_vector(piece_mask: np.ndarray, m_px_x: float, m_px_y: float) -> dict:
    """
    Vectoriza la máscara de una pieza individual y calcula sus métricas geométricas.

    Args:
        piece_mask: máscara uint8 (H, W) donde > 0 es la pieza.
        m_px_x:     metros por píxel en eje X.
        m_px_y:     metros por píxel en eje Y.

    Returns:
        {
            'svg_path_d': str,
            'area_m2':    float,
            'perim_m':    float,
            'bbox_px':    (x, y, w, h),
            'w_m':        float,
            'h_m':        float,
        }
    """
    svg_d = vectorizar_mask(piece_mask, scale_x=m_px_x, scale_y=m_px_y)

    cnts, _ = cv2.findContours(piece_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not cnts:
        return {'svg_path_d': '', 'area_m2': 0.0, 'perim_m': 0.0, 'bbox_px': (0, 0, 0, 0), 'w_m': 0.0, 'h_m': 0.0}

    area_m2 = sum(cv2.contourArea(c) for c in cnts) * m_px_x * m_px_y
    perim_m = sum(cv2.arcLength(c, True) for c in cnts) * m_px_x

    cnt_max = max(cnts, key=cv2.contourArea)
    x, y, w, h = cv2.boundingRect(cnt_max)

    return {
        'svg_path_d': svg_d,
        'area_m2': round(float(area_m2), 6),
        'perim_m': round(float(perim_m), 4),
        'bbox_px': (int(x), int(y), int(w), int(h)),
        'w_m': round(float(w) * m_px_x, 4),
        'h_m': round(float(h) * m_px_y, 4),
    }


def vectorizar_imagen(
    img_bgr: np.ndarray,
    mask_alfa: Optional[np.ndarray] = None,
    scale_x: float = 1.0,
    scale_y: float = 1.0,
) -> dict:
    """
    Pipeline completo: recibe imagen BGR + máscara opcional y devuelve el
    path SVG con las dimensiones en la unidad elegida.

    Args:
        img_bgr:   imagen fuente.
        mask_alfa: máscara uint8 (> 0 = forma). Si es None se genera internamente.
        scale_x/y: factores px → unidad (metros, mm, etc.).

    Returns:
        {
            'svg_path_d': str,   # contenido del atributo d=
            'viewBox':    str,   # "0 0 ancho alto" en unidades escaladas
            'ancho':      float,
            'alto':       float,
        }
    """
    h, w = img_bgr.shape[:2]

    if mask_alfa is None:
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        if np.mean(gray) > 200:
            gray = cv2.bitwise_not(gray)
        _, mask_alfa = cv2.threshold(gray, 15, 255, cv2.THRESH_BINARY)

    svg_d = vectorizar_mask(mask_alfa, scale_x=scale_x, scale_y=scale_y)
    ancho = round(float(w) * scale_x, 6)
    alto = round(float(h) * scale_y, 6)

    return {
        'svg_path_d': svg_d,
        'viewBox': f"0 0 {ancho:.4f} {alto:.4f}",
        'ancho': ancho,
        'alto': alto,
    }
