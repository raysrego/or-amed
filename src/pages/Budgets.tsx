import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Calculator, Eye, Printer, Building2, User, FileText } from 'lucide-react';
import { supabase, Budget, SurgeryRequest, Hospital, Supplier } from '../lib/supabase';

interface OPMEQuote {
  opme_id: string;
  opme_name: string;
  quotes: {
    supplier_id: string;
    supplier_name: string;
    price: number;
  }[];
  selected_supplier_id?: string;
}

export default function Budgets() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [surgeryRequests, setSurgeryRequests] = useState<SurgeryRequest[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<SurgeryRequest | null>(null);
  const [opmeQuotes, setOpmeQuotes] = useState<OPMEQuote[]>([]);
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [selectedBudgetForPrint, setSelectedBudgetForPrint] = useState<Budget | null>(null);
  
  const [formData, setFormData] = useState({
    surgery_request_id: '',
    hospital_id: '',
    icu_daily_cost: '',
    ward_daily_cost: '',
    room_daily_cost: '',
    anesthetist_fee: '',
    evoked_potential_fee: '',
    status: 'AWAITING_QUOTE' as const,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [budgetsResult, requestsResult, hospitalsResult, suppliersResult] = await Promise.all([
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
          `)
          .order('created_at', { ascending: false }),
        supabase.from('hospitals').select('*').order('name'),
        supabase.from('suppliers').select('*').order('name')
      ]);

      if (budgetsResult.error) throw budgetsResult.error;
      if (requestsResult.error) throw requestsResult.error;
      if (hospitalsResult.error) throw hospitalsResult.error;
      if (suppliersResult.error) throw suppliersResult.error;

      setBudgets(budgetsResult.data || []);
      setSurgeryRequests(requestsResult.data || []);
      setHospitals(hospitalsResult.data || []);
      setSuppliers(suppliersResult.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestChange = (requestId: string) => {
    const request = surgeryRequests.find(r => r.id === requestId);
    setSelectedRequest(request || null);
    setFormData({ ...formData, surgery_request_id: requestId });
    
    if (request && request.opme_requests) {
      const quotes: OPMEQuote[] = request.opme_requests.map((opme: any) => ({
        opme_id: opme.opme_id,
        opme_name: opme.opme_name || 'Material OPME',
        quotes: suppliers.slice(0, 3).map(supplier => ({
          supplier_id: supplier.id,
          supplier_name: supplier.name,
          price: 0
        }))
      }));
      setOpmeQuotes(quotes);
    }
  };

  const updateOPMEQuote = (opmeIndex: number, supplierIndex: number, price: number) => {
    const updated = [...opmeQuotes];
    updated[opmeIndex].quotes[supplierIndex].price = price;
    setOpmeQuotes(updated);
  };

  const selectSupplier = (opmeIndex: number, supplierId: string) => {
    const updated = [...opmeQuotes];
    updated[opmeIndex].selected_supplier_id = supplierId;
    setOpmeQuotes(updated);
  };

  const calculateTotal = () => {
    let total = 0;
    
    // Hospital costs
    if (selectedRequest) {
      total += (parseFloat(formData.icu_daily_cost) || 0) * (selectedRequest.icu_days || 0);
      total += (parseFloat(formData.ward_daily_cost) || 0) * (selectedRequest.ward_days || 0);
      total += (parseFloat(formData.room_daily_cost) || 0) * (selectedRequest.room_days || 0);
      total += selectedRequest.doctor_fee || 0;
    }
    
    // Professional fees
    total += parseFloat(formData.anesthetist_fee) || 0;
    
    // Evoked potential
    if (selectedRequest?.evoked_potential) {
      total += parseFloat(formData.evoked_potential_fee) || 0;
    }
    
    // OPME costs
    opmeQuotes.forEach(opme => {
      if (opme.selected_supplier_id) {
        const selectedQuote = opme.quotes.find(q => q.supplier_id === opme.selected_supplier_id);
        if (selectedQuote) {
          total += selectedQuote.price;
        }
      }
    });
    
    const serviceFee = total * 0.02;
    return { subtotal: total, serviceFee, total: total + serviceFee };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { total } = calculateTotal();
      
      const budgetData = {
        surgery_request_id: formData.surgery_request_id,
        hospital_id: formData.hospital_id,
        opme_quotes: opmeQuotes,
        icu_daily_cost: parseFloat(formData.icu_daily_cost) || null,
        ward_daily_cost: parseFloat(formData.ward_daily_cost) || null,
        room_daily_cost: parseFloat(formData.room_daily_cost) || null,
        anesthetist_fee: parseFloat(formData.anesthetist_fee) || null,
        doctor_fee: selectedRequest?.doctor_fee || 0,
        evoked_potential_fee: selectedRequest?.evoked_potential ? (parseFloat(formData.evoked_potential_fee) || null) : null,
        total_cost: total,
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
      resetForm();
      fetchData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const printBudget = (budget: Budget, detailed: boolean = false) => {
    const request = budget.surgery_request;
    if (!request) return;

    const { subtotal, serviceFee, total } = calculateBudgetTotal(budget);

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Orçamento - ${request.patient?.name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .section { margin-bottom: 20px; }
            .section h3 { border-bottom: 2px solid #166534; padding-bottom: 5px; color: #166534; }
            .item { margin-bottom: 10px; }
            .label { font-weight: bold; }
            .total { font-size: 18px; font-weight: bold; border-top: 2px solid #166534; padding-top: 10px; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>CirPlane - Orçamento Cirúrgico</h1>
            <p>Data: ${new Date().toLocaleDateString('pt-BR')}</p>
          </div>

          <div class="section">
            <h3>Dados do Paciente</h3>
            <div class="item"><span class="label">Nome:</span> ${request.patient?.name}</div>
            <div class="item"><span class="label">Médico:</span> ${request.doctor?.name}</div>
            <div class="item"><span class="label">Hospital:</span> ${budget.hospital?.name}</div>
          </div>

          ${detailed ? `
            <div class="section">
              <h3>Detalhamento de Custos</h3>
              ${budget.icu_daily_cost && request.icu_days ? `<div class="item"><span class="label">UTI:</span> ${request.icu_days} dias × R$ ${budget.icu_daily_cost.toFixed(2)} = R$ ${(budget.icu_daily_cost * request.icu_days).toFixed(2)}</div>` : ''}
              ${budget.ward_daily_cost && request.ward_days ? `<div class="item"><span class="label">Enfermaria:</span> ${request.ward_days} dias × R$ ${budget.ward_daily_cost.toFixed(2)} = R$ ${(budget.ward_daily_cost * request.ward_days).toFixed(2)}</div>` : ''}
              ${budget.room_daily_cost && request.room_days ? `<div class="item"><span class="label">Apartamento:</span> ${request.room_days} dias × R$ ${budget.room_daily_cost.toFixed(2)} = R$ ${(budget.room_daily_cost * request.room_days).toFixed(2)}</div>` : ''}
              <div class="item"><span class="label">Honorário Médico:</span> R$ ${budget.doctor_fee.toFixed(2)}</div>
              ${budget.anesthetist_fee ? `<div class="item"><span class="label">Anestesista:</span> R$ ${budget.anesthetist_fee.toFixed(2)}</div>` : ''}
              ${request.evoked_potential && budget.evoked_potential_fee ? `<div class="item"><span class="label">Potencial Evocado:</span> R$ ${budget.evoked_potential_fee.toFixed(2)}</div>` : ''}
              <div class="item"><span class="label">Subtotal:</span> R$ ${subtotal.toFixed(2)}</div>
              <div class="item"><span class="label">Taxa de Serviço (2%):</span> R$ ${serviceFee.toFixed(2)}</div>
            </div>
          ` : `
            <div class="section">
              <h3>Resumo dos Custos</h3>
              <div class="item">Todos os custos hospitalares, honorários e materiais inclusos</div>
            </div>
          `}

          <div class="total">
            <div class="item"><span class="label">VALOR TOTAL:</span> R$ ${total.toFixed(2)}</div>
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

  const calculateBudgetTotal = (budget: Budget) => {
    const request = budget.surgery_request;
    if (!request) return { subtotal: 0, serviceFee: 0, total: 0 };

    let subtotal = 0;
    
    // Hospital costs
    subtotal += (budget.icu_daily_cost || 0) * (request.icu_days || 0);
    subtotal += (budget.ward_daily_cost || 0) * (request.ward_days || 0);
    subtotal += (budget.room_daily_cost || 0) * (request.room_days || 0);
    
    // Professional fees
    subtotal += budget.doctor_fee || 0;
    subtotal += budget.anesthetist_fee || 0;
    
    // Evoked potential
    if (request.evoked_potential) {
      subtotal += budget.evoked_potential_fee || 0;
    }
    
    // OPME costs
    if (budget.opme_quotes && Array.isArray(budget.opme_quotes)) {
      budget.opme_quotes.forEach((opme: any) => {
        const selectedQuote = opme.quotes?.find((q: any) => q.supplier_id === opme.selected_supplier_id);
        if (selectedQuote) {
          subtotal += selectedQuote.price || 0;
        }
      });
    }
    
    const serviceFee = subtotal * 0.02;
    return { subtotal, serviceFee, total: subtotal + serviceFee };
  };

  const resetForm = () => {
    setFormData({
      surgery_request_id: '',
      hospital_id: '',
      icu_daily_cost: '',
      ward_daily_cost: '',
      room_daily_cost: '',
      anesthetist_fee: '',
      evoked_potential_fee: '',
      status: 'AWAITING_QUOTE',
    });
    setSelectedRequest(null);
    setOpmeQuotes([]);
    setEditingBudget(null);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const filteredBudgets = budgets.filter(budget =>
    budget.surgery_request?.patient?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    budget.surgery_request?.doctor?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    budget.hospital?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
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
          className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          Novo Orçamento
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por paciente, médico ou hospital..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>

      {/* Budgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredBudgets.map((budget) => {
          const { total } = calculateBudgetTotal(budget);
          
          return (
            <div key={budget.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Calculator className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-3">
                    <h3 className="font-semibold text-gray-900">
                      {budget.surgery_request?.patient?.name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {new Date(budget.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setSelectedBudgetForPrint(budget);
                      setShowPrintOptions(true);
                    }}
                    className="text-green-600 hover:text-green-800"
                    title="Imprimir"
                  >
                    <Printer className="h-4 w-4" />
                  </button>
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
                  <span><strong>Médico:</strong> {budget.surgery_request?.doctor?.name}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <Building2 className="h-4 w-4 mr-2" />
                  <span><strong>Hospital:</strong> {budget.hospital?.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    budget.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                    budget.status === 'AWAITING_QUOTE' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {budget.status}
                  </span>
                  <span className="text-lg font-bold text-green-900">
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredBudgets.length === 0 && (
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
              <div className="space-y-4">
                <button
                  onClick={() => {
                    printBudget(selectedBudgetForPrint, false);
                    setShowPrintOptions(false);
                    setSelectedBudgetForPrint(null);
                  }}
                  className="w-full p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="font-medium">Versão Simplificada</div>
                  <div className="text-sm text-gray-600">Apenas valor total</div>
                </button>
                <button
                  onClick={() => {
                    printBudget(selectedBudgetForPrint, true);
                    setShowPrintOptions(false);
                    setSelectedBudgetForPrint(null);
                  }}
                  className="w-full p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="font-medium">Versão Detalhada</div>
                  <div className="text-sm text-gray-600">Todos os valores individuais</div>
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">
                {editingBudget ? 'Editar Orçamento' : 'Novo Orçamento'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Surgery Request and Hospital */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Solicitação de Cirurgia *
                    </label>
                    <select
                      value={formData.surgery_request_id}
                      onChange={(e) => handleRequestChange(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    >
                      <option value="">Selecione uma solicitação</option>
                      {surgeryRequests.map((request) => (
                        <option key={request.id} value={request.id}>
                          {request.patient?.name} - {request.doctor?.name}
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
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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

                {/* Hospital Costs */}
                {selectedRequest && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3">Custos Hospitalares</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {selectedRequest.needs_icu && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            UTI/dia (R$) - {selectedRequest.icu_days} dias
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.icu_daily_cost}
                            onChange={(e) => setFormData({ ...formData, icu_daily_cost: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          />
                        </div>
                      )}
                      {selectedRequest.ward_days && selectedRequest.ward_days > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Enfermaria/dia (R$) - {selectedRequest.ward_days} dias
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.ward_daily_cost}
                            onChange={(e) => setFormData({ ...formData, ward_daily_cost: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          />
                        </div>
                      )}
                      {selectedRequest.room_days && selectedRequest.room_days > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Apartamento/dia (R$) - {selectedRequest.room_days} dias
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.room_daily_cost}
                            onChange={(e) => setFormData({ ...formData, room_daily_cost: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Professional Fees */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Honorários Profissionais</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Honorário Médico (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={selectedRequest?.doctor_fee || 0}
                        disabled
                        className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100"
                      />
                      <p className="text-xs text-gray-500 mt-1">Carregado da solicitação</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Anestesista (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.anesthetist_fee}
                        onChange={(e) => setFormData({ ...formData, anesthetist_fee: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                    
                    {selectedRequest?.evoked_potential && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Potencial Evocado (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.evoked_potential_fee}
                          onChange={(e) => setFormData({ ...formData, evoked_potential_fee: e.target.value })}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* OPME Quotes */}
                {opmeQuotes.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3">Cotações OPME</h3>
                    <div className="space-y-4">
                      {opmeQuotes.map((opme, opmeIndex) => (
                        <div key={opme.opme_id} className="border border-gray-200 rounded-lg p-4">
                          <h4 className="font-medium text-gray-900 mb-3">{opme.opme_name}</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {opme.quotes.map((quote, quoteIndex) => (
                              <div key={quote.supplier_id} className="border border-gray-100 rounded p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-sm">{quote.supplier_name}</span>
                                  <input
                                    type="radio"
                                    name={`opme-${opmeIndex}`}
                                    checked={opme.selected_supplier_id === quote.supplier_id}
                                    onChange={() => selectSupplier(opmeIndex, quote.supplier_id)}
                                  />
                                </div>
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="Preço (R$)"
                                  value={quote.price || ''}
                                  onChange={(e) => updateOPMEQuote(opmeIndex, quoteIndex, parseFloat(e.target.value) || 0)}
                                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Total */}
                {selectedRequest && (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(calculateTotal().subtotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Taxa de Serviço (2%):</span>
                        <span>{formatCurrency(calculateTotal().serviceFee)}</span>
                      </div>
                      <div className="flex justify-between border-t border-green-200 pt-2 font-bold text-lg">
                        <span>Total:</span>
                        <span>{formatCurrency(calculateTotal().total)}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
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