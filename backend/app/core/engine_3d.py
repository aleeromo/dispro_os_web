"""
Motor de nesting vectorial 3D para DisproOS.
- Contornos OpenCV -> polígonos en metros (approxPolyDP).
- Nesting en placas (aluminio/acrílico), detección de vinilos (contornos hijos + color).
- Salida: geometría nesting, original, LEDs; BOM y vectores exportables a CNC/SVG.
"""
import cv2
import numpy as np
import math

try:
    from core.vectorizer import (
        vectorizar_mask as _vec_mask,
        puntos_a_svg_d as _pts_a_svg,
    )
    _VECTORIZER_OK = True
except ImportError:
    _VECTORIZER_OK = False

try:
    from core.clip import clip_polygon_by_rect
except ImportError:
    try:
        from .clip import clip_polygon_by_rect
    except ImportError:
        clip_polygon_by_rect = None

# Factor de tolerancia para aproximación poligonal (vértices CNC). Valores más bajos = más fidelidad, más puntos.
EPSILON_FACTOR = 0.0005

class NestingEngineAPI:
    @staticmethod
    def ejecutar_nesting_vectorial(cnts, hierarchy, wm, material_cara, material_canto, prof_canto, con_luz, img_cv, ignoradas, exclusion_zones, alto_m=0):
        pw_m, ph_m = (3.05, 0.90) if material_cara == 'Aluminio' else (2.40, 1.20)
        pw_c, ph_c = (3.05, 0.90) if 'Aluminio' in material_canto else (2.40, 1.20)
        
        if len(cnts) == 0: return 0, 0, 0, 0, [], [], [], 0, 0, "", 0.0, 0.0, 0.0, 0, 0

        # Escalas independientes para X e Y.
        # Si el usuario confirmó alto_m distinto al aspect ratio de la imagen,
        # los polígonos se mapean correctamente en ambos ejes.
        m_px_x = float(wm) / float(img_cv.shape[1]) if int(img_cv.shape[1]) > 0 else 1.0
        m_px_y = float(alto_m) / float(img_cv.shape[0]) if (float(alto_m) > 0 and int(img_cv.shape[0]) > 0) else m_px_x
        m_px = m_px_x  # alias para cálculos de área/perímetro (usa escala X como referencia)
        img_w_m = float(img_cv.shape[1]) * m_px_x
        img_h_m = float(img_cv.shape[0]) * m_px_y

        ignoradas_rects = []
        for ig in ignoradas:
            if ig:
                parts = ig.split('_')
                if len(parts) == 4: ignoradas_rects.append((int(parts[0]), int(parts[1]), int(parts[2]), int(parts[3])))

        def is_box_ignored(cx, cy, rw, rh, ig_rects):
            for rx, ry, w, h in ig_rects:
                if rx <= cx <= rx + w and ry <= cy <= ry + h: return True
            return False

        piezas_dict = {}
        area_total_piezas = 0.0 
        perimetro_total = 0.0

        for i, c in enumerate(cnts):
            x, y, w, h = cv2.boundingRect(c)
            cx, cy = float(x) + float(w)/2.0, float(y) + float(h)/2.0
            if is_box_ignored(cx, cy, float(w), float(h), ignoradas_rects): continue

            box_id = f"{int(x)}_{int(y)}_{int(w)}_{int(h)}"
            # Umbral elevado a 0.98: solo descarta el contorno de la imagen completa
            # (borde del canvas). Con 0.85, diseños grandes (ej. 2.38×1.39m) en imágenes
            # sintéticas generadas con +100 px de margen caían por encima del límite y
            # se descartaban, dejando placas=0, perimetro=0 y precio≈$978.
            if w <= 2 or h <= 2 or (w * h) >= (img_cv.shape[1] * img_cv.shape[0] * 0.98): continue
            
            es_medida = any(z[0] <= cx <= z[2] and z[1] <= cy <= z[3] for z in exclusion_zones)
            if es_medida: continue

            parent_idx = hierarchy[i][3]
            if parent_idx == -1:
                epsilon = max(0.5, EPSILON_FACTOR * cv2.arcLength(c, True))
                approx = cv2.approxPolyDP(c, epsilon, True)
                area_pieza = float(cv2.contourArea(c)) * (m_px_x * m_px_y)
                perim_pieza = float(cv2.arcLength(c, True)) * m_px_x
                area_total_piezas += area_pieza
                perimetro_total += perim_pieza
                # ── Color dominante ────────────────────────────────────────────
                # Si el color es casi blanco (>230) se mantiene '#ffffff' →
                # en el frontend se interpreta como "panel sin color propio".
                color_hex = '#ffffff'
                piece_mask = None
                try:
                    piece_mask = np.zeros(img_cv.shape[:2], dtype=np.uint8)
                    cv2.drawContours(piece_mask, [c], -1, 255, -1)
                    mean_bgr = cv2.mean(img_cv, mask=piece_mask)[:3]
                    r_c, g_c, b_c = int(mean_bgr[2]), int(mean_bgr[1]), int(mean_bgr[0])
                    if not (r_c > 230 and g_c > 230 and b_c > 230):
                        color_hex = '#{:02x}{:02x}{:02x}'.format(r_c, g_c, b_c)
                except Exception:
                    pass
                # ── SVG path (geo_o) ────────────────────────────────────────────
                # Usamos la piece_mask en lugar de `approx` para que Potrace
                # (o el fallback Catmull-Rom) trabaje sobre el contorno original
                # en full-resolution, no sobre el polígono ya simplificado.
                svg_d_pieza = ""
                if _VECTORIZER_OK:
                    try:
                        if piece_mask is not None:
                            svg_d_pieza = _vec_mask(piece_mask, scale_x=m_px_x, scale_y=m_px_y)
                        else:
                            # Fallback si la máscara no pudo crearse
                            svg_d_pieza = _pts_a_svg(c.reshape(-1, 2).astype(float) * [m_px_x, m_px_y])
                    except Exception:
                        pass
                piezas_dict[i] = {
                    'idx': i, 'pts': approx, 'bx': x, 'by': y, 'bw': w, 'bh': h,
                    'w_m': float(w) * m_px_x, 'h_m': float(h) * m_px_y, 'color': color_hex, 'box_id': str(box_id),
                    'agujeros': [], 'vinilos': [], 'svg_path_d': svg_d_pieza,
                }

        for i, c in enumerate(cnts):
            x, y, w, h = cv2.boundingRect(c)
            cx, cy = float(x) + float(w)/2.0, float(y) + float(h)/2.0
            if is_box_ignored(cx, cy, float(w), float(h), ignoradas_rects): continue

            parent_idx = hierarchy[i][3]
            if parent_idx != -1:
                root_idx = parent_idx
                depth = 1
                while hierarchy[root_idx][3] != -1:
                    root_idx = hierarchy[root_idx][3]
                    depth += 1
                
                if root_idx in piezas_dict:
                    epsilon = max(0.5, EPSILON_FACTOR * cv2.arcLength(c, True))
                    approx = cv2.approxPolyDP(c, epsilon, True)
                    if depth % 2 != 0:
                        piezas_dict[root_idx]['agujeros'].append(approx)
                    else:
                        color_hex = "#111111"
                        try:
                            mask = np.zeros(img_cv.shape[:2], dtype=np.uint8)
                            cv2.drawContours(mask, [c], -1, 255, -1)
                            m = cv2.mean(img_cv, mask=mask)[:3]
                            color_hex = '#{:02x}{:02x}{:02x}'.format(int(m[2]), int(m[1]), int(m[0]))
                        except: pass
                        piezas_dict[root_idx]['vinilos'].append({'pts': approx, 'color': str(color_hex)})

        piezas = list(piezas_dict.values())
        piezas = sorted(piezas, key=lambda p: float(max(p['w_m'], p['h_m'])), reverse=True)
        shelves, current_p, margin = [], 0, 0.015
        ascii_empalmes = ""

        # NESTING Y DISTRIBUCIÓN (rotación sistemática + best-fit en X)
        def try_place_shelf(w_p, h_p):
            """Devuelve (shelf, rest_x) donde quepa la pieza (w_p,h_p), con mínimo rest_x; o (None, inf)."""
            candidates = []
            for s in shelves:
                if s['x_curr'] + w_p <= pw_m - margin and h_p <= s['h_m']:
                    rest_x = pw_m - margin - (s['x_curr'] + w_p)
                    candidates.append((s, rest_x))
            if not candidates:
                return (None, float('inf'))
            return min(candidates, key=lambda x: x[1])

        for p in piezas:
            if p['h_m'] > ph_m or p['w_m'] > pw_m:
                tramos_y = int(math.ceil(p['h_m'] / ph_m))
                tramos_x = int(math.ceil(p['w_m'] / pw_m))
                ascii_empalmes += f"\n⚠️ Empalme detectado: Pieza de ({p['w_m']:.1f}x{p['h_m']:.1f}m).\n"
                p['dx'] = float(margin); p['dy'] = float(margin)
                p['placa_idx'] = int(current_p)
                p['is_oversized'] = True
                p['tramos_x'] = int(tramos_x); p['tramos_y'] = int(tramos_y)
                current_p += int(tramos_x * tramos_y)
                shelves = []
                p['rotada'] = False
                continue

            w_orig, h_orig = float(p['w_m']), float(p['h_m'])
            opt0 = try_place_shelf(w_orig, h_orig)
            opt1 = try_place_shelf(h_orig, w_orig)
            use_rotated = None
            if opt0[0] is not None and opt1[0] is not None:
                use_rotated = opt1[1] < opt0[1]
            elif opt0[0] is not None:
                use_rotated = False
            elif opt1[0] is not None:
                use_rotated = True

            if use_rotated is not None:
                w_place = h_orig if use_rotated else w_orig
                h_place = w_orig if use_rotated else h_orig
                if use_rotated:
                    p['w_m'], p['h_m'] = float(h_place), float(w_place)
                    p['rotada'] = True
                else:
                    p['rotada'] = False
                s = opt1[0] if use_rotated else opt0[0]
                p['dx'] = float(s['x_curr'])
                p['dy'] = float(s['y_bottom'] - h_place)
                s['x_curr'] += float(w_place + margin)
                p['is_oversized'] = False
            else:
                dy = float(margin if not shelves else shelves[-1]['y_bottom'] + margin)
                if dy + h_orig <= ph_m - margin:
                    w_place, h_place = w_orig, h_orig
                    p['rotada'] = False
                elif dy + w_orig <= ph_m - margin:
                    w_place, h_place = h_orig, w_orig
                    p['w_m'], p['h_m'] = float(h_place), float(w_place)
                    p['rotada'] = True
                else:
                    if h_orig <= w_orig:
                        w_place, h_place = w_orig, h_orig
                        p['rotada'] = False
                    else:
                        w_place, h_place = h_orig, w_orig
                        p['w_m'], p['h_m'] = float(h_place), float(w_place)
                        p['rotada'] = True
                if dy + h_place <= ph_m - margin:
                    p['dx'] = float(margin)
                    p['dy'] = float(dy)
                    shelves.append({'y_bottom': float(dy + h_place), 'x_curr': float(margin + w_place + margin), 'h_m': float(h_place)})
                else:
                    current_p += 1
                    shelves = []
                    p['dx'] = float(margin)
                    p['dy'] = float(margin)
                    shelves.append({'y_bottom': float(margin + h_place), 'x_curr': float(margin + w_place + margin), 'h_m': float(h_place)})
                p['is_oversized'] = False
            p['placa_idx'] = int(current_p)

        geo_p, geo_o, geo_l = [], [], []
        total_l = 0
        
        gap_placas = 0.3
        for p in piezas:
            poly_n, poly_o = [], []
            off_y = float(p['placa_idx'] * (ph_m + 0.3))

            # Corte y empalme real: pieza oversized → recortar por cada placa y emitir N fragmentos en geo_p
            if p.get('is_oversized') and clip_polygon_by_rect:
                poly_local = [
                    ((float(pt[0][0]) - float(p['bx'])) * m_px_x, (float(pt[0][1]) - float(p['by'])) * m_px_y)
                    for pt in p['pts']
                ]
                if len(poly_local) >= 3 and poly_local[0] != poly_local[-1]:
                    poly_local = list(poly_local) + [poly_local[0]]
                tramos_x = int(p.get('tramos_x', 1))
                tramos_y = int(p.get('tramos_y', 1))
                ancho_tramo = pw_m - 2 * margin
                alto_tramo = ph_m - 2 * margin
                fragments_emitted = False
                for iy in range(tramos_y):
                    for ix in range(tramos_x):
                        x_min = ix * ancho_tramo
                        x_max = (ix + 1) * ancho_tramo
                        # Rectángulos contiguos en espacio de la pieza (sin gap) para que el clip corte bien
                        y_min = iy * alto_tramo
                        y_max = (iy + 1) * alto_tramo
                        frags = clip_polygon_by_rect(poly_local, x_min, y_min, x_max, y_max)
                        for frag in frags:
                            if len(frag) < 3:
                                continue
                            fragments_emitted = True
                            placa_idx_frag = p['placa_idx'] + iy * tramos_x + ix
                            off_y_frag = placa_idx_frag * (ph_m + gap_placas)
                            pts_plan = [
                                {'x': round(pt[0] - x_min + margin, 4), 'y': round(pt[1] - y_min + margin, 4)}
                                for pt in frag
                            ]
                            svg_d_frag = ""
                            if _VECTORIZER_OK and pts_plan:
                                try:
                                    pts_m = np.array([[pt['x'], pt['y']] for pt in pts_plan], dtype=float)
                                    svg_d_frag = _pts_a_svg(pts_m)
                                except Exception:
                                    pass
                            geo_p.append({
                                'tipo': 'cara',
                                'placa': int(placa_idx_frag),
                                'puntos': pts_plan,
                                'svg_path_d': svg_d_frag,
                                'leds': [],
                                'vinilos': [],
                                'is_oversized': True,
                                'tramos_x': tramos_x,
                                'tramos_y': tramos_y,
                                'w_m': round(ancho_tramo, 4),
                                'h_m': round(alto_tramo, 4),
                                'rotada': False,
                                'global_x': round(margin, 4),
                                'global_y': round(margin, 4),
                            })
                if fragments_emitted:
                    poly_o = [{'x': round(float(pt[0][0]) * m_px_x, 4), 'y': round(float(pt[0][1]) * m_px_y, 4)} for pt in p['pts']]
                    agujeros_o = [[{'x': round(float(apt[0][0]*m_px_x),4), 'y': round(float(apt[0][1]*m_px_y),4)} for apt in a] for a in p['agujeros']]
                    vinilos_o = [{'puntos': [{'x': round(float(vpt[0][0])*m_px_x,4), 'y': round(float(vpt[0][1])*m_px_y,4)} for vpt in v['pts']], 'color': str(v['color'])} for v in p['vinilos']]
                    geo_o.append({
                        'puntos': poly_o,
                        'color': str(p['color']),
                        'box_id': str(p['box_id']),
                        'agujeros': agujeros_o,
                        'vinilos': vinilos_o,
                        'svg_path_d': str(p.get('svg_path_d', '')),
                    })
                    continue
                # Si el clip no devolvió fragmentos: fallback por tramo con rect de intersección bbox(pieza) ∩ tramo
                w_pieza = float(p['w_m'])
                h_pieza = float(p['h_m'])
                for iy in range(tramos_y):
                    for ix in range(tramos_x):
                        x_min = ix * ancho_tramo
                        x_max = (ix + 1) * ancho_tramo
                        y_min = iy * alto_tramo
                        y_max = (iy + 1) * alto_tramo
                        rx_min = max(0.0, x_min)
                        rx_max = min(w_pieza, x_max)
                        ry_min = max(0.0, y_min)
                        ry_max = min(h_pieza, y_max)
                        if rx_max <= rx_min or ry_max <= ry_min:
                            continue
                        placa_idx_frag = p['placa_idx'] + iy * tramos_x + ix
                        gx = round(rx_min - x_min + margin, 4)
                        gy_local = round(ry_min - y_min + margin, 4)
                        gw = round(rx_max - rx_min, 4)
                        gh = round(ry_max - ry_min, 4)
                        pts_fb = [
                            {'x': gx, 'y': gy_local},
                            {'x': gx + gw, 'y': gy_local},
                            {'x': gx + gw, 'y': gy_local + gh},
                            {'x': gx, 'y': gy_local + gh},
                        ]
                        path_fb = f"M {gx:.4f} {gy_local:.4f} L {gx+gw:.4f} {gy_local:.4f} L {gx+gw:.4f} {gy_local+gh:.4f} L {gx:.4f} {gy_local+gh:.4f} Z"
                        geo_p.append({
                            'tipo': 'cara',
                            'placa': int(placa_idx_frag),
                            'puntos': pts_fb,
                            'svg_path_d': path_fb,
                            'leds': [],
                            'vinilos': [],
                            'is_oversized': True,
                            'tramos_x': tramos_x,
                            'tramos_y': tramos_y,
                            'w_m': round(gw, 4),
                            'h_m': round(gh, 4),
                            'rotada': False,
                            'global_x': round(gx, 4),
                            'global_y': round(gy_local, 4),
                        })
                if not fragments_emitted:
                    poly_o = [{'x': round(float(pt[0][0]) * m_px_x, 4), 'y': round(float(pt[0][1]) * m_px_y, 4)} for pt in p['pts']]
                    agujeros_o = [[{'x': round(float(apt[0][0]*m_px_x),4), 'y': round(float(apt[0][1]*m_px_y),4)} for apt in a] for a in p['agujeros']]
                    vinilos_o = [{'puntos': [{'x': round(float(vpt[0][0])*m_px_x,4), 'y': round(float(vpt[0][1])*m_px_y,4)} for vpt in v['pts']], 'color': str(v['color'])} for v in p['vinilos']]
                    geo_o.append({
                        'puntos': poly_o,
                        'color': str(p['color']),
                        'box_id': str(p['box_id']),
                        'agujeros': agujeros_o,
                        'vinilos': vinilos_o,
                        'svg_path_d': str(p.get('svg_path_d', '')),
                    })
                    continue
                # Si ni clip ni fallback por tramo emitieron nada, seguir al flujo normal (pieza completa en una placa)

            # Coordenadas LOCALES a la placa (Y en [0, ph_m]). El frontend dibuja en <g transform="translate(0, offY)"> sin conversión.
            dy_local = float(p['dy'])
            for pt in p['pts']:
                px_val = float(pt[0][0])
                py_val = float(pt[0][1])
                local_x_m = (px_val - float(p['bx'])) * m_px_x
                local_y_m = (py_val - float(p['by'])) * m_px_y
                if p.get('rotada'):
                    poly_n.append({'x': round(float(p['dx'] + local_y_m), 4), 'y': round(dy_local + local_x_m, 4)})
                else:
                    poly_n.append({'x': round(float(p['dx'] + local_x_m), 4), 'y': round(dy_local + local_y_m, 4)})
                poly_o.append({'x': round(float(px_val * m_px_x), 4), 'y': round(float(py_val * m_px_y), 4)})
            dx_p, dy_p = float(p['dx']), dy_local
            w_p, h_p = float(p['w_m']), float(p['h_m'])
            if len(poly_n) < 3:
                poly_n = [
                    {'x': round(dx_p, 4), 'y': round(dy_p, 4)},
                    {'x': round(dx_p + w_p, 4), 'y': round(dy_p, 4)},
                    {'x': round(dx_p + w_p, 4), 'y': round(dy_p + h_p, 4)},
                    {'x': round(dx_p, 4), 'y': round(dy_p + h_p, 4)},
                ]
            
            # LEDs en coordenadas locales a la placa
            leds_placa = []
            if con_luz:
                spacing = 0.045
                x_min, y_min, w_b, h_b = float(p['bx']), float(p['by']), float(p['bw']), float(p['bh'])
                for yy in np.arange(y_min + (spacing/m_px_y)/2.0, y_min + h_b, spacing / m_px_y):
                    for xx in np.arange(x_min + (spacing/m_px_x)/2.0, x_min + w_b, spacing / m_px_x):
                        if cv2.pointPolygonTest(p['pts'], (float(xx), float(yy)), False) >= 0:
                            local_x_m = (float(xx) - x_min) * m_px_x
                            local_y_m = (float(yy) - y_min) * m_px_y
                            if p.get('rotada'):
                                led_x = float(p['dx'] + local_y_m)
                                led_y = dy_local + local_x_m
                            else:
                                led_x = float(p['dx'] + local_x_m)
                                led_y = dy_local + local_y_m
                            leds_placa.append({'x': round(led_x, 4), 'y': round(led_y, 4)})
                            total_l += 1
            
            # Vinilos en coordenadas locales a la placa
            vinilos_n, vinilos_o = [], []
            for v in p['vinilos']:
                v_pts_n, v_pts_o = [], []
                for vpt in v['pts']:
                    px_val = float(vpt[0][0])
                    py_val = float(vpt[0][1])
                    v_local_x_m = (px_val - float(p['bx'])) * m_px_x
                    v_local_y_m = (py_val - float(p['by'])) * m_px_y
                    if p.get('rotada'):
                        v_pts_n.append({'x': round(float(p['dx'] + v_local_y_m), 4), 'y': round(dy_local + v_local_x_m, 4)})
                    else:
                        v_pts_n.append({'x': round(float(p['dx'] + v_local_x_m), 4), 'y': round(dy_local + v_local_y_m, 4)})
                    v_pts_o.append({'x': round(float(px_val * m_px_x), 4), 'y': round(float(py_val * m_px_y), 4)})
                vinilos_n.append({'puntos': v_pts_n, 'color': str(v['color'])})
                vinilos_o.append({'puntos': v_pts_o, 'color': str(v['color'])})

            agujeros_o = [[{'x': round(float(apt[0][0]*m_px_x),4), 'y': round(float(apt[0][1]*m_px_y),4)} for apt in a] for a in p['agujeros']]

            svg_d_nesting = ""
            if _VECTORIZER_OK and poly_n:
                try:
                    pts_m = np.array([[pt['x'], pt['y']] for pt in poly_n], dtype=float)
                    svg_d_nesting = _pts_a_svg(pts_m)
                except Exception:
                    pass
            if not (svg_d_nesting and svg_d_nesting.strip()) and poly_n:
                gx, gy = round(float(p['dx']), 4), round(dy_local, 4)
                svg_d_nesting = f"M {gx:.4f} {gy:.4f} L {gx + w_p:.4f} {gy:.4f} L {gx + w_p:.4f} {gy + h_p:.4f} L {gx:.4f} {gy + h_p:.4f} Z"

            geo_p.append({
                'tipo': 'cara',
                'placa': int(p['placa_idx']),
                'puntos': poly_n,
                'svg_path_d': svg_d_nesting,
                'leds': leds_placa,
                'vinilos': vinilos_n,
                'is_oversized': bool(p.get('is_oversized', False)),
                'tramos_x': int(p.get('tramos_x', 1)),
                'tramos_y': int(p.get('tramos_y', 1)),
                'w_m': float(p['w_m']),
                'h_m': float(p['h_m']),
                'rotada': bool(p.get('rotada', False)),
                'global_x': round(float(p['dx']), 4),
                'global_y': round(dy_local, 4),
            })
            geo_o.append({
                'puntos': poly_o,
                'color': str(p['color']),
                'box_id': str(p['box_id']),
                'agujeros': agujeros_o,
                'vinilos': vinilos_o,
                'svg_path_d': str(p.get('svg_path_d', '')),
            })
        
        last_y = float(shelves[-1]['y_bottom']) if shelves else 0.0
        placas_caras_final = float(current_p) + max(0.125, math.ceil((last_y / ph_m) * 8.0) / 8.0) if piezas else 0.0

        tiras_por_placa = math.floor(ph_c / float(prof_canto)) if float(prof_canto) > 0 else 1
        metros_cantos_por_placa = float(tiras_por_placa * pw_c)
        placas_cantos_raw = float(perimetro_total / metros_cantos_por_placa) if metros_cantos_por_placa > 0 else 0.0
        placas_cantos_final = max(0.125, math.ceil(placas_cantos_raw * 8.0) / 8.0) if perimetro_total > 0 else 0.0
        
        if perimetro_total > 0:
            placa_offset = int(math.ceil(placas_caras_final))
            tiras_necesarias = int(math.ceil(perimetro_total / pw_c))
            tiras_dibujadas = 0
            for p_idx in range(int(math.ceil(placas_cantos_final))):
                for t in range(int(tiras_por_placa)):
                    if tiras_dibujadas >= tiras_necesarias: break
                    y_pos = float(margin + t * (float(prof_canto) + margin))
                    if y_pos + float(prof_canto) <= ph_c:
                        strip_pts = [{'x': round(float(margin), 4), 'y': round(float(y_pos), 4)}, {'x': round(float(pw_c - margin), 4), 'y': round(float(y_pos), 4)}, {'x': round(float(pw_c - margin), 4), 'y': round(float(y_pos + float(prof_canto)), 4)}, {'x': round(float(margin), 4), 'y': round(float(y_pos + float(prof_canto)), 4)}]
                        geo_p.append({'tipo': 'canto', 'placa': int(placa_offset + p_idx), 'puntos': strip_pts, 'leds': []})
                        tiras_dibujadas += 1

        placas_pvc = float(placas_caras_final)
        area_total_placas = float(math.ceil(placas_caras_final) * pw_m * ph_m)
        eficiencia = float((area_total_piezas / area_total_placas) * 100.0) if area_total_placas > 0 else 0.0

        watts_totales = float(total_l * 0.24)
        amperaje = float(watts_totales / 12.0)
        fuentes_100w = int(math.ceil(watts_totales / 80.0)) if con_luz else 0 

        ascii_empalmes += f"\n[ REQUERIMIENTO DE MATERIALES (BOM) ]\n"
        ascii_empalmes += f"📐 Perímetro a cantear: {perimetro_total:.2f} metros lineales\n"
        ascii_empalmes += f"🧱 Placas Frontales ({material_cara}): {placas_caras_final:.3f} pz\n"
        ascii_empalmes += f"🧱 Placas Canto ({material_canto}): {placas_cantos_final:.3f} pz\n"
        ascii_empalmes += f"🧱 Placas Traseras (PVC 3mm): {placas_pvc:.3f} pz\n"

        # Garantía de raíz: toda cara debe ser dibujable. Si falta puntos (o hay <3) y falta path, rellenar path con rect.
        for g in geo_p:
            if g.get('tipo') == 'cara':
                pts = g.get('puntos') or []
                path = (g.get('svg_path_d') or '').strip()
                if (not pts or len(pts) < 3) and not path:
                    gx = float(g.get('global_x', 0))
                    gy = float(g.get('global_y', 0))
                    wg = float(g.get('w_m', 0.1))
                    hg = float(g.get('h_m', 0.1))
                    g['svg_path_d'] = f"M {gx:.4f} {gy:.4f} L {gx + wg:.4f} {gy:.4f} L {gx + wg:.4f} {gy + hg:.4f} L {gx:.4f} {gy + hg:.4f} Z"
                if not pts or len(pts) < 3:
                    gx = float(g.get('global_x', 0))
                    gy = float(g.get('global_y', 0))
                    wg = float(g.get('w_m', 0.1))
                    hg = float(g.get('h_m', 0.1))
                    g['puntos'] = [
                        {'x': round(gx, 4), 'y': round(gy, 4)},
                        {'x': round(gx + wg, 4), 'y': round(gy, 4)},
                        {'x': round(gx + wg, 4), 'y': round(gy + hg, 4)},
                        {'x': round(gx, 4), 'y': round(gy + hg, 4)},
                    ]

        return float(placas_caras_final), float(placas_cantos_final), float(perimetro_total), int(total_l), list(geo_p), list(geo_o), list(geo_l), float(img_w_m), float(img_h_m), str(ascii_empalmes), round(float(eficiencia), 1), float(watts_totales), float(amperaje), int(fuentes_100w), float(placas_pvc)

    @staticmethod
    def _svg_path_to_polygon(svg_d: str):
        """
        Parsea un path SVG (M, L, C, Z) y devuelve una lista de (x, y) para recorte.
        Las curvas C se aproximan con 4 segmentos.
        """
        import re as _re
        tokens = _re.split(r'([MLCZmlcz])', (svg_d or '').strip())
        points = []
        i = 0
        start = None
        while i < len(tokens):
            tok = tokens[i].strip()
            if not tok:
                i += 1
                continue
            if tok.upper() in ('M', 'L', 'C', 'Z'):
                cmd = tok.upper()
                i += 1
                if i >= len(tokens):
                    break
                nums_raw = tokens[i].strip()
                nums = [float(n) for n in _re.split(r'[\s,]+', nums_raw) if n]
                i += 1
                if cmd == 'Z':
                    if start is not None:
                        points.append(start)
                    continue
                if cmd == 'M':
                    if nums:
                        x, y = nums[0], nums[1]
                        start = (x, y)
                        points.append((x, y))
                elif cmd == 'L' and len(nums) >= 2:
                    points.append((nums[0], nums[1]))
                elif cmd == 'C' and len(nums) >= 6:
                    x0, y0 = points[-1] if points else (nums[0], nums[1])
                    x1, y1, x2, y2, x3, y3 = nums[0], nums[1], nums[2], nums[3], nums[4], nums[5]
                    for t in (0.25, 0.5, 0.75, 1.0):
                        u = 1 - t
                        x = u*u*u*x0 + 3*u*u*t*x1 + 3*u*t*t*x2 + t*t*t*x3
                        y = u*u*u*y0 + 3*u*u*t*y1 + 3*u*t*t*y2 + t*t*t*y3
                        points.append((x, y))
            else:
                i += 1
        return points if len(points) >= 3 else []

    @staticmethod
    def _traducir_svg_path(svg_d: str, tx: float, ty: float) -> str:
        """
        Traslada todos los pares de coordenadas de un SVG path sumando (tx, ty).
        Soporta comandos M, L, C, Z (mayúsculas). Los pares X,Y se procesan alternados.
        """
        import re as _re
        tokens = _re.split(r'([MLCZmlcz])', svg_d.strip())
        out_parts = []
        i = 0
        while i < len(tokens):
            tok = tokens[i].strip()
            if not tok:
                i += 1
                continue
            if tok.upper() in ('M', 'L', 'C', 'Z'):
                cmd = tok.upper()
                if cmd == 'Z':
                    out_parts.append('Z')
                    i += 1
                    continue
                i += 1
                if i < len(tokens):
                    nums_raw = tokens[i].strip()
                    nums = [float(n) for n in _re.split(r'[\s,]+', nums_raw) if n]
                    adjusted = []
                    for j, val in enumerate(nums):
                        if j % 2 == 0:
                            adjusted.append(f"{val + tx:.4f}")
                        else:
                            adjusted.append(f"{val + ty:.4f}")
                    out_parts.append(f"{cmd} {' '.join(adjusted)}")
                i += 1
            else:
                i += 1
        return ' '.join(out_parts)

    @staticmethod
    def ejecutar_nesting_desde_piezas(piezas_vectoriales, material_cara, material_canto, prof_canto, con_luz, img_w_m, img_h_m):
        """
        Nesting a partir de piezas ya segmentadas y vectorizadas (sin findContours).
        Retorna la misma tupla de 15 elementos que ejecutar_nesting_vectorial.
        """
        pw_m, ph_m = (3.05, 0.90) if material_cara == 'Aluminio' else (2.40, 1.20)
        pw_c, ph_c = (3.05, 0.90) if 'Aluminio' in material_canto else (2.40, 1.20)

        if not piezas_vectoriales:
            return 0, 0, 0, 0, [], [], [], img_w_m, img_h_m, "", 0.0, 0.0, 0.0, 0, 0

        piezas = []
        for pv in piezas_vectoriales:
            piezas.append({
                'w_m': float(pv['w_m']),
                'h_m': float(pv['h_m']),
                'svg_path_d': str(pv.get('svg_path_d', '')),
                'color_hex': str(pv.get('color_hex', '#ffffff')),
                'bbox_px': pv.get('bbox_px', (0, 0, 0, 0)),
                'area_m2': float(pv.get('area_m2', 0.0)),
                'perim_m': float(pv.get('perim_m', 0.0)),
                'dx': 0.0, 'dy': 0.0, 'placa_idx': 0,
                'rotada': False, 'is_oversized': False,
                'tramos_x': 1, 'tramos_y': 1,
            })

        piezas = sorted(piezas, key=lambda p: float(max(p['w_m'], p['h_m'])), reverse=True)
        shelves, current_p, margin = [], 0, 0.015
        ascii_empalmes = ""

        # NESTING Y DISTRIBUCIÓN (rotación sistemática + best-fit en X)
        def try_place_shelf(w_p, h_p):
            candidates = []
            for s in shelves:
                if s['x_curr'] + w_p <= pw_m - margin and h_p <= s['h_m']:
                    rest_x = pw_m - margin - (s['x_curr'] + w_p)
                    candidates.append((s, rest_x))
            if not candidates:
                return (None, float('inf'))
            return min(candidates, key=lambda x: x[1])

        for p in piezas:
            if p['h_m'] > ph_m or p['w_m'] > pw_m:
                tramos_y = int(math.ceil(p['h_m'] / ph_m))
                tramos_x = int(math.ceil(p['w_m'] / pw_m))
                ascii_empalmes += f"\n⚠️ Empalme detectado: Pieza de ({p['w_m']:.1f}x{p['h_m']:.1f}m).\n"
                p['dx'] = float(margin); p['dy'] = float(margin)
                p['placa_idx'] = int(current_p)
                p['is_oversized'] = True
                p['tramos_x'] = int(tramos_x); p['tramos_y'] = int(tramos_y)
                current_p += int(tramos_x * tramos_y)
                shelves = []
                p['rotada'] = False
                continue

            w_orig, h_orig = float(p['w_m']), float(p['h_m'])
            opt0 = try_place_shelf(w_orig, h_orig)
            opt1 = try_place_shelf(h_orig, w_orig)
            use_rotated = None
            if opt0[0] is not None and opt1[0] is not None:
                use_rotated = opt1[1] < opt0[1]
            elif opt0[0] is not None:
                use_rotated = False
            elif opt1[0] is not None:
                use_rotated = True

            if use_rotated is not None:
                w_place = h_orig if use_rotated else w_orig
                h_place = w_orig if use_rotated else h_orig
                if use_rotated:
                    p['w_m'], p['h_m'] = float(h_place), float(w_place)
                    p['rotada'] = True
                else:
                    p['rotada'] = False
                s = opt1[0] if use_rotated else opt0[0]
                p['dx'] = float(s['x_curr'])
                p['dy'] = float(s['y_bottom'] - h_place)
                s['x_curr'] += float(w_place + margin)
                p['is_oversized'] = False
            else:
                dy = float(margin if not shelves else shelves[-1]['y_bottom'] + margin)
                if dy + h_orig <= ph_m - margin:
                    w_place, h_place = w_orig, h_orig
                    p['rotada'] = False
                elif dy + w_orig <= ph_m - margin:
                    w_place, h_place = h_orig, w_orig
                    p['w_m'], p['h_m'] = float(h_place), float(w_place)
                    p['rotada'] = True
                else:
                    if h_orig <= w_orig:
                        w_place, h_place = w_orig, h_orig
                        p['rotada'] = False
                    else:
                        w_place, h_place = h_orig, w_orig
                        p['w_m'], p['h_m'] = float(h_place), float(w_place)
                        p['rotada'] = True
                if dy + h_place <= ph_m - margin:
                    p['dx'] = float(margin)
                    p['dy'] = float(dy)
                    shelves.append({'y_bottom': float(dy + h_place), 'x_curr': float(margin + w_place + margin), 'h_m': float(h_place)})
                else:
                    current_p += 1
                    shelves = []
                    p['dx'] = float(margin)
                    p['dy'] = float(margin)
                    shelves.append({'y_bottom': float(margin + h_place), 'x_curr': float(margin + w_place + margin), 'h_m': float(h_place)})
                p['is_oversized'] = False
            p['placa_idx'] = int(current_p)

        geo_p, geo_o, geo_l = [], [], []
        total_l = 0
        area_total_piezas = sum(p['area_m2'] for p in piezas)
        perimetro_total = sum(p['perim_m'] for p in piezas)

        gap_placas = 0.3
        for p in piezas:
            off_y = float(p['placa_idx'] * (ph_m + 0.3))
            dx = float(p['dx'])
            dy = float(p['dy'])
            w_m = float(p['w_m'])
            h_m = float(p['h_m'])
            bbox_px = p['bbox_px']

            if not p['svg_path_d']:
                raise ValueError(
                    f"Pieza sin svg_path_d (bbox={bbox_px}). "
                    "La vectorización no produjo un contorno real."
                )
            if bbox_px[2] <= 0 or bbox_px[3] <= 0:
                raise ValueError(f"bbox_px inválido {bbox_px} para pieza con svg_path_d.")

            # Corte y empalme real (flujo desde piezas): oversized → recortar path por placa, N fragmentos
            if p.get('is_oversized') and clip_polygon_by_rect:
                pts_path = NestingEngineAPI._svg_path_to_polygon(p['svg_path_d'])
                if not pts_path:
                    raise ValueError("Pieza oversized sin polígono válido desde svg_path_d.")
                m_px_x = float(p['w_m']) / bbox_px[2]
                m_px_y = float(p['h_m']) / bbox_px[3]
                poly_local = [
                    ((float(x) - bbox_px[0]) * m_px_x, (float(y) - bbox_px[1]) * m_px_y)
                    for x, y in pts_path
                ]
                tramos_x = int(p.get('tramos_x', 1))
                tramos_y = int(p.get('tramos_y', 1))
                ancho_tramo = pw_m - 2 * margin
                alto_tramo = ph_m - 2 * margin
                for iy in range(tramos_y):
                    for ix in range(tramos_x):
                        x_min = ix * ancho_tramo
                        x_max = (ix + 1) * ancho_tramo
                        # Rectángulos contiguos en espacio de la pieza (sin gap) para que el clip corte bien
                        y_min = iy * alto_tramo
                        y_max = (iy + 1) * alto_tramo
                        frags = clip_polygon_by_rect(poly_local, x_min, y_min, x_max, y_max)
                        for frag in frags:
                            if len(frag) < 3:
                                continue
                            placa_idx_frag = p['placa_idx'] + iy * tramos_x + ix
                            off_y_frag = placa_idx_frag * (ph_m + gap_placas)
                            pts_plan = [
                                {'x': round(pt[0] - x_min + margin, 4), 'y': round(pt[1] - y_min + margin, 4)}
                                for pt in frag
                            ]
                            svg_d_frag = ""
                            if _VECTORIZER_OK and pts_plan:
                                try:
                                    pts_m = np.array([[pt['x'], pt['y']] for pt in pts_plan], dtype=float)
                                    svg_d_frag = _pts_a_svg(pts_m)
                                except Exception:
                                    pass
                            geo_p.append({
                                'tipo': 'cara',
                                'placa': int(placa_idx_frag),
                                'puntos': pts_plan,
                                'svg_path_d': svg_d_frag,
                                'leds': [],
                                'vinilos': [],
                                'is_oversized': True,
                                'tramos_x': tramos_x,
                                'tramos_y': tramos_y,
                                'w_m': round(ancho_tramo, 4),
                                'h_m': round(alto_tramo, 4),
                                'rotada': False,
                                'global_x': round(margin, 4),
                                'global_y': round(margin, 4),
                            })
                geo_o.append({
                    'puntos': [],
                    'color': p['color_hex'],
                    'box_id': f"{bbox_px[0]}_{bbox_px[1]}_{bbox_px[2]}_{bbox_px[3]}",
                    'agujeros': [],
                    'vinilos': [],
                    'svg_path_d': p['svg_path_d'],
                })
                continue

            try:
                m_px_x = float(p['w_m']) / bbox_px[2]
                m_px_y = float(p['h_m']) / bbox_px[3]
                orig_x_m = bbox_px[0] * m_px_x
                orig_y_m = bbox_px[1] * m_px_y
                tx = dx - orig_x_m
                ty = dy - orig_y_m
                svg_d_nesting = NestingEngineAPI._traducir_svg_path(p['svg_path_d'], tx, ty)
                if not svg_d_nesting:
                    raise ValueError("_traducir_svg_path devolvió cadena vacía.")
            except Exception as _e:
                print(f"[WARN nesting] Fallback rect para pieza bbox={bbox_px}: {_e}", flush=True)
                svg_d_nesting = (
                    f"M {dx:.4f} {dy:.4f} "
                    f"L {dx + w_m:.4f} {dy:.4f} "
                    f"L {dx + w_m:.4f} {dy + h_m:.4f} "
                    f"L {dx:.4f} {dy + h_m:.4f} Z"
                )

            geo_p.append({
                'tipo': 'cara',
                'placa': int(p['placa_idx']),
                'puntos': [],
                'svg_path_d': svg_d_nesting,
                'leds': [],
                'vinilos': [],
                'is_oversized': bool(p.get('is_oversized', False)),
                'tramos_x': int(p.get('tramos_x', 1)),
                'tramos_y': int(p.get('tramos_y', 1)),
                'w_m': float(w_m),
                'h_m': float(h_m),
                'rotada': bool(p.get('rotada', False)),
                'global_x': round(dx, 4),
                'global_y': round(dy, 4),
            })
            geo_o.append({
                'puntos': [],
                'color': p['color_hex'],
                'box_id': f"{bbox_px[0]}_{bbox_px[1]}_{bbox_px[2]}_{bbox_px[3]}",
                'agujeros': [],
                'vinilos': [],
                'svg_path_d': p['svg_path_d'],
            })

        last_y = float(shelves[-1]['y_bottom']) if shelves else 0.0
        placas_caras_final = float(current_p) + max(0.125, math.ceil((last_y / ph_m) * 8.0) / 8.0) if piezas else 0.0

        tiras_por_placa = math.floor(ph_c / float(prof_canto)) if float(prof_canto) > 0 else 1
        metros_cantos_por_placa = float(tiras_por_placa * pw_c)
        placas_cantos_raw = float(perimetro_total / metros_cantos_por_placa) if metros_cantos_por_placa > 0 else 0.0
        placas_cantos_final = max(0.125, math.ceil(placas_cantos_raw * 8.0) / 8.0) if perimetro_total > 0 else 0.0

        if perimetro_total > 0:
            placa_offset = int(math.ceil(placas_caras_final))
            tiras_necesarias = int(math.ceil(perimetro_total / pw_c))
            tiras_dibujadas = 0
            for p_idx in range(int(math.ceil(placas_cantos_final))):
                for t in range(int(tiras_por_placa)):
                    if tiras_dibujadas >= tiras_necesarias:
                        break
                    y_pos = float(margin + t * (float(prof_canto) + margin))
                    if y_pos + float(prof_canto) <= ph_c:
                        strip_pts = [
                            {'x': round(float(margin), 4), 'y': round(float(y_pos), 4)},
                            {'x': round(float(pw_c - margin), 4), 'y': round(float(y_pos), 4)},
                            {'x': round(float(pw_c - margin), 4), 'y': round(float(y_pos + float(prof_canto)), 4)},
                            {'x': round(float(margin), 4), 'y': round(float(y_pos + float(prof_canto)), 4)},
                        ]
                        geo_p.append({'tipo': 'canto', 'placa': int(placa_offset + p_idx), 'puntos': strip_pts, 'leds': []})
                        tiras_dibujadas += 1

        placas_pvc = float(placas_caras_final)
        area_total_placas = float(math.ceil(placas_caras_final) * pw_m * ph_m)
        eficiencia = float((area_total_piezas / area_total_placas) * 100.0) if area_total_placas > 0 else 0.0

        watts_totales = float(total_l * 0.24)
        amperaje = float(watts_totales / 12.0)
        fuentes_100w = int(math.ceil(watts_totales / 80.0)) if con_luz else 0

        ascii_empalmes += f"\n[ REQUERIMIENTO DE MATERIALES (BOM) ]\n"
        ascii_empalmes += f"📐 Perímetro a cantear: {perimetro_total:.2f} metros lineales\n"
        ascii_empalmes += f"🧱 Placas Frontales ({material_cara}): {placas_caras_final:.3f} pz\n"
        ascii_empalmes += f"🧱 Placas Canto ({material_canto}): {placas_cantos_final:.3f} pz\n"
        ascii_empalmes += f"🧱 Placas Traseras (PVC 3mm): {placas_pvc:.3f} pz\n"

        # Garantía de raíz: toda cara debe ser dibujable (puntos >= 3 o svg_path_d).
        for g in geo_p:
            if g.get('tipo') == 'cara':
                pts = g.get('puntos') or []
                path = (g.get('svg_path_d') or '').strip()
                if (not pts or len(pts) < 3) and not path:
                    gx = float(g.get('global_x', 0))
                    gy = float(g.get('global_y', 0))
                    wg = float(g.get('w_m', 0.1))
                    hg = float(g.get('h_m', 0.1))
                    g['svg_path_d'] = f"M {gx:.4f} {gy:.4f} L {gx + wg:.4f} {gy:.4f} L {gx + wg:.4f} {gy + hg:.4f} L {gx:.4f} {gy + hg:.4f} Z"
                if not pts or len(pts) < 3:
                    gx = float(g.get('global_x', 0))
                    gy = float(g.get('global_y', 0))
                    wg = float(g.get('w_m', 0.1))
                    hg = float(g.get('h_m', 0.1))
                    g['puntos'] = [
                        {'x': round(gx, 4), 'y': round(gy, 4)},
                        {'x': round(gx + wg, 4), 'y': round(gy, 4)},
                        {'x': round(gx + wg, 4), 'y': round(gy + hg, 4)},
                        {'x': round(gx, 4), 'y': round(gy + hg, 4)},
                    ]

        return (
            float(placas_caras_final), float(placas_cantos_final), float(perimetro_total), int(total_l),
            list(geo_p), list(geo_o), list(geo_l), float(img_w_m), float(img_h_m), str(ascii_empalmes),
            round(float(eficiencia), 1), float(watts_totales), float(amperaje), int(fuentes_100w), float(placas_pvc)
        )