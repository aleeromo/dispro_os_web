import React from 'react';
import { useDispro } from './hooks/useDispro.js';
import { PDFContent } from './components/PDFContent.jsx';
import { CotizadorModule } from './components/CotizadorModule.jsx';
import { Letras3DView } from './components/Letras3DView.jsx';
import { AppSidebar } from './components/AppSidebar.jsx';
import { PrintRollModal } from './components/modals/PrintRollModal.jsx';
import { SaveProjectModal } from './components/modals/SaveProjectModal.jsx';
import { ErrorToast } from './components/modals/ErrorToast.jsx';
import { EstudioView } from './components/estudio/EstudioView.jsx';
import { ProyectosView } from './components/proyectos/ProyectosView.jsx';
import { BaseDatosView } from './components/BaseDatosView.jsx';

export default function App() {
  const d = useDispro();

  const handleAbrirLetras3DEnEstudio = (res) => {
    if (!res) return;
    d.setResultado(res);
    d.setValues.setPdfFolio(res.folio || '');
    d.setPdfBOM(res.desglose_tecnico || {});
    d.setValues.setPdfTotal(`$${(res.total_venta || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
    const sp = (res.desglose_texto || '').split('|SPLIT|');
    if (sp.length > 1) {
      d.setValues.setPdfTitle(sp[0].trim());
      d.setValues.setPdfDesc(sp[1].trim());
    }
    d.setCurrentView('estudio');
    d.setActiveTab('planos');
  };

  return (
    <>
      <input
        type="file"
        ref={d.globalInputRef}
        onChange={(e) => { if (e.target.files?.length) d.procesarArchivo(e.target.files[0]); e.target.value = null; }}
        className="hidden"
      />

      <style>{`
        @media screen { #fixed-print-layer { display: none !important; } }
        @media print {
          @page { size: 8.5in 11in; margin: 0 !important; }
          html, body { background: white !important; margin: 0; padding: 0; width: 8.5in; height: 11in; overflow: visible !important; }
          #root-main-content { display: none !important; }
          #fixed-print-layer { display: block !important; position: absolute; top: 0; left: 0; width: 100%; }
          #fixed-print-layer * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .pdf-edit-mode { background: rgba(0,0,0, 0.05) !important; border: 2px dashed #000 !important; cursor: move; }
        .drop-zone-active { border: 2px dashed #ffffff !important; background: #111 !important; }
        .no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <div
        id="root-main-content"
        className={`flex h-screen font-sans overflow-hidden transition-colors duration-300 relative ${d.isDarkMode ? 'bg-[#050505] text-white' : 'bg-gray-100 text-black'}`}
      >
        {d.isDarkMode && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />
          </div>
        )}

        {d.showPrintModal && (
          <PrintRollModal
            isDarkMode={d.isDarkMode}
            tempAncho={d.tempAncho}
            setTempAncho={d.setTempAncho}
            printDPI={d.printDPI}
            imgData={d.imgData}
            confirmarMedidaPrint={d.confirmarMedidaPrint}
          />
        )}

        <ErrorToast isDarkMode={d.isDarkMode} errorMsg={d.errorMsg} setErrorMsg={d.setErrorMsg} />

        {d.showSaveModal && (
          <SaveProjectModal
            isDarkMode={d.isDarkMode}
            saveCliente={d.saveCliente}
            setSaveCliente={d.setSaveCliente}
            saveNombre={d.saveNombre}
            setSaveNombre={d.setSaveNombre}
            concretarGuardado={d.concretarGuardado}
            setShowSaveModal={d.setShowSaveModal}
          />
        )}

        <AppSidebar
          isDarkMode={d.isDarkMode}
          setIsDarkMode={d.setIsDarkMode}
          currentView={d.currentView}
          setCurrentView={d.setCurrentView}
          showConfig={d.showConfig}
          setShowConfig={d.setShowConfig}
          handleHomeClick={d.handleHomeClick}
        />

        <main className="flex-1 relative overflow-hidden flex flex-col">
          {d.currentView === 'cotizador' && (
            <div className="absolute inset-0">
              <CotizadorModule isDarkMode={d.isDarkMode} handleGenerarExpress={d.handleGenerarExpress} />
            </div>
          )}

          {d.currentView === 'letras3d' && (
            <Letras3DView isDarkMode={d.isDarkMode} onAbrirEnEstudio={handleAbrirLetras3DEnEstudio} />
          )}

          {d.currentView === 'baseDatos' && (
            <BaseDatosView isDarkMode={d.isDarkMode} />
          )}

          {d.currentView === 'proyectos' && (
            <ProyectosView
              isDarkMode={d.isDarkMode}
              savedProjects={d.savedProjects}
              clientesList={d.clientesList}
              clientesMap={d.clientesMap}
              activeClientFolder={d.activeClientFolder}
              setActiveClientFolder={d.setActiveClientFolder}
              selectedProject={d.selectedProject}
              setSelectedProject={d.setSelectedProject}
              handleEditProject={d.handleEditProject}
              handleImprimir={d.handleImprimir}
              enviarWhatsAppProyecto={d.enviarWhatsAppProyecto}
              updateProjectProgress={d.updateProjectProgress}
            />
          )}

          {d.currentView === 'estudio' && (
            <EstudioView
              isDarkMode={d.isDarkMode}
              activeTab={d.activeTab}
              setActiveTab={d.setActiveTab}
              tabsDisponibles={d.tabsDisponibles}
              preview={d.preview}
              isDetecting={d.isDetecting}
              isDragging={d.isDragging}
              setIsDragging={d.setIsDragging}
              handleDrop={d.handleDrop}
              resultado={d.resultado}
              cajas={d.cajas}
              selectedCajas={d.selectedCajas}
              setSelectedCajas={d.setSelectedCajas}
              cajasIgnoradas={d.cajasIgnoradas}
              toggleSelection={d.toggleSelection}
              toggleIgnoreStatus={d.toggleIgnoreStatus}
              fusionarCajas={d.fusionarCajas}
              classifications={d.classifications}
              updateClassification={d.updateClassification}
              cajaModalStep={d.cajaModalStep}
              setCajaModalStep={d.setCajaModalStep}
              tempCajaMaster={d.tempCajaMaster}
              setTempCajaMaster={d.setTempCajaMaster}
              tempVinylType={d.tempVinylType}
              setTempVinylType={d.setTempVinylType}
              tempVinylColor={d.tempVinylColor}
              setTempVinylColor={d.setTempVinylColor}
              finalizeCajaConfig={d.finalizeCajaConfig}
              bgMontaje={d.bgMontaje}
              setBgMontaje={d.setBgMontaje}
              isCalculating={d.isCalculating}
              analizar={d.analizar}
              archivoSeleccionado={d.archivoSeleccionado}
              imgData={d.imgData}
              modo={d.modo}
              setModo={d.setModo}
              materialCara={d.materialCara}
              setMaterialCara={d.setMaterialCara}
              aluminioTipo={d.aluminioTipo}
              setAluminioTipo={d.setAluminioTipo}
              colorMate={d.colorMate}
              setColorMate={d.setColorMate}
              materialCanto={d.materialCanto}
              setMaterialCanto={d.setMaterialCanto}
              profCanto={d.profCanto}
              setProfCanto={d.setProfCanto}
              ancho={d.ancho}
              setAncho={d.setAncho}
              alto={d.alto}
              setAlto={d.setAlto}
              conLuz={d.conLuz}
              setConLuz={d.setConLuz}
              anchoRollo={d.anchoRollo}
              setAnchoRollo={d.setAnchoRollo}
              anchosDisponibles={d.anchosDisponibles}
              getAnchosRollo={d.getAnchosRollo}
              wallTexture={d.wallTexture}
              texture={d.texture}
              conFlete={d.conFlete}
              setConFlete={d.setConFlete}
              destinoFlete={d.destinoFlete}
              setDestinoFlete={d.setDestinoFlete}
              infoFlete={d.infoFlete}
              isCalculatingFlete={d.isCalculatingFlete}
              calcularFlete={d.calcularFlete}
              viewBoxStr={d.viewBoxStr}
              sheetW={d.sheetW}
              sheetH={d.sheetH}
              gap={d.gap}
              numPlacas={d.numPlacas}
              descargarVectoresCNC={d.descargarVectoresCNC}
              pdfPositions={d.pdfPositions}
              setPdfPositions={d.setPdfPositions}
              pdfCliente={d.pdfCliente}
              pdfFecha={d.pdfFecha}
              pdfTitle={d.pdfTitle}
              pdfDesc={d.pdfDesc}
              pdfTotal={d.pdfTotal}
              pdfFolio={d.pdfFolio}
              pdfBOM={d.pdfBOM}
              pdfImgScale={d.pdfImgScale}
              pdfScale={d.pdfScale}
              isPdfEditing={d.isPdfEditing}
              setIsPdfEditing={d.setIsPdfEditing}
              pdfBackground={d.pdfBackground}
              setPdfBackground={d.setPdfBackground}
              pdfContainerRef={d.pdfContainerRef}
              pdfBgInputRef={d.pdfBgInputRef}
              setValues={d.setValues}
              enviarWhatsAppProyecto={d.enviarWhatsAppProyecto}
              iniciarGuardado={d.iniciarGuardado}
              globalInputRef={d.globalInputRef}
              bgInputRef={d.bgInputRef}
            />
          )}
        </main>
      </div>

      <div id="fixed-print-layer">
        <PDFContent
          positions={d.pdfPositions}
          values={{ pdfCliente: d.pdfCliente, pdfFecha: d.pdfFecha, pdfTitle: d.pdfTitle, pdfDesc: d.pdfDesc, pdfTotal: d.pdfTotal, pdfFolio: d.pdfFolio, pdfBOM: d.pdfBOM, pdfImgScale: d.pdfImgScale }}
          editing={false}
          preview={d.preview}
          isWorkOrder={d.isWorkOrderMode}
          resultado={d.resultado}
          customBg={d.pdfBackground}
        />
      </div>
    </>
  );
}
