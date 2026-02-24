import React, { useState, useMemo } from 'react';
import { Render3DCanvas } from './Render3DCanvas.jsx';
import { API_BASE } from '../../constants/api.js';

export function SmartRenderView({
  isDarkMode,
  resultado,
  preview,
  imgData,
  bgMontaje,
  setBgMontaje,
  bgInputRef,
  conLuz,
}) {
  const [lightsOn, setLightsOn] = useState(conLuz !== false);

  const svgString = resultado?.svg_path_d || '';
  // Prioridad como Motor: siempre preferir la imagen subida (preview) cuando exista.
  const imageSrc = useMemo(() => {
    const raw = preview || resultado?.url_imagen_procesada || null;
    if (!raw || typeof raw !== 'string') return null;
    if (raw.startsWith('data:') || raw.startsWith('blob:') || raw.startsWith('http')) return raw;
    if (raw.startsWith('/')) return `${API_BASE.replace(/\/$/, '')}${raw}`;
    return raw;
  }, [preview, resultado?.url_imagen_procesada]);
  // Backend SVG from analizar is in meters (viewBox iw x ih). Fallback a imgData si resultado no trae dimensiones.
  const imageWidth = Number(resultado?.img_w_m ?? resultado?.ancho_m ?? imgData?.wM ?? 1) || 1;
  const imageHeight = Number(resultado?.img_h_m ?? resultado?.alto_m ?? imgData?.hM ?? 1) || 1;

  const hasContent = svgString && svgString.trim().length > 0;

  return (
    <div className={`absolute inset-0 flex flex-col transition-colors ${isDarkMode ? 'bg-[var(--color-dispro-bg)]' : 'bg-black/5'}`}>
      {bgMontaje && (
        <img
          src={bgMontaje}
          className="absolute inset-0 w-full h-full object-cover opacity-80 pointer-events-none"
          alt="Fondo Montaje"
        />
      )}

      {/* Toggle LED - estilo DisproOS */}
      <div className="absolute top-6 left-6 z-10">
        <label
          className={`flex items-center justify-between cursor-pointer px-4 py-3 rounded-2xl border backdrop-blur-xl transition-colors ${
            isDarkMode
              ? 'bg-white/5 border-white/10 hover:bg-white/10'
              : 'bg-white/80 border-black/10 hover:bg-white'
          }`}
        >
          <span
            className={`text-[10px] font-black uppercase tracking-widest ${
              isDarkMode ? 'text-white/80' : 'text-black/70'
            }`}
          >
            Iluminación LED
          </span>
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only"
              checked={lightsOn}
              onChange={(e) => setLightsOn(e.target.checked)}
            />
            <div
              className={`block w-10 h-6 rounded-full transition-colors ${
                lightsOn
                  ? 'bg-[var(--color-dispro-cyan)] shadow-[0_0_12px_rgba(0,229,255,0.4)]'
                  : isDarkMode
                    ? 'bg-white/20'
                    : 'bg-black/20'
              }`}
            />
            <div
              className={`absolute left-1 top-1 w-4 h-4 rounded-full bg-white transition-transform shadow ${
                lightsOn ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </div>
        </label>
      </div>

      {/* Área 3D */}
      <div className="absolute inset-0 flex items-center justify-center p-8 pt-20 pb-24">
        {hasContent ? (
          <div className="w-full h-full max-w-6xl">
            <Render3DCanvas
              svgString={svgString}
              imageSrc={imageSrc}
              imageWidth={imageWidth}
              imageHeight={imageHeight}
              lightsOn={lightsOn}
              isDarkMode={isDarkMode}
            />
          </div>
        ) : (
          <div
            className={`rounded-2xl border-2 border-dashed px-12 py-10 text-center ${
              isDarkMode ? 'border-white/20 text-white/60' : 'border-black/20 text-black/60'
            }`}
          >
            <p className="text-sm font-bold uppercase tracking-widest">
              Analiza el diseño para ver el render 3D
            </p>
            <p className="mt-2 text-xs">
              Ve a Ajuste, clasifica las formas y haz clic en Analizar.
            </p>
          </div>
        )}
      </div>

      {/* Botones inferiores - mismo estilo que RenderTab */}
      <div className="absolute bottom-6 left-6 flex gap-4 z-10">
        <input
          type="file"
          ref={bgInputRef}
          onChange={(e) => {
            if (e.target.files?.length) setBgMontaje(URL.createObjectURL(e.target.files[0]));
            e.target.value = null;
          }}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => bgInputRef.current?.click()}
          className={`px-6 py-4 font-black text-xs uppercase tracking-widest shadow-2xl transition-all hover:scale-105 ${
            isDarkMode ? 'bg-white text-black' : 'bg-black text-white'
          }`}
        >
          📷 Subir Fachada
        </button>
        {bgMontaje && (
          <button
            type="button"
            onClick={() => setBgMontaje(null)}
            className="bg-red-600 text-white px-6 py-4 font-black text-xs uppercase tracking-widest shadow-2xl transition-all hover:scale-105"
          >
            Quitar Fachada
          </button>
        )}
        <button
          type="button"
          onClick={() =>
            alert(
              'Escanea este código con tu celular para ver en tu espacio:\n(Generando link WebXR...) https://dispro.ar/view'
            )
          }
          className={`px-6 py-4 font-black text-xs uppercase tracking-widest shadow-2xl transition-all hover:scale-105 ${
            isDarkMode
              ? 'bg-[#14151c] text-white border-2 border-white'
              : 'bg-white text-black border-2 border-black'
          }`}
        >
          📱 Ver en AR
        </button>
      </div>
    </div>
  );
}
