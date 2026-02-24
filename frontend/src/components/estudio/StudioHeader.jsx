import React from 'react';

export function StudioHeader({ isDarkMode, tabsDisponibles, activeTab, setActiveTab }) {
  return (
    <header className="flex justify-end items-center p-8 pb-0 mb-6 min-h-[40px] z-20">
      <div className={`flex gap-2 p-1.5 rounded-2xl border backdrop-blur-2xl transition-all ${isDarkMode ? 'border-white/10 bg-black/40 shadow-2xl' : 'border-black/10 bg-white/80'}`}>
        {tabsDisponibles.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-6 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 rounded-xl ${
              activeTab === t
                ? (isDarkMode ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-black text-white')
                : `text-gray-500 hover:${isDarkMode ? 'text-white hover:bg-white/5' : 'text-black hover:bg-black/5'}`
            }`}
          >
            {t === 'render' ? 'Renderizado' : t === 'planos' ? 'Planos' : t}
          </button>
        ))}
      </div>
    </header>
  );
}
