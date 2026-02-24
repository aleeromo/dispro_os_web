# backend/app/core/pricing_config.py
# Configuración de precios solo para Letras 3D. ROLLO no se toca.

import os
import sys
import json
import re

if getattr(sys, 'frozen', False):
    _BASE_DIR = sys._MEIPASS
else:
    _BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CONFIG_PATH = os.environ.get("CONFIG_PRECIOS_PATH", os.path.join(_BASE_DIR, "config_precios.json"))

# Valores por defecto (igual que main.py L64-67 y fórmula actual)
DEFAULT_PRECIOS_3D = {
    "acrilico_3mm": 1320.0,
    "aluminio_plata": 2200.0,
    "aluminio_dorado": 2600.0,
    "aluminio_rosa": 2600.0,
    "aluminio_mate": 1100.0,
    "pvc_3mm": 400.0,
    "led_8cm": 7.5,
    "fuente_100w": 500.0,
    "consumibles_fijos": 850.0,
}

DEFAULT_FORMULA_3D = {
    "mano_obra_por_metro": 90.0,
    "factor_material": 2.0,
    "factor_electrico": 1.5,
    "factor_mo": 1.8,
    "factor_ganancia": 1.15,
}

# Mapeo: texto CODIGO (normalizado: strip, lower) -> clave en precios_3d o clave en formula_3d
# Si el valor mapeado es "formula:mano_obra_por_metro" se escribe en formula_3d.
CODIGO_TO_KEY = {
    # Acrílico
    "acrilico blanco de 3 mm de 2.40 m x 1.20 m": "acrilico_3mm",
    "acrílico blanco de 3 mm de 2.40 m x 1.20 m": "acrilico_3mm",
    "acrilico blanco de 3 mm de 2.40 m x 1.80 m": "acrilico_3mm",
    "acrílico blanco de 3 mm de 2.40 m x 1.80 m": "acrilico_3mm",
    "acrilico blanco de 3 mm de 1.80 m x 1.20 m": "acrilico_3mm",
    "acrílico blanco de 3 mm de 1.80 m x 1.20 m": "acrilico_3mm",
    "alucobond de 3 mm de 2.40 m x 1.20 m": "acrilico_3mm",
    # PVC
    "pvc de 3 mm de 2.40 m x 1.20 m": "pvc_3mm",
    # LEDs y fuentes
    "leds de 8 cm x 1.2 cm": "led_8cm",
    "leds de 5 cm x 1.2 cm": "led_8cm",
    "fuentes de poder de 100 watts": "fuente_100w",
    "fuentes de poder de 60 watts": "fuente_100w",
    "fuentes de poder de 30 watts": "fuente_100w",
    # Aluminio (variantes por tipo)
    "aluminio natural cal. 22 de 3.05 m x 90 cm": "aluminio_mate",
    "aluminio cepillado plata de 2.40 m x 120 m": "aluminio_plata",
    "aluminio cepillado dorado de 2.40 m x 120 m": "aluminio_dorado",
    "aluminio espejo plata de 2.40 m x 120 m": "aluminio_plata",
    "aluminio espejo dorado de 2.40 m x 120 m": "aluminio_dorado",
    # Mano de obra -> formula
    "mano de obra": "formula:mano_obra_por_metro",
}

# Claves que son de formula_3d (no precios_3d)
FORMULA_KEYS = {"mano_obra_por_metro", "factor_material", "factor_electrico", "factor_mo", "factor_ganancia"}

_precios_3d = dict(DEFAULT_PRECIOS_3D)
_formula_3d = dict(DEFAULT_FORMULA_3D)


def _normalize_codigo(text: str) -> str:
    if not text or not isinstance(text, str):
        return ""
    t = text.strip().lower()
    t = re.sub(r"\s+", " ", t)
    return t


def load_config(path: str = None) -> None:
    global _precios_3d, _formula_3d
    p = path or CONFIG_PATH
    try:
        if os.path.isfile(p):
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
            _precios_3d = dict(DEFAULT_PRECIOS_3D)
            _formula_3d = dict(DEFAULT_FORMULA_3D)
            if "precios_3d" in data and isinstance(data["precios_3d"], dict):
                for k, v in data["precios_3d"].items():
                    if k in _precios_3d and isinstance(v, (int, float)):
                        _precios_3d[k] = float(v)
            if "formula_3d" in data and isinstance(data["formula_3d"], dict):
                for k, v in data["formula_3d"].items():
                    if k in _formula_3d and isinstance(v, (int, float)):
                        _formula_3d[k] = float(v)
        else:
            # Crear archivo inicial con valores por defecto
            save_config(dict(DEFAULT_PRECIOS_3D), dict(DEFAULT_FORMULA_3D), p)
    except Exception:
        _precios_3d = dict(DEFAULT_PRECIOS_3D)
        _formula_3d = dict(DEFAULT_FORMULA_3D)


def get_precios_3d() -> dict:
    return dict(_precios_3d)


def get_formula_3d() -> dict:
    return dict(_formula_3d)


def get_config_path() -> str:
    return CONFIG_PATH


def save_config(precios_3d: dict, formula_3d: dict, path: str = None) -> None:
    global _precios_3d, _formula_3d
    p = path or CONFIG_PATH
    data = {"precios_3d": precios_3d, "formula_3d": formula_3d}
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    _precios_3d = dict(precios_3d)
    _formula_3d = dict(formula_3d)


def reload_config(path: str = None) -> None:
    load_config(path or CONFIG_PATH)


def map_codigo_to_internal(codigo: str) -> str | None:
    """Devuelve clave interna: 'acrilico_3mm', 'formula:mano_obra_por_metro', etc. o None si no hay mapeo."""
    n = _normalize_codigo(codigo)
    return CODIGO_TO_KEY.get(n)


def apply_excel_row(codigo: str, precio: float, precios_3d: dict, formula_3d: dict):
    """
    Aplica una fila Excel (codigo, precio) a copias de precios_3d y formula_3d.
    Devuelve (nuevo_precios_3d, nuevo_formula_3d) con el valor actualizado si hay mapeo.
    """
    key = map_codigo_to_internal(codigo)
    if not key:
        return precios_3d, formula_3d
    if key.startswith("formula:"):
        param = key.split(":", 1)[1]
        if param in FORMULA_KEYS:
            formula_3d = dict(formula_3d)
            formula_3d[param] = float(precio)
        return precios_3d, formula_3d
    if key in precios_3d:
        precios_3d = dict(precios_3d)
        precios_3d[key] = float(precio)
    return precios_3d, formula_3d


# Cargar al importar
load_config()
