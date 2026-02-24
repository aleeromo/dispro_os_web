from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from typing import List, Dict
import numpy as np
import cv2
import math
import re
import requests

# Si False: al cargar imagen no se muestran cajas (lista vacía).
# Si True: se detectan contornos y se muestran las cajas de selección; la clasificación (caja luz, letra 3D, etc.) la elige el usuario manualmente.
DETECCION_AUTOMATICA_PIEZAS = True

# Regex quirúrgica: SOLO coincide con cotas/medidas explícitas (número + unidad de longitud)
_REGEX_COTA = re.compile(
    r'\d+[\.,]?\d*\s*(cm|cms|mm|mts?|m)\b'
    r'|'
    r'^[\d\s\.,\-\+]+$',   
    re.IGNORECASE,
)
import time
import os
import sys
import json
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response

if getattr(sys, 'frozen', False):
    BASE_DIR = sys._MEIPASS
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

ia_models_dir = os.path.join(BASE_DIR, 'modelos_ia')
if not os.path.exists(ia_models_dir): os.makedirs(ia_models_dir)

try:
    import easyocr
    READER = easyocr.Reader(['es', 'en'], gpu=False, download_enabled=True, model_storage_directory=ia_models_dir)
except Exception as e:
    print(f"[ADVERTENCIA] EasyOCR no disponible: {e}", flush=True)
    READER = None

from core.database import DataBase
from core.engine_3d import NestingEngineAPI
from core.engine_print import MotorIndustrialAPI
from core import pricing_config

try:
    from core.segmentation import segmentar_imagen, segmentar_piezas, segmentar_piezas_por_contornos
    from core.vectorizer import vectorizar_imagen, pieza_a_vector
    _VISION_OK = True
except ImportError as e:
    print(f"[ERROR CRÍTICO] Módulos de visión no disponibles: {e}", flush=True)
    _VISION_OK = False

TEMP_CONTOURS_CACHE = {}
TEMP_SHAPES_CACHE: Dict[int, np.ndarray] = {}  # Motor: id (int) -> contorno, usado para generate-svg y analizar 3D
TEMP_PREPROCESS_META = {}  

app = FastAPI(title='DisproOS API Industrial', version='1.5.0')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_credentials=True, allow_methods=['*'], allow_headers=['*'])

# Precios Letras 3D se cargan desde config_precios.json (pricing_config). ROLLO usa MotorIndustrialAPI.

class PiezaLetra3D(BaseModel):
    tipo: str = "rect"  
    ancho_m: float
    alto_m: float
    prof_canto_m: float = 0.06

class CotizarLetras3DBody(BaseModel):
    piezas: list[PiezaLetra3D]
    material_cara: str = "Acrílico"
    material_canto: str = "Aluminio"
    aluminio_tipo: str = "Plata"
    prof_canto: float = 0.06
    con_luz: bool = True

class ShapeClassificationBody(BaseModel):
    id: str
    type: str
    material: str = ""
    color: str = ""

class GenerateSvgRequest(BaseModel):
    imageWidth: int
    imageHeight: int
    shapes: List[ShapeClassificationBody]

class CotizacionResponse(BaseModel):
    modo: str
    ancho_m: float
    alto_m: float
    total_venta: float
    desglose_texto: str
    desglose_tecnico: dict = {}
    geometria_nesting: list = []
    geometria_original: list = []
    geometria_leds: list = []
    geometria_empalmes: list = []
    img_w_m: float = 0.0
    img_h_m: float = 0.0
    eficiencia: float = 0.0
    folio: str = ""
    svg_path_d: str = ""
    colores_dominantes: list = []
    url_imagen_procesada: str = ""

def _contour_id_to_index(caja_id) -> int:
    """Convierte id de caja 'c_0' o 0 a índice de contorno 0 (para TEMP_SHAPES_CACHE)."""
    if caja_id is None:
        return -1
    if isinstance(caja_id, int):
        return caja_id
    s = str(caja_id).strip()
    if s.startswith("c_"):
        try:
            return int(s[2:])
        except ValueError:
            pass
    try:
        return int(s)
    except (ValueError, TypeError):
        return -1

def _contour_to_svg_path_d(cnt, scale_x=1.0, scale_y=1.0) -> str:
    """Convierte un contorno OpenCV en path SVG (M/L/Z) en coordenadas de imagen."""
    if cnt is None or len(cnt) < 2:
        return ""
    pts = cnt.reshape(-1, 2)
    parts = [f"M {pts[0][0] * scale_x} {pts[0][1] * scale_y}"]
    for k in range(1, len(pts)):
        parts.append(f"L {pts[k][0] * scale_x} {pts[k][1] * scale_y}")
    parts.append("Z")
    return " ".join(parts)


def _children_from_hierarchy(hierarchy: np.ndarray, i: int) -> list:
    """Devuelve índices de hijos directos del contorno i (OpenCV: [Next, Prev, First_Child, Parent])."""
    if hierarchy is None or i < 0 or i >= len(hierarchy):
        return []
    first_child = int(hierarchy[i][2])
    if first_child == -1:
        return []
    out = []
    idx = first_child
    while idx != -1:
        out.append(idx)
        idx = int(hierarchy[idx][0])  # next sibling
    return out


def _detect_shapes_smart_render(img: np.ndarray, exclusion_zones: list = None) -> list:
    """Detección para nesting: umbral 200, RETR_TREE (contornos externos + interiores/huecos).
    Rellena TEMP_SHAPES_CACHE (id → contorno), TEMP_PREPROCESS_META (w_px, h_px, hierarchy).
    La jerarquía real se usa en analizar para que engine_3d asigne huecos (centros de 'a','e','o','d') a cada pieza."""
    TEMP_SHAPES_CACHE.clear()
    TEMP_PREPROCESS_META.clear()
    exclusion_zones = exclusion_zones or []
    h_img, w_img = img.shape[:2]
    # Máscara binaria: si hay alpha (PNG con transparencia), usarla para preservar huecos (transparente = fondo)
    if len(img.shape) == 3 and img.shape[2] == 4:
        alpha = img[:, :, 3]
        binary = (alpha >= 128).astype(np.uint8) * 255  # opaco = figura (255), transparente = hueco/fondo (0)
    else:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
        _, binary = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)
    for (x1, y1, x2, y2) in exclusion_zones:
        x1i = max(0, int(x1))
        y1i = max(0, int(y1))
        x2i = min(w_img, int(x2))
        y2i = min(h_img, int(y2))
        if x2i > x1i and y2i > y1i:
            binary[y1i:y2i, x1i:x2i] = 0
    # RETR_TREE: contornos externos e internos con jerarquía (parent = hierarchy[i][3]); permite huecos/centros de letras
    contours, hierarchy = cv2.findContours(binary, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    if hierarchy is None:
        hierarchy = np.zeros((len(contours), 4), dtype=np.int32)
        hierarchy[:, 3] = -1
    else:
        hierarchy = hierarchy.reshape(-1, 4)  # OpenCV devuelve (1, N, 4)
    # Cache: id = índice OpenCV (0..N-1) para que la jerarquía siga siendo válida
    for i, cnt in enumerate(contours):
        TEMP_SHAPES_CACHE[i] = cnt.copy()
    TEMP_PREPROCESS_META["hierarchy"] = hierarchy.copy()
    TEMP_PREPROCESS_META["w_px"] = w_img
    TEMP_PREPROCESS_META["h_px"] = h_img
    # Cajas para frontend: una por contorno. Raíces: filtro tamaño para evitar ruido; hijos (huecos): siempre mostrar
    shapes = []
    for i in range(len(contours)):
        x, y, w, h = cv2.boundingRect(contours[i])
        parent_idx = int(hierarchy[i][3])
        is_master = parent_idx == -1
        # Raíces: descartar demasiado pequeños o borde de imagen. Hijos (centros de a,e,o,d): no filtrar por tamaño
        if is_master:
            if w < 2 or h < 2 or w > w_img * 0.99:
                continue
        else:
            if w > w_img * 0.99 or h > h_img * 0.99:
                continue
        children_ids = _children_from_hierarchy(hierarchy, i) if is_master else []
        path_d = _contour_to_svg_path_d(contours[i], 1.0, 1.0)
        shapes.append({
            "id": i,
            "x": int(x), "y": int(y), "w": int(w), "h": int(h),
            "norm_x": float(x / w_img), "norm_y": float(y / h_img),
            "norm_w": float(w / w_img), "norm_h": float(h / h_img),
            "color": "#ffffff",
            "is_master": is_master,
            "childrenIds": children_ids,
            "contour_path_d": path_d,
        })
    return shapes


def _build_svg_motor_style(
    contours_cache: dict,
    shapes_list: list,
    viewbox_w: float,
    viewbox_h: float,
    scale_x: float,
    scale_y: float,
    ignored_ids: set = None,
) -> str:
    """Construye SVG con lógica Motor: approxPolyDP epsilon 0.0001, huecos (fill-rule evenodd)."""
    ignored_ids = ignored_ids or set()
    EPSILON_FACTOR = 0.0001
    solids = [s for s in shapes_list if s.get("type") not in ("ignorar", "hueco")]
    holes = [s for s in shapes_list if s.get("type") == "hueco"]
    def _area_key(s):
        idx = _contour_id_to_index(s.get("id"))
        return cv2.contourArea(contours_cache[idx]) if idx in contours_cache else 0
    solids.sort(key=_area_key)
    by_id = {str(s.get("id", "")): s for s in shapes_list}
    solid_paths = {}
    for s in solids:
        cid = s.get("id")
        idx = _contour_id_to_index(cid)
        if idx < 0 or idx not in contours_cache or idx in ignored_ids:
            continue
        cnt = contours_cache[idx]
        eps = EPSILON_FACTOR * cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, eps, True)
        area = cv2.contourArea(approx, oriented=True)
        if area < 0:
            approx = approx[::-1]
            area = -area
        pts = approx.reshape(-1, 2)
        if len(pts) < 3:
            continue
        d_parts = [f"M {pts[0][0] * scale_x} {pts[0][1] * scale_y}"]
        for k in range(1, len(pts)):
            d_parts.append(f"L {pts[k][0] * scale_x} {pts[k][1] * scale_y}")
        d_parts.append("Z")
        d = " ".join(d_parts)
        stype = (s.get("type") or "letra3d").strip().lower() or "letra3d"
        mat = (s.get("material") or "acrilico").strip().lower() or "acrilico"
        col = s.get("color") or "#ffffff"
        solid_paths[idx] = {"d": d, "type": stype, "mat": mat, "col": col, "cnt": cnt}
    for h in holes:
        idx = _contour_id_to_index(h.get("id"))
        if idx < 0 or idx not in contours_cache or idx in ignored_ids:
            continue
        h_cnt = contours_cache[idx]
        hx, hy, hw, hh = cv2.boundingRect(h_cnt)
        hcx = hx + hw / 2.0
        hcy = hy + hh / 2.0
        eps = EPSILON_FACTOR * cv2.arcLength(h_cnt, True)
        h_approx = cv2.approxPolyDP(h_cnt, eps, True)
        h_area = cv2.contourArea(h_approx, oriented=True)
        for sidx, data in list(solid_paths.items()):
            s_cnt = data["cnt"]
            sx, sy, sw, sh = cv2.boundingRect(s_cnt)
            if sx <= hcx <= sx + sw and sy <= hcy <= sy + sh:
                s_area = cv2.contourArea(data["cnt"], oriented=True)
                if (h_area * s_area) > 0:
                    h_approx = h_approx[::-1]
                pts = h_approx.reshape(-1, 2)
                if len(pts) < 3:
                    break
                h_parts = [f"M {pts[0][0] * scale_x} {pts[0][1] * scale_y}"]
                for k in range(1, len(pts)):
                    h_parts.append(f"L {pts[k][0] * scale_x} {pts[k][1] * scale_y}")
                h_parts.append("Z")
                data["d"] += " " + " ".join(h_parts)
                break
    tags = []
    for sidx, data in solid_paths.items():
        tags.append(
            f'<path d="{data["d"]}" fill-rule="evenodd" data-type="{data["type"]}" data-mat="{data["mat"]}" data-col="{data["col"]}" />'
        )
    return f'<svg viewBox="0 0 {viewbox_w} {viewbox_h}" xmlns="http://www.w3.org/2000/svg">{" ".join(tags)}</svg>'

@app.get('/api/v1/flete')
def calcular_flete(destino: str):
    try:
        url_geo = f"https://nominatim.openstreetmap.org/search?q={destino}, Mexico&format=json&limit=1"
        geo_res = requests.get(url_geo, headers={'User-Agent': 'DisproOS/1.0'}, timeout=5).json()
        if not geo_res: raise Exception("Destino no encontrado")
        lat, lon = float(geo_res[0]['lat']), float(geo_res[0]['lon'])
        url_route = f"https://router.project-osrm.org/route/v1/driving/-98.2063,19.0414;{lon},{lat}?overview=false"
        route_res = requests.get(url_route, timeout=5).json()
        dist_km = float(route_res['routes'][0]['distance']) / 1000.0
        time_h = float(route_res['routes'][0]['duration']) / 3600.0
    except:
        dist_km = float(len(destino)) * 12.0 
        time_h = float(dist_km) / 80.0

    gas = (dist_km / 10.0) * 24.5 * 2.0 
    casetas = dist_km * 2.8 * 2.0
    viaticos = 500.0 * (math.ceil(max(1.0, time_h) / 8.0) * 2.0) 
    hospedaje = 1500.0 if time_h > 6.0 else 0.0
    total_flete = float(math.ceil(gas + casetas + viaticos + hospedaje))
    
    return {"distancia": round(dist_km), "tiempo": round(time_h, 1), "total": total_flete, "desglose": f"Gasolina: ${gas:.0f} | Casetas: ${casetas:.0f} | Viáticos: ${viaticos:.0f} | Hospedaje: ${hospedaje:.0f}"}

@app.get('/api/v1/health')
def health():
    """Comprueba que en este puerto corre el backend DisproOS (no otro servicio)."""
    return {"status": "ok", "app": "DisproOS"}

@app.post('/api/v1/preprocesar')
async def preprocesar_imagen(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        def decodificar_imagen(data):
            img_un = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_UNCHANGED)
            if img_un is None: return None
            # Fix de transparencias
            if len(img_un.shape) == 3 and img_un.shape[2] == 4:
                alpha = img_un[:, :, 3]
                bgr = img_un[:, :, :3]
                blanco = np.ones_like(bgr, dtype=np.uint8) * 255
                return np.where(alpha[:, :, np.newaxis] == 0, blanco, bgr)
            return img_un
            
        img_cv = await run_in_threadpool(decodificar_imagen, contents)
        if img_cv is None: raise ValueError("Imagen corrupta")
            
        h_px, w_px = img_cv.shape[:2]
        modo_detectado = 'ROLLO'
        wm, hm = 1.0, 1.0
        cajas = []
        exclusion_zones = []

        scale_ocr = float(min(1.0, 800.0 / float(max(w_px, h_px))))
        img_ocr = cv2.resize(img_cv, (0, 0), fx=scale_ocr, fy=scale_ocr) if scale_ocr < 1.0 else img_cv

        def _to_m(val_str, unit):
            v = float(val_str.replace(',', '.'))
            if 'mm' in unit: return v / 1000.0
            if 'cm' in unit: return v / 100.0
            return v 

        if READER is not None:
            try:
                h_meds, v_meds = [], []
                res_ocr = READER.readtext(img_ocr)
                txt_h = ""
                for (bbox, text, prob) in res_ocr:
                    txt_h += f" {text.lower()} "
                    if re.search(r'\d', text):
                        modo_detectado = '3D'  
                    if _REGEX_COTA.search(text.strip()):  
                        pts = np.array(bbox, dtype=np.float32) / scale_ocr
                        exclusion_zones.append((float(np.min(pts[:,0]))-15.0, float(np.min(pts[:,1]))-15.0,
                                                float(np.max(pts[:,0]))+15.0, float(np.max(pts[:,1]))+15.0))
                for v, u in re.findall(r'(\d+[\.,]?\d*)\s*(cm|cms|mm|mts?|m)\b', txt_h):
                    h_meds.append(_to_m(v, u))

                img_rot_cw = cv2.rotate(img_ocr, cv2.ROTATE_90_CLOCKWISE)
                rot_h_px_cw, rot_w_px_cw = img_rot_cw.shape[:2]
                res_ocr_rot = READER.readtext(img_rot_cw)
                txt_v = ""
                for (bbox, text, prob) in res_ocr_rot:
                    txt_v += f" {text.lower()} "
                    if re.search(r'\d', text):
                        modo_detectado = '3D'
                    if _REGEX_COTA.search(text.strip()):
                        pts_r = np.array(bbox, dtype=np.float32)
                        orig_x = pts_r[:, 1] / scale_ocr
                        orig_y = (rot_w_px_cw - pts_r[:, 0]) / scale_ocr
                        exclusion_zones.append((float(np.min(orig_x))-15.0, float(np.min(orig_y))-15.0,
                                                float(np.max(orig_x))+15.0, float(np.max(orig_y))+15.0))
                for v, u in re.findall(r'(\d+[\.,]?\d*)\s*(cm|cms|mm|mts?|m)\b', txt_v):
                    v_meds.append(_to_m(v, u))

                img_rot_ccw = cv2.rotate(img_ocr, cv2.ROTATE_90_COUNTERCLOCKWISE)
                rot_h_px_ccw, rot_w_px_ccw = img_rot_ccw.shape[:2]
                res_ocr_rot_ccw = READER.readtext(img_rot_ccw)
                txt_v_ccw = ""
                for (bbox, text, prob) in res_ocr_rot_ccw:
                    txt_v_ccw += f" {text.lower()} "
                    if re.search(r'\d', text):
                        modo_detectado = '3D'
                    if _REGEX_COTA.search(text.strip()):
                        pts_r = np.array(bbox, dtype=np.float32)
                        orig_x = (rot_h_px_ccw - pts_r[:, 1]) / scale_ocr
                        orig_y = pts_r[:, 0] / scale_ocr
                        exclusion_zones.append((float(np.min(orig_x))-15.0, float(np.min(orig_y))-15.0,
                                                float(np.max(orig_x))+15.0, float(np.max(orig_y))+15.0))
                for v, u in re.findall(r'(\d+[\.,]?\d*)\s*(cm|cms|mm|mts?|m)\b', txt_v_ccw):
                    v_meds.append(_to_m(v, u))

                all_meds = sorted(list(set(h_meds + v_meds)), reverse=True)
                h_meds_s = sorted(list(set(h_meds)), reverse=True)
                v_meds_s = sorted(list(set(v_meds)), reverse=True)
                wm = h_meds_s[0] if h_meds_s else (all_meds[0] if all_meds else 1.0)
                hm = v_meds_s[0] if v_meds_s else (all_meds[1] if len(all_meds) > 1 else wm * (float(h_px) / float(w_px)))
            except Exception as e:
                print(f"[ERROR OCR] preprocesar_imagen: {e}", flush=True)

        # Detección de piezas: siempre que esté en 3D o la detección automática esté activa (para distinguir Letras 3D vs Rollo).
        if modo_detectado == '3D' or DETECCION_AUTOMATICA_PIEZAS:
            try:
                def imagen_para_deteccion(data):
                    img_un = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_UNCHANGED)
                    if img_un is None:
                        return None
                    # Mantener alpha (4 canales) para que la detección use transparencia = huecos (centros de a, e, o, d)
                    if img_un.ndim == 2:
                        return cv2.cvtColor(img_un, cv2.COLOR_GRAY2BGR)
                    return img_un
                img_detect = await run_in_threadpool(imagen_para_deteccion, contents)
                if img_detect is None:
                    img_detect = img_cv
                cajas = await run_in_threadpool(_detect_shapes_smart_render, img_detect, [])
                # Inferir modo: si hay varias piezas raíz o una con huecos (letras tipo a,e,o,d) → Letras 3D; si no → Rollo.
                masters = [s for s in cajas if s.get('is_master')]
                if masters:
                    if len(masters) > 1 or (masters[0].get('childrenIds')):
                        modo_detectado = '3D'
                    # Si OCR ya marcó 3D (p. ej. por cotas), mantenerlo aunque solo haya una pieza
                elif not cajas and modo_detectado != '3D':
                    modo_detectado = 'ROLLO'
            except HTTPException:
                raise
            except Exception as e:
                print(f"[ERROR DETECCIÓN SMART RENDER] preprocesar_imagen: {e}", flush=True)
                raise HTTPException(status_code=500, detail=f"Error en detección (Smart Render): {e}")

        return {'modo': str(modo_detectado), 'ancho_m': float(round(wm, 2)), 'alto_m': float(round(hm, 2)), 'cajas': cajas, 'ancho_px': int(w_px), 'alto_px': int(h_px)}
    except Exception as e: 
        raise HTTPException(status_code=500, detail=str(e))

@app.post('/api/v1/generate-svg')
async def generate_svg(req: GenerateSvgRequest):
    """Genera SVG con clasificaciones tipo Motor (letra3d, caja, rotulo, hueco, ignorar) y huecos. Usa TEMP_SHAPES_CACHE del último preprocesar."""
    try:
        w_img = req.imageWidth
        h_img = req.imageHeight
        if w_img < 1 or h_img < 1:
            raise HTTPException(status_code=400, detail="imageWidth e imageHeight requeridos")
        shapes = [{"id": s.id, "type": s.type or "letra3d", "material": s.material or "acrilico", "color": s.color or "#ffffff"} for s in req.shapes]
        svg_str = _build_svg_motor_style(
            TEMP_SHAPES_CACHE,
            shapes,
            viewbox_w=float(w_img),
            viewbox_h=float(h_img),
            scale_x=1.0,
            scale_y=1.0,
        )
        return {"status": "success", "svg_data": svg_str}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def _limpiar_y_procesar_imagen_3d(img_cv: np.ndarray, exclusion_zones: list) -> str:
    import base64
    import io as _io

    try:
        img_limpia = img_cv.copy()
        h_px, w_px = img_limpia.shape[:2]

        for (x1, y1, x2, y2) in exclusion_zones:
            cv2.rectangle(
                img_limpia,
                (int(max(0, x1 - 8)), int(max(0, y1 - 8))),
                (int(min(w_px - 1, x2 + 8)), int(min(h_px - 1, y2 + 8))),
                (255, 255, 255), -1
            )

        try:
            from rembg import remove as _rembg_remove
            from PIL import Image as _PILImage
            img_rgb = cv2.cvtColor(img_limpia, cv2.COLOR_BGR2RGB)
            pil_in = _PILImage.fromarray(img_rgb)
            pil_out = _rembg_remove(pil_in)
            buf = _io.BytesIO()
            pil_out.save(buf, format='PNG', optimize=True)
        except Exception as _rem_e:
            gray = cv2.cvtColor(img_limpia, cv2.COLOR_BGR2GRAY)
            _, mask = cv2.threshold(gray, 245, 255, cv2.THRESH_BINARY_INV)
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
            bgra = cv2.cvtColor(img_limpia, cv2.COLOR_BGR2BGRA)
            bgra[:, :, 3] = mask
            rgba = cv2.cvtColor(bgra, cv2.COLOR_BGRA2RGBA)
            from PIL import Image as _PILImage
            pil_out = _PILImage.fromarray(rgba)
            buf = _io.BytesIO()
            pil_out.save(buf, format='PNG', optimize=True)

        b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        return f"data:image/png;base64,{b64}"

    except Exception as e:
        return ""

@app.post('/api/v1/analizar', response_model=CotizacionResponse)
async def analizar_proyecto(
    file: UploadFile = File(...), modo: str = Form(...), material_cara: str = Form("Acrílico"), 
    aluminio_tipo: str = Form("Plata"), material_canto: str = Form("Aluminio"), prof_canto: float = Form(0.06), 
    ancho_m: float = Form(...), alto_m: float = Form(...), con_luz: str = Form("false"), 
    ancho_rollo: float = Form(1.27), boxes_ignoradas: str = Form(''), 
    classifications: str = Form('')
):
    contents = await file.read()
    def decodificar_imagen(data):
        img_un = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_UNCHANGED)
        if img_un is None: return None
        if len(img_un.shape) == 3 and img_un.shape[2] == 4:
            alpha = img_un[:, :, 3]
            bgr = img_un[:, :, :3]
            blanco = np.ones_like(bgr, dtype=np.uint8) * 255
            return np.where(alpha[:, :, np.newaxis] == 0, blanco, bgr)
        return img_un
        
    img_cv = await run_in_threadpool(decodificar_imagen, contents)
    folio_id = f"DS-{int(time.time()) % 0xFFFFFF:05X}"
    
    is_con_luz = str(con_luz).strip().lower() in ["true", "1", "yes", "t", "y"]
    
    if str(modo) == '3D':
        precios_3d = pricing_config.get_precios_3d()
        formula_3d = pricing_config.get_formula_3d()
        exclusion_zones = []
        h_px, w_px = img_cv.shape[:2]

        if READER is not None:
            scale_ocr = float(min(1.0, 800.0 / float(max(w_px, h_px))))
            img_ocr = cv2.resize(img_cv, (0, 0), fx=scale_ocr, fy=scale_ocr) if scale_ocr < 1.0 else img_cv
            try:
                for (bbox, text, prob) in READER.readtext(img_ocr):
                    if _REGEX_COTA.search(text.strip()):
                        pts = np.array(bbox, dtype=np.float32) / scale_ocr
                        exclusion_zones.append((float(np.min(pts[:,0]))-15.0, float(np.min(pts[:,1]))-15.0,
                                                float(np.max(pts[:,0]))+15.0, float(np.max(pts[:,1]))+15.0))
                img_rot_cw = cv2.rotate(img_ocr, cv2.ROTATE_90_CLOCKWISE)
                rot_w_px_cw = img_rot_cw.shape[1]
                for (bbox, text, prob) in READER.readtext(img_rot_cw):
                    if _REGEX_COTA.search(text.strip()):
                        pts_r = np.array(bbox, dtype=np.float32)
                        orig_x = pts_r[:, 1] / scale_ocr
                        orig_y = (rot_w_px_cw - pts_r[:, 0]) / scale_ocr
                        exclusion_zones.append((float(np.min(orig_x))-15.0, float(np.min(orig_y))-15.0,
                                                float(np.max(orig_x))+15.0, float(np.max(orig_y))+15.0))
                img_rot_ccw = cv2.rotate(img_ocr, cv2.ROTATE_90_COUNTERCLOCKWISE)
                rot_h_px_ccw = img_rot_ccw.shape[0]
                for (bbox, text, prob) in READER.readtext(img_rot_ccw):
                    if _REGEX_COTA.search(text.strip()):
                        pts_r = np.array(bbox, dtype=np.float32)
                        orig_x = (rot_h_px_ccw - pts_r[:, 1]) / scale_ocr
                        orig_y = pts_r[:, 0] / scale_ocr
                        exclusion_zones.append((float(np.min(orig_x))-15.0, float(np.min(orig_y))-15.0,
                                                float(np.max(orig_x))+15.0, float(np.max(orig_y))+15.0))
            except Exception as e:
                pass

        url_imagen_procesada = await run_in_threadpool(
            _limpiar_y_procesar_imagen_3d, img_cv, exclusion_zones
        )

        ignored_ids = set()
        for part in (str(boxes_ignoradas).strip() or "").split(","):
            part = part.strip()
            if part.startswith("c_"):
                try: ignored_ids.add(int(part[2:]))
                except ValueError: pass
            else:
                try: ignored_ids.add(int(part))
                except ValueError: pass

        use_cache = (
            TEMP_PREPROCESS_META.get("w_px") == w_px
            and TEMP_PREPROCESS_META.get("h_px") == h_px
            and len(TEMP_SHAPES_CACHE) > 0
        )
        cnts_list = None
        if use_cache:
            cnts_list = [TEMP_SHAPES_CACHE[i] for i in sorted(TEMP_SHAPES_CACHE.keys())]
        if (cnts_list is None or len(cnts_list) == 0) and img_cv is not None:
            # Solución de raíz: si no hay caché usable, detectar contornos en la imagen actual y usarlos para nesting
            try:
                await run_in_threadpool(_detect_shapes_smart_render, img_cv, exclusion_zones)
                cnts_list = [TEMP_SHAPES_CACHE[i] for i in sorted(TEMP_SHAPES_CACHE.keys())]
                use_cache = len(cnts_list) > 0
            except Exception as _e:
                print(f"[analizar] Fallback detección en analizar: {_e}", flush=True)

        # ignoradas: el motor recibe rectas (x_y_w_h) y salta contornos cuyo centro cae en ellas
        ignoradas = []
        for cid in ignored_ids:
            if cid in TEMP_SHAPES_CACHE:
                cnt = TEMP_SHAPES_CACHE[cid]
                x, y, w, h = cv2.boundingRect(cnt)
                ignoradas.append(f"{int(x)}_{int(y)}_{int(w)}_{int(h)}")

        if cnts_list and len(cnts_list) > 0:
            n = len(cnts_list)
            # Usar jerarquía real si existe (RETR_TREE) para que engine_3d asigne huecos (depth % 2 != 0)
            if "hierarchy" in TEMP_PREPROCESS_META:
                hierarchy = np.asarray(TEMP_PREPROCESS_META["hierarchy"], dtype=np.int32)
                if hierarchy.shape[0] != n:
                    hierarchy = np.zeros((n, 4), dtype=np.int32)
                    hierarchy[:, 3] = -1
            else:
                hierarchy = np.zeros((n, 4), dtype=np.int32)
                hierarchy[:, 3] = -1
                hierarchy[:, 2] = -1
                for i in range(n):
                    hierarchy[i][0] = i + 1 if i < n - 1 else -1
                    hierarchy[i][1] = i - 1 if i > 0 else -1
            wm = float(ancho_m)
            placas_cara, placas_canto, perimetro, leds, geo_n, geo_o, geo_l, _iw, _ih, ascii_emp, eficiencia, watts, amps, fuentes, placas_pvc = await run_in_threadpool(
                NestingEngineAPI.ejecutar_nesting_vectorial,
                cnts_list, hierarchy, wm, str(material_cara), str(material_canto), float(prof_canto),
                is_con_luz, img_cv, ignoradas, exclusion_zones, float(alto_m)
            )
            iw, ih = float(_iw), float(_ih)
        else:
            dummy_piece = PiezaLetra3D(tipo="rect", ancho_m=float(ancho_m), alto_m=float(alto_m), prof_canto_m=float(prof_canto))
            cnts_s, hier_s, img_s, wm_s = await run_in_threadpool(_construir_contornos_sinteticos, [dummy_piece])
            placas_cara, placas_canto, perimetro, leds, geo_n, geo_o, geo_l, _iw, _ih, ascii_emp, eficiencia, watts, amps, fuentes, placas_pvc = await run_in_threadpool(
                NestingEngineAPI.ejecutar_nesting_vectorial,
                cnts_s, hier_s, wm_s, str(material_cara), str(material_canto), float(prof_canto),
                is_con_luz, img_s, [], [], float(alto_m)
            )
            iw, ih = float(ancho_m), float(alto_m)

        full_svg_str = ""
        if cnts_list and len(cnts_list) > 0:
            cl_list = None
            classifications_str = (classifications or "").strip()
            if classifications_str:
                try:
                    parsed = json.loads(classifications_str)
                    if isinstance(parsed, list) and len(parsed) > 0:
                        cl_list = parsed
                except (json.JSONDecodeError, TypeError):
                    pass
            if cl_list is None or len(cl_list) == 0:
                mat_norm = "aluminio" if "aluminio" in str(material_cara).lower() else "acrilico"
                cl_list = [
                    {"id": idx, "type": "letra3d", "material": mat_norm, "color": "#ffffff"}
                    for idx in sorted(TEMP_SHAPES_CACHE.keys())
                    if idx not in ignored_ids
                ]
            if cl_list:
                scale_x = iw / float(w_px)
                scale_y = ih / float(h_px)
                full_svg_str = _build_svg_motor_style(
                    TEMP_SHAPES_CACHE,
                    cl_list,
                    viewbox_w=iw,
                    viewbox_h=ih,
                    scale_x=scale_x,
                    scale_y=scale_y,
                    ignored_ids=ignored_ids,
                )
            if not full_svg_str:
                svg_tags = []
                mat_norm = "aluminio" if "aluminio" in str(material_cara).lower() else "acrilico"
                for p in geo_o:
                    path_d = p.get('svg_path_d', '')
                    col_hex = p.get('color', '#ffffff')
                    if path_d:
                        svg_tags.append(f'<path d="{path_d}" fill-rule="evenodd" data-type="letra3d" data-mat="{mat_norm}" data-col="{col_hex}" />')
                if svg_tags:
                    full_svg_str = f'<svg viewBox="0 0 {iw} {ih}" xmlns="http://www.w3.org/2000/svg">\n{"".join(svg_tags)}\n</svg>'
        # Cuando use_cache es False (p. ej. otra imagen/tamaño), rellenar svg_path_d desde geo_o si hay geometría
        if not full_svg_str and geo_o:
            svg_tags = []
            mat_norm = "aluminio" if "aluminio" in str(material_cara).lower() else "acrilico"
            for p in geo_o:
                path_d = p.get('svg_path_d', '')
                col_hex = p.get('color', '#ffffff')
                if path_d:
                    svg_tags.append(f'<path d="{path_d}" fill-rule="evenodd" data-type="letra3d" data-mat="{mat_norm}" data-col="{col_hex}" />')
            if svg_tags:
                full_svg_str = f'<svg viewBox="0 0 {iw} {ih}" xmlns="http://www.w3.org/2000/svg">\n{"".join(svg_tags)}\n</svg>'

        if str(material_cara) == 'Acrílico':
            p_base_cara = float(precios_3d.get('acrilico_3mm'))
            mat_desc = "acrílico de 3mm rotuladas con vinil"
        else:
            if str(aluminio_tipo) == "Dorado": p_base_cara = float(precios_3d.get('aluminio_dorado'))
            elif str(aluminio_tipo) == "Rosa": p_base_cara = float(precios_3d.get('aluminio_rosa'))
            elif str(aluminio_tipo) == "Mate": p_base_cara = float(precios_3d.get('aluminio_mate'))
            else: p_base_cara = float(precios_3d.get('aluminio_plata'))
            mat_desc = f"aluminio {str(aluminio_tipo).lower()} con acabado industrial"

        if str(material_canto) == 'Acrílico': p_base_canto = float(precios_3d.get('acrilico_3mm'))
        elif 'Dorado' in str(material_canto) or 'Negro' in str(material_canto): p_base_canto = float(precios_3d.get('aluminio_dorado'))
        else: p_base_canto = float(precios_3d.get('aluminio_mate'))

        costo_cara = float(placas_cara) * p_base_cara
        costo_canto = float(placas_canto) * p_base_canto
        costo_pvc = float(placas_pvc) * float(precios_3d.get('pvc_3mm'))
        costo_leds = float(leds) * float(precios_3d.get('led_8cm'))
        costo_fuentes = float(fuentes) * float(precios_3d.get('fuente_100w'))
        costo_consumibles = float(precios_3d.get('consumibles_fijos'))

        costo_mat_bruto = costo_cara + costo_canto + costo_pvc
        costo_electrico = costo_leds + costo_fuentes
        mo_pm = float(formula_3d.get('mano_obra_por_metro', 90.0))
        costo_mo = float(perimetro) * mo_pm
        fm = float(formula_3d.get('factor_material', 2.0))
        fe = float(formula_3d.get('factor_electrico', 1.5))
        fmo = float(formula_3d.get('factor_mo', 1.8))
        fg = float(formula_3d.get('factor_ganancia', 1.15))
        total_venta_bruto = ((costo_mat_bruto * fm) + (costo_electrico * fe) + costo_consumibles + (costo_mo * fmo)) * fg
        total_venta = float(math.ceil(total_venta_bruto))

        desglose = {
            'BOM - LISTA DE MATERIALES': f"Cara: {placas_cara:.3f} pl. {material_cara} (${costo_cara:,.2f})\nCanto: {placas_canto:.3f} pl. {material_canto} (${costo_canto:,.2f})\nFondo: {placas_pvc:.3f} pl. PVC 3mm (${costo_pvc:,.2f})\nLEDs: {int(leds)} pz 8cm (${costo_leds:,.2f})\nFuentes: {int(fuentes)} pz 100W (${costo_fuentes:,.2f})",
            'MANO DE OBRA Y VARIOS': f"Perímetro: {perimetro:.2f}m (${costo_mo:,.2f})\nConsumibles Grales: ${costo_consumibles:,.2f}",
            'REPORTES TÉCNICOS': "\n" + str(ascii_emp) if ascii_emp else "Caja de luz estándar — cotización por medidas."
        }
        texto_formal = f"Letras 3D|SPLIT|Suministro y colocación* de:\n\nCaja de luz fabricada en {mat_desc}, relieve de {int(float(prof_canto)*100)} cms.\nTapas traseras en PVC de 3mm.\n{'Iluminada con módulos led y fuentes de poder.' if is_con_luz else 'Sin iluminación.'}\n\nMedidas finales: {float(ancho_m):.2f}m x {float(alto_m):.2f}m."
        geo_orig = list(geo_o) if (cnts_list and len(cnts_list) > 0) else []
        colores_dom = list(dict.fromkeys([p.get("color", "") for p in geo_orig if p.get("color")]))
        return CotizacionResponse(
            modo=str(modo), ancho_m=float(ancho_m), alto_m=float(alto_m),
            total_venta=total_venta, desglose_texto=texto_formal, desglose_tecnico=desglose,
            geometria_nesting=list(geo_n), geometria_original=geo_orig, geometria_leds=list(geo_l) if (cnts_list and len(cnts_list) > 0) else [],
            img_w_m=iw, img_h_m=ih, eficiencia=float(eficiencia), folio=f"PRO-{folio_id}",
            url_imagen_procesada=url_imagen_procesada,
            svg_path_d=full_svg_str,
            colores_dominantes=colores_dom,
        )

    geo_e, num_l = MotorIndustrialAPI.calcular_empalmes_puros(float(ancho_m), float(alto_m), float(ancho_rollo))
    is_lineal = "DTF" in str(material_cara).upper()
    area_real_material = (float(num_l) * float(ancho_rollo)) * float(alto_m)
    cantidad_cobrar = float(math.ceil(max(float(ancho_m), float(alto_m)))) if is_lineal else float(math.ceil(area_real_material))
    unidad = "Metros Lineales" if is_lineal else "Metros Cuadrados"

    precio_m2 = float(MotorIndustrialAPI.obtener_precio_escalonado(str(material_cara), float(cantidad_cobrar)))
    total = float(math.ceil(((cantidad_cobrar * precio_m2) + 300.0) * 1.15))
    
    desglose = {'Cálculo Ajustado': f"{int(cantidad_cobrar)} {unidad} (Enteros)", 'Lienzos Físicos': f"{int(num_l)} tramos de {float(ancho_rollo)}m", 'Área Bruta (Rollo Completo)': f"{area_real_material:.2f} m²", 'Sustrato': str(material_cara)}
    texto_print = f"Impresión Gran Formato|SPLIT|Suministro y colocación* de:\n\nImpresión en alta resolución sobre {str(material_cara).lower()} en lienzos de {float(ancho_rollo)}m.\n\nMedidas totales de la impresión: {float(ancho_m):.2f}m ancho x {float(alto_m):.2f}m alto."
    
    geo_e_clean = [{"x_offset": float(emp.get("x_offset", 0.0)), "ancho_m": float(emp.get("ancho_m", 0.0)), "lienzo": int(emp.get("lienzo", 1))} for emp in geo_e]

    return CotizacionResponse(modo='ROLLO', ancho_m=float(ancho_m), alto_m=float(alto_m), total_venta=total, desglose_texto=texto_print, desglose_tecnico=desglose, geometria_empalmes=geo_e_clean, eficiencia=100.0, folio=f"IMP-{folio_id}")

def _construir_contornos_sinteticos(piezas: list) -> tuple:
    scale = 1000
    cnts = []
    y_curr = 0
    gap = 20
    max_w = 0
    for p in piezas:
        w_px = max(10, int(float(p.ancho_m) * scale))
        h_px = max(10, int(float(p.alto_m) * scale))
        rect = np.array([[[0, y_curr]], [[w_px, y_curr]], [[w_px, y_curr + h_px]], [[0, y_curr + h_px]]], dtype=np.int32)
        cnts.append(rect)
        max_w = max(max_w, w_px)
        y_curr += h_px + gap
    pad_w = max(150, max_w // 6)
    pad_h = max(150, y_curr // 6)
    img_w = max(1000, max_w + pad_w)
    img_h = max(1000, y_curr + pad_h)
    img_cv = np.ones((img_h, img_w), dtype=np.uint8) * 255
    wm = float(img_w) / 1000.0
    n = len(cnts)
    hierarchy = np.zeros((n, 4), dtype=np.int32)
    hierarchy[:, 3] = -1  
    hierarchy[:, 2] = -1  
    for i in range(n):
        hierarchy[i][0] = i + 1 if i < n - 1 else -1   
        hierarchy[i][1] = i - 1 if i > 0 else -1       
    return cnts, hierarchy, img_cv, wm

@app.post('/api/v1/cotizar_letras_3d', response_model=CotizacionResponse)
async def cotizar_letras_3d(body: CotizarLetras3DBody):
    if not body.piezas or len(body.piezas) == 0:
        raise HTTPException(status_code=400, detail="Se requiere al menos una pieza.")
    cnts, hierarchy, img_cv, wm = await run_in_threadpool(
        _construir_contornos_sinteticos, body.piezas
    )
    folio_id = f"DS-{int(time.time()) % 0xFFFFFF:05X}"
    material_cara = str(body.material_cara)
    material_canto = str(body.material_canto)
    prof_canto = float(body.prof_canto)
    is_con_luz = bool(body.con_luz)
    ignoradas = []
    exclusion_zones = []
    placas_cara, placas_canto, perimetro, leds, geo_n, geo_o, geo_l, iw, ih, ascii_emp, eficiencia, watts, amps, fuentes, placas_pvc = await run_in_threadpool(
        NestingEngineAPI.ejecutar_nesting_vectorial,
        cnts, hierarchy, wm, material_cara, material_canto, prof_canto, is_con_luz, img_cv, ignoradas, exclusion_zones
    )
    precios_3d = pricing_config.get_precios_3d()
    formula_3d = pricing_config.get_formula_3d()
    if material_cara == 'Acrílico':
        p_base_cara = float(precios_3d.get('acrilico_3mm'))
        mat_desc = "acrílico de 3mm rotuladas con vinil"
    else:
        at = str(body.aluminio_tipo)
        if at == "Dorado": p_base_cara = float(precios_3d.get('aluminio_dorado'))
        elif at == "Rosa": p_base_cara = float(precios_3d.get('aluminio_rosa'))
        elif at == "Mate": p_base_cara = float(precios_3d.get('aluminio_mate'))
        else: p_base_cara = float(precios_3d.get('aluminio_plata'))
        mat_desc = f"aluminio {at.lower()} con acabado industrial"
    if material_canto == 'Acrílico': p_base_canto = float(precios_3d.get('acrilico_3mm'))
    elif 'Dorado' in material_canto or 'Negro' in material_canto: p_base_canto = float(precios_3d.get('aluminio_dorado'))
    else: p_base_canto = float(precios_3d.get('aluminio_mate'))
    costo_cara = float(placas_cara) * p_base_cara
    costo_canto = float(placas_canto) * p_base_canto
    costo_pvc = float(placas_pvc) * float(precios_3d.get('pvc_3mm'))
    costo_leds = float(leds) * float(precios_3d.get('led_8cm'))
    costo_fuentes = float(fuentes) * float(precios_3d.get('fuente_100w'))
    costo_consumibles = float(precios_3d.get('consumibles_fijos'))
    costo_mat_bruto = costo_cara + costo_canto + costo_pvc
    costo_electrico = costo_leds + costo_fuentes
    mo_pm = float(formula_3d.get('mano_obra_por_metro', 90.0))
    costo_mo = float(perimetro) * mo_pm
    fm = float(formula_3d.get('factor_material', 2.0))
    fe = float(formula_3d.get('factor_electrico', 1.5))
    fmo = float(formula_3d.get('factor_mo', 1.8))
    fg = float(formula_3d.get('factor_ganancia', 1.15))
    total_venta_bruto = ((costo_mat_bruto * fm) + (costo_electrico * fe) + costo_consumibles + (costo_mo * fmo)) * fg
    total_venta = float(math.ceil(total_venta_bruto))
    ancho_total = float(iw)
    alto_total = float(ih)
    desglose = {
        'BOM - LISTA DE MATERIALES': f"Cara: {placas_cara:.3f} pl. {material_cara} (${costo_cara:,.2f})\nCanto: {placas_canto:.3f} pl. {material_canto} (${costo_canto:,.2f})\nFondo: {placas_pvc:.3f} pl. PVC 3mm (${costo_pvc:,.2f})\nLEDs: {int(leds)} pz 8cm (${costo_leds:,.2f})\nFuentes: {int(fuentes)} pz 100W (${costo_fuentes:,.2f})",
        'MANO DE OBRA Y VARIOS': f"Perímetro: {perimetro:.2f}m (${costo_mo:,.2f})\nConsumibles Grales: ${costo_consumibles:,.2f}",
        'REPORTES TÉCNICOS': "\n" + str(ascii_emp) if ascii_emp else "Cotización por medidas (Letras 3D)."
    }
    texto_formal = f"Letras 3D|SPLIT|Suministro y colocación* de:\n\nLetras 3D y caja de luz fabricadas en {mat_desc}, relieve de {int(prof_canto*100)} cms.\nTapas traseras en PVC de 3mm.\n{'Iluminadas con módulos led.' if is_con_luz else 'Sin iluminación.'}\n\nMedidas totales: {ancho_total:.2f}m x {alto_total:.2f}m."
    return CotizacionResponse(modo='3D', ancho_m=ancho_total, alto_m=alto_total, total_venta=total_venta, desglose_texto=texto_formal, desglose_tecnico=desglose, geometria_nesting=list(geo_n), geometria_original=list(geo_o), geometria_leds=list(geo_l), img_w_m=float(iw), img_h_m=float(ih), eficiencia=float(eficiencia), folio=f"L3D-{folio_id}")


def _parse_precio_celda(val) -> float | None:
    """Convierte celda Excel (número o texto con $, comas) a float."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip().replace(",", "").replace(" ", "")
    s = re.sub(r"^\$?\s*", "", s)
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


@app.get('/api/v1/config/precios')
async def get_config_precios():
    """Devuelve solo la configuración de Letras 3D (precios_3d, formula_3d) en solo lectura."""
    return {
        "precios_3d": pricing_config.get_precios_3d(),
        "formula_3d": pricing_config.get_formula_3d(),
    }


@app.options('/api/v1/config/precios/upload')
async def options_upload_precios():
    """Permite preflight CORS para POST upload; evita 405 en entornos con proxy."""
    return Response(status_code=200, headers={"Allow": "POST, OPTIONS"})


@app.post('/api/v1/config/precios/upload')
async def upload_precios_excel(file: UploadFile = File(...)):
    """
    Recibe un Excel con columnas CODIGO y PRECIO, actualiza solo precios_3d y formula_3d
    en config_precios.json y recarga la configuración para Letras 3D.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No se envió archivo.")
    ext = (file.filename or "").lower()
    if not (ext.endswith(".xlsx") or ext.endswith(".xls")):
        raise HTTPException(status_code=400, detail="Formato no soportado. Use .xlsx o .xls.")
    try:
        import openpyxl
    except ImportError:
        raise HTTPException(status_code=503, detail="El servidor no tiene instalada la librería openpyxl. Instale con: pip install openpyxl")
    contents = await file.read()
    if ext.endswith(".xls"):
        raise HTTPException(status_code=400, detail="Formato .xls requiere xlrd. Use .xlsx.")
    try:
        import io
        wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Archivo Excel no válido: {e}")
    ws = wb.active
    if ws is None:
        raise HTTPException(status_code=400, detail="El libro no tiene hojas.")
    # Buscar columnas CODIGO y PRECIO en la primera fila
    header = []
    for col in range(1, ws.max_column + 1):
        cell = ws.cell(row=1, column=col)
        header.append((col, str(cell.value or "").strip()))
    col_codigo = None
    col_precio = None
    for col, label in header:
        ln = label.lower()
        if ln == "codigo":
            col_codigo = col
        if ln == "precio":
            col_precio = col
    if col_codigo is None or col_precio is None:
        wb.close()
        raise HTTPException(status_code=400, detail="El Excel debe tener columnas 'CODIGO' y 'PRECIO' en la primera fila.")
    precios_3d = pricing_config.get_precios_3d()
    formula_3d = pricing_config.get_formula_3d()
    filas_leidas = 0
    claves_actualizadas = 0
    for row in range(2, ws.max_row + 1):
        codigo_cell = ws.cell(row=row, column=col_codigo)
        precio_cell = ws.cell(row=row, column=col_precio)
        codigo = str(codigo_cell.value or "").strip()
        precio_val = _parse_precio_celda(precio_cell.value)
        if not codigo:
            continue
        filas_leidas += 1
        if precio_val is None:
            continue
        prev_p = dict(precios_3d)
        prev_f = dict(formula_3d)
        precios_3d, formula_3d = pricing_config.apply_excel_row(codigo, precio_val, precios_3d, formula_3d)
        if precios_3d != prev_p or formula_3d != prev_f:
            claves_actualizadas += 1
    wb.close()
    try:
        pricing_config.save_config(precios_3d, formula_3d)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar configuración: {e}")
    return {
        "message": "Base de precios Letras 3D actualizada.",
        "filas_leidas": filas_leidas,
        "claves_actualizadas": claves_actualizadas,
    }


dist_dir = os.path.join(BASE_DIR, "dist")
if os.path.isdir(dist_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_dir, "assets")), name="assets")
    @app.get("/{catchall:path}")
    async def serve_react_app(catchall: str):
        # No servir la SPA para rutas de API; evita 405 si el catch-all capturara la path antes que la API
        if catchall.startswith("api/") or catchall == "api":
            raise HTTPException(status_code=404, detail="Not Found")
        return FileResponse(os.path.join(dist_dir, "index.html"))

if __name__ == "__main__":
    import uvicorn
    import socket
    def _puerto_disponible(port):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("0.0.0.0", port))
                return True
            except OSError:
                return False
    port = 8000
    if not _puerto_disponible(port):
        port = 8001
        print(f"Puerto 8000 en uso. Usando puerto {port}. Si usas frontend dev, define VITE_API_URL=http://localhost:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port)