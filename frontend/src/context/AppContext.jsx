import React, { createContext, useContext, useState } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [currentView, setCurrentView] = useState('estudio');
  const [activeTab, setActiveTab] = useState('ajuste');
  const [showConfig, setShowConfig] = useState(false);

  return (
    <AppContext.Provider value={{ isDarkMode, setIsDarkMode, currentView, setCurrentView, activeTab, setActiveTab, showConfig, setShowConfig }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => useContext(AppContext);
