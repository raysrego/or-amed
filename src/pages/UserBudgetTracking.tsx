import React, { useState, useEffect } from 'react';
import { Search, Eye, CheckCircle, XCircle, RotateCcw, Calculator, Printer, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { UserProfile, UserBudgetTracking as UserBudgetTrackingType } from '../lib/userTypes';

export default function UserBudgetTracking() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [trackings, setTrackings] = useState<UserBudgetTrackingType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [selectedBudgetForPrint, setSelectedBudgetForPrint] = useState<any>(null);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [selectedTracking, setSelectedTracking] = useState<UserBudgetTrackingType | null>(null);
  const [feedbackText, setFeedbackText] = useState('');

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  useEffect(() => {
    if (profile) {
      fetchTrackings();
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

  const fetchTrackings = async () => {
    if (!profile) return;

    try {
      const result = await supabase
        .from('user_budget_tracking')
        .select(`
          *,
          surgery_request:user_surgery_requests(*),
          budget:budgets(
            *,
            hospital:hospitals(name),
            surgery_request:surgery_requests(
              *,
              patient:patients(name),
              doctor:doctors(name)
            )
          )
        `)
        .eq('surgery_request.user_profile_id', profile.id)
        .order('created_at', { ascending: false });

      if (result.error) {
        throw result.error;
      }

      setTrackings(result.data || []);
    } catch (error) {
      console.error('Error fetching trackings:', error);
    }
  };

  const calculateBudgetTotal = (budget: any) => {
    if (!budget) return { subtotal: 0, serviceFee: 0, total: 0 };

    const request = budget.surgery_request;
    if (!request) return { subtotal: 0, serviceFee: 0, total: 0 };

    let subtotal = 0;

    // Add accommodation costs
    subtotal += (budget.icu_daily_cost || 0) * (request.icu_days || 0);
    subtotal += (budget.ward_daily_cost || 0) * (request.ward_days || 0);
    subtotal += (budget.room_daily_cost || 0) * (request.room_days || 0);

    // Add fees
    subtotal += budget.anesthetist_fee || 0;
    subtotal += budget.doctor_fee || 0;

    // Add evoked potential fee if applicable
    if (request.evoked_potential) {
      subtotal += budget.evoked_potential_fee || 0;
    }

    // Add OPME costs
    if (budget.opme_quotes && Array.isArray(budget.opme_quotes)) {
      budget.opme_quotes.forEach((quote: any) => {
        const selectedQuote = quote.quotes?.find((q: any) => q.supplier_id === quote.selected_supplier_id);
        if (selectedQuote) {
          subtotal += selectedQuote.price || 0;
        }
      });
    }

    const serviceFee = subtotal * 0.05; // 5% service fee
    const total = subtotal + serviceFee;

    return { subtotal, serviceFee, total };
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const printBudget = (budget: any, showUnitPrices: boolean = false) => {
    if (!budget) return;

    const request = budget.surgery_request;
    if (!request) return;

    const { subtotal, serviceFee } = calculateBudgetTotal(budget);

    // Função para renderizar custos detalhados ou simplificados
    const renderCostSection = () => {
      if (showUnitPrices) {
        return `
          <div class="section">
            <h3>Detalhamento de Custos Unitários</h3>
            
            <h4 style="margin-top: 15px; color: #166534;">Custos de Internação:</h4>
            ${budget.icu_daily_cost && request.icu_days ? `<div class="item"><span class="label">UTI:</span> ${request.icu_days} dias × ${formatCurrency(budget.icu_daily_cost)} = ${formatCurrency((budget.icu_daily_cost || 0) * (request.icu_days || 0))}</div>` : ''}
            ${budget.ward_daily_cost && request.ward_days ? `<div class="item"><span class="label">Enfermaria:</span> ${request.ward_days} dias × ${formatCurrency(budget.ward_daily_cost)} = ${formatCurrency((budget.ward_daily_cost || 0) * (request.ward_days || 0))}</div>` : ''}
            ${budget.room_daily_cost && request.room_days ? `<div class="item"><span class="label">Apartamento:</span> ${request.room_days} dias × ${formatCurrency(budget.room_daily_cost)} = ${formatCurrency((budget.room_daily_cost || 0) * (request.room_days || 0))}</div>` : ''}
            
            <h4 style="margin-top: 15px; color: #166534;">Honorários Profissionais:</h4>
            ${budget.anesthetist_fee ? `<div class="item"><span class="label">Anestesista:</span> ${formatCurrency(budget.anesthetist_fee)}</div>` : ''}
            <div class="item"><span class="label">Honorário Médico:</span> ${formatCurrency(budget.doctor_fee)}</div>
            ${request.evoked_potential && budget.evoked_potential_fee ? `<div class="item"><span class="label">Potencial Evocado:</span> ${formatCurrency(budget.evoked_potential_fee)}</div>` : ''}
            
            ${budget.opme_quotes && Array.isArray(budget.opme_quotes) && budget.opme_quotes.length > 0 ? `
              <h4 style="margin-top: 15px; color: #166534;">Materiais OPME:</h4>
              ${budget.opme_quotes.map((opmeQuote: any) => {
                const selectedQuote = opmeQuote.quotes?.find((q: any) => q.supplier_id === opmeQuote.selected_supplier_id);
                if (!selectedQuote) return '';
                return `<div class="item"><span class="label">${opmeQuote.opme_name || 'Material OPME'}:</span> 1 unidade × ${formatCurrency(selectedQuote.price || 0)} = ${formatCurrency(selectedQuote.price || 0)}</div>`;
              }).join('')}
            ` : ''}
            
            ${request.hospital_equipment && request.hospital_equipment.length > 0 ? `
              <h4 style="margin-top: 15px; color: #166534;">Equipamentos Hospitalares:</h4>
              <div class="item">${request.hospital_equipment.join(', ')}</div>
            ` : ''}
            
            ${request.exams_during_stay && request.exams_during_stay.length > 0 ? `
              <h4 style="margin-top: 15px; color: #166534;">Exames Durante Internação:</h4>
              <div class="item">${request.exams_during_stay.join(', ')}</div>
            ` : ''}
            
            <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #ddd;">
              <div class="item"><span class="label">Subtotal:</span> ${formatCurrency(subtotal)}</div>
              <div class="item"><span class="label">Taxa de Serviço (5%):</span> ${formatCurrency(serviceFee)}</div>
              <div class="item" style="font-size: 18px; font-weight: bold; border-top: 2px solid #166534; padding-top: 10px; margin-top: 10px;">
                <span class="label">VALOR TOTAL FINAL:</span> ${formatCurrency(total)}
              </div>
            </div>
          </div>
        `;
      } else {
        return `
          <div class="section">
            <h3>Custos de Internação</h3>
            <div class="item"><span class="label">Custos Hospitalares:</span> Inclusos</div>
            <div class="item"><span class="label">Honorários Médicos:</span> Inclusos</div>
            <div class="item"><span class="label">Materiais e Equipamentos:</span> Inclusos</div>
            ${request.evoked_potential ? `<div class="item"><span class="label">Potencial Evocado:</span> Incluso</div>` : ''}
            <div style="margin-top: 15px; padding-top: 10px; border-top: 2px solid #166534;">
              <div class="item" style="font-size: 18px; font-weight: bold;">
                <span class="label">VALOR TOTAL:</span> ${formatCurrency(total)}
              </div>
            </div>
          </div>
        `;
      }
    };
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Orçamento - ${request.patient?.name}</title>
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
            .pulse-line {
              position: absolute;
              top: 8px;
              left: 2px;
              right: 2px;
              height: 2px;
              background: #22c55e;
              border-radius: 1px;
            }
            .section { margin-bottom: 20px; }
            .section h3 { border-bottom: 2px solid #166534; padding-bottom: 5px; color: #166534; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .item { margin-bottom: 10px; }
            .label { font-weight: bold; }
            .total-section { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 20px; }
            .total { font-size: 20px; font-weight: bold; border-top: 2px solid #166534; padding-top: 10px; }
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
            <h2>ORÇAMENTO CIRÚRGICO</h2>
            <p>Data: ${new Date().toLocaleDateString('pt-BR')}</p>
          </div>

          <div class="section">
            <h3>Dados do Paciente</h3>
            <div class="item"><span class="label">Nome:</span> ${request.patient?.name}</div>
          </div>

          <div class="section">
            <h3>Dados da Cirurgia</h3>
            <div class="grid">
              <div>
                <div class="item"><span class="label">Médico:</span> ${request.doctor?.name}</div>
                <div class="item"><span class="label">Hospital:</span> ${budget.hospital?.name}</div>
                <div class="item"><span class="label">Duração:</span> ${request.procedure_duration}</div>
              </div>
              <div>
                <div class="item"><span class="label">UTI:</span> ${request.needs_icu ? 'Sim' : 'Não'}</div>
                <div class="item"><span class="label">Potencial Evocado:</span> ${request.evoked_potential ? 'Sim' : 'Não'}</div>
                <div class="item"><span class="label">Reserva de Sangue:</span> ${request.blood_reserve ? `Sim (${request.blood_units} unidades)` : 'Não'}</div>
              </div>
            </div>
          </div>

          ${renderCostSection()}

          <div class="total-section">
            <div class="total"><span class="label">VALOR TOTAL:</span> ${formatCurrency(total)}</div>
          </div>

          <div class="section" style="margin-top: 40px;">
            <p><span class="label">Status:</span> ${getStatusLabel(budget.status)}</p>
            <p><span class="label">Data do Orçamento:</span> ${new Date(budget.created_at).toLocaleDateString('pt-BR')}</p>
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

  const handleUserResponse = async (trackingId: string, approval: 'approved' | 'revision_requested' | 'rejected') => {
    try {
      const result = await supabase
        .from('user_budget_tracking')
        .update({
          user_approval: approval,
          user_feedback: feedbackText || null,
          status: approval,
          updated_at: new Date().toISOString(),
        })
        .eq('id', trackingId);

      if (result.error) throw result.error;

      setShowBudgetModal(false);
      setSelectedTracking(null);
      setFeedbackText('');
      fetchTrackings();
      
      alert('Resposta enviada com sucesso!');
    } catch (error: any) {
      alert('Erro ao enviar resposta: ' + error.message);
    }
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      'in_progress': 'Em Andamento',
      'awaiting_patient': 'Aguardando Paciente',
      'approved': 'Aprovado',
      'revision_requested': 'Revisão Solicitada',
      'rejected': 'Rejeitado',
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'revision_requested': return 'bg-yellow-100 text-yellow-800';
      case 'awaiting_patient': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredTrackings = trackings.filter(tracking =>
    tracking.surgery_request?.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tracking.surgery_request?.procedure_description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <Calculator className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Configure seu perfil</h2>
        <p className="text-gray-600 mb-4">
          Você precisa configurar seu perfil antes de acompanhar orçamentos.
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Acompanhe seus Orçamentos</h1>
          <p className="text-gray-600 mt-2">Acompanhe o status dos orçamentos dos seus pedidos de cirurgia</p>
        </div>
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

      {/* Trackings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredTrackings.map((tracking) => {
          const { subtotal, serviceFee, total } = calculateBudgetTotal(tracking.budget);
          
          return (
            <div key={tracking.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Calculator className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-3">
                    <h3 className="font-semibold text-gray-900">
                      {tracking.surgery_request?.patient_name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {new Date(tracking.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  {tracking.budget && (
                    <button
                      onClick={() => {
                        setSelectedBudgetForPrint(tracking.budget);
                        setShowPrintOptions(true);
                      }}
                      className="text-green-600 hover:text-green-800"
                      title="Imprimir Orçamento"
                    >
                      <Printer className="h-4 w-4" />
                    </button>
                  )}
                  {tracking.status === 'awaiting_patient' && tracking.budget && (
                    <button
                      onClick={() => {
                        setSelectedTracking(tracking);
                        setShowBudgetModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-800"
                      title="Ver Orçamento"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tracking.status)}`}>
                    {getStatusLabel(tracking.status)}
                  </span>
                  {tracking.budget && (
                    <span className="text-lg font-bold text-green-900">
                      {formatCurrency(total)}
                    </span>
                  )}
                </div>
                
                <div className="text-gray-600">
                  <strong>Procedimento:</strong> {tracking.surgery_request?.procedure_description}
                </div>
                
                {tracking.budget && (
                  <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                    <div className="text-sm text-green-800">
                      <div>Hospital: {tracking.budget.hospital?.name}</div>
                      <div>Subtotal: {formatCurrency(subtotal)}</div>
                      <div>Taxa de Serviço: {formatCurrency(serviceFee)}</div>
                    </div>
                  </div>
                )}
                
                {tracking.user_feedback && (
                  <div className="bg-blue-50 p-2 rounded border border-blue-200">
                    <div className="flex items-center text-blue-800 mb-1">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      <span className="font-medium">Seu Feedback:</span>
                    </div>
                    <div className="text-xs text-blue-700">
                      {tracking.user_feedback}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredTrackings.length === 0 && (
        <div className="text-center py-12">
          <Calculator className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Nenhum orçamento encontrado</p>
        </div>
      )}

      {/* Print Options Modal */}
      {showPrintOptions && selectedBudgetForPrint && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Opções de Impressão</h2>
              <p className="text-gray-600 mb-6">
                Escolha como deseja imprimir o orçamento:
              </p>
              
              <div className="space-y-4">
                <button
                  onClick={() => {
                    printBudget(selectedBudgetForPrint, false);
                    setShowPrintOptions(false);
                    setSelectedBudgetForPrint(null);
                  }}
                  className="w-full p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="font-medium text-gray-900">Versão Simplificada</div>
                  <div className="text-sm text-gray-600">Sem valores unitários - apenas valor total</div>
                </button>
                
                <button
                  onClick={() => {
                    printBudget(selectedBudgetForPrint, true);
                    setShowPrintOptions(false);
                    setSelectedBudgetForPrint(null);
                  }}
                  className="w-full p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="font-medium text-gray-900">Versão Detalhada</div>
                  <div className="text-sm text-gray-600">Com todos os valores unitários</div>
                </button>
              </div>
              
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => {
                    setShowPrintOptions(false);
                    setSelectedBudgetForPrint(null);
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Budget Review Modal */}
      {showBudgetModal && selectedTracking && selectedTracking.budget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">
                Orçamento - {selectedTracking.surgery_request?.patient_name}
              </h2>
              
              <div className="space-y-6">
                {/* Budget Details */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-3">Detalhes do Orçamento</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p><strong>Hospital:</strong> {selectedTracking.budget.hospital?.name}</p>
                      <p><strong>Honorário Médico:</strong> {formatCurrency(selectedTracking.budget.doctor_fee)}</p>
                      {selectedTracking.budget.anesthetist_fee && (
                        <p><strong>Anestesista:</strong> {formatCurrency(selectedTracking.budget.anesthetist_fee)}</p>
                      )}
                    </div>
                    <div>
                      {selectedTracking.budget.icu_daily_cost && (
                        <p><strong>UTI/dia:</strong> {formatCurrency(selectedTracking.budget.icu_daily_cost)}</p>
                      )}
                      {selectedTracking.budget.ward_daily_cost && (
                        <p><strong>Enfermaria/dia:</strong> {formatCurrency(selectedTracking.budget.ward_daily_cost)}</p>
                      )}
                      {selectedTracking.budget.room_daily_cost && (
                        <p><strong>Apartamento/dia:</strong> {formatCurrency(selectedTracking.budget.room_daily_cost)}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Total */}
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(calculateBudgetTotal(selectedTracking.budget).subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Taxa de Serviço (5%):</span>
                      <span>{formatCurrency(calculateBudgetTotal(selectedTracking.budget).serviceFee)}</span>
                    </div>
                    <div className="flex justify-between border-t border-green-200 pt-2 font-bold text-lg">
                      <span>Total:</span>
                      <span>{formatCurrency(calculateBudgetTotal(selectedTracking.budget).total)}</span>
                    </div>
                  </div>
                </div>

                {/* Feedback */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observações (opcional)
                  </label>
                  <textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    rows={3}
                    placeholder="Adicione comentários ou solicitações de alteração..."
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between pt-4">
                  <button
                    onClick={() => {
                      setShowBudgetModal(false);
                      setSelectedTracking(null);
                      setFeedbackText('');
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Fechar
                  </button>
                  
                  <div className="flex space-x-3">
                    <button
                      onClick={() => handleUserResponse(selectedTracking.id, 'rejected')}
                      className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Rejeitar
                    </button>
                    
                    <button
                      onClick={() => handleUserResponse(selectedTracking.id, 'revision_requested')}
                      className="flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Solicitar Revisão
                    </button>
                    
                    <button
                      onClick={() => handleUserResponse(selectedTracking.id, 'approved')}
                      className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Aprovar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}