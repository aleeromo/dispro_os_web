import React from 'react';

export function ErrorToast({ isDarkMode, errorMsg, setErrorMsg, onReiniciar }) {
  if (!errorMsg) return null;
  const isSessionExpired = /sesión expiró|expiró o no es válida/i.test(errorMsg);
  return (
    <div className={`absolute top-10 left-1/2 -translate-x-1/2 z-[1000] px-8 py-4 rounded-xl shadow-2xl font-bold flex items-center gap-4 animate-slide-down border-2 border-red-600 backdrop-blur-md ${isDarkMode ? 'bg-[#14151c]/90 text-white' : 'bg-black/90 text-white'}`}>
      <span className="text-2xl text-red-500">⚠️</span>
      {errorMsg}
      {isSessionExpired && onReiniciar && (
        <button
          onClick={() => { onReiniciar(); setErrorMsg(null); }}
          className="ml-2 border border-white/50 px-4 py-1 hover:bg-white hover:text-black uppercase text-[10px] rounded-lg"
        >
          Reiniciar
        </button>
      )}
      <button
        onClick={() => setErrorMsg(null)}
        className="ml-2 border border-white/50 px-4 py-1 hover:bg-white hover:text-black uppercase text-[10px] rounded-lg"
      >
        Cerrar
      </button>
    </div>
  );
}
