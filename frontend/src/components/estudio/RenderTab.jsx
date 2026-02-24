/**
 * @deprecated Sustituido por SmartRenderView + Render3DCanvas (motor Smart Render integrado).
 * Se mantiene solo como referencia.
 */
import React from 'react';
import { Modelo3D } from '../Modelo3D.jsx';

export function RenderTab({ isDarkMode, resultado, bgMontaje, setBgMontaje, materialCara, materialCanto, aluminioTipo, colorMate, conLuz, texture, wallTexture, bgInputRef, profCanto }) {
  return (
    <div className="absolute inset-0 bg-black/5">
      {bgMontaje && (
        <img src={bgMontaje} className="absolute inset-0 w-full h-full object-cover opacity-80" alt="Fondo Montaje" />
      )}
      <Modelo3D
        urlImagenProcesada={resultado.url_imagen_procesada}
        svgData={resultado.svg_path_d || ''}
        materialCara={materialCara}
        materialCanto={materialCanto}
        aluminioTipo={aluminioTipo}
        colorMate={colorMate}
        showLeds={conLuz}
        imgW={resultado.img_w_m || resultado.ancho_m}
        imgH={resultado.img_h_m || resultado.alto_m}
        wallTexture={wallTexture}
        isMontaje={!!bgMontaje}
        isDarkMode={isDarkMode}
        profCanto={profCanto}
        geometriaOriginal={resultado.geometria_original || []}
      />
      <div className="absolute bottom-6 left-6 flex gap-4">
        <input
          type="file"
          ref={bgInputRef}
          onChange={(e) => { if (e.target.files?.length) setBgMontaje(URL.createObjectURL(e.target.files[0])); e.target.value = null; }}
          className="hidden"
        />
        <button
          onClick={() => bgInputRef.current.click()}
          className={`px-6 py-4 font-black text-xs uppercase tracking-widest shadow-2xl transition-all hover:scale-105 ${isDarkMode ? 'bg-white text-black' : 'bg-black text-white'}`}
        >
          📷 Subir Fachada
        </button>
        {bgMontaje && (
          <button
            onClick={() => setBgMontaje(null)}
            className="bg-red-600 text-white px-6 py-4 font-black text-xs uppercase tracking-widest shadow-2xl transition-all hover:scale-105"
          >
            Quitar Fachada
          </button>
        )}
        <button
          onClick={() => alert('Escanea este código con tu celular para ver en tu espacio:\n(Generando link WebXR...) https://dispro.ar/view')}
          className={`px-6 py-4 font-black text-xs uppercase tracking-widest shadow-2xl transition-all hover:scale-105 ${isDarkMode ? 'bg-[#14151c] text-white border-2 border-white' : 'bg-white text-black border-2 border-black'}`}
        >
          📱 Ver en AR
        </button>
      </div>
    </div>
  );
}
