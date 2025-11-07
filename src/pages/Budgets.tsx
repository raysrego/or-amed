import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Calculator, Eye } from 'lucide-react';
import { supabase, Budget, SurgeryRequest, Hospital } from '../lib/supabase';

export default function Budgets() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [surgeryRequests, setSurgeryRequests] = useState<SurgeryRequest[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [budgetsResult, surgeryRequestsResult, hospitalsResult] = await Promise.all([
        supabase
          .from('budgets')
          .select(`
            *,
            surgery_request:surgery_requests(
              id,
              patient:patients(name),
              doctor:doctors(name)
            ),
            hospital:hospitals(name, address)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('surgery_requests')
          .select(`
            *,
            patient:patients(name),
            doctor:doctors(name)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('hospitals').select('*').order('name')
      ]);

      if (budgetsResult.error) throw budgetsResult.error;
      if (surgeryRequestsResult.error) throw surgeryRequestsResult.error;
      if (hospitalsResult.error) throw hospitalsResult.error;

      setBudgets(budgetsResult.data || []);
      setSurgeryRequests(surgeryRequestsResult.data || []);
      setHospitals(hospitalsResult.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const [formData, setFormData] = useState({
    surgery_request_id: '',
    hospital_id: '',
    icu_daily_cost: '',
    ward_daily_cost: '',
    room_daily_cost: '',
    anesthetist_fee: '',
    doctor_fee: '',
    evoked_potential_fee: '',
    status: 'AWAITING_QUOTE' as 'APPROVED' | 'AWAITING_QUOTE' | 'AWAITING_PATIENT' | 'AWAITING_PAYMENT' | 'CANCELED',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const budgetData = {
        surgery_request_id: formData.surgery_request_id,
        hospital_id: formData.hospital_id,
        opme_quotes: [],
        icu_daily_cost: formData.icu_daily_cost ? parseFloat(formData.icu_daily_cost) : null,
        ward_daily_cost: formData.ward_daily_cost ? parseFloat(formData.ward_daily_cost) : null,
        room_daily_cost: formData.room_daily_cost ? parseFloat(formData.room_daily_cost) : null,
        anesthetist_fee: formData.anesthetist_fee ? parseFloat(formData.anesthetist_fee) : null,
        doctor_fee: parseFloat(formData.doctor_fee),
        evoked_potential_fee: formData.evoked_potential_fee ? parseFloat(formData.evoked_potential_fee) : null,
        status: formData.status,
      };

      if (editingBudget) {
        const { error } = await supabase
          .from('budgets')
          .update(budgetData)
          .eq('id', editingBudget.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('budgets')
          .insert([budgetData]);

        if (error) throw error;
      }

      await loadData();
      setShowForm(false);
      setEditingBudget(null);
      resetForm();
    } catch (error: any) {
      console.error('Erro ao salvar orçamento:', error);
      alert('Erro ao salvar orçamento: ' + error.message);
    }
  };

  const handleEdit = (budget: Budget) => {
    setEditingBudget(budget);
    setFormData({
      surgery_request_id: budget.surgery_request_id,
      hospital_id: budget.hospital_id,
      icu_daily_cost: budget.icu_daily_cost?.toString() || '',
      ward_daily_cost: budget.ward_daily_cost?.toString() || '',
      room_daily_cost: budget.room_daily_cost?.toString() || '',
      anesthetist_fee: budget.anesthetist_fee?.toString() || '',
      doctor_fee: budget.doctor_fee.toString(),
      evoked_potential_fee: budget.evoked_potential_fee?.toString() || '',
      status: budget.status,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este orçamento?')) return;

    try {
      const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadData();
    } catch (error: any) {
      console.error('Erro ao excluir orçamento:', error);
      alert('Erro ao excluir orçamento: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      surgery_request_id: '',
      hospital_id: '',
      icu_daily_cost: '',
      ward_daily_cost: '',
      room_daily_cost: '',
      anesthetist_fee: '',
      doctor_fee: '',
      evoked_potential_fee: '',
      status: 'AWAITING_QUOTE',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AWAITING_QUOTE':
        return 'bg-yellow-100 text-yellow-800';
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'AWAITING_PATIENT':
        return 'bg-blue-100 text-blue-800';
      case 'AWAITING_PAYMENT':
        return 'bg-purple-100 text-purple-800';
      case 'CANCELED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'AWAITING_QUOTE':
        return 'Aguardando Cotação';
      case 'APPROVED':
        return 'Aprovado';
      case 'AWAITING_PATIENT':
        return 'Aguardando Paciente';
      case 'AWAITING_PAYMENT':
        return 'Aguardando Pagamento';
      case 'CANCELED':
        return 'Cancelado';
      default:
        return status;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const filteredBudgets = budgets.filter(budget =>
    budget.surgery_request?.patient?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    budget.surgery_request?.doctor?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    budget.hospital?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    budget.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-2">
          <Calculator className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Orçamentos</h1>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingOrcamento(null);
            reset();
          }}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Novo Orçamento</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Buscar orçamentos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingBudget ? 'Editar Orçamento' : 'Novo Orçamento'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pedido de Cirurgia *
                </label>
                <select
                  value={formData.surgery_request_id}
                  onChange={(e) => setFormData({ ...formData, surgery_request_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                >
                  <option value="">Selecione um pedido de cirurgia</option>
                  {surgeryRequests.map((request) => (
                    <option key={request.id} value={request.id}>
                      {request.patient?.name} - Dr. {request.doctor?.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hospital *
                </label>
                <select
                  value={formData.hospital_id}
                  onChange={(e) => setFormData({ ...formData, hospital_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                >
                  <option value="">Selecione um hospital</option>
                  {hospitals.map((hospital) => (
                    <option key={hospital.id} value={hospital.id}>
                      {hospital.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Diária UTI (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.icu_daily_cost}
                    onChange={(e) => setFormData({ ...formData, icu_daily_cost: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Diária Enfermaria (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.ward_daily_cost}
                    onChange={(e) => setFormData({ ...formData, ward_daily_cost: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Diária Apartamento (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.room_daily_cost}
                    onChange={(e) => setFormData({ ...formData, room_daily_cost: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Honorário Anestesista (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.anesthetist_fee}
                    onChange={(e) => setFormData({ ...formData, anesthetist_fee: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Honorário Médico (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.doctor_fee}
                    onChange={(e) => setFormData({ ...formData, doctor_fee: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Taxa Potencial Evocado (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.evoked_potential_fee}
                    onChange={(e) => setFormData({ ...formData, evoked_potential_fee: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status *
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                >
                  <option value="AWAITING_QUOTE">Aguardando Cotação</option>
                  <option value="APPROVED">Aprovado</option>
                  <option value="AWAITING_PATIENT">Aguardando Paciente</option>
                  <option value="AWAITING_PAYMENT">Aguardando Pagamento</option>
                  <option value="CANCELED">Cancelado</option>
                </select>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
                >
                  {editingBudget ? 'Atualizar' : 'Criar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingBudget(null);
                    resetForm();
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Paciente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Médico
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hospital
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredBudgets.map((budget) => (
                <tr key={budget.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">
                      {budget.surgery_request?.patient?.name || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {budget.surgery_request?.doctor?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {budget.hospital?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(budget.status)}`}>
                      {getStatusLabel(budget.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {budget.total_cost ? formatCurrency(budget.total_cost) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {formatDate(budget.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(budget)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(budget.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredBudgets.length === 0 && (
          <div className="text-center py-12">
            <Calculator className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum orçamento encontrado</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm ? 'Tente ajustar sua busca.' : 'Comece adicionando um novo orçamento.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}