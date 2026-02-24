import React, { useState, useRef, useCallback } from 'react';

const PRESET_COLORS = ['#2563eb', '#ffffff', '#111111', '#ef4444', '#bdc3c7', '#22c55e', '#eab308'];
const TYPE_LABELS = [
  ['letra3d', 'Letra 3D'],
  ['caja', 'Caja Luz'],
  ['rotulo', 'Vinil'],
  ['hueco', 'Hueco'],
  ['ignorar', 'Omitir'],
];
const TYPE_TAG_LABELS = { letra3d: 'LETRA 3D', caja: 'CAJA LUZ', rotulo: 'VINIL', hueco: 'HUECO', ignorar: 'OMITIR' };
const MAT_LABELS = [
  ['acrilico', 'Acrílico'],
  ['aluminio', 'Aluminio'],
  ['vinil', 'Vinil'],
];

export function AjusteTab({
  isDarkMode,
  preview,
  imgData,
  modo,
  cajas,
  cajasIgnoradas,
  selectedCajas,
  setSelectedCajas,
  toggleSelection,
  toggleIgnoreStatus,
  fusionarCajas,
  classifications = {},
  updateClassification,
  cajaModalStep,
  setCajaModalStep,
  tempCajaMaster,
  setTempCajaMaster,
  tempVinylType,
  setTempVinylType,
  tempVinylColor,
  setTempVinylColor,
  finalizeCajaConfig,
}) {
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragCurrent, setDragCurrent] = useState(null);

  const wPx = imgData.wPx || 1;
  const hPx = imgData.hPx || 1;

  const getNormCoords = useCallback((e) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const r = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  }, []);

  const getBoxNorm = (c) => {
    if (c.norm_x != null && c.norm_y != null && c.norm_w != null && c.norm_h != null) {
      return { nx: c.norm_x, ny: c.norm_y, nw: c.norm_w, nh: c.norm_h };
    }
    return {
      nx: (c.x ?? 0) / wPx,
      ny: (c.y ?? 0) / hPx,
      nw: (c.w ?? 0) / wPx,
      nh: (c.h ?? 0) / hPx,
    };
  };

  const boxContainsPoint = (c, nx, ny) => {
    const { nx: bx, ny: by, nw: bw, nh: bh } = getBoxNorm(c);
    return nx >= bx && nx <= bx + bw && ny >= by && ny <= by + bh;
  };

  const boxIntersectsRect = (c, minX, minY, maxX, maxY) => {
    const { nx: bx, ny: by, nw: bw, nh: bh } = getBoxNorm(c);
    return !(bx + bw < minX || bx > maxX || by + bh < minY || by > maxY);
  };

  const handleMouseDown = useCallback((e) => {
    if (modo !== '3D' || !cajas?.length) return;
    const coords = getNormCoords(e);
    setDragStart(coords);
    setDragCurrent(coords);
    setIsDragging(true);
  }, [modo, cajas, getNormCoords]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !dragStart) return;
    setDragCurrent(getNormCoords(e));
  }, [isDragging, dragStart, getNormCoords]);

  const handleMouseUp = useCallback((e) => {
    if (!dragStart || !dragCurrent) return;
    const dist = Math.hypot(dragCurrent.x - dragStart.x, dragCurrent.y - dragStart.y);
    const shiftKey = e?.shiftKey === true;

    if (dist < 0.005) {
      const { x, y } = dragStart;
      const containing = cajas.filter((c) => boxContainsPoint(c, x, y));
      if (containing.length > 0) {
        const byArea = [...containing].sort((a, b) => {
          const aa = getBoxNorm(a).nw * getBoxNorm(a).nh;
          const ab = getBoxNorm(b).nw * getBoxNorm(b).nh;
          return aa - ab;
        });
        const picked = byArea[0].id;
        if (shiftKey) {
          setSelectedCajas((prev) => (prev.includes(picked) ? prev.filter((id) => id !== picked) : [...prev, picked]));
        } else {
          toggleSelection(picked);
        }
      } else if (!shiftKey) {
        setSelectedCajas([]);
      }
    } else {
      const minX = Math.min(dragStart.x, dragCurrent.x);
      const maxX = Math.max(dragStart.x, dragCurrent.x);
      const minY = Math.min(dragStart.y, dragCurrent.y);
      const maxY = Math.max(dragStart.y, dragCurrent.y);
      const hitIds = cajas.filter((c) => boxIntersectsRect(c, minX, minY, maxX, maxY)).map((c) => c.id);
      if (shiftKey) {
        setSelectedCajas((prev) => {
          const next = new Set([...prev, ...hitIds]);
          return [...next];
        });
      } else {
        setSelectedCajas(hitIds);
      }
    }
    setIsDragging(false);
    setDragStart(null);
    setDragCurrent(null);
  }, [dragStart, dragCurrent, cajas, setSelectedCajas, toggleSelection]);

  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      setDragStart(null);
      setDragCurrent(null);
    }
  }, [isDragging]);

  // Motor funcional: contenedor con el mismo aspect ratio que la imagen para que las cajas coincidan exactamente
  const aspectRatio = wPx && hPx && hPx > 0 ? wPx / hPx : 1;

  return (
    <>
    <div className="flex-1 min-h-0 min-w-0 flex flex-col relative" style={{ minHeight: '70vh' }}>
      <div
        className={`flex-1 flex items-center justify-center overflow-hidden ${isDarkMode ? 'bg-[#0d0d0d]' : 'bg-gray-100'}`}
        style={{ minHeight: '65vh' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Contenedor grande: mismo aspect ratio que la imagen, ocupa el máximo posible (evitar imagen diminuta) */}
        <div
          ref={containerRef}
          className="relative shadow-2xl border overflow-hidden flex-shrink-0 bg-transparent"
          style={{
            width: '100%',
            maxWidth: '100%',
            maxHeight: '100%',
            aspectRatio: String(aspectRatio),
            minWidth: 200,
            minHeight: 200,
            borderColor: isDarkMode ? '#333' : '#e5e7eb',
          }}
        >
          {preview && (
            <img
              key={preview}
              src={preview}
              alt="Diseño cargado"
              draggable={false}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
              style={{ objectFit: 'contain', display: 'block' }}
            />
          )}

        {modo === '3D' && Array.isArray(cajas) && cajas.length > 0 && (
          <div className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
            {/* Sombreado azul por path (forma real) cuando existe contour_path_d */}
            {cajas.some((c) => c?.contour_path_d) ? (
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox={`0 0 ${wPx} ${hPx}`}
                preserveAspectRatio="xMidYMid meet"
              >
                {cajas.map((c) => {
                  if (!c?.contour_path_d) return null;
                  const idsToIgnore = c.childrenIds || [c.id];
                  const isIgnored = idsToIgnore.every((id) => (cajasIgnoradas || []).includes(id));
                  const isSelected = (selectedCajas || []).includes(c.id);
                  const fillColor = isIgnored ? 'rgba(220,38,38,0.2)' : 'rgba(147,197,253,0.28)';
                  return (
                    <path
                      key={c.id}
                      d={c.contour_path_d}
                      fill={fillColor}
                      stroke="none"
                      className="transition-colors"
                    />
                  );
                })}
              </svg>
            ) : null}
            {/* Cajas: borde blanco fino + relleno azul claro + etiqueta "TIPO - ID:XXX" (igual que Smart Render) */}
            {cajas.map((c) => {
              if (!c) return null;
              const idsToIgnore = c.childrenIds || [c.id];
              const isIgnored = idsToIgnore.every((id) => (cajasIgnoradas || []).includes(id));
              const isSelected = (selectedCajas || []).includes(c.id);
              const { nx, ny, nw, nh } = getBoxNorm(c);
              const cl = classifications[Number(c.id)] ?? classifications[c.id];
              const typeSlug = (cl?.type && TYPE_TAG_LABELS[cl.type]) ? cl.type : '';
              const tagLabel = TYPE_TAG_LABELS[typeSlug];
              const usePath = !!c.contour_path_d;
              return (
                <div
                  key={c.id}
                  className="absolute transition-all pointer-events-none border-2"
                  style={{
                    left: `${nx * 100}%`,
                    top: `${ny * 100}%`,
                    width: `${nw * 100}%`,
                    height: `${nh * 100}%`,
                    borderColor: isSelected ? '#ef4444' : '#2563eb',
                    boxShadow: isSelected ? '0 0 0 2px rgba(239,68,68,0.8)' : '0 0 0 1px rgba(37,99,235,0.6)',
                    backgroundColor: usePath ? 'transparent' : (isIgnored ? 'rgba(220,38,38,0.2)' : 'rgba(147,197,253,0.2)'),
                  }}
                >
                  {typeSlug && tagLabel && nw > 0.012 && nh > 0.012 && (
                    <span
                      className="absolute left-0 top-0 max-w-full truncate text-[7px] font-black uppercase px-1.5 py-0.5 rounded-sm whitespace-nowrap leading-tight shadow-md"
                      style={{
                        backgroundColor: '#111111',
                        color: '#ffffff',
                        border: '1px solid #333',
                      }}
                    >
                      {tagLabel} - ID:{c.id}
                    </span>
                  )}
                </div>
              );
            })}
            {isDragging && dragStart && dragCurrent && (
              <div
                className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none"
                style={{
                  left: `${Math.min(dragStart.x, dragCurrent.x) * 100}%`,
                  top: `${Math.min(dragStart.y, dragCurrent.y) * 100}%`,
                  width: `${Math.abs(dragCurrent.x - dragStart.x) * 100}%`,
                  height: `${Math.abs(dragCurrent.y - dragStart.y) * 100}%`,
                }}
              />
            )}
          </div>
        )}
        </div>
      </div>
    </div>

      {/* Clasificación, Material y Color están en el ParametrosSidebar (derecha); modal Caja desde EstudioView */}
    </>
  );
}
