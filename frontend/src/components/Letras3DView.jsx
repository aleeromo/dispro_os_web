import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../constants/api.js';

const TIPOS_PIEZA = [{ value: 'rect', label: 'Rectángulo' }, { value: 'texto', label: 'Texto' }, { value: 'elipse', label: 'Elipse' }];

export function Letras3DView({ isDarkMode, onAbrirEnEstudio }) {
  const [piezas, setPiezas] = useState([{ tipo: 'rect', ancho_m: 0.5, alto_m: 0.3 }]);
  const [materialCara, setMaterialCara] = useState('Acrílico');
  const [materialCanto, setMaterialCanto] = useState('Aluminio');
  const [aluminioTipo, setAluminioTipo] = useState('Plata');
  const [profCanto, setProfCanto] = useState(0.06);
  const [conLuz, setConLuz] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resultado, setResultado] = useState(null);

  const agregarPieza = () => {
    setPiezas([...piezas, { tipo: 'rect', ancho_m: 0.5, alto_m: 0.3 }]);
  };

  const quitarPieza = (i) => {
    if (piezas.length <= 1) return;
    setPiezas(piezas.filter((_, idx) => idx !== i));
  };

  const actualizarPieza = (i, field, value) => {
    setPiezas(piezas.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  };

  const cotizar = async () => {
    const payload = {
      piezas: piezas.map((p) => ({ tipo: p.tipo, ancho_m: parseFloat(p.ancho_m) || 0.5, alto_m: parseFloat(p.alto_m) || 0.3, prof_canto_m: parseFloat(profCanto) || 0.06 })),
      material_cara: materialCara,
      material_canto: materialCanto,
      aluminio_tipo: aluminioTipo,
      prof_canto: parseFloat(profCanto) || 0.06,
      con_luz: conLuz
    };
    setError(null);
    setLoading(true);
    try {
      const { data } = await axios.post(`${API_BASE}/api/v1/cotizar_letras_3d`, payload);
      setResultado(data);
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al cotizar.');
    } finally {
      setLoading(false);
    }
  };

  const abrirEnEstudio = () => {
    if (resultado && onAbrirEnEstudio) onAbrirEnEstudio(resultado);
  };

  const inputCls = `w-full rounded-xl p-3 text-sm font-bold outline-none border transition-all ${isDarkMode ? 'bg-black/30 border-white/10 text-white' : 'bg-black/5 border-black/10 text-black'}`;
  const labelCls = `text-[10px] font-black tracking-[0.2em] uppercase block mb-2 ${isDarkMode ? 'text-cyan-400/90' : 'text-gray-500'}`;

  return (
    <div className={`absolute inset-0 flex flex-col p-8 overflow-y-auto animate-fade-in ${isDarkMode ? 'bg-[#0a0a0c]' : 'bg-gray-100'}`}>
      <div className={`max-w-4xl mx-auto w-full flex flex-col relative ${isDarkMode ? 'bg-white/[0.03] border border-white/10 backdrop-blur-2xl shadow-2xl' : 'bg-white/90 border border-black/10 backdrop-blur-md shadow-lg'} rounded-[2rem] overflow-hidden`}>
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
        <div className="p-10">
          <p className={`text-[10px] font-black tracking-[0.5em] uppercase mb-1 ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>Motor 3D</p>
          <h1 className={`text-3xl font-black uppercase tracking-tighter mb-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>Letras 3D</h1>
          <p className={`text-sm mb-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Define texto o formas con medidas específicas y cotiza como letras 3D (sin subir imagen).</p>

          <div className="space-y-6 mb-8">
            <div className="flex justify-between items-center">
              <h2 className={`text-[10px] font-black tracking-[0.2em] uppercase ${isDarkMode ? 'text-cyan-400/90' : 'text-gray-500'}`}>Piezas</h2>
              <button type="button" onClick={agregarPieza} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-black text-white hover:bg-gray-800'}`}>+ Añadir pieza</button>
            </div>
            {piezas.map((p, i) => (
              <div key={i} className={`flex flex-wrap items-center gap-4 p-4 rounded-2xl border ${isDarkMode ? 'bg-black/30 border-white/10' : 'bg-black/5 border-black/10'}`}>
                <select value={p.tipo} onChange={(e) => actualizarPieza(i, 'tipo', e.target.value)} className={`flex-1 min-w-[120px] ${inputCls}`}>
                  {TIPOS_PIEZA.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <label className={`flex items-center gap-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  <span className="text-[10px] font-black uppercase tracking-widest">Ancho (m)</span>
                  <input type="number" step="0.01" min="0.01" value={p.ancho_m} onChange={(e) => actualizarPieza(i, 'ancho_m', e.target.value)} className={`w-24 ${inputCls}`} />
                </label>
                <label className={`flex items-center gap-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  <span className="text-[10px] font-black uppercase tracking-widest">Alto (m)</span>
                  <input type="number" step="0.01" min="0.01" value={p.alto_m} onChange={(e) => actualizarPieza(i, 'alto_m', e.target.value)} className={`w-24 ${inputCls}`} />
                </label>
                <button type="button" onClick={() => quitarPieza(i)} disabled={piezas.length <= 1} className="text-red-500 hover:text-red-400 font-bold text-xs uppercase tracking-widest disabled:opacity-30">Quitar</button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <div>
              <label className={labelCls}>Material frontal</label>
              <select value={materialCara} onChange={(e) => setMaterialCara(e.target.value)} className={inputCls}>
                <option value="Acrílico">Acrílico</option>
                <option value="Aluminio">Aluminio</option>
              </select>
            </div>
            {materialCara === 'Aluminio' && (
              <div>
                <label className={labelCls}>Tipo aluminio</label>
                <select value={aluminioTipo} onChange={(e) => setAluminioTipo(e.target.value)} className={inputCls}>
                  <option value="Plata">Plata</option>
                  <option value="Dorado">Dorado</option>
                  <option value="Rosa">Rosa</option>
                  <option value="Mate">Mate</option>
                </select>
              </div>
            )}
            <div>
              <label className={labelCls}>Canto</label>
              <select value={materialCanto} onChange={(e) => setMaterialCanto(e.target.value)} className={inputCls}>
                <option value="Aluminio">Aluminio</option>
                <option value="Aluminio Negro">Aluminio Negro</option>
                <option value="Aluminio Dorado">Aluminio Dorado</option>
                <option value="Acrílico">Acrílico</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Grosor canto (m)</label>
              <input type="number" step="0.01" value={profCanto} onChange={(e) => setProfCanto(parseFloat(e.target.value) || 0.06)} className={inputCls} />
            </div>
            <label className={`flex items-center gap-3 cursor-pointer col-span-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>
              <input type="checkbox" checked={conLuz} onChange={(e) => setConLuz(e.target.checked)} className="w-5 h-5 accent-cyan-500" />
              <span className="font-black text-sm uppercase tracking-widest">Iluminación LED</span>
            </label>
          </div>

          {error && <p className="text-red-500 font-bold mb-4 text-sm">{error}</p>}

          <button type="button" onClick={cotizar} disabled={loading} className={`w-full py-5 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all disabled:opacity-50 ${isDarkMode ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]' : 'bg-black text-white hover:bg-gray-800'}`}>
            {loading ? 'Calculando...' : 'Cotizar Letras 3D'}
          </button>

          {resultado && (
            <div className={`mt-10 p-8 rounded-2xl border ${isDarkMode ? 'bg-black/40 border-cyan-500/30' : 'bg-black/5 border-cyan-600/20'}`}>
              <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-cyan-400/90' : 'text-gray-500'}`}>Total</p>
              <p className={`text-4xl font-black mb-6 ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>${resultado.total_venta?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
              <button type="button" onClick={abrirEnEstudio} className={`w-full py-4 text-[10px] font-black uppercase tracking-widest rounded-xl border-2 transition-all ${isDarkMode ? 'border-cyan-500 text-cyan-400 hover:bg-cyan-500 hover:text-black' : 'border-cyan-600 text-cyan-600 hover:bg-cyan-600 hover:text-white'}`}>
                Abrir en Estudio (planos y PDF)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
