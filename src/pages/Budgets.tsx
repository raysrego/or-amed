import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Calculator, 
  Building2, 
  User, 
  FileText,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { supabase, Budget, SurgeryRequest, Hospital } from '../lib/supabase';

export default function Budgets() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [surgeryRequests, setSurgeryRequests] = useState<SurgeryRequest[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [formData, setFormData] = useState({
    surgery_request_id: '',
    hospital_id: '',
    opme_quotes: '[]',
    icu_daily_cost: '',
    ward_daily_cost: '',
    room_daily_cost: '',
    anesthetist_fee: '',
    doctor_fee: '',
    status: 'AWAITING_QUOTE' as const,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [budgetsResult, surgeryRequestsResult, hospitalsResult] = await Promise.all([
        supabase
          .from('budgets')
          .select(`
            *,
            surgery_request:surgery_requests(
              *,
              patient:patients(name),
              doctor:doctors(name)
            ),
            hospital:hospitals(name)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('surgery_requests')
          .select(`
            *,
            patient:patients(name),
            doctor:doctors(name)
          `),
        supabase
          .from('hospitals')
          .select('*')
          .order('name')
      ]);

      if (budgetsResult.error) throw budgetsResult.error;
      if (surgeryRequestsResult.error) throw surgeryRequestsResult.error;
      if (hospitalsResult.error) throw hospitalsResult.error;

      setBudgets(budgetsResult.data || []);
      setSurgeryRequests(surgeryRequestsResult.data || []);
      setHospitals(hospitalsResult.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let opmeQuotes;
      try {
        opmeQuotes = JSON.parse(formData.opme_quotes);
      } catch {
        opmeQuotes = [];
      }

      const budgetData = {
        surgery_request_id: formData.surgery_request_id,
        hospital_id: formData.hospital_id,
        opme_quotes: opmeQuotes,
        icu_daily_cost: formData.icu_daily_cost ? parseFloat(formData.icu_daily_cost) : null,
        ward_daily_cost: formData.ward_daily_cost ? parseFloat(formData.ward_daily_cost) : null,
        room_daily_cost: formData.room_daily_cost ? parseFloat(formData.room_daily_cost) : null,
        anesthetist_fee: formData.anesthetist_fee ? parseFloat(formData.anesthetist_fee) : null,
        doctor_fee: parseFloat(formData.doctor_fee),
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

      setShowModal(false);
      setEditingBudget(null);
      resetForm();
      fetchData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleEdit = (budget: Budget) => {
    setEditingBudget(budget);
    setFormData({
      surgery_request_id: budget.surgery_request_id,
      hospital_id: budget.hospital_id,
      opme_quotes: JSON.stringify(budget.opme_quotes, null, 2),
      icu_daily_cost: budget.icu_daily_cost?.toString() || '',
      ward_daily_cost: budget.ward_daily_cost?.toString() || '',
      room_daily_cost: budget.room_daily_cost?.toString() || '',
      anesthetist_fee: budget.anesthetist_fee?.toString() || '',
      doctor_fee: budget.doctor_fee.toString(),
      status: budget.status,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este orçamento?')) return;

    try {
      const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      fetchData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      surgery_request_id: '',
      hospital_id: '',
      opme_quotes: '[]',
      icu_daily_cost: '',
      ward_daily_cost: '',
      room_daily_cost: '',
      anesthetist_fee: '',
      doctor_fee: '',
      status: 'AWAITING_QUOTE',
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'CANCELED':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'AWAITING_PAYMENT':
        return <DollarSign className="h-5 w-5 text-blue-500" />;
      default:
        return <Clock className="h-5 w-5 text-amber-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'CANCELED':
        return 'bg-red-100 text-red-800';
      case 'AWAITING_PAYMENT':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-amber-100 text-amber-800';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      'APPROVED': 'Aprovado',
      'AWAITING_QUOTE': 'Aguardando Cotação',
      'AWAITING_PATIENT': 'Aguardando Paciente',
      'AWAITING_PAYMENT': 'Aguardando Pagamento',
      'CANCELED': 'Cancelado',
    };
    return labels[status as keyof typeof labels] || status;
  };

  const filteredBudgets = budgets.filter(budget => {
    const matchesSearch = 
      budget.surgery_request?.patient?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      budget.surgery_request?.doctor?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      budget.hospital?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || budget.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Orçamentos</h1>
          <p className="text-gray-600 mt-2">Gerencie os orçamentos de cirurgias</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-600 transition-colors"
        >
          <Plus className="h-5 w-5" />
          Novo Orçamento
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por paciente, médico ou hospital..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="ALL">Todos os Status</option>
          <option value="AWAITING_QUOTE">Aguardando Cotação</option>
          <option value="AWAITING_PATIENT">Aguardando Paciente</option>
          <option value="AWAITING_PAYMENT">Aguardando Pagamento</option>
          <option value="APPROVED">Aprovado</option>
          <option value="CANCELED">Cancelado</option>
        </select>
      </div>

      {/* Budgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredBudgets.map((budget) => (
          <div key={budget.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Calculator className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-3">
                  <h3 className="font-semibold text-gray-900">
                    Orçamento #{budget.id.slice(0, 8)}
                  </h3>
                  <div className="flex items-center mt-1">
                    {getStatusIcon(budget.status)}
                    <span className={`ml-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(budget.status)}`}>
                      {getStatusLabel(budget.status)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEdit(budget)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(budget.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center text-gray-600">
                <User className="h-4 w-4 mr-2" />
                <span><strong>Paciente:</strong> {budget.surgery_request?.patient?.name}</span>
              </div>
              <div className="flex items-center text-gray-600">
                <FileText className="h-4 w-4 mr-2" />
                <span><strong>Médico:</strong> {budget.surgery_request?.doctor?.name}</span>
              </div>
              <div className="flex items-center text-gray-600">
                <Building2 className="h-4 w-4 mr-2" />
                <span><strong>Hospital:</strong> {budget.hospital?.name}</span>
              </div>
              
              {budget.total_cost && (
                <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-green-800">Valor Total:</span>
                    <span className="text-lg font-bold text-green-900">
                      {formatCurrency(budget.total_cost)}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                {budget.icu_daily_cost && (
                  <div>UTI/dia: {formatCurrency(budget.icu_daily_cost)}</div>
                )}
                {budget.ward_daily_cost && (
                  <div>Enfermaria/dia: {formatCurrency(budget.ward_daily_cost)}</div>
                )}
                {budget.room_daily_cost && (
                  <div>Quarto/dia: {formatCurrency(budget.room_daily_cost)}</div>
                )}
                {budget.anesthetist_fee && (
                  <div>Anestesista: {formatCurrency(budget.anesthetist_fee)}</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredBudgets.length === 0 && (
        <div className="text-center py-12">
          <Calculator className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Nenhum orçamento encontrado</p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">
                {editingBudget ? 'Editar Orçamento' : 'Novo Orçamento'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pedido de Cirurgia *
                    </label>
                    <select
                      value={formData.surgery_request_id}
                      onChange={(e) => setFormData({ ...formData, surgery_request_id: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Selecione um pedido</option>
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
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Custo UTI/dia (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.icu_daily_cost}
                      onChange={(e) => setFormData({ ...formData, icu_daily_cost: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Custo Enfermaria/dia (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.ward_daily_cost}
                      onChange={(e) => setFormData({ ...formData, ward_daily_cost: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Custo Quarto/dia (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.room_daily_cost}
                      onChange={(e) => setFormData({ ...formData, room_daily_cost: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Honorário do Anestesista (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.anesthetist_fee}
                      onChange={(e) => setFormData({ ...formData, anesthetist_fee: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Honorário do Médico (R$) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.doctor_fee}
                      onChange={(e) => setFormData({ ...formData, doctor_fee: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="AWAITING_QUOTE">Aguardando Cotação</option>
                    <option value="AWAITING_PATIENT">Aguardando Paciente</option>
                    <option value="AWAITING_PAYMENT">Aguardando Pagamento</option>
                    <option value="APPROVED">Aprovado</option>
                    <option value="CANCELED">Cancelado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cotações OPME (JSON)
                  </label>
                  <textarea
                    value={formData.opme_quotes}
                    onChange={(e) => setFormData({ ...formData, opme_quotes: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    rows={4}
                    placeholder='[{"name": "Implante", "cost": 1000.00}]'
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Formato: Array de objetos com "name" e "cost"
                  </p>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingBudget(null);
                      resetForm();
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    {editingBudget ? 'Atualizar' : 'Criar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}