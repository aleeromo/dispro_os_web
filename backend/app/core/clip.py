"""
Recorte de polígono por rectángulo (Sutherland-Hodgman).
Usado para dividir piezas oversized en fragmentos por placa (corte y empalme real).
"""


def _clip_by_left(poly, x_min):
    out = []
    for i in range(len(poly)):
        p = poly[i]
        q = poly[(i + 1) % len(poly)]
        inside_p = p[0] >= x_min
        inside_q = q[0] >= x_min
        if inside_p:
            out.append(p)
        if inside_p != inside_q:
            t = (x_min - p[0]) / (q[0] - p[0]) if q[0] != p[0] else 0
            out.append((x_min, p[1] + t * (q[1] - p[1])))
    return out


def _clip_by_right(poly, x_max):
    out = []
    for i in range(len(poly)):
        p = poly[i]
        q = poly[(i + 1) % len(poly)]
        inside_p = p[0] <= x_max
        inside_q = q[0] <= x_max
        if inside_p:
            out.append(p)
        if inside_p != inside_q:
            t = (x_max - p[0]) / (q[0] - p[0]) if q[0] != p[0] else 0
            out.append((x_max, p[1] + t * (q[1] - p[1])))
    return out


def _clip_by_bottom(poly, y_max):
    out = []
    for i in range(len(poly)):
        p = poly[i]
        q = poly[(i + 1) % len(poly)]
        inside_p = p[1] <= y_max
        inside_q = q[1] <= y_max
        if inside_p:
            out.append(p)
        if inside_p != inside_q:
            t = (y_max - p[1]) / (q[1] - p[1]) if q[1] != p[1] else 0
            out.append((p[0] + t * (q[0] - p[0]), y_max))
    return out


def _clip_by_top(poly, y_min):
    out = []
    for i in range(len(poly)):
        p = poly[i]
        q = poly[(i + 1) % len(poly)]
        inside_p = p[1] >= y_min
        inside_q = q[1] >= y_min
        if inside_p:
            out.append(p)
        if inside_p != inside_q:
            t = (y_min - p[1]) / (q[1] - p[1]) if q[1] != p[1] else 0
            out.append((p[0] + t * (q[0] - p[0]), y_min))
    return out


def clip_polygon_by_rect(poly, x_min, y_min, x_max, y_max):
    """
    Recorta el polígono por el rectángulo (Sutherland-Hodgman).
    poly: lista de (x, y).
    Rectángulo: [x_min, y_min, x_max, y_max].
    Devuelve lista de polígonos (normalmente uno); vacía si no hay intersección.
    """
    if not poly or len(poly) < 3:
        return []
    current = [(float(x), float(y)) for x, y in poly]
    current = _clip_by_left(current, x_min)
    if not current or len(current) < 3:
        return []
    current = _clip_by_right(current, x_max)
    if not current or len(current) < 3:
        return []
    current = _clip_by_bottom(current, y_max)
    if not current or len(current) < 3:
        return []
    current = _clip_by_top(current, y_min)
    if not current or len(current) < 3:
        return []
    return [current]
