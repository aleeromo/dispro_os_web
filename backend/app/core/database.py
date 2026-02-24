# backend/app/core/database.py

class DataBase:
    precios = {
        "acrilico_3mm": 1320.0, 
        "aluminio_cal22": 1100.0, 
        "mdf_placa": 1500.0,
        "pvc_3mm": 400.0, 
        "tubular_2_6m": 550.0, 
        "led_8cm": 7.50, 
        "fuente_100w": 500.0,
        "cubrecanto": 400.0, 
        "soldadura": 90.0, 
        "disco_corte": 20.0, 
        "disco_desbaste": 50.0,
        "pegacril": 200.0, 
        "duretan": 150.0, 
        "cinta_doble_cara": 125.0,
        "mo_letras": 1500.0, 
        "gasolina_litro": 24.50, 
        "viaticos_dia": 1800.0
    }
    flete_km_cache = 0.0