import React from 'react';

const FASES = ['Levantamiento', 'Diseño', 'Producción', 'Colocación', 'Cobro'];

export function KanbanPanel({ isDarkMode, savedProjects }) {
  return (
    <div className={`w-1/4 rounded-[2.5rem] border backdrop-blur-2xl p-8 flex flex-col relative overflow-hidden ${isDarkMode ? 'bg-white/[0.02] border-white/5 shadow-2xl' : 'bg-white border-black/10'}`}>
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
      <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400/60 mb-8 flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
        Pipeline Operativo
      </h4>
      <div className="flex-1 flex flex-col gap-6 overflow-y-auto no-scrollbar">
        {FASES.map((fase, idx) => {
          const projs      = savedProjects.filter((p) => (p.progreso || 1) === idx + 1);
          const percentage = (projs.length / Math.max(1, savedProjects.length)) * 100;
          return (
            <div key={fase} className="group cursor-default">
              <div className="flex justify-between items-end mb-3">
                <div>
                  <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">{idx + 1}. Fase</p>
                  <span className="text-[11px] font-black uppercase tracking-tighter text-white group-hover:text-cyan-400 transition-colors">{fase}</span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-white leading-none">{projs.length}</span>
                  <p className="text-[8px] font-bold text-gray-600 uppercase">Proyectos</p>
                </div>
              </div>
              <div className="w-full h-2.5 rounded-full bg-black/40 border border-white/5 p-0.5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-500 shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all duration-1000 ease-out relative"
                  style={{ width: `${percentage}%` }}
                >
                  <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:20px_20px] animate-[shimmer_2s_linear_infinite]" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
