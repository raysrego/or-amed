import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  FileText, 
  User, 
  UserCheck, 
  Scissors, 
  Package, 
  Clock, 
  Heart,
  Building2,
  TestTube,
  Droplets,
  Calendar,
  Zap,
  Printer
} from 'lucide-react';
import { supabase, SurgeryRequest, Patient, Doctor, Procedure, OPME, AnesthesiaType } from '../lib/supabase';

interface OPMERequest {
  opme_id: string;
  quantity: number;
  description: string;
}

export default function SurgeryRequests() {
  const [surgeryRequests, setSurgeryRequests] = useState<SurgeryRequest[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [opmes, setOpmes] = useState<OPME[]>([]);
  const [anesthesiaTypes, setAnesthesiaTypes] = useState<AnesthesiaType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRequest, setEditingRequest] = useState<SurgeryRequest | null>(null);
  const [selectedProcedures, setSelectedProcedures] = useState<string[]>([]);
  const [opmeRequests, setOpmeRequests] = useState<OPMERequest[]>([]);
  const [hospitalEquipment, setHospitalEquipment] = useState<string[]>([]);
  const [examsDuringStay, setExamsDuringStay] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    patient_id: '',
    doctor_id: '',
    anesthesia_id: '',
    needs_icu: false,
    icu_days: '',
    ward_days: '',
    room_days: '',
    procedure_duration: '',
    doctor_fee: '',
    blood_reserve: false,
    blood_units: '',
    evoked_potential: false,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [
        requestsResult,
        patientsResult,
        doctorsResult,
        proceduresResult,
        opmesResult,
        anesthesiaResult
      ] = await Promise.all([
        supabase
          .from('surgery_requests')
          .select(`
            *,
            patient:patients(name),
            doctor:doctors(name),
            anesthesia_type:anesthesia_types(type)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('patients').select('*').order('name'),
        supabase.from('doctors').select('*').order('name'),
        supabase.from('procedures').select('*').order('name'),
        supabase.from('opmes').select('*').order('name'),
        supabase.from('anesthesia_types').select('*').order('type')
      ]);

      if (requestsResult.error) throw requestsResult.error;
      if (patientsResult.error) throw patientsResult.error;
      if (doctorsResult.error) throw doctorsResult.error;
      if (proceduresResult.error) throw proceduresResult.error;
      if (opmesResult.error) throw opmesResult.error;
      if (anesthesiaResult.error) throw anesthesiaResult.error;

      setSurgeryRequests(requestsResult.data || []);
      setPatients(patientsResult.data || []);
      setDoctors(doctorsResult.data || []);
      setProcedures(proceduresResult.data || []);
      setOpmes(opmesResult.data || []);
      setAnesthesiaTypes(anesthesiaResult.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProcedureNames = (procedureIds: string[]) => {
    if (!procedureIds || !Array.isArray(procedureIds)) return [];
    return procedureIds.map(id => {
      const procedure = procedures.find(p => p.id === id);
      return procedure?.name || 'Procedimento não encontrado';
    });
  };

  const getOPMENames = (opmeRequests: any[]) => {
    if (!opmeRequests || !Array.isArray(opmeRequests)) return [];
    return opmeRequests.map(req => {
      const opme = opmes.find(o => o.id === req.opme_id);
      return {
        name: opme?.name || 'Material não encontrado',
        brand: opme?.brand || '',
        quantity: req.quantity || 1,
        description: req.description || ''
      };
    });
  };

  const printSurgeryRequest = (request: SurgeryRequest) => {
    const procedureNames = getProcedureNames(request.procedure_ids || []);
    const opmeDetails = getOPMENames(request.opme_requests || []);

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Pedido de Cirurgia - ${request.patient?.name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .section { margin-bottom: 20px; }
            .section h3 { border-bottom: 2px solid #333; padding-bottom: 5px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .item { margin-bottom: 10px; }
            .label { font-weight: bold; }
            .procedure-list { list-style-type: disc; margin-left: 20px; }
            .opme-item { border: 1px solid #ddd; padding: 10px; margin-bottom: 10px; }
            .equipment-list { display: flex; flex-wrap: wrap; gap: 5px; }
            .equipment-tag { background: #e3f2fd; padding: 3px 8px; border-radius: 12px; font-size: 12px; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>PEDIDO DE CIRURGIA</h1>
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
                <div class="item"><span class="label">Médico Solicitante:</span> ${request.doctor?.name}</div>
                <div class="item"><span class="label">Tipo de Anestesia:</span> ${request.anesthesia_type?.type}</div>
                <div class="item"><span class="label">Duração do Procedimento:</span> ${request.procedure_duration}</div>
                <div class="item"><span class="label">Honorário Médico:</span> ${formatCurrency(request.doctor_fee)}</div>
              </div>
              <div>
                <div class="item"><span class="label">Necessita UTI:</span> ${request.needs_icu ? `Sim (${request.icu_days} dias)` : 'Não'}</div>
                <div class="item"><span class="label">Enfermaria:</span> ${request.ward_days || 0} dias</div>
                <div class="item"><span class="label">Apartamento:</span> ${request.room_days || 0} dias</div>
                <div class="item"><span class="label">Potencial Evocado:</span> ${request.evoked_potential ? 'Sim' : 'Não'}</div>
                <div class="item"><span class="label">Reserva de Sangue:</span> ${request.blood_reserve ? `Sim (${request.blood_units} unidades)` : 'Não'}</div>
              </div>
            </div>
          </div>

          ${procedureNames.length > 0 ? `
            <div class="section">
              <h3>Procedimentos a serem realizados</h3>
              <ul class="procedure-list">
                ${procedureNames.map(name => `<li>${name}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          ${opmeDetails.length > 0 ? `
            <div class="section">
              <h3>Materiais OPME Solicitados</h3>
              ${opmeDetails.map(opme => `
                <div class="opme-item">
                  <div><span class="label">Material:</span> ${opme.name} - ${opme.brand}</div>
                  <div><span class="label">Quantidade:</span> ${opme.quantity}</div>
                  ${opme.description ? `<div><span class="label">Descrição:</span> ${opme.description}</div>` : ''}
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${request.hospital_equipment && request.hospital_equipment.length > 0 ? `
            <div class="section">
              <h3>Equipamentos Hospitalares Necessários</h3>
              <div class="equipment-list">
                ${request.hospital_equipment.map(equipment => `<span class="equipment-tag">${equipment}</span>`).join('')}
              </div>
            </div>
          ` : ''}

          ${request.exams_during_stay && request.exams_during_stay.length > 0 ? `
            <div class="section">
              <h3>Exames Durante a Internação</h3>
              <div class="equipment-list">
                ${request.exams_during_stay.map(exam => `<span class="equipment-tag">${exam}</span>`).join('')}
              </div>
            </div>
          ` : ''}

          <div class="section" style="margin-top: 40px;">
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
    
    try {
      const requestData = {
        patient_id: formData.patient_id,
        doctor_id: formData.doctor_id,
        procedure_ids: selectedProcedures,
        opme_requests: opmeRequests,
        anesthesia_id: formData.anesthesia_id,
        needs_icu: formData.needs_icu,
        icu_days: formData.icu_days ? parseInt(formData.icu_days) : null,
        ward_days: formData.ward_days ? parseInt(formData.ward_days) : null,
        room_days: formData.room_days ? parseInt(formData.room_days) : null,
        hospital_equipment: hospitalEquipment,
        exams_during_stay: examsDuringStay,
        procedure_duration: formData.procedure_duration,
        doctor_fee: parseFloat(formData.doctor_fee),
        blood_reserve: formData.blood_reserve,
        blood_units: formData.blood_units ? parseInt(formData.blood_units) : null,
        evoked_potential: formData.evoked_potential,
      };

      if (editingRequest) {
        const { error } = await supabase
          .from('surgery_requests')
          .update(requestData)
          .eq('id', editingRequest.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('surgery_requests')
          .insert([requestData]);
        if (error) throw error;
      }

      setShowModal(false);
      setEditingRequest(null);
      resetForm();
      fetchData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleEdit = (request: SurgeryRequest) => {
    setEditingRequest(request);
    setFormData({
      patient_id: request.patient_id,
      doctor_id: request.doctor_id,
      anesthesia_id: request.anesthesia_id,
      needs_icu: request.needs_icu,
      icu_days: request.icu_days?.toString() || '',
      ward_days: request.ward_days?.toString() || '',
      room_days: request.room_days?.toString() || '',
      procedure_duration: request.procedure_duration,
      doctor_fee: request.doctor_fee.toString(),
      blood_reserve: request.blood_reserve,
      blood_units: request.blood_units?.toString() || '',
      evoked_potential: request.evoked_potential || false,
    });
    
    setSelectedProcedures(request.procedure_ids || []);
    setOpmeRequests(Array.isArray(request.opme_requests) ? request.opme_requests : []);
    setHospitalEquipment(request.hospital_equipment || []);
    setExamsDuringStay(request.exams_during_stay || []);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este pedido de cirurgia?')) return;

    try {
      const { error } = await supabase
        .from('surgery_requests')
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
      patient_id: '',
      doctor_id: '',
      anesthesia_id: '',
      needs_icu: false,
      icu_days: '',
      ward_days: '',
      room_days: '',
      procedure_duration: '',
      doctor_fee: '',
      blood_reserve: false,
      blood_units: '',
      evoked_potential: false,
    });
    setSelectedProcedures([]);
    setOpmeRequests([]);
    setHospitalEquipment([]);
    setExamsDuringStay([]);
  };

  const addOpmeRequest = () => {
    setOpmeRequests([...opmeRequests, { opme_id: '', quantity: 1, description: '' }]);
  };

  const updateOpmeRequest = (index: number, field: keyof OPMERequest, value: any) => {
    const updated = [...opmeRequests];
    updated[index] = { ...updated[index], [field]: value };
    setOpmeRequests(updated);
  };

  const removeOpmeRequest = (index: number) => {
    setOpmeRequests(opmeRequests.filter((_, i) => i !== index));
  };

  const addEquipment = (equipment: string) => {
    if (equipment && !hospitalEquipment.includes(equipment)) {
      setHospitalEquipment([...hospitalEquipment, equipment]);
    }
  };

  const removeEquipment = (equipment: string) => {
    setHospitalEquipment(hospitalEquipment.filter(e => e !== equipment));
  };

  const addExam = (exam: string) => {
    if (exam && !examsDuringStay.includes(exam)) {
      setExamsDuringStay([...examsDuringStay, exam]);
    }
  };

  const removeExam = (exam: string) => {
    setExamsDuringStay(examsDuringStay.filter(e => e !== exam));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const filteredRequests = surgeryRequests.filter(request =>
    request.patient?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.doctor?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <h1 className="text-3xl font-bold text-gray-900">Pedidos de Cirurgia</h1>
          <p className="text-gray-600 mt-2">Gerencie os pedidos de cirurgia do sistema</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-600 transition-colors"
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
          placeholder="Buscar por paciente ou médico..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Requests Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredRequests.map((request) => (
          <div key={request.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <FileText className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-3">
                  <h3 className="font-semibold text-gray-900">
                    Pedido #{request.id.slice(0, 8)}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {new Date(request.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => printSurgeryRequest(request)}
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
              <div className="flex items-center text-gray-600">
                <User className="h-4 w-4 mr-2" />
                <span><strong>Paciente:</strong> {request.patient?.name}</span>
              </div>
              <div className="flex items-center text-gray-600">
                <UserCheck className="h-4 w-4 mr-2" />
                <span><strong>Médico:</strong> {request.doctor?.name}</span>
              </div>
              <div className="flex items-center text-gray-600">
                <Heart className="h-4 w-4 mr-2" />
                <span><strong>Anestesia:</strong> {request.anesthesia_type?.type}</span>
              </div>
              <div className="flex items-center text-gray-600">
                <Clock className="h-4 w-4 mr-2" />
                <span><strong>Duração:</strong> {request.procedure_duration}</span>
              </div>
              <div className="flex items-center text-gray-600">
                <Calendar className="h-4 w-4 mr-2" />
                <span><strong>Honorário:</strong> {formatCurrency(request.doctor_fee)}</span>
              </div>
              
              {/* Procedures */}
              {request.procedure_ids && request.procedure_ids.length > 0 && (
                <div className="bg-purple-50 p-2 rounded border border-purple-200">
                  <div className="flex items-center text-purple-800 mb-1">
                    <Scissors className="h-4 w-4 mr-2" />
                    <span className="font-medium">Procedimentos:</span>
                  </div>
                  <div className="text-xs text-purple-700">
                    {getProcedureNames(request.procedure_ids).join(', ')}
                  </div>
                </div>
              )}
              
              {request.needs_icu && (
                <div className="bg-red-50 p-2 rounded border border-red-200">
                  <span className="text-red-800 font-medium">Necessita UTI: {request.icu_days} dias</span>
                </div>
              )}
              
              {request.blood_reserve && (
                <div className="bg-blue-50 p-2 rounded border border-blue-200">
                  <div className="flex items-center text-blue-800">
                    <Droplets className="h-4 w-4 mr-2" />
                    <span>Reserva de sangue: {request.blood_units} unidades</span>
                  </div>
                </div>
              )}

              {request.evoked_potential && (
                <div className="bg-yellow-50 p-2 rounded border border-yellow-200">
                  <div className="flex items-center text-yellow-800">
                    <Zap className="h-4 w-4 mr-2" />
                    <span>Potencial Evocado: Sim</span>
                  </div>
                </div>
              )}

              {request.opme_requests && Array.isArray(request.opme_requests) && request.opme_requests.length > 0 && (
                <div className="bg-teal-50 p-2 rounded border border-teal-200">
                  <div className="flex items-center text-teal-800 mb-1">
                    <Package className="h-4 w-4 mr-2" />
                    <span className="font-medium">Materiais OPME:</span>
                  </div>
                  <div className="text-xs text-teal-700">
                    {request.opme_requests.length} material(is) solicitado(s)
                  </div>
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
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">
                {editingRequest ? 'Editar Pedido de Cirurgia' : 'Novo Pedido de Cirurgia'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Patient and Doctor */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Paciente *
                    </label>
                    <select
                      value={formData.patient_id}
                      onChange={(e) => setFormData({ ...formData, patient_id: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Selecione um paciente</option>
                      {patients.map((patient) => (
                        <option key={patient.id} value={patient.id}>
                          {patient.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Médico Solicitante *
                    </label>
                    <select
                      value={formData.doctor_id}
                      onChange={(e) => setFormData({ ...formData, doctor_id: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Selecione um médico</option>
                      {doctors.map((doctor) => (
                        <option key={doctor.id} value={doctor.id}>
                          {doctor.name} - CRM: {doctor.crm}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Procedures */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Procedimentos a serem realizados *
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-3">
                    {procedures.map((procedure) => (
                      <label key={procedure.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedProcedures.includes(procedure.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedProcedures([...selectedProcedures, procedure.id]);
                            } else {
                              setSelectedProcedures(selectedProcedures.filter(id => id !== procedure.id));
                            }
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm">{procedure.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* OPME Materials */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Materiais OPME
                    </label>
                    <button
                      type="button"
                      onClick={addOpmeRequest}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      + Adicionar Material
                    </button>
                  </div>
                  <div className="space-y-3">
                    {opmeRequests.map((request, index) => (
                      <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-2 p-3 border border-gray-200 rounded-lg">
                        <select
                          value={request.opme_id}
                          onChange={(e) => updateOpmeRequest(index, 'opme_id', e.target.value)}
                          className="p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Selecione um material</option>
                          {opmes.map((opme) => (
                            <option key={opme.id} value={opme.id}>
                              {opme.name} - {opme.brand}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          placeholder="Quantidade"
                          value={request.quantity}
                          onChange={(e) => updateOpmeRequest(index, 'quantity', parseInt(e.target.value) || 1)}
                          className="p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          min="1"
                        />
                        <input
                          type="text"
                          placeholder="Descrição/Observações"
                          value={request.description}
                          onChange={(e) => updateOpmeRequest(index, 'description', e.target.value)}
                          className="p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => removeOpmeRequest(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Anesthesia and Duration */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo de Anestesia *
                    </label>
                    <select
                      value={formData.anesthesia_id}
                      onChange={(e) => setFormData({ ...formData, anesthesia_id: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Selecione o tipo</option>
                      {anesthesiaTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.type}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tempo de Procedimento *
                    </label>
                    <input
                      type="text"
                      value={formData.procedure_duration}
                      onChange={(e) => setFormData({ ...formData, procedure_duration: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: 2 hours, 90 minutes"
                      required
                    />
                  </div>
                </div>

                {/* ICU and Stay */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.needs_icu}
                      onChange={(e) => setFormData({ ...formData, needs_icu: e.target.checked })}
                      className="mr-2"
                    />
                    <label className="text-sm font-medium text-gray-700">
                      Necessita UTI
                    </label>
                  </div>
                  
                  {formData.needs_icu && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Diárias UTI
                      </label>
                      <input
                        type="number"
                        value={formData.icu_days}
                        onChange={(e) => setFormData({ ...formData, icu_days: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="0"
                      />
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Diárias Enfermaria
                    </label>
                    <input
                      type="number"
                      value={formData.ward_days}
                      onChange={(e) => setFormData({ ...formData, ward_days: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="0"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Diárias Apartamento
                    </label>
                    <input
                      type="number"
                      value={formData.room_days}
                      onChange={(e) => setFormData({ ...formData, room_days: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="0"
                    />
                  </div>
                </div>

                {/* Hospital Equipment */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Equipamento Hospitalar
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {hospitalEquipment.map((equipment, index) => (
                      <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm flex items-center">
                        {equipment}
                        <button
                          type="button"
                          onClick={() => removeEquipment(equipment)}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Adicionar equipamento"
                      className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addEquipment((e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        const input = (e.target as HTMLButtonElement).previousElementSibling as HTMLInputElement;
                        addEquipment(input.value);
                        input.value = '';
                      }}
                      className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>

                {/* Exams During Stay */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Exames Durante Internação
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {examsDuringStay.map((exam, index) => (
                      <span key={index} className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm flex items-center">
                        {exam}
                        <button
                          type="button"
                          onClick={() => removeExam(exam)}
                          className="ml-1 text-green-600 hover:text-green-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Adicionar exame"
                      className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addExam((e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        const input = (e.target as HTMLButtonElement).previousElementSibling as HTMLInputElement;
                        addExam(input.value);
                        input.value = '';
                      }}
                      className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>

                {/* Doctor Fee, Blood Reserve, and Evoked Potential */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Honorário Médico (R$) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.doctor_fee}
                      onChange={(e) => setFormData({ ...formData, doctor_fee: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.blood_reserve}
                      onChange={(e) => setFormData({ ...formData, blood_reserve: e.target.checked })}
                      className="mr-2"
                    />
                    <label className="text-sm font-medium text-gray-700">
                      Reserva de Sangue
                    </label>
                  </div>
                  
                  {formData.blood_reserve && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Unidades de Hemácias
                      </label>
                      <input
                        type="number"
                        value={formData.blood_units}
                        onChange={(e) => setFormData({ ...formData, blood_units: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="1"
                      />
                    </div>
                  )}

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.evoked_potential}
                      onChange={(e) => setFormData({ ...formData, evoked_potential: e.target.checked })}
                      className="mr-2"
                    />
                    <label className="text-sm font-medium text-gray-700">
                      Potencial Evocado
                    </label>
                  </div>
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
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    {editingRequest ? 'Atualizar' : 'Criar'}
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