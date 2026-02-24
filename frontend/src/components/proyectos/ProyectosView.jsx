import React from 'react';
import { CalendarioPanel } from './CalendarioPanel.jsx';
import { KanbanPanel } from './KanbanPanel.jsx';
import { DirectorioPanel } from './DirectorioPanel.jsx';
import { ProyectoDetalle } from './ProyectoDetalle.jsx';

export function ProyectosView({
  isDarkMode,
  savedProjects,
  clientesList, clientesMap,
  activeClientFolder, setActiveClientFolder,
  selectedProject, setSelectedProject,
  handleEditProject,
  handleImprimir,
  enviarWhatsAppProyecto,
  updateProjectProgress,
}) {
  return (
    <div className={`absolute inset-0 flex flex-col animate-fade-in overflow-hidden ${isDarkMode ? 'bg-transparent' : 'bg-gray-100'}`}>
      <CalendarioPanel isDarkMode={isDarkMode} />

      <div className="h-1/2 w-full px-8 pb-8 flex gap-6">
        <KanbanPanel isDarkMode={isDarkMode} savedProjects={savedProjects} />

        <DirectorioPanel
          isDarkMode={isDarkMode}
          clientesList={clientesList}
          clientesMap={clientesMap}
          activeClientFolder={activeClientFolder}
          setActiveClientFolder={setActiveClientFolder}
          selectedProject={selectedProject}
          setSelectedProject={setSelectedProject}
        />

        <ProyectoDetalle
          isDarkMode={isDarkMode}
          selectedProject={selectedProject}
          handleEditProject={handleEditProject}
          handleImprimir={handleImprimir}
          enviarWhatsAppProyecto={enviarWhatsAppProyecto}
          updateProjectProgress={updateProjectProgress}
        />
      </div>
    </div>
  );
}
