# Fases 1 y 2: Sesión por job y vectores CNC

## Fase 1: Job id

- **Envío:** header `X-Job-Id` (recomendado) o query `job_id`.
- **POST /api/v1/preprocesar:** si no se envía job id, el backend genera uno y lo devuelve en la respuesta (`job_id`). El frontend debe guardarlo y usarlo en las siguientes peticiones.
- **POST /api/v1/analizar** y **POST /api/v1/generate-svg:** el job id es obligatorio. Si falta o el job expiró, el backend responde 404 con cuerpo `{"code": "JOB_NOT_FOUND", "message": "..."}`.

## Almacén en memoria (backend)

- **TTL por defecto:** 30 minutos (`JOB_STORE_TTL_SECONDS` en `backend/app/constants.py`).
- **Máximo de jobs:** 50 (`JOB_STORE_MAX_JOBS`). Al superar el límite, se eliminan los jobs más antiguos.

## Fase 2: Vectores CNC desde backend

- **GET /api/v1/vectores-cnc:** Devuelve el SVG de nesting (vectores para corte CNC) del job. Requiere job id (header `X-Job-Id` o query `job_id`). Tras un análisis 3D correcto, el backend guarda ese SVG en el job; esta ruta lo sirve como descarga (`Content-Disposition: attachment`). Si el job no tiene vectores (aún no se analizó en 3D), responde 404 con `code: "NO_VECTORES"`.
