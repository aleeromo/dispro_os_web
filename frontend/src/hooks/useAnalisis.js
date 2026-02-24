import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import * as THREE from 'three';
import { API_BASE } from '../constants/api.js';

/**
 * @param {object} opts
 * @param {string}   opts.modo                - Valor actual de useMaterialParams.modo
 * @param {function} opts.onAnalisisComplete  - (data, fleteCosto, isAuto) → usePdfEditor.cargarDesdeResultado
 * @param {function} opts.onArchivoDetectado  - ({ modo, materialCara, anchoRollo, ancho, alto }) → sets in useMaterialParams
 * @param {function} opts.getParamsForAnalysis - () → { modo, materialCara, aluminioTipo, materialCanto, profCanto, ancho, alto, conLuz, anchoRollo }
 * @param {function} opts.onFileReady         - () → navega a tab 'ajuste' después de preprocesar
 * @param {function} opts.onNavigateToEstudio - () → navega a vista estudio al iniciar carga (para que la imagen se vea)
 */
export function useAnalisis({ modo, onAnalisisComplete, onArchivoDetectado, getParamsForAnalysis, onFileReady, onNavigateToEstudio }) {
  const [resultado,           setResultado]           = useState(null);
  const [preview,             setPreview]             = useState(null);
  const [texture,             setTexture]             = useState(null);
  const [cajas,               setCajas]               = useState([]);
  const [selectedCajas,       setSelectedCajas]       = useState([]);
  const [cajasIgnoradas,      setCajasIgnoradas]      = useState([]);
  const [isCalculating,       setIsCalculating]       = useState(false);
  const [isDetecting,         setIsDetecting]         = useState(false);
  const [errorMsg,            setErrorMsg]            = useState(null);
  const [showPrintModal,      setShowPrintModal]      = useState(false);
  const [tempAncho,           setTempAncho]           = useState('1.00');
  const [printDPI,            setPrintDPI]            = useState({ dpi: 0, status: 'Calculando...', color: 'text-gray-500' });
  const [archivoSeleccionado, setArchivoSeleccionado] = useState(null);
  const [isDragging,          setIsDragging]          = useState(false);
  const [conFlete,            setConFlete]            = useState(false);
  const [destinoFlete,        setDestinoFlete]        = useState('');
  const [infoFlete,           setInfoFlete]           = useState(null);
  const [isCalculatingFlete,  setIsCalculatingFlete]  = useState(false);
  const [bgMontaje,           setBgMontaje]           = useState(null);
  const [imgData,             setImgData]             = useState({ wPx: 1, hPx: 1 });
  const [classifications,     setClassifications]     = useState({});
  const [cajaModalStep,       setCajaModalStep]       = useState(0);
  const [tempCajaMaster,       setTempCajaMaster]      = useState(null);
  const [tempVinylType,       setTempVinylType]       = useState('corte');
  const [tempVinylColor,      setTempVinylColor]      = useState('#2563eb');
  const [jobId,               setJobId]              = useState(null);

  const globalInputRef = useRef(null);
  const bgInputRef     = useRef(null);

  // Textura THREE.js para el render 3D
  useEffect(() => {
    if (preview) {
      new THREE.TextureLoader().load(preview, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        setTexture(tex);
      });
    }
  }, [preview]);

  // Análisis de DPI según ancho del rollo
  useEffect(() => {
    if (modo === 'ROLLO' && imgData.wPx > 1) {
      const m = parseFloat(tempAncho);
      if (m > 0) {
        const dpi = Math.round(imgData.wPx / (m * 39.3701));
        if (dpi >= 150)     setPrintDPI({ dpi, status: 'Óptima (Alta Resolución)',  color: 'text-green-500'  });
        else if (dpi >= 72) setPrintDPI({ dpi, status: 'Viable (Calidad Media)',    color: 'text-yellow-500' });
        else                setPrintDPI({ dpi, status: 'No Viable (Se Pixelará)',   color: 'text-red-500'    });
      }
    }
  }, [tempAncho, imgData, modo]);

  const procesarArchivo = useCallback(async (f) => {
    if (!f || !(f instanceof File)) return;
    onNavigateToEstudio?.();
    setErrorMsg(null);
    setIsDetecting(true);
    setArchivoSeleccionado(f);
    setResultado(null);
    setCajasIgnoradas([]);
    setSelectedCajas([]);
    setCajas([]);
    setPreview(URL.createObjectURL(f));
    setBgMontaje(null);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const headers = {};
      if (jobId) headers['X-Job-Id'] = jobId;
      const res = await axios.post(`${API_BASE}/api/v1/preprocesar`, fd, { headers });
      const returnedJobId = res.data.job_id;
      if (returnedJobId) setJobId(returnedJobId);
      setImgData({
        wPx: res.data.ancho_px,
        hPx: res.data.alto_px,
        wM: parseFloat(res.data.ancho_m) || 1.0,
        hM: parseFloat(res.data.alto_m)  || 1.0,
      });
      let newCajas = Array.isArray(res.data.cajas) ? res.data.cajas : [];
      const wPx = res.data.ancho_px || 1;
      const hPx = res.data.alto_px || 1;
      if (newCajas.length === 0 && wPx > 0 && hPx > 0) {
        newCajas = [{
          id: 0,
          x: 0,
          y: 0,
          w: wPx,
          h: hPx,
          norm_x: 0,
          norm_y: 0,
          norm_w: 1,
          norm_h: 1,
          color: '#ffffff',
          is_master: true,
          childrenIds: [],
          contour_path_d: `M 0 0 L ${wPx} 0 L ${wPx} ${hPx} L 0 ${hPx} Z`,
        }];
      }
      setCajas(newCajas);
      setClassifications((prev) => {
        const next = { ...prev };
        newCajas.forEach((c) => {
          const numId = Number(c.id);
          if (Number.isNaN(numId)) return;
          if (!(numId in next))
            next[numId] = { type: '', material: '', color: c.color || '#ffffff' };
        });
        return next;
      });
      const detModo = res.data.modo;
      const wF = parseFloat(res.data.ancho_m) || 1.0;
      const hF = parseFloat(res.data.alto_m)  || 1.0;
      if (detModo === 'ROLLO') {
        setTempAncho(wF.toFixed(2));
        setShowPrintModal(true);
        onArchivoDetectado?.({ modo: detModo, materialCara: 'Lona', anchoRollo: '1.20', ancho: wF.toFixed(2), alto: hF.toFixed(2) });
      } else {
        onArchivoDetectado?.({ modo: detModo, materialCara: 'Acrílico', anchoRollo: null, ancho: wF.toFixed(2), alto: hF.toFixed(2) });
      }
      onFileReady?.();
    } catch (err) {
      const res = err.response;
      if (res?.status === 404 && res?.data?.code === 'JOB_NOT_FOUND') {
        setErrorMsg('La sesión expiró o no es válida. Carga de nuevo la imagen.');
        setJobId(null);
      } else if (res?.status === 400 && res?.data?.message) {
        setErrorMsg(res.data.message);
      } else {
        setErrorMsg('No se pudo conectar con el servidor. Comprueba que el backend DisproOS esté en marcha (p. ej. puerto 8000).');
      }
      setPreview(null);
      setArchivoSeleccionado(null);
    } finally {
      setIsDetecting(false);
    }
  }, [jobId, onArchivoDetectado, onFileReady, onNavigateToEstudio]);

  const confirmarMedidaPrint = useCallback(() => {
    const p = getParamsForAnalysis?.() || {};
    const parsedW = parseFloat(tempAncho);
    if (!isNaN(parsedW) && parsedW > 0) {
      const ratio = imgData.hPx / imgData.wPx;
      onArchivoDetectado?.({
        modo: p.modo,
        materialCara: p.materialCara,
        anchoRollo: p.anchoRollo,
        ancho: parsedW.toFixed(2),
        alto: (parsedW * ratio).toFixed(2),
      });
    }
    setShowPrintModal(false);
  }, [tempAncho, imgData, getParamsForAnalysis, onArchivoDetectado]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length > 0) procesarArchivo(e.dataTransfer.files[0]);
  }, [procesarArchivo]);

  const calcularFlete = useCallback(async () => {
    if (!destinoFlete) return;
    setIsCalculatingFlete(true);
    try {
      const res = await axios.get(`${API_BASE}/api/v1/flete?destino=${encodeURIComponent(destinoFlete)}`);
      setInfoFlete(res.data);
    } catch {
      setErrorMsg('Error al calcular viáticos.');
    } finally {
      setIsCalculatingFlete(false);
    }
  }, [destinoFlete]);

  const toggleSelection = useCallback((id) => {
    setSelectedCajas((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  }, []);

  const toggleIgnoreStatus = useCallback(() => {
    let newIgnoradas = [...cajasIgnoradas];
    selectedCajas.forEach((boxId) => {
      const box = cajas.find((c) => c.id === boxId);
      if (!box) return;
      const idsToIgnore = box.childrenIds || [box.id];
      const isIgnored = idsToIgnore.every((id) => newIgnoradas.includes(id));
      if (isIgnored) {
        newIgnoradas = newIgnoradas.filter((id) => !idsToIgnore.includes(id));
      } else {
        idsToIgnore.forEach((id) => { if (!newIgnoradas.includes(id)) newIgnoradas.push(id); });
      }
    });
    setCajasIgnoradas(newIgnoradas);
    setSelectedCajas([]);
  }, [cajasIgnoradas, selectedCajas, cajas]);

  const updateClassification = useCallback((ids, key, value) => {
    if (!Array.isArray(ids)) ids = [ids];
    setClassifications((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        const numId = Number(id);
        if (Number.isNaN(numId)) return;
        if (!next[numId]) next[numId] = { type: 'letra3d', material: 'acrilico', color: '#ffffff' };
        next[numId] = { ...next[numId], [key]: value };
      });
      return next;
    });
  }, []);

  const finalizeCajaConfig = useCallback((boxColor) => {
    const master = tempCajaMaster;
    const hex = typeof boxColor === 'string' && boxColor ? (boxColor.startsWith('#') ? boxColor : `#${boxColor}`) : '#2563eb';
    if (!master) {
      setCajaModalStep(0);
      setTempCajaMaster(null);
      return;
    }
    const mid = Number(master.id);
    const wPx = imgData.wPx || 1;
    const hPx = imgData.hPx || 1;
    setClassifications((prev) => {
      const next = { ...prev };
      const mx = master.norm_x ?? master.x / wPx;
      const my = master.norm_y ?? master.y / hPx;
      const mw = master.norm_w ?? master.w / wPx;
      const mh = master.norm_h ?? master.h / hPx;
      const inside = cajas.filter((c) => {
        if (c.id === master.id) return false;
        const cx = (c.norm_x ?? c.x / wPx) + (c.norm_w ?? c.w / wPx) / 2;
        const cy = (c.norm_y ?? c.y / hPx) + (c.norm_h ?? c.h / hPx) / 2;
        return cx >= mx && cx <= mx + mw && cy >= my && cy <= my + mh;
      });
      if (tempVinylType === 'impreso') {
        next[mid] = { type: 'caja', material: 'impreso', color: hex };
        inside.forEach((el) => {
          const eid = Number(el.id);
          next[eid] = { ...(next[eid] || {}), type: 'ignorar', material: '', color: next[eid]?.color || hex };
        });
      } else if (tempVinylType === 'liso') {
        next[mid] = { type: 'caja', material: 'acrilico', color: hex };
        inside.forEach((el) => {
          const eid = Number(el.id);
          next[eid] = { ...(next[eid] || {}), type: 'ignorar', material: '', color: next[eid]?.color || hex };
        });
      } else {
        next[mid] = { type: 'caja', material: 'acrilico', color: hex };
        const valid = inside.filter((el) => {
          const ew = el.norm_w ?? el.w / wPx;
          const eh = el.norm_h ?? el.h / hPx;
          return ew < mw * 0.95 && eh < mh * 0.95 && ew > 0.002 && eh > 0.002;
        });
        valid.forEach((el) => {
          const eid = Number(el.id);
          const elCx = (el.norm_x ?? 0) + (el.norm_w ?? 0) / 2;
          const elCy = (el.norm_y ?? 0) + (el.norm_h ?? 0) / 2;
          const isHole = valid.some((p) => p.id !== el.id && (p.norm_w * p.norm_h) > (el.norm_w * el.norm_h) && elCx >= (p.norm_x ?? 0) && elCx <= (p.norm_x ?? 0) + (p.norm_w ?? 0) && elCy >= (p.norm_y ?? 0) && elCy <= (p.norm_y ?? 0) + (p.norm_h ?? 0));
          next[eid] = { ...(next[eid] || {}), type: isHole ? 'hueco' : 'rotulo', material: isHole ? '' : 'vinil', color: isHole ? '' : tempVinylColor };
        });
      }
      return next;
    });
    setCajaModalStep(0);
    setTempCajaMaster(null);
    setSelectedCajas([]);
  }, [tempCajaMaster, tempVinylType, tempVinylColor, cajas, imgData.wPx, imgData.hPx]);

  const fusionarCajas = useCallback(() => {
    if (selectedCajas.length < 2) return;
    const boxesToMerge = cajas.filter((c) => selectedCajas.includes(c.id));
    const minX = Math.min(...boxesToMerge.map((c) => c.x));
    const minY = Math.min(...boxesToMerge.map((c) => c.y));
    const maxX = Math.max(...boxesToMerge.map((c) => c.x + c.w));
    const maxY = Math.max(...boxesToMerge.map((c) => c.y + c.h));
    const allChildren = [];
    boxesToMerge.forEach((c) => {
      if (c.childrenIds) allChildren.push(...c.childrenIds);
      else allChildren.push(c.id);
    });
    const wPx = imgData.wPx || 1;
    const hPx = imgData.hPx || 1;
    const newBox = {
      id: `merged_${Date.now()}`,
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY,
      norm_x: minX / wPx,
      norm_y: minY / hPx,
      norm_w: (maxX - minX) / wPx,
      norm_h: (maxY - minY) / hPx,
      childrenIds: allChildren,
    };
    setCajas((prev) => [...prev.filter((c) => !selectedCajas.includes(c.id)), newBox]);
    setCajasIgnoradas((prev) => prev.filter((id) => !allChildren.includes(id)));
    setSelectedCajas([]);
  }, [cajas, selectedCajas, imgData.wPx, imgData.hPx]);

  const analizar = useCallback(async (isAuto = false) => {
    if (!archivoSeleccionado) return;
    if (!isAuto) setIsCalculating(true);
    setErrorMsg(null);
    const p = getParamsForAnalysis?.() || {};
    const fd = new FormData();
    fd.append('file',            archivoSeleccionado);
    fd.append('modo',            p.modo            || 'ROLLO');
    fd.append('material_cara',   p.materialCara    || 'Lona');
    fd.append('aluminio_tipo',   p.aluminioTipo    || 'Plata');
    fd.append('material_canto',  p.materialCanto   || 'Aluminio');
    fd.append('prof_canto',      p.profCanto       || '0.06');
    fd.append('ancho_m',         p.ancho           || '1.00');
    fd.append('alto_m',          p.alto            || '1.00');
    fd.append('con_luz',         p.conLuz ? 'true' : 'false');
    fd.append('ancho_rollo',     p.anchoRollo      || '1.20');
    fd.append('boxes_ignoradas', cajasIgnoradas.join(','));
    const classificationsArray = (cajas || []).map((c) => {
      const cl = classifications[Number(c.id)] ?? classifications[c.id];
      return {
        id: c.id,
        type: (cl?.type || '').trim() || 'letra3d',
        material: (cl?.material || '').trim() || 'acrilico',
        color: cl?.color ?? (c.color || '#ffffff'),
      };
    });
    fd.append('classifications', JSON.stringify(classificationsArray));
    const headers = {};
    if (jobId) headers['X-Job-Id'] = jobId;
    try {
      const res = await axios.post(`${API_BASE}/api/v1/analizar`, fd, { headers });
      setResultado(res.data);
      const fleteCosto = conFlete && infoFlete ? infoFlete.total : 0;
      onAnalisisComplete?.(res.data, fleteCosto, isAuto);
    } catch (err) {
      const res = err.response;
      if (res?.status === 404 && res?.data?.code === 'JOB_NOT_FOUND') {
        setErrorMsg('La sesión expiró o no es válida. Carga de nuevo la imagen.');
        setJobId(null);
      } else if (res?.status === 400 && res?.data?.message) {
        setErrorMsg(res.data.message);
      } else {
        setErrorMsg('Fallo en cálculo vectorial.');
      }
    } finally {
      setIsCalculating(false);
    }
  }, [archivoSeleccionado, jobId, cajasIgnoradas, cajas, classifications, conFlete, infoFlete, getParamsForAnalysis, onAnalisisComplete]);

  // Computed: nesting / CNC — deben coincidir con backend (engine_3d: pw_m, ph_m, gap 0.3)
  const isAluminio = useMemo(
    () => JSON.stringify(resultado?.desglose_tecnico || {}).includes('Aluminio'),
    [resultado]
  );
  const sheetW = isAluminio ? 3.05 : 2.4;
  const sheetH = isAluminio ? 0.9  : 1.2;
  const gap    = 0.3;
  const placasArr = (resultado?.geometria_nesting || []).map((g) => Number(g.placa)).filter((n) => !Number.isNaN(n) && n >= 0);
  const maxPlaca = placasArr.length > 0 ? Math.max(...placasArr) : 0;
  const numPlacas = Math.max(1, maxPlaca + 1);
  // viewBox en metros: placa i tiene y = i * (sheetH + gap), mismo criterio que backend off_y
  const viewBoxStr = `-0.1 -0.1 ${sheetW + 0.2} ${sheetH * numPlacas + gap * (numPlacas - 1) + 0.2}`;

  const tabsDisponibles = useMemo(
    () => ['ajuste', ...(modo === '3D' && resultado ? ['render'] : []), ...(resultado ? ['planos'] : []), 'pdf'],
    [modo, resultado]
  );

  const resetEstudio = useCallback(() => {
    setJobId(null);
    setPreview(null);
    setResultado(null);
    setArchivoSeleccionado(null);
    setCajas([]);
    setCajasIgnoradas([]);
    setSelectedCajas([]);
    setClassifications({});
    setErrorMsg(null);
  }, []);

  return {
    resultado,  setResultado,
    preview,    setPreview,
    texture,
    cajas,
    selectedCajas,  setSelectedCajas,
    cajasIgnoradas,
    isCalculating,
    isDetecting,
    errorMsg,  setErrorMsg,
    showPrintModal,
    tempAncho, setTempAncho,
    printDPI,
    archivoSeleccionado, setArchivoSeleccionado,
    isDragging,  setIsDragging,
    conFlete,    setConFlete,
    destinoFlete, setDestinoFlete,
    infoFlete,
    isCalculatingFlete,
    bgMontaje,   setBgMontaje,
    imgData,
    globalInputRef,
    bgInputRef,
    // methods
    procesarArchivo,
    confirmarMedidaPrint,
    handleDrop,
    calcularFlete,
    toggleSelection,
    toggleIgnoreStatus,
    fusionarCajas,
    analizar,
    classifications,
    setClassifications,
    updateClassification,
    cajaModalStep,
    setCajaModalStep,
    tempCajaMaster,
    tempVinylType,
    setTempVinylType,
    tempVinylColor,
    setTempVinylColor,
    finalizeCajaConfig,
    // computed
    isAluminio,
    sheetW, sheetH, gap, numPlacas, viewBoxStr,
    tabsDisponibles,
    jobId,
    setJobId,
    resetEstudio,
  };
}
