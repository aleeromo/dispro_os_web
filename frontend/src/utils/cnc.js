import { API_BASE } from '../constants/api.js';

/**
 * Descarga vectores CNC (SVG de nesting). Fase 2: si hay jobId, obtiene el SVG desde el backend;
 * si no, fallback a serializar el DOM (nesting-svg-export).
 * @param {string} pdfFolio - Folio para el nombre del archivo si no viene del backend
 * @param {string|null} jobId - Job id de la sesión (header X-Job-Id)
 * @param {function(string)|undefined} onError - Callback con mensaje si falla (ej. setErrorMsg)
 */
export async function descargarVectoresCNC(pdfFolio, jobId = null, onError) {
  if (jobId) {
    try {
      const res = await fetch(`${API_BASE}/api/v1/vectores-cnc`, {
        headers: { 'X-Job-Id': jobId },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 404 && data.code === 'JOB_NOT_FOUND') {
          onError?.('La sesión expiró o no es válida. Carga de nuevo la imagen.');
        } else if (res.status === 404 && data.code === 'NO_VECTORES') {
          onError?.(data.message || 'No hay vectores CNC. Analiza primero en modo 3D.');
        } else {
          onError?.(data.message || 'Error al descargar vectores.');
        }
        return;
      }
      const blob = await res.blob();
      const disp = res.headers.get('Content-Disposition');
      let filename = `${pdfFolio}_Vectores_Corte.svg`;
      if (disp) {
        const m = disp.match(/filename="?([^";\n]+)"?/);
        if (m) filename = m[1].trim();
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return;
    } catch (e) {
      onError?.(e.message || 'Error de conexión al descargar vectores.');
      return;
    }
  }
  const svgElement = document.getElementById('nesting-svg-export');
  if (!svgElement) {
    onError?.('No hay vista de planos. Abre la pestaña Planos y analiza en modo 3D.');
    return;
  }
  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(svgElement);
  if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
    source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  if (!source.match(/^<svg[^>]+"http:\/\/www\.w3\.org\/1999\/xlink"/)) {
    source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
  }
  source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${pdfFolio}_Vectores_Corte.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
