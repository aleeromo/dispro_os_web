import React from 'react';
import logoImg from '../assets/logo.png';

export function AppSidebar({ isDarkMode, setIsDarkMode, currentView, setCurrentView, showConfig, setShowConfig, handleHomeClick }) {
  return (
    <aside className={`w-72 bg-black/40 backdrop-blur-3xl border-r flex flex-col pt-12 pb-6 z-[1000] shadow-2xl text-white transition-all ${isDarkMode ? 'border-white/5' : 'border-white'}`}>
      <div
        className="w-full flex justify-start px-10 mb-12 cursor-pointer hover:scale-105 transition-transform"
        onClick={handleHomeClick}
      >
        <img src={logoImg} className="h-48 w-auto object-contain transition-all" alt="Dispro" onError={(e) => (e.target.style.display = 'none')} />
      </div>

      <nav className="w-full flex flex-col gap-4 px-6 flex-1">
        {[
          { view: 'estudio',   label: 'DisproIA'  },
          { view: 'cotizador', label: 'Servicios' },
          { view: 'proyectos', label: 'Proyectos' },
          { view: 'letras3d',  label: 'Letras 3D' },
        ].map(({ view, label }) => (
          <button
            key={view}
            onClick={() => setCurrentView(view)}
            className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all ${
              currentView === view
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                : 'text-gray-400 hover:text-white hover:bg-white/5 font-bold border border-transparent'
            }`}
          >
            <span className="text-xs tracking-widest uppercase">{label}</span>
          </button>
        ))}

        <button
          disabled
          className="flex items-center gap-4 px-6 py-4 mt-2 rounded-2xl opacity-30 cursor-not-allowed border border-dashed border-gray-800 transition-all"
        >
          <span className="text-xs tracking-widest uppercase text-gray-500">Levantamientos</span>
          <span className="text-[8px] bg-gray-900 px-2 py-1 rounded ml-auto">PRONTO</span>
        </button>

        <div className="mt-auto border-t border-dashed border-white/10 pt-6 px-2 flex flex-col gap-2">
          <div className="flex flex-col">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="flex items-center justify-between px-4 py-3 rounded-xl transition-all text-gray-400 hover:text-white hover:bg-white/5"
            >
              <span className="text-xs font-bold tracking-widest uppercase">⚙️ Configuración</span>
              <span className="text-[10px]">{showConfig ? '▲' : '▼'}</span>
            </button>
            {showConfig && (
              <div className="flex flex-col gap-1 px-8 py-2 animate-slide-down">
                <button className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-white py-2 transition-colors">👤 Perfil</button>
                <button
                  onClick={() => { setCurrentView('baseDatos'); setShowConfig(false); }}
                  className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-white py-2 transition-colors"
                >
                  🗄️ Base de Datos
                </button>
                <button className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-white py-2 transition-colors">🛠️ Opciones</button>
              </div>
            )}
          </div>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="flex items-center gap-4 px-4 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 font-bold transition-all"
          >
            <span className="text-lg">{isDarkMode ? '☀️' : '🌙'}</span>
            <span className="text-xs tracking-widest uppercase">Modo {isDarkMode ? 'Claro' : 'Oscuro'}</span>
          </button>
        </div>
      </nav>
    </aside>
  );
}
