import React, { useState, useRef } from 'react';
import axios from 'axios';
import { API_BASE } from '../constants/api.js';

export function BaseDatosView({ isDarkMode }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [isError, setIsError] = useState(false);
  const inputRef = useRef(null);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    setMessage(null);
  };

  const handleSubmit = async () => {
    if (!file) {
      setMessage('Selecciona un archivo Excel (.xlsx) con columnas CODIGO y PRECIO.');
      setIsError(true);
      return;
    }
    setMessage(null);
    setLoading(true);
    setIsError(false);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const { data } = await axios.post(`${API_BASE}/api/v1/config/precios/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessage(
        data.message +
          (data.filas_leidas != null ? ` ${data.filas_leidas} filas leídas, ${data.claves_actualizadas} claves de Letras 3D actualizadas.` : '')
      );
      setIsError(false);
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch (e) {
      const detail = e.response?.data?.detail;
      setMessage(typeof detail === 'string' ? detail : 'Error al subir el archivo.');
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`absolute inset-0 flex flex-col p-10 overflow-y-auto animate-fade-in ${isDarkMode ? 'bg-[#050505]' : 'bg-gray-100'}`}
    >
      <div
        className={`max-w-2xl mx-auto w-full rounded-[2rem] shadow-2xl border p-10 ${isDarkMode ? 'bg-[#14151c]/90 border-white/10' : 'bg-white border-black/10'}`}
      >
        <h1
          className={`text-3xl font-black uppercase tracking-tighter mb-2 ${isDarkMode ? 'text-white' : 'text-black'}`}
        >
          Base de datos de precios (Letras 3D)
        </h1>
        <p className={`text-sm mb-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          Sube tu archivo Excel con columnas <strong>CODIGO</strong> y <strong>PRECIO</strong> para actualizar los
          precios del motor Letras 3D. Los precios de impresión gran formato (ROLLO) no se modifican.
        </p>
        <div className="flex flex-col gap-4">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className={`block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold ${isDarkMode ? 'file:bg-cyan-500/20 file:text-cyan-400 text-gray-300' : 'file:bg-cyan-600 file:text-white text-gray-700'}`}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className={`px-6 py-3 rounded-xl font-bold uppercase tracking-widest transition-all ${isDarkMode ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30' : 'bg-cyan-600 text-white hover:bg-cyan-700'} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? 'Subiendo…' : 'Subir y aplicar'}
          </button>
        </div>
        {message && (
          <p
            className={`mt-6 text-sm font-medium ${isError ? 'text-red-500' : isDarkMode ? 'text-cyan-400' : 'text-cyan-700'}`}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
