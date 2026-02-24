import React, { useState } from 'react';
import { DonutChart } from '../DonutChart.jsx';

const PLANOS_SUBVIEW = { material: 'Material', leds: 'LEDs', ambos: 'Material + LEDs' };

export function PlanosTab({ isDarkMode, resultado, modo, ancho, alto, viewBoxStr, sheetW, sheetH, gap, numPlacas, descargarVectoresCNC }) {
  const [planosSubView, setPlanosSubView] = useState('ambos');
  const tieneGeometria =
    (modo === 'ROLLO' && resultado.geometria_empalmes?.length > 0) ||
    (resultado.geometria_nesting && resultado.geometria_nesting.length > 0);
  const showNesting = planosSubView === 'material' || planosSubView === 'ambos';
  const showLeds = planosSubView === 'leds' || planosSubView === 'ambos';

  return (
    <div className={`absolute inset-0 flex gap-6 animate-fade-in p-6 ${isDarkMode ? 'bg-[#0a0a0c]' : 'bg-white'}`}>
      {/* Panel SVG */}
      <div className={`w-2/3 border-2 border-dashed p-8 flex flex-col items-center justify-center relative overflow-hidden ${isDarkMode ? 'bg-[#14151c] border-gray-700' : 'bg-gray-50 border-gray-300'}`}>
        {modo === '3D' && tieneGeometria && (
          <div className={`absolute top-4 left-4 z-10 flex gap-1.5 p-1 rounded-xl border ${isDarkMode ? 'border-white/10 bg-black/40' : 'border-black/10 bg-white/80'}`}>
            {Object.entries(PLANOS_SUBVIEW).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPlanosSubView(key)}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                  planosSubView === key
                    ? isDarkMode ? 'bg-cyan-500/90 text-white' : 'bg-black text-white'
                    : isDarkMode ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:bg-black/5'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {tieneGeometria ? (
          <div className="flex-1 w-full flex items-center justify-center overflow-auto">
            <svg
              id="nesting-svg-export"
              viewBox={modo === 'ROLLO'
                ? `-0.1 -0.1 ${(parseFloat(ancho) || 0) + 0.2} ${(parseFloat(alto) || 0) + 0.2}`
                : viewBoxStr}
              className="w-full h-full max-h-full drop-shadow-lg"
            >
              {modo === 'ROLLO' ? (
                <>
                  <rect x="0" y="0" width={ancho || 0} height={alto || 0} fill="none" stroke={isDarkMode ? '#fff' : '#000'} strokeWidth="0.01" strokeDasharray="0.05,0.05" />
                  {resultado.geometria_empalmes?.map((emp, i) => (
                    <g key={i}>
                      <rect x={emp.x_offset} y="0" width={emp.ancho_m} height={alto || 0} fill={isDarkMode ? '#fff' : '#000'} fillOpacity="0.05" stroke={isDarkMode ? '#fff' : '#000'} strokeWidth="0.01" />
                      <text x={emp.x_offset + emp.ancho_m / 2} y={(parseFloat(alto) || 0) / 2} fill={isDarkMode ? '#fff' : '#000'} fontSize={(parseFloat(alto) || 0) * 0.08} textAnchor="middle" className="font-black">L{emp.lienzo}</text>
                    </g>
                  ))}
                </>
              ) : (
                /* Dibujo por placa: el backend envía coordenadas LOCALES a cada placa; se dibuja sin conversión */
                (() => {
                  const stepY = sheetH + gap;
                  const getPlateIndex = (geo) => {
                    const fromPlaca = Number(geo.placa);
                    if (!Number.isNaN(fromPlaca) && fromPlaca >= 0) return Math.min(numPlacas - 1, fromPlaca);
                    return 0;
                  };
                  const geosWithPlate = (resultado?.geometria_nesting || []).map((geo) => ({ geo, plateIndex: getPlateIndex(geo) }));
                  const geosByPlaca = geosWithPlate.reduce((acc, { geo, plateIndex }) => {
                    if (!acc[plateIndex]) acc[plateIndex] = [];
                    acc[plateIndex].push(geo);
                    return acc;
                  }, {});

                  return (
                    <>
                      {Array.from({ length: numPlacas }).map((_, i) => {
                        const geos = geosByPlaca[i] || [];
                        const offY = i * stepY;
                        return (
                          <g key={`placa-${i}`} transform={`translate(0, ${offY})`}>
                            <rect x="0" y="0" width={sheetW} height={sheetH} fill="none" stroke={isDarkMode ? (showNesting ? '#666' : '#333') : (showNesting ? '#aaa' : '#ddd')} strokeWidth="0.008" />
                            {geos.map((geo, idx) => {
                              const puntos = geo.puntos?.length >= 3 ? geo.puntos : null;
                              const localX = geo.global_x != null ? geo.global_x : 0;
                              const localY = geo.global_y != null ? geo.global_y : 0;

                              return (
                                <g key={`geo-${i}-${idx}`}>
                                  {showNesting && puntos && puntos.length >= 3 && (
                                    <polygon
                                      points={puntos.map((pt) => `${pt.x},${pt.y}`).join(' ')}
                                      fill={geo.tipo === 'canto' ? 'rgba(59,130,246,0.2)' : 'none'}
                                      stroke={geo.tipo === 'canto' ? '#3b82f6' : (isDarkMode ? '#fff' : '#000')}
                                      strokeWidth={geo.tipo === 'canto' ? '0.01' : '0.005'}
                                      strokeLinejoin="round"
                                    />
                                  )}
                                  {showNesting && geo.tipo !== 'canto' && (!puntos || puntos.length < 3) && geo.svg_path_d && (
                                    <path d={geo.svg_path_d} fill="none" stroke={isDarkMode ? '#fff' : '#000'} strokeWidth="0.005" strokeLinejoin="round" />
                                  )}
                                  {showNesting && geo.tipo !== 'canto' && (!puntos || puntos.length < 3) && !geo.svg_path_d && (
                                    <rect x={localX} y={localY} width={geo.w_m ?? sheetW * 0.2} height={geo.h_m ?? sheetH * 0.2} fill="none" stroke={isDarkMode ? '#666' : '#999'} strokeWidth="0.004" strokeDasharray="0.02,0.02" />
                                  )}
                                  {showNesting && geo.vinilos?.map((v, vIdx) => (
                                    <polygon key={`v-${vIdx}`} points={(v.puntos || []).map((pt) => `${pt.x},${pt.y}`).join(' ')} fill={v.color} opacity={0.9} />
                                  ))}
                                  {showLeds && geo.leds?.length > 0 && geo.leds.map((led, j) => (
                                    <circle key={`l-${j}`} cx={led.x} cy={led.y} r="0.015" fill="#facc15" stroke="#000" strokeWidth="0.002" />
                                  ))}
                                </g>
                              );
                            })}
                          </g>
                        );
                      })}
                    </>
                  );
                })()
              )}
            </svg>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-500 opacity-50 p-10 text-center">
            <span className="text-4xl mb-4">⚠️</span>
            <p className="font-black uppercase tracking-widest text-xs">Sin geometría</p>
            <p className="text-[10px] mt-2 max-w-sm">
              {modo === 'ROLLO'
                ? 'No se generaron empalmes para esta impresión.'
                : 'No hay datos de nesting. Reanaliza el archivo o revisa el servidor.'}
            </p>
          </div>
        )}

        {modo === '3D' && resultado.geometria_nesting && resultado.geometria_nesting.length > 0 && (
          <button
            onClick={descargarVectoresCNC}
            className={`absolute bottom-8 right-8 px-6 py-4 font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-[0_15px_30px_rgba(0,0,0,0.5)] transition-all hover:scale-105 flex items-center gap-2 ${isDarkMode ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`}
          >
            <span className="text-xl">📥</span> Exportar SVG (CNC)
          </button>
        )}
      </div>

      {/* BOM lateral */}
      <div className={`w-1/3 border-4 p-8 overflow-y-auto flex flex-col gap-6 ${isDarkMode ? 'bg-[#0a0a0c] border-gray-700' : 'bg-white border-black'}`}>
        <h3 className={`font-black text-2xl uppercase tracking-tighter border-b-4 pb-4 ${isDarkMode ? 'border-gray-700' : 'border-black'}`}>Detalle Técnico BOM</h3>
        {resultado.eficiencia !== undefined && modo === '3D' && (
          <div className={`flex justify-center py-4 border-b-2 border-dashed ${isDarkMode ? 'border-gray-700' : 'border-gray-300'}`}>
            <DonutChart percentage={resultado.eficiencia} isDarkMode={isDarkMode} />
          </div>
        )}
        {Object.entries(resultado.desglose_tecnico).map(([k, v]) => (
          <div key={k} className={`flex flex-col border-b-2 border-dashed py-3 text-sm gap-1 ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
            <span className="text-gray-500 font-bold tracking-widest uppercase text-[10px]">{k}</span>
            <pre className={`font-mono font-bold whitespace-pre-wrap ${isDarkMode ? 'text-gray-300' : 'text-black'}`}>{v}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
