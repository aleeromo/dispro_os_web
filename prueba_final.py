print("Iniciando prueba...")
try:
    import cv2
    import numpy as np
    from rembg import remove
    import potracer # <--- Cambiamos esto
    print("--- ¡ÉXITO! Todas las librerías de visión cargaron correctamente. ---")
except ImportError as e:
    print(f"\n--- ERROR FATAL: {e} ---")