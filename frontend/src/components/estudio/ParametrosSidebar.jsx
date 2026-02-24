import React, { useState } from 'react';

const PRESET_COLORS = ['#2563eb', '#ffffff', '#111111', '#ef4444', '#bdc3c7', '#22c55e', '#eab308'];
const TYPE_OPTS = [
  ['letra3d', 'Letra 3D'],
  ['caja', 'Caja Luz'],
  ['rotulo', 'Vinil'],
  ['hueco', 'Hueco'],
  ['ignorar', 'Omitir'],
];
const MAT_OPTS = [
  ['acrilico', 'Acrílico'],
  ['aluminio', 'Aluminio'],
  ['vinil', 'Vinil'],
];

export function ParametrosSidebar({
  isDarkMode,
  modo, setModo,
  materialCara, setMaterialCara,
  aluminioTipo, setAluminioTipo,
  colorMate, setColorMate,
  materialCanto, setMaterialCanto,
  profCanto, setProfCanto,
  ancho, setAncho,
  alto, setAlto,
  conLuz, setConLuz,
  anchoRollo, setAnchoRollo,
  anchosDisponibles, getAnchosRollo,
  conFlete, setConFlete,
  destinoFlete, setDestinoFlete,
  infoFlete, isCalculatingFlete, calcularFlete,
  imgData,
  resultado,
  pdfTotal,
  isCalculating, isDetecting,
  analizar,
  globalInputRef,
  cajas = [],
  selectedCajas = [],
  setSelectedCajas,
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
  preview,
}) {
  const selectCls = `w-full rounded-xl p-3 text-sm font-bold outline-none border transition-all ${isDarkMode ? 'bg-black/30 border-white/10 text-white' : 'bg-black/5 border-black/10 text-black'}`;
  const hasCajas = modo === '3D' && ((Array.isArray(cajas) && cajas.length > 0) || !!preview);
  const selectedId = selectedCajas?.[0];
  const hasSelection = selectedCajas != null && selectedCajas.length > 0;
  const selectedCaja = hasSelection ? cajas.find((c) => c.id === selectedId) : null;
  const cl = hasSelection && selectedId != null ? classifications[Number(selectedId)] : null;
  const showTypeMatColor = cl && ['letra3d', 'caja', 'rotulo'].includes(cl.type);
  const matFilter = ([value]) => {
    if (!cl) return true;
    if (cl.type === 'rotulo') return value === 'vinil';
    if (cl.type === 'caja' || cl.type === 'letra3d') return value !== 'vinil';
    return true;
  };

  const [opcionesExpandidas, setOpcionesExpandidas] = useState(false);
  const currentColorHex = (cl?.color ?? '#2563EB').toString().replace(/^#?/, (m) => (m ? '#' : '#')).toUpperCase();

  return (
    <aside className="w-80 flex flex-col flex-shrink-0 relative z-20">
      <div className={`relative flex flex-col h-full transition-all duration-300 overflow-hidden ${isDarkMode ? 'bg-white/[0.03] border border-white/10 backdrop-blur-2xl text-white shadow-2xl' : 'bg-white/90 border border-black/10 backdrop-blur-md text-black shadow-lg'}`}>
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

        <div className="p-8 flex flex-col h-full">
          <div className="flex-none mb-6">
            <p className="text-[10px] font-black tracking-[0.5em] text-cyan-400 uppercase mb-1">Motor 3D</p>
            <h2 className="text-2xl font-black uppercase tracking-tighter">Parámetros</h2>
            <div className="mt-3 w-8 h-0.5 bg-cyan-500 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
          </div>

          <div className="space-y-5 flex-1 overflow-y-auto no-scrollbar pb-4">
            {modo === '3D' ? (
              <>
                {/* 1. En modo 3D: primero Clasificación del elemento (Smart Render nativo) */}
                {hasCajas && (
                  <div className={`relative z-10 space-y-3 p-4 rounded-xl border ${isDarkMode ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-cyan-50/80 border-cyan-200'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-black text-cyan-600 uppercase tracking-[0.2em]">Clasificación del elemento</p>
                      {cajas.length > 0 && (
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${isDarkMode ? 'bg-cyan-500/30 text-cyan-300' : 'bg-cyan-200 text-cyan-800'}`}>
                          {cajas.length} total
                        </span>
                      )}
                    </div>
                    {!hasSelection ? (
                      <p className={`text-xs font-medium ${isDarkMode ? 'text-white/60' : 'text-black/60'}`}>
                        Selecciona una o más formas en el lienzo para clasificar.
                      </p>
                    ) : (
                      <>
                        <div className="relative">
                          <label className="text-[10px] font-black text-gray-500 uppercase block mb-1">1. Clasificación</label>
                          <div className="grid grid-cols-2 gap-1">
                            {TYPE_OPTS.map(([value, label]) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => {
                                  updateClassification?.(selectedCajas, 'type', value);
                                  if (value === 'rotulo') updateClassification?.(selectedCajas, 'material', 'vinil');
                                  // Comportamiento Smart Render: abrir modal "caja con cajas dentro" si alguna seleccionada es is_master
                                  if (value === 'caja') {
                                    const masterCaja = selectedCajas
                                      .map((id) => cajas.find((c) => c.id === id))
                                      .find((c) => c?.is_master);
                                    if (masterCaja) {
                                      setTempCajaMaster?.(masterCaja);
                                      setCajaModalStep?.(1);
                                    }
                                  }
                                }}
                                className={`py-2 rounded-lg text-[10px] font-bold uppercase touch-manipulation cursor-pointer ${cl?.type === value ? 'bg-cyan-600 text-white' : isDarkMode ? 'bg-white/10 hover:bg-white/15' : 'bg-black/10 hover:bg-black/15'}`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        {showTypeMatColor && (
                          <>
                            <div className="relative">
                              <label className="text-[10px] font-black text-gray-500 uppercase block mb-1">2. Material</label>
                              <div className="flex flex-wrap gap-1">
                                {MAT_OPTS.filter(matFilter).map(([value, label]) => (
                                  <button
                                    key={value}
                                    type="button"
                                    onClick={() => updateClassification?.(selectedCajas, 'material', value)}
                                    className={`px-2 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer touch-manipulation ${cl?.material === value ? 'bg-cyan-600 text-white' : isDarkMode ? 'bg-white/10 hover:bg-white/15' : 'bg-black/10 hover:bg-black/15'}`}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="relative">
                              <label className="text-[10px] font-black text-gray-500 uppercase block mb-1">3. Color</label>
                              <div className="flex flex-wrap gap-1 items-center">
                                {PRESET_COLORS.map((hex) => (
                                  <button
                                    key={hex}
                                    type="button"
                                    onClick={() => updateClassification?.(selectedCajas, 'color', hex)}
                                    className={`w-7 h-7 rounded-full border-2 cursor-pointer touch-manipulation ${cl?.color === hex ? 'border-cyan-500 scale-110' : 'border-gray-400'}`}
                                    style={{ backgroundColor: hex }}
                                    title={hex}
                                  />
                                ))}
                                <div className={`flex items-center gap-3 p-2 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
                                  <div className="relative w-10 h-10 rounded-lg overflow-hidden border-2 border-gray-400 shrink-0">
                                    <input
                                      type="color"
                                      value={cl?.color || '#2563eb'}
                                      onChange={(e) => updateClassification?.(selectedCajas, 'color', e.target.value)}
                                      className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer opacity-0"
                                    />
                                    <div className="w-full h-full pointer-events-none" style={{ backgroundColor: cl?.color || '#2563eb' }} />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase text-gray-500">Color Custom</span>
                                    <span className={`text-xs font-mono font-bold ${isDarkMode ? 'text-cyan-300' : 'text-cyan-700'}`}>{currentColorHex}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Dimensiones (visibles en 3D) */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] block mb-2">Ancho (m)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={ancho}
                      onChange={(e) => { setAncho(e.target.value); if (imgData.wPx) setAlto((parseFloat(e.target.value) * (imgData.hPx / imgData.wPx)).toFixed(2)); }}
                      className={`w-full rounded-xl p-3 text-xl font-black outline-none text-center border-2 transition-all ${isDarkMode ? 'bg-black/30 border-white/10 text-white focus:border-cyan-500' : 'bg-black/5 border-black/20 text-black focus:border-blue-500'}`}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] block mb-2">Alto (m)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={alto}
                      onChange={(e) => { setAlto(e.target.value); if (imgData.hPx) setAncho((parseFloat(e.target.value) * (imgData.wPx / imgData.hPx)).toFixed(2)); }}
                      className={`w-full rounded-xl p-3 text-xl font-black outline-none text-center border-2 transition-all ${isDarkMode ? 'bg-black/30 border-white/10 text-white focus:border-cyan-500' : 'bg-black/5 border-black/20 text-black focus:border-blue-500'}`}
                    />
                  </div>
                </div>

                {/* Opciones de proyecto (colapsable) */}
                <div className={`rounded-xl border ${isDarkMode ? 'border-white/10' : 'border-black/10'}`}>
                  <button
                    type="button"
                    onClick={() => setOpcionesExpandidas(!opcionesExpandidas)}
                    className={`w-full flex items-center justify-between gap-2 p-3 rounded-xl font-bold text-sm transition-all ${isDarkMode ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-black/5 text-black hover:bg-black/10'}`}
                  >
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Opciones de proyecto</span>
                    <span className="text-lg leading-none">{opcionesExpandidas ? '▼' : '▶'}</span>
                  </button>
                  {opcionesExpandidas && (
                    <div className="space-y-4 p-4 pt-0 border-t border-white/10">
                      <div>
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] block mb-2">Tipo de Proyecto</label>
                        <select
                          value={modo}
                          onChange={(e) => { setModo(e.target.value); setMaterialCara(e.target.value === 'ROLLO' ? 'Lona' : 'Acrílico'); }}
                          className={selectCls}
                        >
                          <option value="3D">Letras 3D (Corte)</option>
                          <option value="ROLLO">Impresión Gran Formato</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] block mb-2">Material Frontal</label>
                        <select value={materialCara} onChange={(e) => setMaterialCara(e.target.value)} className={selectCls}>
                          <option>Acrílico</option><option>Aluminio</option>
                        </select>
                      </div>
                      {materialCara === 'Aluminio' && (
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] block mb-2">Tipo Aluminio</label>
                            <select value={aluminioTipo} onChange={(e) => setAluminioTipo(e.target.value)} className={selectCls}>
                              <option>Plata</option><option>Dorado</option><option>Rosa</option><option>Mate</option>
                            </select>
                          </div>
                          {aluminioTipo === 'Mate' && (
                            <div className="w-16">
                              <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] block mb-2">Color</label>
                              <input type="color" value={colorMate} onChange={(e) => setColorMate(e.target.value)} className="w-full h-12 cursor-pointer bg-transparent border-0 p-0" />
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] block mb-2">Canto</label>
                          <select value={materialCanto} onChange={(e) => setMaterialCanto(e.target.value)} className={selectCls}>
                            <option>Aluminio</option><option>Aluminio Negro</option><option>Aluminio Dorado</option><option>Acrílico</option>
                          </select>
                        </div>
                        <div className="w-24">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] block mb-2">Grosor</label>
                          <select value={profCanto} onChange={(e) => setProfCanto(e.target.value)} className={selectCls}>
                            <option value="0.06">6 cm</option><option value="0.10">10 cm</option>
                          </select>
                        </div>
                      </div>
                      <label className={`flex items-center gap-3 cursor-pointer p-4 rounded-xl font-bold text-sm transition-all border ${isDarkMode ? 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-cyan-500/30' : 'bg-black/5 border-black/10 text-black hover:bg-black/10'}`}>
                        <input type="checkbox" checked={conLuz} onChange={(e) => setConLuz(e.target.checked)} className="w-5 h-5 accent-cyan-400" />
                        Iluminación LED
                      </label>
                      <label className={`flex items-center gap-3 cursor-pointer p-4 rounded-xl font-bold text-sm transition-all border ${isDarkMode ? 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-cyan-500/30' : 'bg-black/5 border-black/10 text-black hover:bg-black/10'}`}>
                        <input type="checkbox" checked={conFlete} onChange={(e) => setConFlete(e.target.checked)} className="w-5 h-5 accent-cyan-400" />
                        Servicio de Flete
                      </label>
                      {conFlete && (
                        <div className={`p-4 rounded-xl border-l-4 ${isDarkMode ? 'bg-black/30 border-cyan-500/30' : 'bg-black/5 border-blue-500/30'}`}>
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] block mb-2">Destino (Ciudad, Estado)</label>
                          <input
                            type="text"
                            value={destinoFlete}
                            onChange={(e) => setDestinoFlete(e.target.value)}
                            placeholder="Ej. Tlaxcala"
                            className={`w-full rounded-lg p-2 text-sm font-bold outline-none border-b ${isDarkMode ? 'bg-transparent text-white border-white/20' : 'bg-transparent text-black border-black/20'}`}
                          />
                          <button
                            onClick={calcularFlete}
                            disabled={isCalculatingFlete}
                            className="mt-4 w-full py-2 rounded-lg bg-blue-600 text-white font-bold uppercase tracking-widest text-[10px] hover:bg-blue-500 transition-colors"
                          >
                            {isCalculatingFlete ? 'Calculando...' : 'Calcular Viáticos'}
                          </button>
                          {infoFlete && (
                            <div className="mt-4 text-[10px] font-mono leading-relaxed">
                              <p>Distancia: {infoFlete.distancia} km</p>
                              <p>Tiempo: {infoFlete.tiempo} hrs</p>
                              <p className="font-black text-cyan-400 mt-1">Costo Flete: ${infoFlete.total.toLocaleString()}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] block mb-2">Tipo de Proyecto</label>
                  <select
                    value={modo}
                    onChange={(e) => { setModo(e.target.value); setMaterialCara(e.target.value === 'ROLLO' ? 'Lona' : 'Acrílico'); }}
                    className={`w-full rounded-xl p-3 text-sm font-black outline-none border transition-all ${isDarkMode ? 'bg-black/30 border-white/10 text-white focus:border-cyan-500/50' : 'bg-black/5 border-black/10 text-black'}`}
                  >
                    <option value="3D">Letras 3D (Corte)</option>
                    <option value="ROLLO">Impresión Gran Formato</option>
                  </select>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] block mb-2">Sustrato</label>
                    <select value={materialCara} onChange={(e) => { setMaterialCara(e.target.value); setAnchoRollo(getAnchosRollo(e.target.value)[0].val); }} className={selectCls}>
                      <option>Lona</option><option>Vinil</option><option>DTF UV</option><option>DTF Textil</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] block mb-2">Ancho Rollo</label>
                    <select value={anchoRollo} onChange={(e) => setAnchoRollo(e.target.value)} className={selectCls}>
                      {anchosDisponibles.map((a) => <option key={a.val} value={a.val}>{a.label}</option>)}
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* Dimensiones (solo en ROLLO; en 3D ya están arriba) */}
            {modo === 'ROLLO' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] block mb-2">Ancho (m)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={ancho}
                    onChange={(e) => { setAncho(e.target.value); if (imgData.wPx) setAlto((parseFloat(e.target.value) * (imgData.hPx / imgData.wPx)).toFixed(2)); }}
                    className={`w-full rounded-xl p-3 text-xl font-black outline-none text-center border-2 transition-all ${isDarkMode ? 'bg-black/30 border-white/10 text-white focus:border-cyan-500' : 'bg-black/5 border-black/20 text-black focus:border-blue-500'}`}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] block mb-2">Alto (m)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={alto}
                    onChange={(e) => { setAlto(e.target.value); if (imgData.hPx) setAncho((parseFloat(e.target.value) * (imgData.wPx / imgData.hPx)).toFixed(2)); }}
                    className={`w-full rounded-xl p-3 text-xl font-black outline-none text-center border-2 transition-all ${isDarkMode ? 'bg-black/30 border-white/10 text-white focus:border-cyan-500' : 'bg-black/5 border-black/20 text-black focus:border-blue-500'}`}
                  />
                </div>
              </div>
            )}

          </div>

          {/* Botón Analizar */}
          <div className="pt-4 flex-none border-t border-dashed border-white/10 pb-24">
            {!resultado ? (
              <button
                onClick={() => analizar(false)}
                disabled={isCalculating || isDetecting}
                className="group relative overflow-hidden w-full py-5 mt-4 font-black uppercase text-sm transition-all duration-500 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_10px_25px_rgba(6,182,212,0.25)] hover:shadow-[0_15px_35px_rgba(6,182,212,0.45)] hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="relative z-10">{isCalculating ? 'CALCULANDO...' : '🚀 ANALIZAR DISEÑO'}</span>
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
              </button>
            ) : (
              <button
                onClick={() => globalInputRef.current.click()}
                className={`w-full py-5 mt-4 font-black uppercase text-sm transition-all rounded-2xl border border-dashed ${isDarkMode ? 'bg-transparent text-white border-white/20 hover:border-white/50 hover:bg-white/5' : 'bg-transparent text-black border-black/30 hover:border-black hover:bg-black/5'}`}
              >
                Cargar Nuevo Diseño
              </button>
            )}
          </div>
        </div>
      </div>

      {resultado && (
        <div className={`absolute bottom-0 left-0 right-0 p-6 border-t shadow-[0_-15px_30px_rgba(0,0,0,0.5)] text-center flex-none z-10 backdrop-blur-2xl ${isDarkMode ? 'bg-black/60 border-white/10 text-white' : 'bg-white/90 border-black/10 text-black'}`}>
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] mb-1">Presupuesto Final</p>
          <h3 className="text-4xl font-black tracking-tighter">{pdfTotal}</h3>
        </div>
      )}
    </aside>
  );
}
