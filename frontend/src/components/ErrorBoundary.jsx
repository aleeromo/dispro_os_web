import React from 'react';

const STORAGE_KEY = 'dispro_saved_projects';

function getSafeSavedProjects() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('DisproOS ErrorBoundary:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const err = this.state.error;
      const errMsg = err?.message || String(err);
      return (
        <div className="min-h-screen flex items-center justify-center p-8 transition-colors duration-300 bg-[#050505] text-white">
          <div className="max-w-lg w-full p-10 rounded-[2rem] shadow-2xl backdrop-blur-3xl border bg-[#14151c]/90 border-white/10">
            <h1 className="text-2xl font-black uppercase tracking-tighter mb-4">Algo salió mal</h1>
            <p className="text-sm opacity-80 mb-6">La aplicación encontró un error. Puedes recargar para intentar de nuevo.</p>
            {errMsg && (
              <pre className="text-left text-xs bg-black/40 p-4 rounded-xl mb-6 overflow-auto max-h-32 text-red-300 font-mono break-all">
                {errMsg}
              </pre>
            )}
            <button
              onClick={this.handleRetry}
              className="w-full py-4 font-black uppercase tracking-widest text-sm rounded-2xl transition-all bg-white text-black hover:bg-gray-200"
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

