import React from 'react';

export function ProyectoDetalle({ isDarkMode, selectedProject, handleEditProject, handleImprimir, enviarWhatsAppProyecto, updateProjectProgress }) {
  return (
    <div className={`w-[35%] rounded-[2.5rem] border backdrop-blur-3xl p-8 flex flex-col relative overflow-hidden ${isDarkMode ? 'bg-white/[0.04] border-white/10 shadow-2xl' : 'bg-white border-black/10'}`}>
      {selectedProject ? (
        <div className="flex flex-col h-full animate-fade-in">
          <div className="mb-6">
            <h2 className="text-2xl font-black uppercase tracking-tighter text-white leading-none mb-2">{selectedProject.nombre}</h2>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{selectedProject.cliente} • {selectedProject.fecha}</p>
          </div>

          <div className="p-6 rounded-3xl bg-white/5 border border-white/10 mb-6">
            <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.3em] mb-1">Inversión Total</p>
            <p className="text-4xl font-black text-green-400 tracking-tighter">{selectedProject.total}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-8">
            <button
              onClick={() => handleEditProject(selectedProject)}
              className="py-4 rounded-2xl bg-white text-black font-black uppercase text-[9px] tracking-widest hover:bg-cyan-400 transition-all"
            >
              ✏️ Editar
            </button>
            <button
              onClick={() => handleImprimir(false)}
              className="py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black uppercase text-[9px] tracking-widest hover:bg-white/10 transition-all"
            >
              🖨️ PDF
            </button>
            <button
              onClick={() => enviarWhatsAppProyecto(false)}
              className="col-span-2 py-4 rounded-2xl bg-[#25D366] text-white font-black uppercase text-[9px] tracking-widest hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
            >
              💬 Enviar WhatsApp
            </button>
          </div>

          <div className="mt-auto">
            <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.3em] mb-6 text-center">Progreso Operativo</p>
            <div className="flex justify-between relative px-2">
              <div className="absolute top-4 left-4 right-4 h-0.5 bg-white/10" />
              {[1, 2, 3, 4, 5].map((step) => {
                const isPast   = step <= (selectedProject.progreso || 1);
                const isActive = step === (selectedProject.progreso || 1);
                return (
                  <div
                    key={step}
                    className="relative z-10 flex flex-col items-center gap-2 cursor-pointer"
                    onClick={() => updateProjectProgress(selectedProject.id, step)}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs transition-all ${isActive ? 'bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.6)] scale-125' : (isPast ? 'bg-cyan-900/50 text-cyan-400 border border-cyan-500/50' : 'bg-white/5 text-gray-600 border border-white/10')}`}>
                      {isPast && !isActive ? '✓' : step}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="h-full flex flex-col items-center justify-center opacity-20">
          <span className="text-6xl mb-4">📁</span>
          <p className="text-[10px] font-black uppercase tracking-[0.4em]">Seleccione Proyecto</p>
        </div>
      )}
    </div>
  );
}
