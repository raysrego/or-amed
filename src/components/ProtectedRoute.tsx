import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  roles?: string[];
  allowCreate?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
}

export default function ProtectedRoute({ 
  children, 
  adminOnly, 
  roles,
  allowCreate = true,
  allowEdit = true,
  allowDelete = true
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
    if (profile.is_admin) {
      return <div data-user-permissions="admin,create,edit,delete">{children}</div>;
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
    if (roles && !roles.includes(profile.role)) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h2>
            <p className="text-gray-600">Você não tem permissão para acessar esta página.</p>
          </div>
        </div>
      );
    }
    
    // Pass user permissions as context
    const userPermissions = {
      canCreate: allowCreate && (profile.is_admin || (roles && roles.includes(profile.role))),
      canEdit: allowEdit && (profile.is_admin || (roles && roles.includes(profile.role))),
      canDelete: allowDelete && profile.is_admin, // Only admin can delete
      isAdmin: profile.is_admin,
      role: profile.role
    };
    
    return (
      <div data-user-permissions={JSON.stringify(userPermissions)}>
        {children}
      </div>
    );
  }
  
  return <>{children}</>;
}