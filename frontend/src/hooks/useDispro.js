import { useEffect, useRef, useCallback } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { useMaterialParams } from './useMaterialParams.js';
import { usePdfEditor } from './usePdfEditor.js';
import { useAnalisis } from './useAnalisis.js';
import { useProjectManager } from './useProjectManager.js';
import { descargarVectoresCNC as descargarVectoresCNCUtil } from '../utils/cnc.js';

export function useDispro() {
  const appCtx = useAppContext();
  const params = useMaterialParams();
  const pdf    = usePdfEditor();

  const analisis = useAnalisis({
    modo: params.modo,
    onAnalisisComplete: (data, fleteCosto, isAuto) => {
      pdf.cargarDesdeResultado(data, fleteCosto, isAuto);
      if (!isAuto) appCtx.setActiveTab('render');
    },
    onArchivoDetectado: ({ modo, materialCara, anchoRollo, ancho, alto }) => {
      params.setModo(modo);
      params.setMaterialCara(materialCara);
      if (anchoRollo) params.setAnchoRollo(anchoRollo);
      params.setAncho(ancho);
      params.setAlto(alto);
    },
    onFileReady: () => appCtx.setActiveTab('ajuste'),
    onNavigateToEstudio: () => appCtx.setCurrentView('estudio'),
    getParamsForAnalysis: () => ({
      modo:          params.modo,
      materialCara:  params.materialCara,
      aluminioTipo:  params.aluminioTipo,
      materialCanto: params.materialCanto,
      profCanto:     params.profCanto,
      ancho:         params.ancho,
      alto:          params.alto,
      conLuz:        params.conLuz,
      anchoRollo:    params.anchoRollo,
    }),
  });

  const projects = useProjectManager({
    getPdfSnapshot: pdf.getSnapshot,
    onEditProject: (p) => {
      pdf.cargar(p);
      appCtx.setCurrentView('estudio');
      appCtx.setActiveTab('pdf');
    },
    onPrint: (project) => {
      pdf.setValues.setPdfCliente(project.cliente);
      pdf.setValues.setPdfTitle(project.nombre);
      pdf.setValues.setPdfFolio(project.folio);
      pdf.setValues.setPdfDesc(project.desc || '');
      pdf.setValues.setPdfTotal(project.total);
      pdf.setPdfBOM(project.desglose || {});
    },
    onSaved: () => {
      appCtx.setCurrentView('proyectos');
    },
  });

  // Paso 1: Una sola fuente de verdad para pdfTotal. Flete solo se suma si existe y es número válido; evita NaN.
  useEffect(() => {
    if (!analisis.resultado) return;
    const totalVenta = Number(analisis.resultado.total_venta);
    const venta = Number.isFinite(totalVenta) ? totalVenta : 0;
    const fleteCosto =
      analisis.conFlete &&
      analisis.infoFlete != null &&
      typeof analisis.infoFlete.total === 'number' &&
      Number.isFinite(analisis.infoFlete.total)
        ? analisis.infoFlete.total
        : 0;
    const total = venta + fleteCosto;
    pdf.setValues.setPdfTotal(
      `$${Math.ceil(total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
    );
  }, [analisis.resultado, analisis.infoFlete, analisis.conFlete]);

  // Seam: recalcular escala del PDF cuando se activa la pestaña
  useEffect(() => {
    if (appCtx.activeTab === 'pdf' && pdf.pdfContainerRef.current) {
      const cW = pdf.pdfContainerRef.current.clientWidth - 40;
      const cH = pdf.pdfContainerRef.current.clientHeight - 40;
      pdf.setPdfScale(Math.min(cW / 816, cH / 1056));
    }
  }, [appCtx.activeTab, analisis.resultado, appCtx.currentView, projects.selectedProject]);

  // Paso 2: Re-análisis automático con debounce 800 ms. No encolar si ya hay petición en vuelo (isCalculating).
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    if (
      analisis.resultado &&
      !analisis.isDetecting &&
      !analisis.isCalculating &&
      analisis.archivoSeleccionado
    ) {
      const t = setTimeout(() => analisis.analizar(true), 800);
      return () => clearTimeout(t);
    }
  }, [
    params.ancho,
    params.alto,
    params.materialCara,
    params.materialCanto,
    params.profCanto,
    params.conLuz,
    params.anchoRollo,
    params.aluminioTipo,
    params.colorMate,
    analisis.cajasIgnoradas,
    analisis.isCalculating,
    analisis.resultado,
    analisis.isDetecting,
    analisis.archivoSeleccionado,
    analisis.analizar,
  ]);

  // Bridge: cotizador → PDF + navegación
  const handleGenerarExpress = useCallback((cartList) => {
    pdf.cargarDesdeCarrito(cartList);
    appCtx.setCurrentView('estudio');
    appCtx.setActiveTab('pdf');
  }, [pdf, appCtx]);

  // Bridge: home → reset estudio (limpia sesión y genera nuevo job id en la próxima carga)
  const handleHomeClick = useCallback(() => {
    appCtx.setCurrentView('estudio');
    appCtx.setActiveTab('ajuste');
    analisis.resetEstudio?.();
  }, [appCtx, analisis]);

  // Wrapper: descargar SVG CNC usando folio actual del PDF
  const descargarVectoresCNC = useCallback(() => {
    descargarVectoresCNCUtil(pdf.pdfFolio);
  }, [pdf.pdfFolio]);

  return {
    // AppContext
    ...appCtx,
    // Material params
    ...params,
    // Análisis
    ...analisis,
    // PDF editor
    ...pdf,
    // Proyectos
    ...projects,
    // Orchestrator bridges
    handleGenerarExpress,
    handleHomeClick,
    descargarVectoresCNC,
  };
}
