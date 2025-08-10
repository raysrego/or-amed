import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, FileText, User, Calendar, AlertTriangle, Clock, Printer } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { UserProfile, UserSurgeryRequest as UserSurgeryRequestType } from '../lib/userTypes';

export default function UserSurgeryRequest() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [requests, setRequests] = useState<UserSurgeryRequestType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRequest, setEditingRequest] = useState<UserSurgeryRequestType | null>(null);
  const [formData, setFormData] = useState({
    patient_name: '',
    patient_cpf: '',
    patient_birth_date: '',
    patient_contact: '',
    procedure_description: '',
    urgency_level: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    preferred_date: '',
    observations: '',
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  useEffect(() => {
    if (profile) {
      fetchRequests();
    }
  }, [profile]);

  const fetchProfile = async () => {
    try {
      const result = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (result.error && result.error.code !== 'PGRST116') {
        throw result.error;
      }

      if (result.data) {
        setProfile(result.data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    if (!profile) return;

    try {
      const result = await supabase
        .from('user_surgery_requests')
        .select('*')
        .eq('user_profile_id', profile.id)
        .order('created_at', { ascending: false });

      if (result.error) {
        throw result.error;
      }

      setRequests(result.data || []);
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  };

  const printRequest = (request: UserSurgeryRequestType) => {
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Pedido de Cirurgia - ${request.patient_name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { display: flex; align-items: center; justify-content: center; margin-bottom: 10px; }
            .logo-icon { 
              width: 48px; 
              height: 48px; 
              background: #166534; 
              border-radius: 12px; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              margin-right: 15px;
              position: relative;
            }
            .logo-icon::before {
              content: '';
              position: absolute;
              width: 28px;
              height: 24px;
              background: #166534;
              border-radius: 3px;
              top: 18px;
              left: 10px;
            }
            .logo-icon::after {
              content: '';
              position: absolute;
              width: 22px;
              height: 5px;
              background: #dcfce7;
              border-radius: 1px;
              top: 21px;
              left: 13px;
            }
            .pulse-line {
              position: absolute;
              top: 8px;
              left: 2px;
              right: 2px;
              height: 2px;
              background: #22c55e;
              border-radius: 1px;
            }
            .pulse-line::before {
              content: '';
              position: absolute;
              width: 8px;
              height: 8px;
              background: #22c55e;
              border-radius: 50%;
              top: -3px;
              left: 8px;
            }
            .pulse-line::after {
              content: '';
              position: absolute;
              width: 6px;
              height: 6px;
              background: #22c55e;
              border-radius: 50%;
              top: -2px;
              right: 12px;
            }
            .section { margin-bottom: 20px; }
            .section h3 { border-bottom: 2px solid #166534; padding-bottom: 5px; color: #166534; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .item { margin-bottom: 10px; }
            .label { font-weight: bold; }
            .urgency-high { color: #dc2626; font-weight: bold; }
            .urgency-urgent { color: #dc2626; font-weight: bold; text-transform: uppercase; }
            .urgency-medium { color: #f59e0b; font-weight: bold; }
            .urgency-low { color: #10b981; font-weight: bold; }
            .no-print { display: none; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">
              <div class="logo-icon">
                <div class="pulse-line"></div>
              </div>
              <h1 style="margin: 0; color: #166534;">CirPlane</h1>
            </div>
            <p style="margin: 0; color: #666; font-size: 14px;">Planejamento de cirurgias</p>
            <h2>PEDIDO DE CIRURGIA</h2>
            <p>Data: ${new Date().toLocaleDateString('pt-BR')}</p>
          </div>

          <div class="section">
            <h3>Dados do Paciente</h3>
            <div class="grid">
              <div>
                <div class="item"><span class="label">Nome:</span> ${request.patient_name}</div>
                <div class="item"><span class="label">CPF:</span> ${request.patient_cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}</div>
              </div>
              <div>
                <div class="item"><span class="label">Data de Nascimento:</span> ${new Date(request.patient_birth_date).toLocaleDateString('pt-BR')}</div>
                <div class="item"><span class="label">Contato:</span> ${request.patient_contact}</div>
              </div>
            </div>
          </div>

          <div class="section">
            <h3>Dados do Procedimento</h3>
            <div class="item"><span class="label">Descrição:</span> ${request.procedure_description}</div>
            <div class="item">
              <span class="label">Urgência:</span> 
              <span class="urgency-${request.urgency_level}">
                ${getUrgencyLabel(request.urgency_level)}
              </span>
            </div>
            ${request.preferred_date ? `<div class="item"><span class="label">Data Preferencial:</span> ${new Date(request.preferred_date).toLocaleDateString('pt-BR')}</div>` : ''}
          </div>

          ${request.observations ? `
            <div class="section">
              <h3>Observações</h3>
              <p>${request.observations}</p>
            </div>
          ` : ''}

          <div class="section" style="margin-top: 40px;">
            <p><span class="label">Status:</span> ${getStatusLabel(request.status)}</p>
            <p><span class="label">Data do Pedido:</span> ${new Date(request.created_at).toLocaleDateString('pt-BR')}</p>
            <p><span class="label">ID do Pedido:</span> ${request.id}</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profile) {
      alert('Perfil não encontrado. Configure seu perfil primeiro.');
      return;
    }

    try {
      const requestData = {
        user_profile_id: profile.id,
        ...formData,
      };

      if (editingRequest) {
        const result = await supabase
          .from('user_surgery_requests')
          .update(requestData)
          .eq('id', editingRequest.id);
        
        if (result.error) throw result.error;
      } else {
        const result = await supabase
          .from('user_surgery_requests')
          .insert([requestData]);
        
        if (result.error) throw result.error;
      }

      setShowModal(false);
      setEditingRequest(null);
      resetForm();
      fetchRequests();
    } catch (error: any) {
      alert('Erro ao salvar pedido: ' + error.message);
    }
  };

  const handleEdit = (request: UserSurgeryRequestType) => {
    setEditingRequest(request);
    setFormData({
      patient_name: request.patient_name,
      patient_cpf: request.patient_cpf,
      patient_birth_date: request.patient_birth_date,
      patient_contact: request.patient_contact,
      procedure_description: request.procedure_description,
      urgency_level: request.urgency_level,
      preferred_date: request.preferred_date || '',
      observations: request.observations || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este pedido?')) return;

    try {
      const result = await supabase
        .from('user_surgery_requests')
        .delete()
        .eq('id', id);
      
      if (result.error) throw result.error;
      fetchRequests();
    } catch (error: any) {
      alert('Erro ao excluir pedido: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      patient_name: '',
      patient_cpf: '',
      patient_birth_date: '',
      patient_contact: '',
      procedure_description: '',
      urgency_level: 'medium',
      preferred_date: '',
      observations: '',
    });
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getUrgencyLabel = (urgency: string) => {
    const labels = {
      urgent: 'URGENTE',
      high: 'Alta',
      medium: 'Média',
      low: 'Baixa',
    };
    return labels[urgency as keyof typeof labels] || urgency;
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      pending: 'Pendente',
      approved: 'Aprovado',
      rejected: 'Rejeitado',
      in_progress: 'Em Andamento',
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredRequests = requests.filter(request =>
    request.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.procedure_description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!profile && user?.email !== 'rayannyrego@gmail.com') {
    return (
      <div className="text-center py-12">
        <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Configure seu perfil</h2>
        <p className="text-gray-600 mb-4">
          Você precisa configurar seu perfil antes de criar pedidos de cirurgia.
        </p>
        <button
          onClick={() => window.location.href = '/user-profile'}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
        >
          Configurar Perfil
        </button>
      </div>
    );
  }

  // Admin pode acessar mesmo sem perfil configurado
  const isAdmin = user?.email === 'rayannyrego@gmail.com' || profile?.is_admin;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Meus Pedidos de Cirurgia</h1>
          <p className="text-gray-600 mt-2">
            {isAdmin ? 'Gerencie todos os pedidos de cirurgia' : 'Gerencie seus pedidos de cirurgia'}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          Novo Pedido
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por paciente ou procedimento..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>

      {/* Requests Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredRequests.map((request) => (
          <div key={request.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <FileText className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-3">
                  <h3 className="font-semibold text-gray-900">
                    {request.patient_name}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {new Date(request.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => printRequest(request)}
                  className="text-green-600 hover:text-green-800"
                  title="Imprimir Pedido"
                >
                  <Printer className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleEdit(request)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(request.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                  {getStatusLabel(request.status)}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getUrgencyColor(request.urgency_level)}`}>
                  {getUrgencyLabel(request.urgency_level)}
                </span>
              </div>
              
              <div className="text-gray-600">
                <strong>CPF:</strong> {request.patient_cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
              </div>
              
              <div className="text-gray-600">
                <strong>Procedimento:</strong> {request.procedure_description}
              </div>
              
              {request.preferred_date && (
                <div className="flex items-center text-gray-600">
                  <Calendar className="h-4 w-4 mr-2" />
                  <span>Data preferencial: {new Date(request.preferred_date).toLocaleDateString('pt-BR')}</span>
                </div>
              )}
              
              {request.observations && (
                <div className="bg-gray-50 p-2 rounded text-gray-600">
                  <strong>Observações:</strong> {request.observations}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredRequests.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Nenhum pedido de cirurgia encontrado</p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">
                {editingRequest ? 'Editar Pedido de Cirurgia' : 'Novo Pedido de Cirurgia'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome do Paciente *
                    </label>
                    <input
                      type="text"
                      value={formData.patient_name}
                      onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CPF do Paciente *
                    </label>
                    <input
                      type="text"
                      value={formData.patient_cpf}
                      onChange={(e) => setFormData({ ...formData, patient_cpf: e.target.value.replace(/\D/g, '') })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="00000000000"
                      maxLength={11}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data de Nascimento *
                    </label>
                    <input
                      type="date"
                      value={formData.patient_birth_date}
                      onChange={(e) => setFormData({ ...formData, patient_birth_date: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contato do Paciente *
                    </label>
                    <input
                      type="text"
                      value={formData.patient_contact}
                      onChange={(e) => setFormData({ ...formData, patient_contact: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="(11) 99999-9999"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição do Procedimento *
                  </label>
                  <textarea
                    value={formData.procedure_description}
                    onChange={(e) => setFormData({ ...formData, procedure_description: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    rows={3}
                    placeholder="Descreva o procedimento cirúrgico necessário"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nível de Urgência *
                    </label>
                    <select
                      value={formData.urgency_level}
                      onChange={(e) => setFormData({ ...formData, urgency_level: e.target.value as any })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    >
                      <option value="low">Baixa</option>
                      <option value="medium">Média</option>
                      <option value="high">Alta</option>
                      <option value="urgent">URGENTE</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data Preferencial
                    </label>
                    <input
                      type="date"
                      value={formData.preferred_date}
                      onChange={(e) => setFormData({ ...formData, preferred_date: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observações
                  </label>
                  <textarea
                    value={formData.observations}
                    onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    rows={3}
                    placeholder="Informações adicionais sobre o caso"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingRequest(null);
                      resetForm();
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    {editingRequest ? 'Atualizar' : 'Criar Pedido'}
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