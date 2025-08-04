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

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
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
  
  return <>{children}</>;
}