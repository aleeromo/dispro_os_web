import React, { useState, useEffect } from 'react';

export function CotizadorModule({ isDarkMode, handleGenerarExpress }) {
  const [ancho, setAncho] = useState('1.0');
  const [alto, setAlto] = useState('1.0');
  const [unidades, setUnidades] = useState('1');
  const [anchoRolloExp, setAnchoRolloExp] = useState('1.20');
  const [servicioSel, setServicioSel] = useState('');
  const [categoriaActiva, setCategoriaActiva] = useState('Impresión Gran Formato');
  const [cart, setCart] = useState([]);

  const categorias = {
    'Impresión Gran Formato': {
      'Lona impresa':               [{ l: 0, p: 100 }],
      'Vinil impreso':              [{ l: 25, p: 120 }, { l: 10, p: 130 }, { l: 5, p: 140 }, { l: 0, p: 150 }],
      'Vinil transparente':         [{ l: 25, p: 120 }, { l: 10, p: 130 }, { l: 5, p: 140 }, { l: 0, p: 150 }],
      'Microperforado':             [{ l: 25, p: 100 }, { l: 10, p: 140 }, { l: 5, p: 160 }, { l: 0, p: 180 }],
      'DTF UV impreso':             [{ l: 0, p: 300 }],
      'DTF Textil':                 [{ l: 0, p: 350 }],
    },
    'Corte de Vinil': {
      'Corte sencillo':             [{ l: 0, p: 50 }],
      'Corte a detalle':            [{ l: 0, p: 100 }],
      'Transfer (por metro)':       [{ l: 0, p: 30 }],
      'Depilado sencillo':          [{ l: 0, p: 30 }],
      'Depilado a detalle':         [{ l: 0, p: 50 }],
      'Textil - Corte sencillo':    [{ l: 0, p: 200 }],
      'Textil - Corte a detalle':   [{ l: 0, p: 300 }],
      'Planchado (por pieza)':      [{ l: 0, p: 25 }],
    },
    'Imprenta y Servicios': {
      'Tabloide impreso':           [{ l: 0, p: 10 }],
      'Volantes (millar)':          [{ l: 0, p: 650 }],
      'Tarjetas (millar)':          [{ l: 0, p: 450 }],
      'Bordado (millar puntadas)':  [{ l: 0, p: 5 }],
      'Diseño (por hora)':          [{ l: 0, p: 250 }],
    },
  };

  const categoriaIcons = {
    'Impresión Gran Formato': '🖨️',
    'Corte de Vinil': '✂️',
    'Imprenta y Servicios': '📋',
  };

  const getAnchosRolloExp = (sustrato) => {
    const s = sustrato?.toLowerCase() || '';
    if (s.includes('lona') || s.includes('microperforado')) return [{ val: '1.20', label: '1.20 m' }, { val: '2.50', label: '2.50 m' }, { val: '3.20', label: '3.20 m' }];
    if (s.includes('vinil')) return [{ val: '1.27', label: '1.27 m' }, { val: '1.52', label: '1.52 m' }];
    return [{ val: '1.20', label: '1.20 m' }];
  };

  useEffect(() => {
    if (servicioSel) {
      const a = getAnchosRolloExp(servicioSel);
      if (!a.find((x) => x.val === anchoRolloExp)) setAnchoRolloExp(a[0].val);
    }
  }, [servicioSel]);

  const getPrecioUnitario = (mat, qty) => {
    if (!mat) return 0;
    let escalas = null;
    for (const cat of Object.values(categorias)) {
      if (cat[mat]) { escalas = cat[mat]; break; }
    }
    if (!escalas) return 0;
    for (const esc of escalas) { if (qty >= esc.l) return esc.p; }
    return escalas[escalas.length - 1].p;
  };

  const getPrecioLabel = (mat) => {
    if (!mat) return '';
    let escalas = null;
    for (const cat of Object.values(categorias)) {
      if (cat[mat]) { escalas = cat[mat]; break; }
    }
    if (!escalas) return '';
    if (escalas.length === 1) return `$${escalas[0].p}`;
    const min = escalas[escalas.length - 1].p;
    const max = escalas[0].p;
    return `desde $${max}`;
  };

  const isUnitario = ['Tabloide', 'Planchado', 'Volantes', 'Tarjetas', 'Bordado', 'Diseño'].some((s) => servicioSel.includes(s));
  const isLineal   = ['DTF', 'Corte', 'Transfer', 'Depilado'].some((s) => servicioSel.includes(s)) && !isUnitario;

  // Límites dinámicos por tipo de servicio (Refinados para mejor sensibilidad)
  const getLimits = () => {
    if (servicioSel.includes('Diseño'))   return { min: 1,   max: 30,   step: 1 };
    if (servicioSel.includes('Volantes') || servicioSel.includes('Tarjetas') || servicioSel.includes('Bordado'))
                                          return { min: 1,   max: 20,   step: 1 };
    if (servicioSel.includes('Tabloide')) return { min: 1,   max: 1000, step: 1 }; // Reducido de 5000 a 1000 para sensibilidad
    if (servicioSel.includes('Planchado'))return { min: 1,   max: 500,  step: 1 }; // Reducido de 1000 a 500
    if (isUnitario)                       return { min: 1,   max: 1000, step: 1 };
    if (isLineal)                         return { min: 0.1, max: 100,  step: 0.1 }; // Reducido de 500 a 100 para sensibilidad
    return                                       { min: 0.1, max: 20,   step: 0.1 }; // Reducido de 50 a 20 para Ancho/Alto
  };

  const limits = getLimits();

  const w = parseFloat(ancho) || 0;
  const h = parseFloat(alto) || 0;
  const u = parseInt(unidades) || 1;
  let cant = 0, sufijo = 'm²', numLienzos = 1, areaLabel = 'Área Calculada';

  if (servicioSel) {
    if (isUnitario) {
      cant = u;
      sufijo = servicioSel.includes('Diseño') ? 'horas' : (servicioSel.includes('Volantes') || servicioSel.includes('Tarjetas') || servicioSel.includes('Bordado')) ? 'millares' : 'pzas';
      areaLabel = 'Cantidad Requerida';
    } else if (isLineal) {
      cant = Math.ceil(Math.max(w, h));
      sufijo = 'm';
      areaLabel = 'Metros Lineales';
    } else {
      const aRollo = parseFloat(anchoRolloExp);
      numLienzos = Math.ceil(w / aRollo);
      cant = Math.ceil(numLienzos * aRollo * h);
      sufijo = 'm²';
      areaLabel = 'Área Calculada';
    }
  }

  const pUnitario = getPrecioUnitario(servicioSel, cant);
  const total = cant * pUnitario;
  const cartTotal = Array.isArray(cart) ? cart.reduce((s, i) => s + i.total, 0) : 0;

  const agregarAlCarrito = () => {
    if (!servicioSel || cant === 0) return;
    setCart([...cart, {
      id: Date.now(),
      servicio: servicioSel,
      cant, sufijo, total,
      desc: isUnitario ? `${cant} ${sufijo}` : `${w}m × ${h}m`,
    }]);
    setServicioSel('');
    setAncho('1.0');
    setAlto('1.0');
    setUnidades('1');
  };

  const sliderStyles = `
    input[type=range] { -webkit-appearance: none; width: 100%; background: transparent; }
    input[type=range]:focus { outline: none; }
    input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 10px; cursor: pointer; background: linear-gradient(90deg, #06b6d4 0%, #3b82f6 100%); border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.1); }
    input[type=range]::-webkit-slider-thumb { height: 24px; width: 24px; border-radius: 50%; background: #ffffff; cursor: pointer; -webkit-appearance: none; margin-top: -8px; box-shadow: 0 0 15px rgba(255, 255, 255, 0.8), 0 0 5px rgba(0, 0, 0, 0.2); border: 2px solid #3b82f6; }
    input[type=range]::-moz-range-track { width: 100%; height: 10px; cursor: pointer; background: linear-gradient(90deg, #06b6d4 0%, #3b82f6 100%); border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.1); }
    input[type=range]::-moz-range-thumb { height: 24px; width: 24px; border-radius: 50%; background: #ffffff; cursor: pointer; box-shadow: 0 0 15px rgba(255, 255, 255, 0.8), 0 0 5px rgba(0, 0, 0, 0.2); border: 2px solid #3b82f6; }
  `;

  return (
    <div className="w-full h-full flex overflow-hidden animate-fade-in relative bg-black">
      <style>{sliderStyles}</style>
      
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px]" />
      </div>

      {/* ── PANEL IZQUIERDO ── */}
      <div className="w-[62%] flex flex-col bg-black/40 backdrop-blur-3xl overflow-y-auto relative border-r border-white/5 no-scrollbar">
        
        <div className="absolute top-0 right-0 w-32 h-full bg-white/[0.02] z-0"
          style={{ clipPath: 'polygon(70% 0, 100% 0, 100% 100%, 0% 100%)' }} />

        <div className="relative z-10 flex flex-col h-full px-12 pt-12 pb-8">

          <div className="mb-10 select-none">
            <h1 className="text-[4rem] font-black tracking-tighter uppercase leading-none text-white drop-shadow-2xl">NUESTROS</h1>
            <h1 className="text-[5rem] font-normal lowercase leading-none text-cyan-400 -mt-3 drop-shadow-[0_0_15px_rgba(34,211,238,0.4)]"
              style={{ fontFamily: "'Brush Script MT', 'Brush Script Std', 'Style Script', cursive" }}>
              Servicios
            </h1>
          </div>

          {/* Categorías Prominentes */}
          <div className="flex gap-4 mb-10 flex-wrap">
            {Object.keys(categorias).map((cat) => (
              <button
                key={cat}
                onClick={() => { setCategoriaActiva(cat); setServicioSel(''); }}
                className={`flex items-center gap-4 py-5 px-10 rounded-3xl text-sm font-black uppercase tracking-[0.2em] transition-all border backdrop-blur-md ${
                  categoriaActiva === cat
                    ? 'bg-white/10 text-white border-cyan-500/50 shadow-[0_0_25px_rgba(6,182,212,0.3)] scale-105'
                    : 'bg-white/5 text-gray-500 border-white/5 hover:border-white/20 hover:text-white'
                }`}
              >
                <span className="text-2xl">{categoriaIcons[cat]}</span> {cat}
              </button>
            ))}
          </div>

          {/* Grid Compacto de Servicios */}
          <div className="grid grid-cols-3 gap-4 mb-10">
            {Object.entries(categorias[categoriaActiva]).map(([serv, escalas]) => (
              <div
                key={serv}
                onClick={() => setServicioSel(serv)}
                className={`group p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between gap-2 backdrop-blur-xl relative overflow-hidden ${
                  servicioSel === serv
                    ? 'border-cyan-500/40 bg-cyan-500/10 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
                    : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/5'
                }`}
              >
                <p className={`font-black text-xs uppercase tracking-tight leading-snug ${
                  servicioSel === serv ? 'text-white' : 'text-gray-300 group-hover:text-white'
                }`}>
                  {serv}
                </p>
                <p className={`text-[10px] font-bold tracking-[0.15em] ${
                  servicioSel === serv ? 'text-cyan-400' : 'text-gray-500 group-hover:text-gray-400'
                }`}>
                  {getPrecioLabel(serv)}
                </p>
              </div>
            ))}
          </div>

          {/* Panel de entrada (Panel de Control Dinámico Glassmorphism Optimizado) */}
          {servicioSel && (
            <div className="mt-4 w-1/2 animate-slide-up">
              <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] border border-white/10 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.5)] p-8 min-h-[450px] flex flex-col relative overflow-hidden">
                {/* Reflejo superior sutil */}
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
                
                <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                      <span className="text-xl animate-pulse">⚙️</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400">Ajuste Dinámico</p>
                      <h3 className="text-xl font-black uppercase tracking-tight text-white leading-none">{servicioSel}</h3>
                    </div>
                  </div>
                  <button
                    onClick={() => { setServicioSel(''); setAncho('1.0'); setAlto('1.0'); setUnidades('1'); }}
                    className="px-4 py-1.5 rounded-full bg-white/5 border border-white/5 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all"
                  >
                    ✕ Limpiar
                  </button>
                </div>

                <div className="flex-1 flex flex-col gap-10">
                  {/* Área de Sliders e Inputs (Layout Vertical Optimizado) */}
                  <div className="flex flex-col gap-8">
                    {isUnitario ? (
                      <div className="bg-black/20 rounded-2xl p-8 border border-white/5 group transition-all hover:border-cyan-500/30">
                        <div className="flex justify-between items-center mb-6">
                          <label className="text-[12px] font-black text-gray-400 uppercase tracking-[0.2em]">Cantidad Requerida</label>
                          <div className="relative">
                            <input 
                              type="number" value={unidades} onChange={(e) => setUnidades(Math.min(limits.max, Math.max(limits.min, e.target.value)))}
                              className="w-32 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-right font-black text-white text-2xl outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all shadow-inner"
                            />
                            <span className="absolute -bottom-5 right-0 text-[10px] font-bold text-gray-600 uppercase tracking-widest">{sufijo}</span>
                          </div>
                        </div>
                        <div className="pt-4">
                          <input type="range" min={limits.min} max={limits.max} step={limits.step} value={unidades} onChange={(e) => setUnidades(e.target.value)} className="cursor-pointer h-2" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-6">
                        {/* Control Ancho */}
                        <div className="bg-black/20 rounded-2xl p-8 border border-white/5 group transition-all hover:border-cyan-500/30">
                          <div className="flex justify-between items-center mb-6">
                            <label className="text-[12px] font-black text-gray-400 uppercase tracking-[0.2em]">Ancho (m)</label>
                            <input 
                              type="number" step={limits.step} value={ancho} onChange={(e) => setAncho(Math.min(limits.max, Math.max(limits.min, e.target.value)))}
                              className="w-24 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-right font-black text-white text-xl outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all shadow-inner"
                            />
                          </div>
                          <div className="pt-2">
                            <input type="range" min={limits.min} max={limits.max} step={limits.step} value={ancho} onChange={(e) => setAncho(e.target.value)} className="cursor-pointer h-2" />
                          </div>
                        </div>
                        
                        {/* Control Alto */}
                        <div className="bg-black/20 rounded-2xl p-8 border border-white/5 group transition-all hover:border-cyan-500/30">
                          <div className="flex justify-between items-center mb-6">
                            <label className="text-[12px] font-black text-gray-400 uppercase tracking-[0.2em]">Alto (m)</label>
                            <input 
                              type="number" step={limits.step} value={alto} onChange={(e) => setAlto(Math.min(limits.max, Math.max(limits.min, e.target.value)))}
                              className="w-24 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-right font-black text-white text-xl outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all shadow-inner"
                            />
                          </div>
                          <div className="pt-2">
                            <input type="range" min={limits.min} max={limits.max} step={limits.step} value={alto} onChange={(e) => setAlto(e.target.value)} className="cursor-pointer h-2" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Área de Selección de Material (Abajo en este nuevo layout) */}
                  {!isLineal && !isUnitario && (
                    <div className="mt-auto">
                      <div className="bg-black/20 rounded-2xl p-8 border border-white/5">
                        <label className="text-[12px] font-black text-gray-400 uppercase tracking-[0.2em] block mb-6 leading-none">Formato Material</label>
                        <div className="flex gap-3">
                          {getAnchosRolloExp(servicioSel).map((a) => (
                            <button
                              key={a.val} onClick={() => setAnchoRolloExp(a.val)}
                              className={`group flex-1 py-4 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border flex justify-between items-center ${
                                anchoRolloExp === a.val 
                                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 border-cyan-500/50 text-white shadow-[0_0_15px_rgba(6,182,212,0.1)]' 
                                  : 'bg-white/5 text-gray-500 border-white/5 hover:border-white/10 hover:text-gray-300'
                              }`}
                            >
                              <span>{a.label}</span>
                              <div className={`w-2 h-2 rounded-full transition-all ${anchoRolloExp === a.val ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-gray-800'}`} />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── PANEL DERECHO ── */}
      <div className={`flex-1 flex flex-col overflow-y-auto relative ${isDarkMode ? 'bg-black/60' : 'bg-white'}`}>
        <div className="relative z-10 flex flex-col h-full px-12 pt-12 pb-8 backdrop-blur-2xl">

          <div className="pb-8 mb-8 border-b border-white/10">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] mb-2 text-cyan-400/80">Live Engine v2.1</p>
            <h2 className="text-3xl font-black uppercase tracking-tighter text-white">Inversión Estimada</h2>
          </div>

          <div className="flex flex-col gap-3 mb-8">
            <div className="flex justify-between items-center p-5 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-md">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">{areaLabel || 'Área Calculada'}</span>
              <span className="font-black text-lg text-white">{cant > 0 ? `${cant} ${sufijo}` : '—'}</span>
            </div>
            <div className="flex justify-between items-center p-5 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-md">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Tarifa Base</span>
              <span className="font-black text-lg text-cyan-400">{pUnitario > 0 ? `$${pUnitario} / ${sufijo}` : '—'}</span>
            </div>
          </div>

          <div className="p-8 mb-8 rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-3 text-gray-400">Subtotal del Servicio</p>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-cyan-500">$</span>
              <p className="font-black tracking-tighter leading-none text-white text-6xl">
                {total > 0 ? total.toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '0.00'}
              </p>
            </div>
            
            <button
              onClick={agregarAlCarrito}
              disabled={!servicioSel || cant === 0}
              className={`mt-8 w-full py-5 rounded-full font-black uppercase text-[10px] tracking-[0.25em] transition-all duration-500 flex items-center justify-center gap-3 ${
                !servicioSel || cant === 0
                  ? 'bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_10px_30px_rgba(6,182,212,0.3)] hover:shadow-[0_15px_40px_rgba(6,182,212,0.5)] hover:scale-[1.02] active:scale-95'
              }`}
            >
              <span>+</span> Añadir a Cotización
            </button>
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col gap-3 mb-8 pr-2 custom-scrollbar">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-10">
                <span className="text-3xl mb-3">🛒</span>
                <p className="text-[9px] font-black uppercase tracking-widest">Lista vacía</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="flex justify-between items-center p-5 rounded-2xl border border-white/5 bg-white/[0.01] backdrop-blur-md hover:bg-white/[0.03] transition-all group">
                  <div>
                    <p className="font-black text-xs uppercase tracking-tight text-white group-hover:text-cyan-400 transition-colors">{item.servicio}</p>
                    <p className="text-[9px] font-bold mt-1 text-gray-600 tracking-widest">{item.desc}</p>
                  </div>
                  <div className="flex items-center gap-5">
                    <p className="font-black text-base text-green-400">${item.total.toLocaleString()}</p>
                    <button onClick={() => setCart(cart.filter((c) => c.id !== item.id))} className="w-7 h-7 rounded-full flex items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all text-lg font-light">×</button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-auto pt-8 border-t border-white/10">
            <div className="flex justify-between items-end mb-8">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] mb-1 text-gray-500">Total Final</p>
                <p className="font-black tracking-tighter text-white text-5xl">${cartTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
            
            <button
              onClick={() => handleGenerarExpress(cart)}
              disabled={cart.length === 0}
              className={`w-full py-6 rounded-full font-black uppercase tracking-[0.3em] text-xs transition-all duration-500 ${
                cart.length === 0 ? 'bg-white/5 text-gray-700 border border-white/5 cursor-not-allowed' : 'bg-white text-black hover:bg-cyan-400 hover:text-black hover:scale-[1.02] active:scale-95 shadow-[0_15px_40px_rgba(255,255,255,0.05)]'
              }`}
            >
              🚀 Generar Cotización PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
