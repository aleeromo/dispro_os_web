# Constantes Fase 1: sesión por job (Estudio).
#
# Job id (sesión de estudio):
#   - Se envía en header X-Job-Id (recomendado) o en query ?job_id=...
#   - POST /api/v1/preprocesar: si no se envía, el backend genera uno y lo devuelve en la respuesta (job_id).
#   - POST /api/v1/analizar y POST /api/v1/generate-svg: job id obligatorio; si falta o expiró → 404.
#
# Almacén en memoria:
#   - TTL por defecto: 30 minutos (JOB_STORE_TTL_SECONDS).
#   - Máximo de jobs en memoria: 50 (JOB_STORE_MAX_JOBS). Al superar, se eliminan los más antiguos.
#
JOB_STORE_TTL_SECONDS = 30 * 60   # 30 minutos
JOB_STORE_MAX_JOBS = 50
# Validación de archivo en preprocesar
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024   # 20 MB
MIN_IMAGE_WIDTH_PX = 10
MIN_IMAGE_HEIGHT_PX = 10
ALLOWED_IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp")
ALLOWED_IMAGE_CONTENT_TYPES = (
    "image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp",
)
