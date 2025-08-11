import React from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Error boundary component
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [hasError, setHasError] = React.useState(false);
  const [errorDetails, setErrorDetails] = React.useState<string>('');

  React.useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      console.error('Global error:', error);
      setErrorDetails(error.message || 'Unknown error');
      setHasError(true);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      setErrorDetails(event.reason?.message || 'Promise rejection');
      setHasError(true);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Algo deu errado</h1>
          <p className="text-gray-600 mb-4">Ocorreu um erro inesperado. Tente recarregar a página.</p>
          <details className="mb-4 text-left bg-red-50 p-4 rounded-lg border border-red-200">
            <summary className="cursor-pointer text-red-800 font-medium">Detalhes do erro</summary>
            <pre className="mt-2 text-xs text-red-700 whitespace-pre-wrap">{errorDetails}</pre>
          </details>
          <button
            onClick={() => window.location.reload()}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            Recarregar Página
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
} else {
  console.error('Root element not found');
}
