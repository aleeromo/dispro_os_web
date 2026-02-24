import { useState, useEffect, useMemo, useCallback } from 'react';

function getSafeSavedProjects() {
  try {
    const raw = localStorage.getItem('dispro_saved_projects');
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * @param {object} opts
 * @param {function} opts.getPdfSnapshot  - () → { pdfFolio, pdfCliente, pdfFecha, pdfTitle, pdfDesc, pdfTotal, pdfBOM }
 * @param {function} opts.onEditProject   - (project) → carga PDF y navega a estudio/pdf
 * @param {function} opts.onPrint         - (project, isInternal) → carga proyecto en PDF antes de imprimir
 * @param {function} opts.onSaved         - (cliente) → navega a vista 'proyectos'
 */
export function useProjectManager({ getPdfSnapshot, onEditProject, onPrint, onSaved }) {
  const [savedProjects,     setSavedProjects]     = useState(getSafeSavedProjects);
  const [showSaveModal,     setShowSaveModal]     = useState(false);
  const [saveCliente,       setSaveCliente]       = useState('');
  const [saveNombre,        setSaveNombre]        = useState('');
  const [selectedProject,   setSelectedProject]   = useState(null);
  const [isWorkOrderMode,   setIsWorkOrderMode]   = useState(false);
  const [activeClientFolder, setActiveClientFolder] = useState(null);

  useEffect(() => {
    const toSave = Array.isArray(savedProjects) ? savedProjects : [];
    localStorage.setItem('dispro_saved_projects', JSON.stringify(toSave));
  }, [savedProjects]);

  const clientesMap = useMemo(() => {
    const list = Array.isArray(savedProjects) ? savedProjects : [];
    return list.reduce((acc, p) => {
      if (!acc[p.cliente]) acc[p.cliente] = [];
      acc[p.cliente].push(p);
      return acc;
    }, {});
  }, [savedProjects]);

  const clientesList = useMemo(() => Object.keys(clientesMap), [clientesMap]);

  const updateProjectData = useCallback((id, key, value) => {
    setSavedProjects((prev) => prev.map((p) => (p.id === id ? { ...p, [key]: value } : p)));
    setSelectedProject((prev) => (prev && prev.id === id ? { ...prev, [key]: value } : prev));
  }, []);

  const updateProjectProgress = useCallback((id, step) => updateProjectData(id, 'progreso', step), [updateProjectData]);

  const iniciarGuardado = useCallback(() => {
    const snap = getPdfSnapshot?.() || {};
    setSaveCliente(snap.pdfCliente === 'Cliente' ? '' : (snap.pdfCliente || ''));
    setSaveNombre(snap.pdfTitle === 'Proyecto Nuevo' ? '' : (snap.pdfTitle || ''));
    setShowSaveModal(true);
  }, [getPdfSnapshot]);

  const concretarGuardado = useCallback(() => {
    const snap = getPdfSnapshot?.() || {};
    const newProj = {
      id:           Date.now(),
      cliente:      saveCliente || 'Sin Cliente',
      nombre:       saveNombre  || 'Proyecto Sin Nombre',
      fecha:        new Date().toLocaleDateString(),
      total:        snap.pdfTotal  || '$0.00',
      folio:        snap.pdfFolio  || '',
      desc:         snap.pdfDesc   || '',
      desglose:     snap.pdfBOM    || {},
      quoteSent:    false,
      quotePrinted: false,
      woSent:       false,
      woPrinted:    false,
      progreso:     1,
      agendaLink:   '',
    };
    setSavedProjects((prev) => [newProj, ...prev]);
    setShowSaveModal(false);
    setActiveClientFolder(newProj.cliente);
    onSaved?.(newProj.cliente);
  }, [saveCliente, saveNombre, getPdfSnapshot, onSaved]);

  const handleEditProject = useCallback((p) => {
    setSelectedProject(null);
    onEditProject?.(p);
  }, [onEditProject]);

  const handleImprimir = useCallback((isInternal) => {
    if (!selectedProject) return;
    setIsWorkOrderMode(isInternal);
    updateProjectData(selectedProject.id, isInternal ? 'woPrinted' : 'quotePrinted', true);
    onPrint?.(selectedProject, isInternal);
    requestAnimationFrame(() => setTimeout(() => window.print(), 500));
  }, [selectedProject, updateProjectData, onPrint]);

  const enviarWhatsAppProyecto = useCallback((isInternal, isEmail = false) => {
    if (!selectedProject) return;
    updateProjectData(selectedProject.id, isInternal ? 'woSent' : 'quoteSent', true);
    const texto = isInternal
      ? `Orden de Trabajo Interna\nFolio: ${selectedProject.folio}\nCliente: ${selectedProject.cliente}\nProyecto: ${selectedProject.nombre}`
      : `Cotización DISPRO\nFolio: ${selectedProject.folio}\nHola ${selectedProject.cliente}, adjunto estimación:\n${selectedProject.nombre}\nTOTAL: ${selectedProject.total}`;
    if (isEmail) window.open(`mailto:?subject=Cotización ${selectedProject.folio}&body=${encodeURIComponent(texto)}`);
    else window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, '_blank');
  }, [selectedProject, updateProjectData]);

  return {
    savedProjects,
    showSaveModal,  setShowSaveModal,
    saveCliente,    setSaveCliente,
    saveNombre,     setSaveNombre,
    selectedProject, setSelectedProject,
    isWorkOrderMode,
    activeClientFolder, setActiveClientFolder,
    clientesMap,
    clientesList,
    // methods
    iniciarGuardado,
    concretarGuardado,
    updateProjectData,
    updateProjectProgress,
    handleEditProject,
    handleImprimir,
    enviarWhatsAppProyecto,
  };
}
