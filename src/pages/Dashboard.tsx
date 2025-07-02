import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserCheck, 
  Building2, 
  FileText, 
  Calculator,
  TrendingUp,
  Clock,
  DollarSign
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DashboardStats {
  patients: number;
  doctors: number;
  hospitals: number;
  surgeryRequests: number;
  budgets: number;
  totalBudgetValue: number;
  pendingBudgets: number;
  approvedBudgets: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    patients: 0,
    doctors: 0,
    hospitals: 0,
    surgeryRequests: 0,
    budgets: 0,
    totalBudgetValue: 0,
    pendingBudgets: 0,
    approvedBudgets: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [
        patientsResult,
        doctorsResult,
        hospitalsResult,
        surgeryRequestsResult,
        budgetsResult,
        budgetStatsResult,
      ] = await Promise.all([
        supabase.from('patients').select('id', { count: 'exact', head: true }),
        supabase.from('doctors').select('id', { count: 'exact', head: true }),
        supabase.from('hospitals').select('id', { count: 'exact', head: true }),
        supabase.from('surgery_requests').select('id', { count: 'exact', head: true }),
        supabase.from('budgets').select('id', { count: 'exact', head: true }),
        supabase.from('budgets').select('total_cost, status'),
      ]);

      const budgets = budgetStatsResult.data || [];
      const totalBudgetValue = budgets.reduce((sum, budget) => sum + (budget.total_cost || 0), 0);
      const pendingBudgets = budgets.filter(b => 
        ['AWAITING_QUOTE', 'AWAITING_PATIENT', 'AWAITING_PAYMENT'].includes(b.status)
      ).length;
      const approvedBudgets = budgets.filter(b => b.status === 'APPROVED').length;

      setStats({
        patients: patientsResult.count || 0,
        doctors: doctorsResult.count || 0,
        hospitals: hospitalsResult.count || 0,
        surgeryRequests: surgeryRequestsResult.count || 0,
        budgets: budgetsResult.count || 0,
        totalBudgetValue,
        pendingBudgets,
        approvedBudgets,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const statCards = [
    {
      title: 'Pacientes',
      value: stats.patients,
      icon: Users,
      color: 'bg-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Médicos',
      value: stats.doctors,
      icon: UserCheck,
      color: 'bg-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      title: 'Hospitais',
      value: stats.hospitals,
      icon: Building2,
      color: 'bg-teal-600',
      bgColor: 'bg-teal-50',
    },
    {
      title: 'Pedidos de Cirurgia',
      value: stats.surgeryRequests,
      icon: FileText,
      color: 'bg-green-700',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Orçamentos',
      value: stats.budgets,
      icon: Calculator,
      color: 'bg-green-800',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Valor Total dos Orçamentos',
      value: formatCurrency(stats.totalBudgetValue),
      icon: DollarSign,
      color: 'bg-emerald-700',
      bgColor: 'bg-emerald-50',
      isMonetary: true,
    },
  ];

  const statusCards = [
    {
      title: 'Orçamentos Pendentes',
      value: stats.pendingBudgets,
      icon: Clock,
      color: 'bg-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      title: 'Orçamentos Aprovados',
      value: stats.approvedBudgets,
      icon: TrendingUp,
      color: 'bg-green-600',
      bgColor: 'bg-green-50',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Visão geral do CirPlane - Planejamento de Cirurgias
          </p>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => (
          <div key={index} className={`${stat.bgColor} rounded-xl p-6 border border-gray-100`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">{stat.title}</p>
                <p className={`text-2xl font-bold mt-2 ${stat.isMonetary ? 'text-lg' : 'text-gray-900'}`}>
                  {stat.value}
                </p>
              </div>
              <div className={`${stat.color} p-3 rounded-lg`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {statusCards.map((stat, index) => (
          <div key={index} className={`${stat.bgColor} rounded-xl p-6 border border-gray-100`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">{stat.title}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
              </div>
              <div className={`${stat.color} p-3 rounded-lg`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Ações Rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="flex items-center p-4 text-left hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors">
            <Users className="h-8 w-8 text-green-600 mr-3" />
            <div>
              <p className="font-medium text-gray-900">Novo Paciente</p>
              <p className="text-sm text-gray-600">Cadastrar paciente</p>
            </div>
          </button>
          <button className="flex items-center p-4 text-left hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors">
            <UserCheck className="h-8 w-8 text-emerald-600 mr-3" />
            <div>
              <p className="font-medium text-gray-900">Novo Médico</p>
              <p className="text-sm text-gray-600">Cadastrar médico</p>
            </div>
          </button>
          <button className="flex items-center p-4 text-left hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors">
            <FileText className="h-8 w-8 text-green-700 mr-3" />
            <div>
              <p className="font-medium text-gray-900">Pedido de Cirurgia</p>
              <p className="text-sm text-gray-600">Criar novo pedido</p>
            </div>
          </button>
          <button className="flex items-center p-4 text-left hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors">
            <Calculator className="h-8 w-8 text-green-800 mr-3" />
            <div>
              <p className="font-medium text-gray-900">Novo Orçamento</p>
              <p className="text-sm text-gray-600">Criar orçamento</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}