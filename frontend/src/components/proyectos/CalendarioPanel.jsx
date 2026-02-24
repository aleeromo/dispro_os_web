import React from 'react';

export function CalendarioPanel({ isDarkMode }) {
  return (
    <div className="h-1/2 w-full p-8 flex flex-col relative">
      <div className={`flex-1 rounded-[3rem] border backdrop-blur-3xl p-10 flex flex-col shadow-2xl relative overflow-hidden ${isDarkMode ? 'bg-white/[0.03] border-white/10' : 'bg-white border-black/10'}`}>
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

        <div className="flex justify-between items-center mb-8">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400 mb-1">Agenda de Instalaciones</p>
            <h3 className="text-4xl font-black uppercase tracking-tighter text-white">Calendario Operativo</h3>
          </div>
          <div className="flex gap-4">
            <span className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              {new Date().toLocaleString('es-MX', { month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-7 gap-3">
          {['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map((d) => (
            <div key={d} className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 pb-2 border-b border-white/5">{d}</div>
          ))}
          {Array.from({ length: 35 }).map((_, i) => {
            const day = i - 2;
            const isToday  = day === new Date().getDate();
            const hasProject = day === 18 || day === 22;
            return (
              <div
                key={i}
                onClick={() => { if (day > 0 && day <= 31) prompt(`Nueva Orden de Trabajo para el día ${day}:`); }}
                className={`relative group rounded-2xl border transition-all duration-300 flex flex-col p-3 cursor-pointer ${
                  day > 0 && day <= 31
                    ? (isToday
                      ? 'bg-cyan-500/20 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/10 hover:border-white/20')
                    : 'opacity-0 pointer-events-none'
                }`}
              >
                {day > 0 && day <= 31 && (
                  <>
                    <span className={`text-sm font-black ${isToday ? 'text-cyan-400' : 'text-gray-500 group-hover:text-white'}`}>{day}</span>
                    {hasProject && (
                      <div className="mt-auto flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      </div>
                    )}
                    {isToday && <span className="absolute top-2 right-2 text-[8px] font-black text-cyan-400 uppercase tracking-widest">Hoy</span>}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
