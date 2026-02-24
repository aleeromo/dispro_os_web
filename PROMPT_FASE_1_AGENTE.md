# Prompt para implementar Fase 1 — DisproOS (nueva ventana de agente)

Copia y pega todo lo que está debajo de la línea "---" en una nueva conversación con el agente para que implemente únicamente la Fase 1 del plan de arquitectura.

---

## Contexto del proyecto

**DisproOS** es un sistema operativo industrial web para cotización de servicios, nesting vectorial para corte CNC y renderizado 3D de letras y cajas de luz. La base de código está en la carpeta del workspace (raíz del proyecto: `dispro_os_web` o la raíz que contenga `frontend/` y `backend/`).

- **Frontend:** React, Vite, Tailwind, React Three Fiber/Drei. Entrada: `dispro_os_web/frontend/`.
- **Backend:** FastAPI, Uvicorn (puerto 8000), OpenCV, EasyOCR (opcional). Entrada: `dispro_os_web/backend/app/` (`main.py` es el punto de entrada de la API).

**Flujo de la aplicación (no modificable en su secuencia):**
1. Carga de imagen (drag & drop o selector).
2. Detección y clasificación (Impresión plana vs Letras 3D / Cajas de Luz; jerarquías y childrenIds).
3. Procesamiento geométrico (nesting, vectores CNC, LEDs).
4. Smart Render 3D (render fotorealista, escala real).
5. Cotización y PDF (BOM, flete, export PDF).

**Restricciones:** Mantener la estética actual (minimalista, oscura, estilo Apple Pro / Nothing). No alterar logos ni textos originales en el preprocesamiento de la imagen.

---

## Plan global (5 fases)

Existe un plan en 5 fases, una por cada paso del flujo. Solo se implementa **una fase por vez**. Ahora toca **solo la Fase 1**.

- **Fase 1:** Carga de imagen y detección/clasificación (sesión por job, sin estado global).
- Fase 2: Procesamiento geométrico (nesting, vectores CNC desde backend).
- Fase 3: Smart Render 3D (escala, luz sincronizada).
- Fase 4: Cotización y PDF (una sola fuente de verdad del total).
- Fase 5: Estabilidad global (tipado, validación, límites, contexto Estudio, menos re-renders).

---

## Tu tarea: implementar SOLO la Fase 1

Implementa **únicamente la Fase 1** del plan. No toques aún las fases 2–5.

### Objetivo de la Fase 1

Que la **carga de imagen** y la **detección/clasificación** (modo 3D vs Rollo, contornos, jerarquías) sean **robustas y correctas por sesión**, sin estado global compartido entre peticiones.

---

### Backend (FastAPI) — tareas concretas

1. **Identificador de sesión/job**
   - El frontend generará un **job id** (UUID o string único) al iniciar una “sesión” de estudio (por ejemplo al abrir la vista estudio o al hacer la primera carga de imagen). Todas las peticiones relacionadas con esa sesión deben enviar ese job id (header `X-Job-Id` o query param `job_id`; decide uno y documéntalo).
   - En el backend, reemplaza los diccionarios globales `TEMP_SHAPES_CACHE` y `TEMP_PREPROCESS_META` por un **almacén por job**: estructura en memoria (dict keyed por job_id) que guarde para cada job:
     - Contornos (equivalente a lo que hoy es TEMP_SHAPES_CACHE: id → contorno).
     - Meta de preprocesado (equivalente a TEMP_PREPROCESS_META: w_px, h_px, hierarchy).
     - Dimensiones y modo detectado (ancho_m, alto_m, modo) para no depender de “último preprocesado”.
   - Implementa **TTL y límite de jobs**: por ejemplo, máximo 50 jobs en memoria y expiración de 30 minutos por job; al crear un job nuevo si se supera el límite, eliminar los más antiguos. Limpia el almacén cuando un job expira.

2. **Endpoints que usan el job**
   - **POST /api/v1/preprocesar:** Debe aceptar el job id (header o query). Si no viene, generar uno nuevo en el backend y devolverlo en la respuesta (para que el frontend lo guarde). Tras la detección, guardar contornos y meta **en el almacén bajo ese job id**. La respuesta debe incluir el `job_id` usado (generado o recibido), además de `modo`, `ancho_m`, `alto_m`, `cajas`, `ancho_px`, `alto_px`.
   - **POST /api/v1/analizar:** Debe recibir el job id (obligatorio). Leer contornos y meta **solo del almacén para ese job**. Si el job no existe o expiró, devolver 404 con cuerpo estructurado (p. ej. `{"code": "JOB_NOT_FOUND", "message": "..."}`). No usar nunca TEMP_SHAPES_CACHE ni TEMP_PREPROCESS_META globales.
   - **POST /api/v1/generate-svg:** Debe recibir el job id (obligatorio). Construir el SVG usando **solo** los contornos y meta del almacén para ese job. Si el job no existe o expiró, devolver 404 con cuerpo estructurado.

3. **Eliminar código muerto**
   - Elimina o deja de usar `TEMP_CONTOURS_CACHE` en `main.py` (actualmente no se usa).

4. **Detección de modo (3D vs Rollo)**
   - Centraliza la lógica de “cómo se decide modo 3D vs Rollo” en un solo lugar (función o módulo). Criterios ya existentes: OCR con dígitos o medidas (regex de cotas), medidas extraídas (h_meds/v_meds), detección de formas (varias piezas raíz, una con huecos, o sin OCR cualquier forma). Documenta en comentarios o docstring el orden y las condiciones. No cambies el comportamiento actual de detección más de lo necesario; el objetivo es claridad y un solo punto de verdad.

5. **Validación de entrada y errores**
   - En `preprocesar`: validar tipo de archivo (imagen permitida), tamaño máximo del archivo (p. ej. 20 MB) y, tras decodificar, dimensiones mínimas (p. ej. ancho y alto >= 10 px). Si falla la validación, devolver 400 con cuerpo estructurado, por ejemplo: `{"code": "INVALID_FILE", "message": "...", "details": {...}}`.
   - Usa un esquema de error común para el backend (p. ej. siempre `code`, `message`, y opcionalmente `details`). Donde hoy se hace `raise HTTPException(status_code=500, detail=str(e))`, valora si debe ser 400/404/422 y devolver el mismo formato de error.

---

### Frontend (React) — tareas concretas

1. **Generar y guardar el job id**
   - Al iniciar una “sesión” de estudio (por ejemplo cuando el usuario va a la vista estudio y va a cargar o ya cargó una imagen), el frontend debe tener un **job id** único. Opciones: generarlo en el cliente (uuid) al montar la vista estudio o al llamar a `preprocesar` por primera vez; o usar el que devuelve el backend en la respuesta de `preprocesar` si el backend lo genera.
   - Guarda ese job id en el estado (por ejemplo en el hook que orquesta el análisis, o en un estado de “sesión estudio”). Cuando el usuario “reinicia” el estudio (por ejemplo botón que limpia imagen y resultado), genera un **nuevo** job id para la nueva sesión.

2. **Enviar el job id en todas las llamadas relevantes**
   - **preprocesar:** Enviar el job id (header `X-Job-Id` o query `job_id` según lo que hayas elegido en backend). Si el backend devuelve un `job_id` en la respuesta, guardar ese y usarlo de ahí en adelante para esa sesión.
   - **analizar:** Incluir siempre el job id de la sesión actual en la petición.
   - **generate-svg:** Incluir siempre el job id de la sesión actual (y las dimensiones/shapes que ya se envían).

3. **Modo 3D/Rollo**
   - El modo mostrado en la UI debe seguir viniendo de la respuesta de `preprocesar` (y actualizarse con `onArchivoDetectado` como hoy). El usuario debe poder cambiarlo manualmente (ya existe en ParametrosSidebar). Una sola fuente de verdad en el estado (useMaterialParams); no duplicar.

4. **Manejo de errores 404/400 del backend**
   - Si el backend devuelve 404 (job no encontrado o expirado), mostrar un mensaje claro al usuario (por ejemplo: “La sesión expiró o no es válida. Carga de nuevo la imagen.”) y ofrecer reiniciar (limpiar y generar nuevo job id). Si devuelve 400 (archivo inválido, etc.), mostrar el `message` o `details` que venga en el cuerpo.

---

### Entregables de la Fase 1

- Backend: almacén por job (con TTL y límite), endpoints preprocesar/analizar/generate-svg usando job id; sin TEMP_SHAPES_CACHE ni TEMP_PREPROCESS_META globales; TEMP_CONTOURS_CACHE eliminado o sin uso; validación de archivo en preprocesar; respuestas de error estructuradas (code, message, details).
- Frontend: generación y persistencia de job id por sesión; envío del job id en preprocesar, analizar y generate-svg; manejo de 404/400 con mensaje y opción de reiniciar.
- Documentación breve: en el código o en un README, indica cómo se envía el job id (header vs query) y el valor por defecto de TTL y máximo de jobs.

---

### Archivos clave a modificar (referencia)

- Backend: `dispro_os_web/backend/app/main.py` (endpoints, almacén por job, validación, errores).
- Frontend: hook que llama a preprocesar/analizar (p. ej. `useAnalisis.js`), y donde se construyan las peticiones (axios/fetch); posiblemente el componente o hook que maneja “reiniciar estudio” para generar nuevo job id; componente que muestre errores (toast o banner).
- Constantes: considera un archivo de constantes en backend para tamaño máximo de archivo, dimensiones mínimas, TTL y máximo de jobs.

No implementes cambios de las Fases 2–5 (nesting desde backend, descarga vectores desde backend, Smart Render, PDF, contexto Estudio, etc.). Solo Fase 1.

Cuando termines, indica brevemente qué archivos tocaste y cómo se puede probar (por ejemplo: cargar imagen, ver que la respuesta incluye job_id; abrir otra pestaña, cargar otra imagen, ver que cada una tiene su job y no se mezclan; expirar un job y ver 404 al analizar).
