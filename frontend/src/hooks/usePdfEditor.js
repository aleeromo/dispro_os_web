import { useState, useRef, useCallback } from 'react';

const PDF_POSITIONS_DEFAULT = {
  logo:    { x: 10,  y: 10  },
  folio:   { x: 10,  y: 40  },
  fecha:   { x: 10,  y: 60  },
  cliente: { x: 10,  y: 80  },
  title:   { x: 75,  y: 15  },
  desc:    { x: 75,  y: 35  },
  total:   { x: 10,  y: 240 },
  preview: { x: 75,  y: 130 },
};

export function usePdfEditor() {
  const [pdfFolio,      setPdfFolio]     = useState(`DS-${Math.floor(Math.random() * 9000 + 1000)}`);
  const [pdfCliente,    setPdfCliente]   = useState('Cliente');
  const [pdfFecha,      setPdfFecha]     = useState(new Date().toLocaleDateString());
  const [pdfTitle,      setPdfTitle]     = useState('Proyecto Nuevo');
  const [pdfDesc,       setPdfDesc]      = useState('');
  const [pdfTotal,      setPdfTotal]     = useState('$0.00');
  const [pdfBOM,        setPdfBOM]       = useState(null);
  const [pdfImgScale,   setPdfImgScale]  = useState(1);
  const [pdfScale,      setPdfScale]     = useState(1);
  const [isPdfEditing,  setIsPdfEditing] = useState(false);
  const [pdfPositions,  setPdfPositions] = useState(PDF_POSITIONS_DEFAULT);
  const [pdfBackground, setPdfBackground] = useState(null);

  const pdfContainerRef = useRef(null);
  const pdfBgInputRef   = useRef(null);

  // Carga desde resultado de análisis.
  // fleteCosto se calcula fuera (en useDispro) para evitar acoplamiento con flete.
  const cargarDesdeResultado = useCallback((data, fleteCosto = 0, isAuto = false) => {
    if (!isAuto) setPdfFolio(data.folio || `DS-${Math.floor(Math.random() * 9000 + 1000)}`);
    setPdfBOM(data.desglose_tecnico);
    const sp = (data.desglose_texto || '').split('|SPLIT|');
    if (sp.length > 1) {
      setPdfTitle(sp[0].trim());
      setPdfDesc(sp[1].trim());
    }
    setPdfTotal(`$${(data.total_venta + fleteCosto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
  }, []);

  const cargarDesdeCarrito = useCallback((cartList) => {
    const desgloseStr = {};
    cartList.forEach((item, i) => {
      desgloseStr[`Partida ${i + 1}: ${item.servicio}`] = `${item.desc} | $${item.total.toLocaleString()}`;
    });
    setPdfBOM(desgloseStr);
    setPdfTitle('Servicios Express');
    setPdfDesc(`Cotización rápida de ${cartList.length} servicios de impresión y corte.`);
    setPdfTotal(`$${cartList.reduce((s, i) => s + i.total, 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
    setPdfFolio(`EXP-${Math.floor(Math.random() * 9000 + 1000)}`);
  }, []);

  const cargar = useCallback((p) => {
    setPdfTitle(p.nombre);
    setPdfCliente(p.cliente);
    setPdfTotal(p.total);
    setPdfDesc(p.desc || '');
    setPdfBOM(p.desglose || null);
    setPdfFolio(p.folio);
  }, []);

  const getSnapshot = useCallback(() => ({
    pdfFolio, pdfCliente, pdfFecha, pdfTitle, pdfDesc, pdfTotal, pdfBOM,
  }), [pdfFolio, pdfCliente, pdfFecha, pdfTitle, pdfDesc, pdfTotal, pdfBOM]);

  const setValues = {
    setPdfFolio, setPdfFecha, setPdfCliente,
    setPdfTitle, setPdfDesc, setPdfTotal, setPdfImgScale,
  };

  return {
    pdfFolio, pdfCliente, pdfFecha, pdfTitle, pdfDesc, pdfTotal,
    pdfBOM, setPdfBOM,
    pdfImgScale, pdfScale, setPdfScale,
    isPdfEditing, setIsPdfEditing,
    pdfPositions, setPdfPositions,
    pdfBackground, setPdfBackground,
    pdfContainerRef, pdfBgInputRef,
    cargarDesdeResultado, cargarDesdeCarrito, cargar, getSnapshot,
    setValues,
  };
}
