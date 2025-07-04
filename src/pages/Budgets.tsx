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
  Package,
  Truck,
  Printer,
  Zap,
  Scissors,
  MessageSquare
} from 'lucide-react';
import { supabase, Budget, SurgeryRequest, Hospital, OPME, Supplier, Procedure } from '../lib/supabase';

interface OPMERequest {
  opme_id: string;
  quantity: number;
  description: string;
  opme?: OPME;
}

interface SupplierQuote {
  supplier_id: string;
  price: number;
  supplier?: Supplier;
}

interface OPMEQuote {
  opme_id: string;
  selected_supplier_id: string;
  quotes: SupplierQuote[];
}

export default function Budgets() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [surgeryRequests, setSurgeryRequests] = useState<SurgeryRequest[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [opmes, setOpmes] = useState<OPME[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [selectedSurgeryRequest, setSelectedSurgeryRequest] = useState<SurgeryRequest | null>(null);
  const [opmeQuotes, setOpmeQuotes] = useState<OPMEQuote[]>([]);
  const [formData, setFormData] = useState({
    surgery_request_id: '',
    hospital_id: '',
    icu_daily_cost: '',
    ward_daily_cost: '',
    room_daily_cost: '',
    anesthetist_fee: '',
    doctor_fee: '',
    evoked_potential_fee: '',
    observations: '',
    status: 'AWAITING_QUOTE' as const,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [budgetsResult, surgeryRequestsResult, hospitalsResult, opmesResult, suppliersResult, proceduresResult] = await Promise.all([
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
          .order('name'),
        supabase
          .from('opmes')
          .select(`
            *,
            supplier:suppliers(*)
          `),
        supabase
          .from('suppliers')
          .select('*')
          .order('name'),
        supabase
          .from('procedures')
          .select('*')
          .order('name')
      ]);

      if (budgetsResult.error) throw budgetsResult.error;
      if (surgeryRequestsResult.error) throw surgeryRequestsResult.error;
      if (hospitalsResult.error) throw hospitalsResult.error;
      if (opmesResult.error) throw opmesResult.error;
      if (suppliersResult.error) throw suppliersResult.error;
      if (proceduresResult.error) throw proceduresResult.error;

      setBudgets(budgetsResult.data || []);
      setSurgeryRequests(surgeryRequestsResult.data || []);
      setHospitals(hospitalsResult.data || []);
      setOpmes(opmesResult.data || []);
      setSuppliers(suppliersResult.data || []);
      setProcedures(proceduresResult.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateBudgetTotal = (budget: Budget) => {
    const request = budget.surgery_request;
    if (!request) return { subtotal: 0, serviceFee: 0, total: 0 };

    let subtotal = 0;

  

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

    const serviceFee = subtotal * 0.02; // 2% service fee
    const total = subtotal + serviceFee;

    return { subtotal, serviceFee, total };
  };

  const getProcedureNames = (procedureIds: string[]) => {
    if (!procedureIds || !Array.isArray(procedureIds)) return [];
    return procedureIds.map(id => {
      const procedure = procedures.find(p => p.id === id);
      return procedure?.name || 'Procedimento não encontrado';
    });
  };

  const printBudget = (budget: Budget) => {
    const request = budget.surgery_request;
    if (!request) return;

    const { subtotal, serviceFee, total } = calculateBudgetTotal(budget);
    const opmeTotal = budget.opme_quotes && Array.isArray(budget.opme_quotes) 
      ? budget.opme_quotes.reduce((sum: number, quote: any) => {
          const selectedQuote = quote.quotes?.find((q: any) => q.supplier_id === quote.selected_supplier_id);
          return sum + (selectedQuote?.price || 0);
        }, 0)
      : 0;

    const procedureNames = getProcedureNames(request.procedure_ids || []);

    // Função local para formatar moeda na impressão
    const formatCurrencyForPrint = (value: number) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(value);
    };

    // Função local para obter label de status na impressão
    const getStatusLabelForPrint = (status: string) => {
      const labels = {
        'APPROVED': 'Aprovado',
        'AWAITING_QUOTE': 'Aguardando Cotação',
        'AWAITING_PATIENT': 'Aguardando Paciente',
        'AWAITING_PAYMENT': 'Aguardando Pagamento',
        'CANCELED': 'Cancelado',
      };
      return labels[status as keyof typeof labels] || status;
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
            .total-section { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 20px; }
            .subtotal { font-size: 16px; margin-bottom: 8px; }
            .service-fee { font-size: 16px; margin-bottom: 8px; color: #166534; }
            .total { font-size: 20px; font-weight: bold; border-top: 2px solid #166534; padding-top: 10px; }
            .opme-item { border: 1px solid #ddd; padding: 10px; margin-bottom: 10px; }
            .procedure-list { list-style-type: disc; margin-left: 20px; }
            .observations { background: #f0f8ff; padding: 10px; border-left: 4px solid #166534; margin-top: 15px; }
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

          ${procedureNames.length > 0 ? `
            <div class="section">
              <h3>Procedimentos</h3>
              <ul class="procedure-list">
                ${procedureNames.map(name => `<li>${name}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          <div class="section">
            <h3>Custos de Internação</h3>
            <div class="grid">
              <div>
                ${budget.icu_daily_cost ? `<div class="item"><span class="label">Custos do Hospital:</span> ${formatCurrencyForPrint(budget.icu_daily_cost)}</div>` : ''}
${budget.ward_daily_cost ? `<div class="item"><span class="label">Custos do Hospital somente Enfermaria):</span> ${formatCurrencyForPrint(budget.ward_daily_cost)}</div>` : ''}
${budget.room_daily_cost ? `<div class="item"><span class="label">Custos do Hospital somente Apartamente):</span> ${formatCurrencyForPrint(budget.room_daily_cost)}</div>` : ''}

              </div>
              <div>
                <div class="item"><span class="label">Honorário Médico:</span> ${formatCurrencyForPrint(budget.doctor_fee)}</div>
                ${budget.anesthetist_fee ? `<div class="item"><span class="label">Honorário Anestesista:</span> ${formatCurrencyForPrint(budget.anesthetist_fee)}</div>` : ''}
                ${request.evoked_potential && budget.evoked_potential_fee ? `<div class="item"><span class="label">Potencial Evocado:</span> ${formatCurrencyForPrint(budget.evoked_potential_fee)}</div>` : ''}
              </div>
            </div>
          </div>

          ${budget.opme_quotes && Array.isArray(budget.opme_quotes) && budget.opme_quotes.length > 0 ? `
            <div class="section">
              <h3>Materiais OPME</h3>
              ${budget.opme_quotes.map((quote: any) => {
                const opme = getOPMEDetails(quote.opme_id);
                const selectedQuote = quote.quotes?.find((q: any) => q.supplier_id === quote.selected_supplier_id);
                const supplier = suppliers.find(s => s.id === quote.selected_supplier_id);
                return `
                  <div class="opme-item">
                    <div><span class="label">Material:</span> ${opme?.name} - ${opme?.brand}</div>
                    <div><span class="label">Fornecedor:</span> ${supplier?.name}</div>
                    <div><span class="label">Valor:</span> ${formatCurrencyForPrint(selectedQuote?.price || 0)}</div>
                  </div>
                `;
              }).join('')}
              <div class="item"><span class="label">Total OPME:</span> ${formatCurrencyForPrint(opmeTotal)}</div>
            </div>
          ` : ''}

          <div class="total-section">
            <div class="subtotal"><span class="label">Subtotal:</span> ${formatCurrencyForPrint(subtotal)}</div>
            <div class="service-fee"><span class="label">Taxa de Serviço (2%):</span> ${formatCurrencyForPrint(serviceFee)}</div>
            <div class="total"><span class="label">VALOR TOTAL:</span> ${formatCurrencyForPrint(total)}</div>
          </div>

          ${budget.observations ? `
            <div class="observations">
              <h4 style="margin-top: 0; color: #166534;">Observações:</h4>
              <p style="margin-bottom: 0;">${budget.observations}</p>
            </div>
          ` : ''}

          <div class="section" style="margin-top: 40px;">
            <p><span class="label">Status:</span> ${getStatusLabelForPrint(budget.status)}</p>
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

  const handleSurgeryRequestChange = (surgeryRequestId: string) => {
    const request = surgeryRequests.find(r => r.id === surgeryRequestId);
    setSelectedSurgeryRequest(request || null);
    setFormData({ 
      ...formData, 
      surgery_request_id: surgeryRequestId, 
      doctor_fee: request?.doctor_fee?.toString() || '',
      evoked_potential_fee: '' // Reset evoked potential fee when changing request
    });

    if (request && request.opme_requests) {
      const opmeRequests = Array.isArray(request.opme_requests) ? request.opme_requests : [];
      const initialQuotes: OPMEQuote[] = opmeRequests.map((req: any) => ({
        opme_id: req.opme_id,
        selected_supplier_id: '',
        quotes: suppliers.map(supplier => ({
          supplier_id: supplier.id,
          price: 0,
          supplier
        }))
      }));
      setOpmeQuotes(initialQuotes);
    } else {
      setOpmeQuotes([]);
    }
  };

  const updateOpmeQuote = (opmeId: string, supplierIndex: number, price: number) => {
    setOpmeQuotes(prev => prev.map(quote => {
      if (quote.opme_id === opmeId) {
        const newQuotes = [...quote.quotes];
        newQuotes[supplierIndex] = { ...newQuotes[supplierIndex], price };
        return { ...quote, quotes: newQuotes };
      }
      return quote;
    }));
  };

  const selectSupplier = (opmeId: string, supplierId: string) => {
    setOpmeQuotes(prev => prev.map(quote => {
      if (quote.opme_id === opmeId) {
        return { ...quote, selected_supplier_id: supplierId };
      }
      return quote;
    }));
  };

  const getOPMEDetails = (opmeId: string) => {
    return opmes.find(opme => opme.id === opmeId);
  };

  const getOPMERequestDetails = (opmeId: string) => {
    if (!selectedSurgeryRequest?.opme_requests) return null;
    const requests = Array.isArray(selectedSurgeryRequest.opme_requests) ? selectedSurgeryRequest.opme_requests : [];
    return requests.find((req: any) => req.opme_id === opmeId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Check if this would exceed the 3 budget limit
      if (!editingBudget) {
        const { count } = await supabase
          .from('budgets')
          .select('id', { count: 'exact', head: true })
          .eq('surgery_request_id', formData.surgery_request_id);
        
        if (count && count >= 3) {
          alert('Máximo de 3 orçamentos por pedido de cirurgia permitido');
          return;
        }
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
        evoked_potential_fee: formData.evoked_potential_fee ? parseFloat(formData.evoked_potential_fee) : null,
        observations: formData.observations || null,
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
      icu_daily_cost: budget.icu_daily_cost?.toString() || '',
      ward_daily_cost: budget.ward_daily_cost?.toString() || '',
      room_daily_cost: budget.room_daily_cost?.toString() || '',
      anesthetist_fee: budget.anesthetist_fee?.toString() || '',
      doctor_fee: budget.doctor_fee.toString(),
      evoked_potential_fee: budget.evoked_potential_fee?.toString() || '',
      observations: (budget as any).observations || '',
      status: budget.status,
    });

    // Load surgery request and OPME quotes
    const request = surgeryRequests.find(r => r.id === budget.surgery_request_id);
    setSelectedSurgeryRequest(request || null);

    if (budget.opme_quotes && Array.isArray(budget.opme_quotes)) {
      setOpmeQuotes(budget.opme_quotes.map((quote: any) => ({
        ...quote,
        quotes: quote.quotes?.map((q: any) => ({
          ...q,
          supplier: suppliers.find(s => s.id === q.supplier_id)
        })) || []
      })));
    }

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
      icu_daily_cost: '',
      ward_daily_cost: '',
      room_daily_cost: '',
      anesthetist_fee: '',
      doctor_fee: '',
      evoked_potential_fee: '',
      observations: '',
      status: 'AWAITING_QUOTE',
    });
    setSelectedSurgeryRequest(null);
    setOpmeQuotes([]);
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

  const getBudgetCount = (surgeryRequestId: string) => {
    return budgets.filter(b => b.surgery_request_id === surgeryRequestId).length;
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Orçamentos</h1>
          <p className="text-gray-600 mt-2">Gerencie os orçamentos de cirurgias (máximo 3 por pedido)</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition-colors"
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
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
        {filteredBudgets.map((budget) => {
          const budgetCount = getBudgetCount(budget.surgery_request_id);
          const { subtotal, serviceFee, total } = calculateBudgetTotal(budget);
          
          return (
            <div key={budget.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Calculator className="h-6 w-6 text-green-600" />
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
                      <span className="ml-2 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                        {budgetCount}/3 orçamentos
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => printBudget(budget)}
                    className="text-green-600 hover:text-green-800"
                    title="Imprimir Orçamento"
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
                
                {/* Procedures */}
                {budget.surgery_request?.procedure_ids && budget.surgery_request.procedure_ids.length > 0 && (
                  <div className="bg-purple-50 p-2 rounded border border-purple-200">
                    <div className="flex items-center text-purple-800 mb-1">
                      <Scissors className="h-4 w-4 mr-2" />
                      <span className="font-medium">Procedimentos:</span>
                    </div>
                    <div className="text-xs text-purple-700">
                      {getProcedureNames(budget.surgery_request.procedure_ids).join(', ')}
                    </div>
                  </div>
                )}
                
                {/* Surgery Request Details */}
                {budget.surgery_request?.evoked_potential && (
                  <div className="flex items-center text-yellow-600">
                    <Zap className="h-4 w-4 mr-2" />
                    <span><strong>Potencial Evocado:</strong> Sim</span>
                  </div>
                )}
                
                {/* OPME Summary */}
                {budget.opme_quotes && Array.isArray(budget.opme_quotes) && budget.opme_quotes.length > 0 && (
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <div className="flex items-center mb-2">
                      <Package className="h-4 w-4 text-blue-600 mr-2" />
                      <span className="font-medium text-blue-800">Materiais OPME:</span>
                    </div>
                    <div className="space-y-1">
                      {budget.opme_quotes.map((quote: any, index: number) => {
                        const opme = getOPMEDetails(quote.opme_id);
                        const selectedQuote = quote.quotes?.find((q: any) => q.supplier_id === quote.selected_supplier_id);
                        return (
                          <div key={index} className="text-xs text-blue-700">
                            {opme?.name} - {selectedQuote ? formatCurrency(selectedQuote.price) : 'Sem cotação'}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Observations */}
                {(budget as any).observations && (
                  <div className="bg-blue-50 p-2 rounded border border-blue-200">
                    <div className="flex items-center text-blue-800 mb-1">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      <span className="font-medium">Observações:</span>
                    </div>
                    <div className="text-xs text-blue-700">
                      {(budget as any).observations}
                    </div>
                  </div>
                )}
                
                {/* Cost Breakdown */}
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
  <div className="text-xs text-gray-600 space-y-1">
    {budget.icu_daily_cost && (
      <div>UTI: {formatCurrency(budget.icu_daily_cost)}</div>
    )}

    {budget.ward_daily_cost && (
      <div>Enfermaria: {formatCurrency(budget.ward_daily_cost)}</div>
    )}

    {budget.room_daily_cost && (
      <div>Apartamento: {formatCurrency(budget.room_daily_cost)}</div>
    )}
                    {budget.anesthetist_fee && (
                      <div>Anestesista: {formatCurrency(budget.anesthetist_fee)}</div>
                    )}
                    <div>Honorário Médico: {formatCurrency(budget.doctor_fee)}</div>
                    {budget.surgery_request?.evoked_potential && budget.evoked_potential_fee && (
                      <div>Potencial Evocado: {formatCurrency(budget.evoked_potential_fee)}</div>
                    )}
                  </div>
                </div>

                <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-green-700">Subtotal:</span>
                      <span className="text-green-900">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-green-700">Taxa de Serviço (2%):</span>
                      <span className="text-green-900">{formatCurrency(serviceFee)}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-green-200 pt-1">
                      <span className="font-medium text-green-800">Valor Total:</span>
                      <span className="text-lg font-bold text-green-900">{formatCurrency(total)}</span>
                    </div>
                  </div>
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">
                {editingBudget ? 'Editar Orçamento' : 'Novo Orçamento'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pedido de Cirurgia *
                    </label>
                    <select
                      value={formData.surgery_request_id}
                      onChange={(e) => handleSurgeryRequestChange(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    >
                      <option value="">Selecione um pedido</option>
                      {surgeryRequests.map((request) => {
                        const budgetCount = getBudgetCount(request.id);
                        return (
                          <option 
                            key={request.id} 
                            value={request.id}
                            disabled={!editingBudget && budgetCount >= 3}
                          >
                            {request.patient?.name} - Dr. {request.doctor?.name} ({budgetCount}/3)
                            {request.evoked_potential ? ' - Potencial Evocado' : ''}
                          </option>
                        );
                      })}
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

                {/* Surgery Request Info */}
                {selectedSurgeryRequest && (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h3 className="text-lg font-medium text-green-900 mb-2">Informações do Pedido</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p><strong>Paciente:</strong> {selectedSurgeryRequest.patient?.name}</p>
                        <p><strong>Médico:</strong> {selectedSurgeryRequest.doctor?.name}</p>
                        <p><strong>Duração:</strong> {selectedSurgeryRequest.procedure_duration}</p>
                        {selectedSurgeryRequest.procedure_ids && selectedSurgeryRequest.procedure_ids.length > 0 && (
                          <div>
                            <p><strong>Procedimentos:</strong></p>
                            <ul className="list-disc list-inside ml-2 text-xs">
                              {getProcedureNames(selectedSurgeryRequest.procedure_ids).map((name, index) => (
                                <li key={index}>{name}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      <div>
                        <p><strong>UTI:</strong> {selectedSurgeryRequest.needs_icu ? `Sim (${selectedSurgeryRequest.icu_days} dias)` : 'Não'}</p>
                        <p><strong>Enfermaria:</strong> {selectedSurgeryRequest.ward_days || 0} dias</p>
                        <p><strong>Apartamento:</strong> {selectedSurgeryRequest.room_days || 0} dias</p>
                        <p><strong>Potencial Evocado:</strong> {selectedSurgeryRequest.evoked_potential ? 'Sim' : 'Não'}</p>
                        <p><strong>Reserva de Sangue:</strong> {selectedSurgeryRequest.blood_reserve ? `Sim (${selectedSurgeryRequest.blood_units} unidades)` : 'Não'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* OPME Materials Section */}
                {selectedSurgeryRequest && opmeQuotes.length > 0 && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                      <Package className="h-5 w-5 mr-2" />
                      Materiais OPME do Pedido
                    </h3>
                    <div className="space-y-4">
                      {opmeQuotes.map((opmeQuote, opmeIndex) => {
                        const opme = getOPMEDetails(opmeQuote.opme_id);
                        const request = getOPMERequestDetails(opmeQuote.opme_id);
                        
                        return (
                          <div key={opmeQuote.opme_id} className="bg-white p-4 rounded-lg border border-gray-200">
                            <div className="mb-3">
                              <h4 className="font-medium text-gray-900">{opme?.name}</h4>
                              <p className="text-sm text-gray-600">
                                Marca: {opme?.brand} | Quantidade: {request?.quantity || 1}
                              </p>
                              {request?.description && (
                                <p className="text-sm text-gray-600">Descrição: {request.description}</p>
                              )}
                            </div>
                            
                            <div className="space-y-3">
                              <h5 className="text-sm font-medium text-gray-700">Cotações dos Fornecedores:</h5>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {opmeQuote.quotes.map((quote, quoteIndex) => (
                                  <div key={quoteIndex} className="border border-gray-200 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center">
                                        <Truck className="h-4 w-4 text-gray-500 mr-2" />
                                        <span className="text-sm font-medium">
                                          {quote.supplier?.name || `Fornecedor ${quoteIndex + 1}`}
                                        </span>
                                      </div>
                                      <input
                                        type="radio"
                                        name={`selected-${opmeQuote.opme_id}`}
                                        checked={opmeQuote.selected_supplier_id === quote.supplier_id}
                                        onChange={() => selectSupplier(opmeQuote.opme_id, quote.supplier_id)}
                                        className="text-green-600"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-600 mb-1">
                                        Preço (R$)
                                      </label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={quote.price}
                                        onChange={(e) => updateOpmeQuote(opmeQuote.opme_id, quoteIndex, parseFloat(e.target.value) || 0)}
                                        className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                        placeholder="0.00"
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Custos do Hospital (inclui todas as diárias) (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.icu_daily_cost}
                      onChange={(e) => setFormData({ ...formData, icu_daily_cost: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Custos do Hospital (internação enfermaria) (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.ward_daily_cost}
                      onChange={(e) => setFormData({ ...formData, ward_daily_cost: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Custos do Hospital (internação apartamento) (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.room_daily_cost}
                      onChange={(e) => setFormData({ ...formData, room_daily_cost: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Honorário do Anestesista (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.anesthetist_fee}
                      onChange={(e) => setFormData({ ...formData, anesthetist_fee: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="0.00"
                      required
                    />
                  </div>

                  {/* Evoked Potential Fee - only show if surgery request has evoked potential */}
                  {selectedSurgeryRequest?.evoked_potential && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <div className="flex items-center">
                          <Zap className="h-4 w-4 mr-1 text-yellow-600" />
                          Potencial Evocado (R$)
                        </div>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.evoked_potential_fee}
                        onChange={(e) => setFormData({ ...formData, evoked_potential_fee: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="0.00"
                      />
                    </div>
                  )}
                </div>

                {/* Observations Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <div className="flex items-center">
                      <MessageSquare className="h-4 w-4 mr-1 text-blue-600" />
                      Observações
                    </div>
                  </label>
                  <textarea
                    value={formData.observations}
                    onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    rows={3}
                    placeholder="Observações adicionais sobre o orçamento..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="AWAITING_QUOTE">Aguardando Cotação</option>
                    <option value="AWAITING_PATIENT">Aguardando Paciente</option>
                    <option value="AWAITING_PAYMENT">Aguardando Pagamento</option>
                    <option value="APPROVED">Aprovado</option>
                    <option value="CANCELED">Cancelado</option>
                  </select>
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
