import React from 'react';

export function PrintRollModal({ isDarkMode, tempAncho, setTempAncho, printDPI, imgData, confirmarMedidaPrint }) {
  return (
    <div className="absolute inset-0 z-[999] bg-black/60 flex items-center justify-center animate-fade-in backdrop-blur-md">
      <div className={`relative ${isDarkMode ? 'bg-[#0a0a0c]/80 backdrop-blur-3xl border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.8)]' : 'bg-white/80 backdrop-blur-2xl border-black/20 shadow-2xl'} p-12 rounded-[3rem] border flex flex-col gap-10 w-[520px] overflow-hidden`}>
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-60" />

        <div className="text-center relative">
          <p className="text-[10px] font-black tracking-[0.5em] text-cyan-400 mb-2 uppercase">Configuración de Salida</p>
          <h3 className={`font-black tracking-tighter uppercase text-4xl ${isDarkMode ? 'text-white' : 'text-black'}`}>Formato de Rollo</h3>
          <div className="mt-4 w-12 h-1 bg-cyan-500 mx-auto rounded-full shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
        </div>

        <div className="flex flex-col gap-4 bg-black/20 p-8 rounded-[2rem] border border-white/5 group transition-all hover:border-cyan-500/30">
          <p className="text-[10px] text-gray-500 text-center font-black tracking-[0.2em] uppercase">Ancho Físico Real (m)</p>
          <div className="relative flex justify-center items-center">
            <input
              type="number"
              step="0.01"
              value={tempAncho}
              onChange={(e) => setTempAncho(e.target.value)}
              className={`w-full text-center text-7xl font-black outline-none bg-transparent transition-all ${isDarkMode ? 'text-white focus:text-cyan-400' : 'text-black focus:text-blue-600'}`}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && confirmarMedidaPrint()}
            />
            <span className="absolute right-4 bottom-2 text-cyan-500 font-black text-2xl opacity-40">m</span>
          </div>
          <div className="w-full h-[1px] bg-white/10 mt-2 group-focus-within:bg-cyan-500/50 transition-colors" />
        </div>

        <div className={`p-8 rounded-[2rem] flex flex-col items-center gap-4 border shadow-inner relative overflow-hidden ${isDarkMode ? 'bg-black/40 border-white/5' : 'bg-gray-100 border-gray-300'}`}>
          <div className={`absolute left-0 top-0 w-1.5 h-full ${printDPI.dpi < 72 ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)]' : 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.8)]'}`} />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Análisis de Densidad (DPI)</span>
          <div className="flex flex-col items-center">
            <span className={`text-2xl font-black uppercase tracking-tighter drop-shadow-md ${printDPI.color}`}>{printDPI.dpi} DPI</span>
            <span className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${printDPI.color} opacity-80`}>{printDPI.status}</span>
          </div>
          <div className="flex gap-4 mt-2">
            <span className="text-[9px] font-mono text-gray-600 bg-white/5 px-3 py-1 rounded-full border border-white/5">{imgData.wPx}w px</span>
            <span className="text-[9px] font-mono text-gray-600 bg-white/5 px-3 py-1 rounded-full border border-white/5">{imgData.hPx}h px</span>
          </div>
        </div>

        <button
          onClick={confirmarMedidaPrint}
          className="group relative overflow-hidden w-full py-6 font-black tracking-[0.3em] uppercase text-xs rounded-2xl transition-all duration-500 bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_15px_35px_rgba(6,182,212,0.3)] hover:shadow-[0_20px_50px_rgba(6,182,212,0.5)] hover:scale-[1.02] active:scale-95"
        >
          <span className="relative z-10">Continuar al Estudio 🚀</span>
          <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
        </button>
      </div>
    </div>
  );
}
