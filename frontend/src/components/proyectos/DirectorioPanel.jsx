import React from 'react';

export function DirectorioPanel({ isDarkMode, clientesList, clientesMap, activeClientFolder, setActiveClientFolder, selectedProject, setSelectedProject }) {
  return (
    <div className={`flex-1 rounded-[2.5rem] border backdrop-blur-2xl p-0 flex overflow-hidden ${isDarkMode ? 'bg-white/[0.02] border-white/5 shadow-2xl' : 'bg-white border-black/10'}`}>

      {/* Lista de clientes */}
      <div className="w-1/3 border-r border-white/5 flex flex-col bg-black/20">
        <div className="p-8 border-b border-white/5">
          <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500">Directorio</h4>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 flex flex-col gap-2">
          {clientesList.map((c) => (
            <div
              key={c}
              onClick={() => { setActiveClientFolder(c); setSelectedProject(null); }}
              className={`group p-5 rounded-2xl cursor-pointer transition-all duration-300 border flex items-center justify-between ${
                activeClientFolder === c
                  ? 'bg-gradient-to-r from-cyan-500/10 to-blue-600/10 border-cyan-500/40 text-white shadow-lg'
                  : 'bg-transparent border-transparent text-gray-500 hover:bg-white/5 hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all duration-500 ${activeClientFolder === c ? 'bg-cyan-500 text-black scale-110 shadow-[0_0_15px_rgba(6,182,212,0.5)]' : 'bg-white/5 text-gray-600 group-hover:text-gray-300'}`}>
                  {activeClientFolder === c ? '📂' : '📁'}
                </div>
                <div>
                  <p className="font-black text-xs uppercase tracking-tight">{c}</p>
                  <p className="text-[8px] font-bold tracking-[0.2em] mt-0.5 opacity-50">{clientesMap[c].length} EXPEDIENTES</p>
                </div>
              </div>
              <span className={`text-lg transition-all duration-300 ${activeClientFolder === c ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`}>›</span>
            </div>
          ))}
        </div>
      </div>

      {/* Proyectos del cliente seleccionado */}
      <div className="flex-1 flex flex-col bg-black/10">
        <div className="p-8 border-b border-white/5 flex justify-between items-center">
          <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500">
            {activeClientFolder ? `Proyectos: ${activeClientFolder}` : 'Seleccione un Cliente'}
          </h4>
          {activeClientFolder && (
            <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[8px] font-black text-cyan-400 uppercase tracking-widest">
              {clientesMap[activeClientFolder].length} Total
            </span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar p-8">
          <div className="grid grid-cols-2 gap-6">
            {activeClientFolder && clientesMap[activeClientFolder].map((p) => (
              <div
                key={p.id}
                onClick={() => setSelectedProject(p)}
                className={`group p-6 rounded-[2.5rem] border-2 cursor-pointer transition-all duration-500 relative overflow-hidden flex flex-col justify-between min-h-[140px] ${
                  selectedProject?.id === p.id
                    ? 'border-cyan-500/50 bg-cyan-500/10 shadow-[0_0_30px_rgba(6,182,212,0.15)] scale-[1.02]'
                    : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/5 hover:scale-[1.01]'
                }`}
              >
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex justify-between items-start">
                  <div className="max-w-[70%]">
                    <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Nombre del Proyecto</p>
                    <p className="font-black text-sm uppercase tracking-tight text-white leading-tight group-hover:text-cyan-400 transition-colors">{p.nombre}</p>
                  </div>
                  <span className="text-[9px] font-black px-3 py-1.5 rounded-xl bg-black/40 border border-white/5 text-cyan-400 shadow-inner">{p.folio}</span>
                </div>
                <div className="flex justify-between items-end mt-4">
                  <div>
                    <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-0.5">Inversión</p>
                    <p className="text-2xl font-black text-green-400 tracking-tighter">{p.total}</p>
                  </div>
                  <div className="flex -space-x-2">
                    <div className="w-6 h-6 rounded-full border-2 border-black bg-gray-800 flex items-center justify-center text-[8px] font-bold text-white">AI</div>
                    <div className="w-6 h-6 rounded-full border-2 border-black bg-cyan-600 flex items-center justify-center text-[8px] font-bold text-white">✓</div>
                  </div>
                </div>
              </div>
            ))}
            {!activeClientFolder && (
              <div className="col-span-2 h-64 flex flex-col items-center justify-center opacity-10 grayscale">
                <span className="text-8xl mb-4">📂</span>
                <p className="text-xs font-black uppercase tracking-[0.5em]">Esperando Selección</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
