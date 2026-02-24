# backend/app/core/engine_print.py
"""
Motor de impresión gran formato: empalmes (splicing) por ancho de rollo y precios escalonados por m².
- Merma fija por empalme (traslape). Costos por material y escala de cantidad.
"""
import math
from core.database import DataBase

# Merma de ancho por empalme (traslape) en metros. Configurable según estándar de material.
MERMA_EMPALME_M = 0.03

class MotorIndustrialAPI:
    PRECIOS_IMPRESION = {
        "Lona": [(25, 45), (10, 50), (5, 65), (0, 75)],
        "Vinil": [(25, 120), (10, 130), (5, 140), (0, 150)],
        "DTF UV": [(0, 300)],
        "DTF Textil": [(0, 250)]
    }
    
    @staticmethod
    def obtener_precio_escalonado(material, m2):
        escalas = MotorIndustrialAPI.PRECIOS_IMPRESION.get(material, [(0, 150)])
        for limite, precio in escalas:
            if m2 >= limite: return precio
        return escalas[-1][1]

    @staticmethod
    def calcular_ruta(destino_nombre):
        if DataBase.flete_km_cache == 0.0: return 300.0, "TARIFA LOCAL"
        km = DataBase.flete_km_cache
        gas = (km / 8.0) * DataBase.precios["gasolina_litro"] * 2
        peajes = km * 2.50 * 2
        viaticos = DataBase.precios["viaticos_dia"]
        return round(gas + peajes + viaticos, 2), f"FLETE ({km:.1f}km):\nGas ${gas:.0f} | Peaje ${peajes:.0f} | Viat. ${viaticos:.0f}"

    @staticmethod
    def calcular_empalmes_puros(wf, hf, ancho_rollo):
        """Estructura JSON de empalmes para el frontend (canvas 2D). ancho_rollo en metros."""
        if wf <= 0 or hf <= 0:
            return [], 0
        ancho_usable = float(ancho_rollo) - MERMA_EMPALME_M
        if ancho_usable <= 0:
            ancho_usable = 0.1
        num_lienzo = math.ceil(float(wf) / ancho_usable)
        geometria_empalmes = []
        x_curr = 0.0
        lap_m = MERMA_EMPALME_M

        for i in range(num_lienzo):
            if i < num_lienzo - 1:
                m_ancho = ancho_usable
                tiene_lap = True
            else:
                m_ancho = wf - (ancho_usable * i)
                tiene_lap = False
                
            geometria_empalmes.append({
                "lienzo": i + 1,
                "ancho_m": round(m_ancho, 3),
                "alto_m": round(hf, 3),
                "x_offset": round(x_curr, 3),
                "tiene_lap": tiene_lap,
                "lap_m": lap_m if tiene_lap else 0.0
            })
            x_curr += m_ancho
            
        return geometria_empalmes, num_lienzo