import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUserProfile } from '../hooks/useUserProfile';
import { Shield } from 'lucide-react';

interface AdminRouteProps {
  children: React.ReactNode;
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const { profile, loading } = useUserProfile();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!profile?.is_admin) {
    return (
      <div className="text-center py-12">
        <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Acesso Negado</h2>
        <p className="text-gray-600 mb-4">
          Você não tem permissão para acessar esta área administrativa.
        </p>
        <button
          onClick={() => window.location.href = '/user-profile'}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
        >
          Voltar ao Perfil
        </button>
      </div>
    );
  }

  return <>{children}</>;
}