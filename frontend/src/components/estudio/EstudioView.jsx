import React, { useState, useEffect } from 'react';
import axios from 'axios';
import logoImg from '../../assets/logo.png';
import { API_BASE } from '../../constants/api.js';
import { PDFContent } from '../PDFContent.jsx';
import { StudioHeader } from './StudioHeader.jsx';
import { AjusteTab } from './AjusteTab.jsx';
import { SmartRenderView } from './SmartRenderView.jsx';
import { PlanosTab } from './PlanosTab.jsx';
import { ParametrosSidebar } from './ParametrosSidebar.jsx';

export function EstudioView({
  isDarkMode,
  activeTab, setActiveTab,
  tabsDisponibles,
  preview, isDetecting, isDragging, setIsDragging, handleDrop,
  resultado,
  cajas, selectedCajas, setSelectedCajas, cajasIgnoradas,
  toggleSelection, toggleIgnoreStatus, fusionarCajas,
  classifications, updateClassification,
  cajaModalStep, setCajaModalStep, tempCajaMaster, setTempCajaMaster,
  tempVinylType, setTempVinylType, tempVinylColor, setTempVinylColor, finalizeCajaConfig,
  bgMontaje, setBgMontaje,
  isCalculating,
  analizar,
  archivoSeleccionado,
  imgData,
  modo, setModo,
  materialCara, setMaterialCara,
  aluminioTipo, setAluminioTipo,
  colorMate, setColorMate,
  materialCanto, setMaterialCanto,
  profCanto, setProfCanto,
  ancho, setAncho,
  alto, setAlto,
  conLuz, setConLuz,
  anchoRollo, setAnchoRollo,
  anchosDisponibles, getAnchosRollo,
  wallTexture, texture,
  conFlete, setConFlete,
  destinoFlete, setDestinoFlete,
  infoFlete, isCalculatingFlete, calcularFlete,
  viewBoxStr, sheetW, sheetH, gap, numPlacas,
  descargarVectoresCNC,
  pdfPositions, setPdfPositions,
  pdfCliente, pdfFecha, pdfTitle, pdfDesc, pdfTotal, pdfFolio, pdfBOM, pdfImgScale,
  pdfScale, isPdfEditing, setIsPdfEditing,
  pdfBackground, setPdfBackground,
  pdfContainerRef, pdfBgInputRef,
  setValues,
  enviarWhatsAppProyecto,
  iniciarGuardado,
  globalInputRef, bgInputRef,
}) {
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const [backendCheckDone, setBackendCheckDone] = useState(false);
  const [step3BoxColor, setStep3BoxColor] = useState('#2563eb');

  useEffect(() => {
    if (cajaModalStep === 3) setStep3BoxColor(tempVinylColor || '#2563eb');
  }, [cajaModalStep, tempVinylColor]);

  useEffect(() => {
    let cancelled = false;
    axios.get(`${API_BASE}/api/v1/health`).then(() => {
      if (!cancelled) setBackendUnavailable(false);
    }).catch(() => {
      if (!cancelled) setBackendUnavailable(true);
    }).finally(() => {
      if (!cancelled) setBackendCheckDone(true);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <div
      className={`absolute inset-0 flex flex-col transition-all ${!preview && isDragging ? 'drop-zone-active' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {backendCheckDone && backendUnavailable && (
        <div
          className={`flex items-center justify-between gap-4 px-4 py-3 text-sm z-20 ${
            isDarkMode ? 'bg-amber-500/20 text-amber-200 border-b border-amber-500/30' : 'bg-amber-100 text-amber-900 border-b border-amber-300'
          }`}
          role="alert"
        >
          <span>
            Backend no disponible. Ejecuta el servidor DisproOS (python main.py en backend/app).
          </span>
          <button
            type="button"
            onClick={() => setBackendUnavailable(false)}
            className="shrink-0 px-2 py-1 rounded font-bold uppercase text-xs opacity-80 hover:opacity-100"
            aria-label="Cerrar aviso"
          >
            Cerrar
          </button>
        </div>
      )}
      {(preview || activeTab === 'pdf') && activeTab !== 'pdf' && (
        <StudioHeader isDarkMode={isDarkMode} tabsDisponibles={tabsDisponibles} activeTab={activeTab} setActiveTab={setActiveTab} />
      )}

      {/* Estado inicial: sin imagen — logo y botón centrados horizontal y verticalmente */}
      {!preview && !isDetecting && activeTab !== 'pdf' ? (
        <div className="absolute inset-0 flex items-center justify-center animate-fade-in pointer-events-none z-10">
          <div className="flex flex-col items-center justify-center gap-8 pointer-events-auto">
            <img
              src={logoImg}
              className={`h-[50rem] max-h-[70vh] w-auto object-contain transition-all duration-700 hover:scale-105 ${!isDarkMode ? 'filter invert' : ''}`}
              alt="Logo Central"
              onError={(e) => (e.target.style.display = 'none')}
            />
            <div
              className={`w-[450px] h-20 px-8 rounded-[2.5rem] flex flex-row items-center justify-between transition-all duration-300 shadow-[0_20px_40px_rgba(0,0,0,0.6)] cursor-pointer backdrop-blur-[40px] border border-white/20 hover:bg-white/10 text-white shrink-0 ${isDarkMode ? 'bg-white/5' : 'bg-black/90'}`}
              onClick={() => globalInputRef.current?.click()}
            >
              <div className="flex flex-col text-left justify-center pointer-events-none">
                <h2 className="text-xl font-black uppercase tracking-[0.2em] drop-shadow-lg">Cargar Diseño</h2>
              </div>
              <div className="px-5 py-2.5 rounded-2xl border border-dashed border-white/40 text-white/70 flex items-center justify-center">
                <span className="text-[11px] font-bold tracking-widest uppercase">JPG, PNG</span>
              </div>
            </div>
          </div>
        </div>

      ) : isDetecting ? (
        <div className="w-full h-full flex items-center justify-center">
          <div className={`flex flex-col items-center justify-center p-12 rounded-3xl shadow-2xl ${isDarkMode ? 'bg-[#0a0a0c] border border-gray-800' : 'bg-white border border-gray-200'}`}>
            <div className={`w-16 h-16 border-8 border-t-transparent rounded-full animate-spin mb-6 ${isDarkMode ? 'border-white' : 'border-black'}`} />
            <p className={`font-black tracking-[0.2em] uppercase text-xl ${isDarkMode ? 'text-white' : 'text-black'}`}>Analizando...</p>
          </div>
        </div>

      ) : (
        <div className="flex-1 flex gap-8 overflow-hidden animate-slide-up p-8 pt-0 relative min-h-0">
          {/* Área central: ocupa todo el espacio; altura mínima en vh para que la imagen no se vea diminuta */}
          <div className={`flex-1 min-w-0 border-4 relative flex flex-col p-4 transition-all duration-300 z-0 overflow-hidden ${isDarkMode ? 'bg-[#0a0a0c] border-gray-700' : 'bg-gray-50 border-black'}`} style={{ minHeight: '60vh' }}>

            {activeTab === 'ajuste' && preview && (
              <AjusteTab
                isDarkMode={isDarkMode}
                preview={preview}
                imgData={imgData}
                modo={modo}
                cajas={cajas}
                cajasIgnoradas={cajasIgnoradas}
                selectedCajas={selectedCajas}
                setSelectedCajas={setSelectedCajas}
                toggleSelection={toggleSelection}
                toggleIgnoreStatus={toggleIgnoreStatus}
                fusionarCajas={fusionarCajas}
                classifications={classifications}
                updateClassification={updateClassification}
                cajaModalStep={cajaModalStep}
                setCajaModalStep={setCajaModalStep}
                tempCajaMaster={tempCajaMaster}
                setTempCajaMaster={setTempCajaMaster}
                tempVinylType={tempVinylType}
                setTempVinylType={setTempVinylType}
                tempVinylColor={tempVinylColor}
                setTempVinylColor={setTempVinylColor}
                finalizeCajaConfig={finalizeCajaConfig}
              />
            )}

            {activeTab === 'render' && (
              <SmartRenderView
                isDarkMode={isDarkMode}
                resultado={resultado}
                preview={preview}
                imgData={imgData}
                bgMontaje={bgMontaje}
                setBgMontaje={setBgMontaje}
                bgInputRef={bgInputRef}
                conLuz={conLuz}
              />
            )}

            {activeTab === 'planos' && resultado && (
              <PlanosTab
                isDarkMode={isDarkMode}
                resultado={resultado}
                modo={modo}
                ancho={ancho}
                alto={alto}
                viewBoxStr={viewBoxStr}
                sheetW={sheetW}
                sheetH={sheetH}
                gap={gap}
                numPlacas={numPlacas}
                descargarVectoresCNC={descargarVectoresCNC}
              />
            )}

            {activeTab === 'pdf' && (
              <div
                className={`absolute inset-0 flex flex-col items-center py-12 gap-12 overflow-y-auto no-scrollbar relative ${isDarkMode ? 'bg-transparent' : 'bg-gray-100'}`}
                ref={pdfContainerRef}
              >
                {isDarkMode && (
                  <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />
                  </div>
                )}

                {/* Botones superiores */}
                <div className="flex gap-4 z-20 animate-fade-in">
                  <button
                    onClick={() => enviarWhatsAppProyecto(false)}
                    className="group relative flex items-center gap-3 px-8 py-4 rounded-2xl bg-[#25D366] text-white font-black uppercase text-[10px] tracking-[0.2em] shadow-[0_10px_25px_rgba(37,211,102,0.3)] hover:shadow-[0_15px_35px_rgba(37,211,102,0.5)] hover:scale-[1.02] transition-all duration-300"
                  >
                    <span className="text-xl">💬</span>
                    <span>Compartir por WhatsApp</span>
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity rounded-2xl" />
                  </button>
                  <button
                    onClick={() => alert('Función de envío por correo en desarrollo...')}
                    className={`group relative flex items-center gap-3 px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all duration-300 border shadow-lg hover:scale-[1.02] ${isDarkMode ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-black/5 border-black/10 text-black hover:bg-black/10'}`}
                  >
                    <span className="text-xl">📧</span>
                    <span>Enviar por correo</span>
                  </button>
                </div>

                {/* PDF Document */}
                <div style={{ transform: `scale(${pdfScale})`, transformOrigin: 'top center' }} className="flex flex-col gap-8 pb-32 relative z-10 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)]">
                  <PDFContent
                    positions={pdfPositions}
                    values={{ pdfCliente, pdfFecha, pdfTitle, pdfDesc, pdfTotal, pdfFolio, pdfBOM, pdfImgScale }}
                    editing={isPdfEditing}
                    onPosChange={(id, newPos) => setPdfPositions((p) => ({ ...p, [id]: newPos }))}
                    setValues={setValues}
                    preview={preview}
                    isWorkOrder={false}
                    resultado={resultado}
                    customBg={pdfBackground}
                  />
                </div>

                {/* Toolbar flotante */}
                <div className="fixed bottom-20 right-22 flex gap-4 z-50 animate-slide-up">
                  <div className="bg-black/40 backdrop-blur-2xl border border-white/10 p-3 rounded-[2rem] flex gap-3 shadow-2xl">
                    <input
                      type="file"
                      ref={pdfBgInputRef}
                      onChange={(e) => { if (e.target.files?.length) setPdfBackground(URL.createObjectURL(e.target.files[0])); e.target.value = null; }}
                      className="hidden"
                    />
                    <button
                      onClick={() => pdfBgInputRef.current.click()}
                      className="group relative flex items-center justify-center w-14 h-14 rounded-2xl bg-white/5 border border-white/5 hover:border-blue-500/50 hover:bg-blue-500/10 transition-all duration-300"
                      title="Subir Plantilla Base"
                    >
                      <span className="text-xl group-hover:scale-110 transition-transform">🖼️</span>
                      <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-black/80 text-[8px] font-black uppercase tracking-widest text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-white/10 pointer-events-none">Subir Plantilla</div>
                    </button>
                    <button
                      onClick={() => setIsPdfEditing(!isPdfEditing)}
                      className={`group relative flex items-center justify-center w-14 h-14 rounded-2xl border transition-all duration-300 ${isPdfEditing ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.4)]' : 'bg-white/5 border-white/5 hover:border-cyan-500/50 hover:bg-cyan-500/10 text-white'}`}
                      title={isPdfEditing ? 'Guardar Posiciones' : 'Ajustar Textos'}
                    >
                      <span className="text-xl group-hover:scale-110 transition-transform">{isPdfEditing ? '💾' : '✏️'}</span>
                      <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-black/80 text-[8px] font-black uppercase tracking-widest text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-white/10 pointer-events-none">
                        {isPdfEditing ? 'Guardar' : 'Editar'}
                      </div>
                    </button>
                    <div className="w-[1px] h-10 bg-white/10 self-center mx-1" />
                    <button
                      onClick={iniciarGuardado}
                      className="group relative flex items-center justify-center px-8 h-14 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-black uppercase text-[10px] tracking-[0.2em] shadow-[0_10px_25px_rgba(6,182,212,0.3)] hover:shadow-[0_15px_35px_rgba(6,182,212,0.5)] hover:scale-[1.02] transition-all duration-300"
                    >
                      🚀 Guardar Proyecto
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {activeTab !== 'pdf' && (
            <ParametrosSidebar
              isDarkMode={isDarkMode}
              preview={preview}
              modo={modo} setModo={setModo}
              materialCara={materialCara} setMaterialCara={setMaterialCara}
              aluminioTipo={aluminioTipo} setAluminioTipo={setAluminioTipo}
              colorMate={colorMate} setColorMate={setColorMate}
              materialCanto={materialCanto} setMaterialCanto={setMaterialCanto}
              profCanto={profCanto} setProfCanto={setProfCanto}
              ancho={ancho} setAncho={setAncho}
              alto={alto} setAlto={setAlto}
              conLuz={conLuz} setConLuz={setConLuz}
              anchoRollo={anchoRollo} setAnchoRollo={setAnchoRollo}
              anchosDisponibles={anchosDisponibles}
              getAnchosRollo={getAnchosRollo}
              conFlete={conFlete} setConFlete={setConFlete}
              destinoFlete={destinoFlete} setDestinoFlete={setDestinoFlete}
              infoFlete={infoFlete}
              isCalculatingFlete={isCalculatingFlete}
              calcularFlete={calcularFlete}
              imgData={imgData}
              resultado={resultado}
              pdfTotal={pdfTotal}
              isCalculating={isCalculating}
              isDetecting={isDetecting}
              analizar={analizar}
              globalInputRef={globalInputRef}
              cajas={cajas}
              selectedCajas={selectedCajas}
              setSelectedCajas={setSelectedCajas}
              classifications={classifications}
              updateClassification={updateClassification}
              cajaModalStep={cajaModalStep}
              setCajaModalStep={setCajaModalStep}
              tempCajaMaster={tempCajaMaster}
              setTempCajaMaster={setTempCajaMaster}
              tempVinylType={tempVinylType}
              setTempVinylType={setTempVinylType}
              tempVinylColor={tempVinylColor}
              setTempVinylColor={setTempVinylColor}
              finalizeCajaConfig={finalizeCajaConfig}
            />
          )}
        </div>
      )}

      {/* Modal Caja con cajas dentro (rotulado / impresión en vinil) — visible desde Ajuste o desde PARÁMETROS */}
      {cajaModalStep > 0 && (
        <div
          className={`fixed inset-0 z-[200] flex items-center justify-center p-6 ${isDarkMode ? 'bg-black/70' : 'bg-slate-900/60'} backdrop-blur-sm`}
          onClick={() => { setCajaModalStep(0); setTempCajaMaster(null); }}
        >
          <div
            className={`max-w-sm w-full rounded-2xl p-8 shadow-2xl border ${isDarkMode ? 'bg-[#14151c] border-white/10' : 'bg-white border-slate-200'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {cajaModalStep === 1 && (
              <>
                <h2 className="text-xl font-black mb-2">Caja con cajas dentro</h2>
                <p className="text-slate-500 text-xs mb-6">Elige si el interior es <strong>rotulada en vinil</strong> (color sólido) o <strong>impresión en vinil</strong> (proyectar imagen).</p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => { setTempVinylType('impreso'); setCajaModalStep(3); }}
                    className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg"
                  >
                    🖼️ Impresión en vinil (proyectar fotografía)
                  </button>
                  <button
                    onClick={() => { setTempVinylType('corte'); setCajaModalStep(2); }}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg"
                  >
                    ✂️ Rotulada en vinil (elegir color sólido)
                  </button>
                  <button
                    onClick={() => { setTempVinylType('liso'); setCajaModalStep(3); }}
                    className={`w-full py-4 rounded-2xl font-bold text-[10px] uppercase ${isDarkMode ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    ⬜ Acrílico liso (ignorar interior)
                  </button>
                </div>
              </>
            )}
            {cajaModalStep === 2 && (
              <>
                <h2 className="text-xl font-black mb-2">Color del vinil (rotulada)</h2>
                <div className="flex flex-wrap gap-2 justify-center mb-6">
                  {['#2563eb', '#ffffff', '#111111', '#ef4444', '#bdc3c7', '#22c55e', '#eab308'].map((hex) => (
                    <button
                      key={hex}
                      onClick={() => { setTempVinylColor(hex); setCajaModalStep(3); }}
                      className="w-10 h-10 rounded-full border-2 border-slate-200 hover:scale-110 transition-transform"
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={tempVinylColor}
                  onChange={(e) => { setTempVinylColor(e.target.value); }}
                  className="w-full h-12 cursor-pointer rounded-lg border-2 border-slate-200 mb-4"
                />
                <button onClick={() => setCajaModalStep(3)} className="w-full py-2 mb-2 bg-slate-900 text-white rounded-lg font-bold text-xs uppercase">Siguiente →</button>
                <button onClick={() => setCajaModalStep(1)} className="text-xs font-bold text-slate-400 uppercase">← Volver</button>
              </>
            )}
            {cajaModalStep === 3 && (
              <>
                <h2 className="text-xl font-black mb-2">Color de la caja</h2>
                <div className="flex flex-wrap gap-2 justify-center mb-4">
                  {['#2563eb', '#ffffff', '#111111', '#ef4444', '#bdc3c7', '#22c55e', '#eab308'].map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => {
                        setStep3BoxColor(hex);
                        finalizeCajaConfig(hex);
                      }}
                      className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${step3BoxColor.toLowerCase() === hex.toLowerCase() ? 'border-cyan-400 ring-2 ring-cyan-400/50' : 'border-slate-200'}`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
                <div className="w-full h-14 rounded-xl border-2 border-slate-200 mb-4 transition-colors" style={{ backgroundColor: step3BoxColor }} />
                <input
                  type="color"
                  value={step3BoxColor}
                  onChange={(e) => setStep3BoxColor(e.target.value)}
                  className="w-full h-12 cursor-pointer rounded-lg border-2 border-slate-200 mb-2"
                />
                <button
                  type="button"
                  onClick={() => {
                    const hex = step3BoxColor.startsWith('#') ? step3BoxColor : `#${step3BoxColor}`;
                    finalizeCajaConfig?.(hex);
                    setCajaModalStep?.(0);
                    setTempCajaMaster?.(null);
                  }}
                  className="w-full py-2 mb-2 bg-slate-900 text-white rounded-lg font-bold text-xs uppercase hover:bg-slate-800 transition-colors"
                >
                  Aplicar color
                </button>
                <button type="button" onClick={() => setCajaModalStep(tempVinylType === 'corte' ? 2 : 1)} className="text-xs font-bold text-slate-400 uppercase">← Volver</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
