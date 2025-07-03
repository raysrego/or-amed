import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  Users, 
  UserCheck, 
  Scissors, 
  Building2, 
  Truck, 
  ShoppingCart, 
  FileText, 
  Calculator,
  History,
  LogOut,
  Activity,
  Heart,
  User,
  ClipboardList,
  TrendingUp,
  Settings
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';
import PulseCalculatorLogo from './PulseCalculatorLogo';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { signOut, user } = useAuth();
  const { profile, isAdmin } = useUserProfile();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const adminNavItems = [
    { path: '/', icon: Activity, label: 'Dashboard', exact: true },
    { path: '/patients', icon: Users, label: 'Pacientes' },
    { path: '/doctors', icon: UserCheck, label: 'Médicos' },
    { path: '/procedures', icon: Scissors, label: 'Procedimentos' },
    { path: '/anesthesia-types', icon: Heart, label: 'Tipos de Anestesia' },
    { path: '/hospitals', icon: Building2, label: 'Hospitais' },
    { path: '/suppliers', icon: Truck, label: 'Fornecedores' },
    { path: '/opmes', icon: ShoppingCart, label: 'OPMEs' },
    { path: '/surgery-requests', icon: FileText, label: 'Pedidos de Cirurgia' },
    { path: '/budgets', icon: Calculator, label: 'Orçamentos' },
    { path: '/audit-logs', icon: History, label: 'Logs de Auditoria' },
    { path: '/user-management', icon: Settings, label: 'Gerenciar Usuários' },
  ];

  const userNavItems = [
    { path: '/user-profile', icon: User, label: 'Meu Perfil', exact: true },
    { path: '/user-surgery-requests', icon: ClipboardList, label: 'Pedidos de Cirurgia' },
    { path: '/user-budget-tracking', icon: TrendingUp, label: 'Acompanhar Orçamentos' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg flex flex-col min-h-screen">
        <div className="p-6 border-b">
          <div className="flex items-center">
            <PulseCalculatorLogo size="md" className="text-green-800 mr-3" />
            <div>
              <h1 className="text-xl font-bold text-gray-800">
                CirPlane
              </h1>
              <p className="text-sm text-gray-600">
                Planejamento de cirurgias
              </p>
            </div>
          </div>
        </div>
        
        <nav className="mt-6 flex-1">
          <div className="px-4 space-y-1">
            {/* User Module Section */}
            <div className="mb-6">
              <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Área do Usuário
              </h3>
              {userNavItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.exact}
                  className={({ isActive }) =>
                    `flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.label}
                </NavLink>
              ))}
            </div>

            {/* Admin Module Section - Only show for admins */}
            {isAdmin() && (
              <div>
                <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Administração
                </h3>
                {adminNavItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.exact}
                    className={({ isActive }) =>
                      `flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-green-50 text-green-700 border-r-2 border-green-700'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`
                    }
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* User info and logout */}
        <div className="p-4 border-t bg-white mt-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {profile?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
                </span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700 truncate">
                  {profile?.name || user?.email}
                </p>
                {profile?.role && (
                  <p className="text-xs text-gray-500 capitalize">
                    {profile.role === 'admin' ? 'Administrador' : 
                     profile.role === 'doctor' ? 'Médico' : 'Secretária'}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Sair"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}