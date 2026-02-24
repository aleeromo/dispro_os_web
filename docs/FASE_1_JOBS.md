# Fase 1: Sesión por job (Estudio)

## Job id

- **Envío:** header `X-Job-Id` (recomendado) o query `job_id`.
- **POST /api/v1/preprocesar:** si no se envía job id, el backend genera uno y lo devuelve en la respuesta (`job_id`). El frontend debe guardarlo y usarlo en las siguientes peticiones.
- **POST /api/v1/analizar** y **POST /api/v1/generate-svg:** el job id es obligatorio. Si falta o el job expiró, el backend responde 404 con cuerpo `{"code": "JOB_NOT_FOUND", "message": "..."}`.

## Almacén en memoria (backend)

- **TTL por defecto:** 30 minutos (`JOB_STORE_TTL_SECONDS` en `backend/app/constants.py`).
- **Máximo de jobs:** 50 (`JOB_STORE_MAX_JOBS`). Al superar el límite, se eliminan los jobs más antiguos.
