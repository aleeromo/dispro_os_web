import React from 'react';
import logoImg from '../assets/logo.png';

const PDF_POSITIONS_DEFAULT = { logo: { x: 10, y: 10 }, folio: { x: 10, y: 40 }, fecha: { x: 10, y: 60 }, cliente: { x: 10, y: 80 }, title: { x: 75, y: 15 }, desc: { x: 75, y: 35 }, total: { x: 10, y: 240 }, preview: { x: 75, y: 130 } };

export function PDFContent({ positions, values, editing, onPosChange, setValues, preview, isWorkOrder, resultado, customBg }) {
  const pos = { ...PDF_POSITIONS_DEFAULT, ...(positions || {}) };
  const { pdfCliente, pdfFecha, pdfTitle, pdfDesc, pdfTotal, pdfFolio, pdfBOM, pdfImgScale } = values || {};
  const safeDesc = (pdfDesc ?? '').replace('Suministro y colocación* de:', '').trim();

  const handleDrag = (e, id) => {
    if (!editing) return;
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = (pos[id] && pos[id].x) ?? 0;
    const initialY = (pos[id] && pos[id].y) ?? 0;

    const onMove = (moveEvent) => {
      const deltaX = (moveEvent.clientX - startX) / 3.7795;
      const deltaY = (moveEvent.clientY - startY) / 3.7795;
      onPosChange(id, { x: initialX + deltaX, y: initialY + deltaY });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const getStyle = (id) => ({
    position: 'absolute',
    left: `${(pos[id] && pos[id].x) ?? 0}mm`,
    top: `${(pos[id] && pos[id].y) ?? 0}mm`,
    cursor: editing ? 'move' : 'default',
    border: editing ? '1px dashed blue' : 'none',
    padding: editing ? '2px' : '0'
  });

  const isAluminio = JSON.stringify(resultado?.desglose_tecnico || {}).includes('Aluminio');
  const sheetW = isAluminio ? 3.05 : 2.40;
  const sheetH = isAluminio ? 0.90 : 1.20;
  const gap = 0.3;
  const maxPlaca = Math.max(0, ...(resultado?.geometria_nesting?.map(g => g.placa) || [0]));
  const numPlacas = isNaN(maxPlaca) ? 1 : maxPlaca + 1;
  const viewBoxStr = `-0.1 -0.1 ${sheetW + 0.2} ${(sheetH * numPlacas) + (gap * (numPlacas - 1)) + 0.2}`;

  const shareSummary = `Cotización DisproOS – Folio: ${pdfFolio ?? ''} – Cliente: ${pdfCliente ?? ''} – Total: ${pdfTotal ?? ''} – ${(pdfTitle ?? '').slice(0, 60)}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareSummary)}`;
  const mailtoSubject = encodeURIComponent(`Cotización DisproOS – Folio ${pdfFolio ?? ''}`);
  const mailtoBody = encodeURIComponent(
    `Cliente: ${pdfCliente ?? ''}\nFecha: ${pdfFecha ?? ''}\nTítulo: ${pdfTitle ?? ''}\nTotal: ${pdfTotal ?? ''}\n\n${safeDesc}\n\nGenerado por DisproOS.`
  );
  const mailtoUrl = `mailto:?subject=${mailtoSubject}&body=${mailtoBody}`;

  return (
    <div className="flex flex-col gap-10">
      <div className="relative bg-white shadow-2xl overflow-hidden border border-gray-200 pdf-page-container flex-shrink-0" style={{ width: '8.5in', height: '11in' }}>
        {customBg && <img src={customBg} className="absolute inset-0 w-full h-full object-fill z-0" alt="Plantilla" />}

        <div className={`absolute inset-0 z-10 ${customBg ? 'bg-transparent' : 'bg-white'}`}>
          <div onMouseDown={(e) => handleDrag(e, 'logo')} style={getStyle('logo')}>
            <img src={logoImg} className="h-[25mm] w-auto object-contain" alt="DISPRO" onError={(e) => (e.target.style.display = 'none')} />
          </div>

          <div onMouseDown={(e) => handleDrag(e, 'folio')} style={getStyle('folio')}>
            <input value={pdfFolio} readOnly={!editing} onChange={(e) => setValues?.setPdfFolio(e.target.value)} className="w-full bg-transparent font-black text-lg outline-none text-black placeholder-black" placeholder="FOLIO" />
          </div>
          <div onMouseDown={(e) => handleDrag(e, 'fecha')} style={getStyle('fecha')}>
            <input value={pdfFecha} readOnly={!editing} onChange={(e) => setValues?.setPdfFecha(e.target.value)} className="w-full bg-transparent font-bold outline-none text-sm text-black placeholder-black" placeholder="FECHA" />
          </div>
          <div onMouseDown={(e) => handleDrag(e, 'cliente')} style={getStyle('cliente')}>
            <input value={pdfCliente} readOnly={!editing} onChange={(e) => setValues?.setPdfCliente(e.target.value)} className="w-full bg-transparent font-bold outline-none text-sm text-black placeholder-black" placeholder="CLIENTE" />
          </div>
          <div onMouseDown={(e) => handleDrag(e, 'title')} style={getStyle('title')} className="w-[120mm]">
            <input value={pdfTitle} readOnly={!editing} onChange={(e) => setValues?.setPdfTitle(e.target.value)} className="w-full bg-transparent text-2xl font-black uppercase tracking-tighter outline-none text-black placeholder-black" placeholder="TÍTULO" />
          </div>

          <div onMouseDown={(e) => handleDrag(e, 'desc')} style={getStyle('desc')} className="w-[140mm]">
            {isWorkOrder ? (
              <div className="w-full text-black">
                <div className="flex flex-col gap-2">
                  {pdfBOM && Object.entries(pdfBOM).map(([k, v]) => {
                    const cleanText = typeof v === 'string' ? v.replace(/\s*\(\$[\d,]+\.\d{2}\)/g, '') : v;
                    return (
                      <div key={k}>
                        <pre className="font-mono text-xs whitespace-pre-wrap font-bold text-black">{k}: {cleanText}</pre>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="w-full text-black">
                <textarea value={safeDesc} readOnly={!editing} onChange={(e) => setValues?.setPdfDesc(e.target.value)} className="w-full h-32 bg-transparent text-xs font-medium leading-relaxed outline-none resize-none text-gray-800 placeholder-black" placeholder="Descripción del servicio..." />
              </div>
            )}
          </div>

          {preview && (
            <div onMouseDown={(e) => handleDrag(e, 'preview')} style={{ ...getStyle('preview'), width: `${(pdfImgScale || 1) * 120}mm` }} className="h-auto p-2 relative group flex flex-col items-center">
              <img src={preview} className="w-full h-full object-contain mix-blend-multiply pointer-events-none" alt="Preview" />
              {editing && (
                <div className="absolute -bottom-8 bg-black/80 px-4 py-2 rounded-xl flex gap-2 items-center" onMouseDown={(e) => e.stopPropagation()}>
                  <span className="text-white text-[10px] font-bold">Zoom</span>
                  <input type="range" min="0.3" max="2.5" step="0.05" value={pdfImgScale || 1} onChange={(e) => setValues?.setPdfImgScale(parseFloat(e.target.value))} className="w-24 accent-blue-500" />
                </div>
              )}
            </div>
          )}

          <div onMouseDown={(e) => handleDrag(e, 'total')} style={getStyle('total')}>
            {isWorkOrder ? (
              <p className="w-full bg-transparent font-black text-xl text-yellow-600">ORDEN DE TRABAJO</p>
            ) : (
              <input value={pdfTotal} readOnly={!editing} onChange={(e) => setValues?.setPdfTotal(e.target.value)} className="w-full bg-transparent font-black text-3xl outline-none text-black placeholder-black" placeholder="$0.00" />
            )}
          </div>
        </div>
      </div>

      {isWorkOrder && resultado?.modo === '3D' && (
        <div className="relative bg-white shadow-2xl overflow-hidden border border-gray-200 pdf-page-container flex-shrink-0 flex flex-col p-12" style={{ width: '8.5in', height: '11in', pageBreakBefore: 'always' }}>
          <h3 className="text-2xl font-black text-black uppercase tracking-tighter border-b-4 border-black pb-2 mb-6 z-10">Planos de Producción / Nesting</h3>
          <div className="flex-1 w-full border-2 border-dashed border-gray-400 p-4 relative overflow-hidden flex items-center justify-center z-10 bg-white/90">
            <svg viewBox={viewBoxStr} className="w-full h-full max-h-full">
              {Array.from({ length: numPlacas }).map((_, i) => (
                <rect key={`bounds-${i}`} x="0" y={i * (sheetH + gap)} width={sheetW} height={sheetH} fill="none" stroke="#000" strokeWidth="0.008" />
              ))}
              {resultado?.geometria_nesting?.map((geo, i) => (
                <g key={`geo-${i}`}>
                  {geo.puntos && Array.isArray(geo.puntos) && geo.puntos.length > 0 && (
                    <polygon points={geo.puntos.map((pt) => `${pt.x},${pt.y}`).join(' ')} fill={geo.tipo === 'canto' ? 'rgba(59,130,246,0.2)' : 'none'} stroke={geo.tipo === 'canto' ? '#3b82f6' : '#000'} strokeWidth={geo.tipo === 'canto' ? '0.01' : '0.005'} strokeLinejoin="round" />
                  )}
                  {geo.vinilos?.map((v, idx) => (
                    <polygon key={`v-${idx}`} points={v.puntos.map((pt) => `${pt.x},${pt.y}`).join(' ')} fill={v.color} opacity={0.8} />
                  ))}
                  {geo.tipo === 'cara' && geo.is_oversized && geo.global_x !== undefined && (
                    <g>
                      {Array.from({ length: geo.tramos_x || 1 }).map((_, tx) => (
                        <line key={`lx-${tx}`} x1={geo.global_x + (tx * (geo.w_m / geo.tramos_x))} y1={geo.global_y} x2={geo.global_x + (tx * (geo.w_m / geo.tramos_x))} y2={geo.global_y + geo.h_m} stroke="red" strokeDasharray="0.02,0.02" strokeWidth="0.003" />
                      ))}
                      {Array.from({ length: geo.tramos_y || 1 }).map((_, ty) => (
                        <line key={`ly-${ty}`} x1={geo.global_x} y1={geo.global_y + (ty * (geo.h_m / geo.tramos_y))} x2={geo.global_x + geo.w_m} y2={geo.global_y + (ty * (geo.h_m / geo.tramos_y))} stroke="red" strokeDasharray="0.02,0.02" strokeWidth="0.003" />
                      ))}
                    </g>
                  )}
                  {geo.leds?.map((led, j) => (
                    <circle key={`l-${j}`} cx={led.x} cy={led.y} r="0.015" fill="#facc15" stroke="#000" strokeWidth="0.002" />
                  ))}
                </g>
              ))}
            </svg>
          </div>
          <div className="mt-6 mb-4 flex gap-4 text-xs font-bold text-black bg-gray-100 p-2 rounded z-10">
            <div className="flex items-center gap-2"><div className="w-4 h-4 border border-black bg-white"></div> Cara Frontal</div>
            <div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-blue-500 bg-blue-100"></div> Tiras Canto</div>
            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-yellow-400 rounded-full border border-black"></div> LEDs Físicos</div>
          </div>
          <p className="text-[9px] text-gray-400 text-right mt-2 pb-4 z-10">Página 2/2 - Generado por DisproIA</p>
        </div>
      )}
    </div>
  );
}
