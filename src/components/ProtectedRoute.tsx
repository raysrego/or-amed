import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  roles?: string[];
}

export default function ProtectedRoute({ 
  children, 
  adminOnly, 
  roles,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();

  // Add error boundary for this component
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    const handleError = (error: any) => {
      console.error('❌ ProtectedRoute error:', error);
      setHasError(true);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Erro na Aplicação</h2>
          <p className="text-gray-600 mb-4">Ocorreu um erro. Tente recarregar a página.</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }
  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
          <p className="text-xs text-gray-500 mt-2">
            Auth: {loading ? 'Loading...' : 'Ready'} | Profile: {profileLoading ? 'Loading...' : 'Ready'}
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Always allow access for the main admin email
  if (user?.email === 'rayannyrego@gmail.com') {
    return <>{children}</>;
  }

  // Check access permissions
  if (profile) {
    // Admin can access everything
    if (profile.is_admin === true || profile.role === 'admin') {
      return <>{children}</>;
    }
    
    // Check admin-only routes
    if (adminOnly) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h2>
            <p className="text-gray-600">Você não tem permissão para acessar esta página.</p>
          </div>
        </div>
      );
    }
    
    // Check role-based access
    if (roles && profile.role && !roles.includes(profile.role)) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h2>
            <p className="text-gray-600">Você não tem permissão para acessar esta página.</p>
          </div>
        </div>
      );
    }
    
    return <>{children}</>;
  }
  
  // If no profile found, show loading or redirect to profile setup
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Configuração Necessária</h2>
        <p className="text-gray-600 mb-4">Complete seu perfil para continuar.</p>
        <button
          onClick={() => window.location.href = '/user-profile'}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
        >
          Configurar Perfil
        </button>
      </div>
    </div>
  );
}