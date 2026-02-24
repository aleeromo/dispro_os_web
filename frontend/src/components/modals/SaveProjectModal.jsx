import React from 'react';

export function SaveProjectModal({ isDarkMode, saveCliente, setSaveCliente, saveNombre, setSaveNombre, concretarGuardado, setShowSaveModal }) {
  return (
    <div className="absolute inset-0 z-[1000] bg-black/90 flex items-center justify-center backdrop-blur-sm">
      <div className={`w-[500px] p-10 border-4 shadow-2xl flex flex-col gap-6 ${isDarkMode ? 'bg-[#0a0a0c] border-gray-700' : 'bg-white border-black'}`}>
        <h2 className="text-2xl font-black uppercase tracking-tighter">Guardar Proyecto</h2>

        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">Cliente / Empresa</label>
          <input
            type="text"
            value={saveCliente}
            onChange={(e) => setSaveCliente(e.target.value)}
            className={`w-full p-4 font-bold outline-none border-b-2 ${isDarkMode ? 'bg-[#14151c] text-white border-gray-600' : 'bg-gray-50 text-black border-gray-300'}`}
            placeholder="Ej. Coca Cola"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">Proyecto</label>
          <input
            type="text"
            value={saveNombre}
            onChange={(e) => setSaveNombre(e.target.value)}
            className={`w-full p-4 font-bold outline-none border-b-2 ${isDarkMode ? 'bg-[#14151c] text-white border-gray-600' : 'bg-gray-50 text-black border-gray-300'}`}
            placeholder="Ej. Letras Sucursal Centro"
          />
        </div>

        <div className="flex gap-4 mt-4">
          <button
            onClick={concretarGuardado}
            className="flex-1 py-4 bg-white text-black font-black uppercase tracking-widest"
          >
            Guardar
          </button>
          <button
            onClick={() => setShowSaveModal(false)}
            className="flex-1 py-4 border-2 border-gray-600 text-gray-400 font-bold uppercase tracking-widest hover:border-white hover:text-white"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
