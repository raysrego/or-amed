import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Users, UserCheck, Stethoscope, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';
import { UserProfile } from '../lib/userTypes';

export default function UserManagement() {
  const { user } = useAuth();
  const { profile: currentUserProfile, loading: profileLoading } = useUserProfile();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [doctorsFromUserProfiles, setDoctorsFromUserProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'secretary' as 'doctor' | 'secretary' | 'admin',
    crm: '',
    specialty: '',
    doctor_id: '',
  });

  useEffect(() => {
    fetchUsers();
    fetchDoctorsFromBothTables();
  }, []);

  const fetchUsers = async () => {
    try {
      const result = await supabase
        .from('user_profiles')
        .select(`
          *,
          doctor:user_profiles!doctor_id(*)
        `)
        .order('created_at', { ascending: false });

      if (result.error) {
        throw result.error;
      }

      setUsers(result.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctorsFromBothTables = async () => {
    try {
      // Buscar médicos da tabela doctors
      const doctorsResult = await supabase
        .from('doctors')
        .select('id, name, crm, specialty')
        .order('name');

      if (doctorsResult.error) {
        console.error('Error fetching doctors from doctors table:', doctorsResult.error);
      } else {
        setDoctors(doctorsResult.data || []);
      }

      // Buscar médicos da tabela user_profiles
      const userProfilesResult = await supabase
        .from('user_profiles')
        .select('id, name, crm, specialty')
        .eq('role', 'doctor')
        .order('name');

      if (userProfilesResult.error) {
        console.error('Error fetching doctors from user_profiles:', userProfilesResult.error);
      } else {
        setDoctorsFromUserProfiles(userProfilesResult.data || []);
      }

    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setFormLoading(true);
    
    try {
      if (editingUser) {
        await updateUser();
      } else {
        await createUser();
      }

      setShowModal(false);
      setEditingUser(null);
      resetForm();
      fetchUsers();
      fetchDoctorsFromBothTables();
    } catch (error: any) {
      console.error('Error in handleSubmit:', error);
      alert(error.message || 'Erro ao salvar usuário');
    } finally {
      setFormLoading(false);
    }
  };

  const updateUser = async () => {
    if (!editingUser) return;
    
    const profileData = {
      name: formData.name,
      role: formData.role,
      is_admin: formData.role === 'admin',
      crm: formData.role === 'doctor' ? formData.crm : null,
      specialty: formData.role === 'doctor' ? formData.specialty : null,
      doctor_id: formData.role === 'secretary' ? (formData.doctor_id || null) : null,
    };

    const result = await supabase
      .from('user_profiles')
      .update(profileData)
      .eq('id', editingUser.id);
    
    if (result.error) throw result.error;
    alert('Usuário atualizado com sucesso!');
  };

  const createUser = async () => {
    if (!formData.email?.trim()) throw new Error('Email é obrigatório');
    if (!formData.name?.trim()) throw new Error('Nome é obrigatório');

    if (formData.role === 'doctor') {
      if (!formData.crm?.trim()) throw new Error('CRM é obrigatório');
      if (!formData.specialty?.trim()) throw new Error('Especialidade é obrigatória');
    }

    if (formData.role === 'secretary' && formData.doctor_id) {
      // Verificar se o médico existe em qualquer uma das tabelas
      const doctorExistsInDoctors = doctors.find(d => d.id === formData.doctor_id);
      const doctorExistsInUserProfiles = doctorsFromUserProfiles.find(d => d.id === formData.doctor_id);
      
      if (!doctorExistsInDoctors && !doctorExistsInUserProfiles) {
        throw new Error('Médico selecionado não encontrado');
      }
    }

    // Verificar se email já existe
    const { data: existingUser } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('email', formData.email.trim())
      .single();

    if (existingUser) {
      throw new Error('Este email já está cadastrado');
    }

    // Preparar dados para envio
    const userData = {
      email: formData.email.trim(),
      password: formData.password || Math.random().toString(36).slice(-12),
      name: formData.name.trim(),
      role: formData.role,
      crm: formData.role === 'doctor' ? formData.crm?.trim() || null : null,
      specialty: formData.role === 'doctor' ? formData.specialty?.trim() || null : null,
      doctor_id: formData.role === 'secretary' ? (formData.doctor_id || null) : null,
    };

    console.log('Sending user data:', userData);

    // Chamar a função serverless
    const response = await fetch('/.netlify/functions/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Erro ao criar usuário');
    }

    console.log('User created successfully:', result);
    
    // Mostrar senha gerada se aplicável
    if (result.user?.password_generated && result.user?.password) {
      alert(`Usuário criado com sucesso!\n\nSenha gerada: ${result.user.password}\n\nAnote esta senha, ela não será mostrada novamente.`);
    } else {
      alert('Usuário criado com sucesso!');
    }
  };

  const handleEdit = (userProfile: UserProfile) => {
    setEditingUser(userProfile);
    setFormData({
      email: '', // Email não pode ser editado
      password: '',
      name: userProfile.name,
      role: userProfile.role as 'doctor' | 'secretary' | 'admin',
      crm: userProfile.crm || '',
      specialty: userProfile.specialty || '',
      doctor_id: userProfile.doctor_id || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.')) return;

    try {
      const result = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', id);
      
      if (result.error) throw result.error;
      fetchUsers();
      alert('Usuário excluído com sucesso!');
    } catch (error: any) {
      alert('Erro ao excluir usuário: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      name: '',
      role: 'secretary',
      crm: '',
      specialty: '',
      doctor_id: '',
    });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'doctor': return <Stethoscope className="h-5 w-5 text-green-600" />;
      case 'secretary': return <UserCheck className="h-5 w-5 text-blue-600" />;
      case 'admin': return <Users className="h-5 w-5 text-purple-600" />;
      default: return <Users className="h-5 w-5 text-gray-600" />;
    }
  };

  const getRoleLabel = (role: string) => {
    const labels = {
      doctor: 'Médico',
      secretary: 'Secretária',
      admin: 'Administrador',
    };
    return labels[role as keyof typeof labels] || role;
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'doctor': return 'bg-green-100 text-green-800';
      case 'secretary': return 'bg-blue-100 text-blue-800';
      case 'admin': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredUsers = users.filter(userProfile =>
    userProfile.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    userProfile.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (userProfile.crm && userProfile.crm.includes(searchTerm)) ||
    (userProfile.specialty && userProfile.specialty.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  // Check if user is admin
  if (!currentUserProfile?.is_admin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h2>
          <p className="text-gray-600">Apenas administradores podem gerenciar usuários.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Usuários</h1>
          <p className="text-gray-600 mt-2">Gerencie médicos e secretárias do sistema</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          Novo Usuário
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nome, função, CRM ou especialidade..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.map((userProfile) => (
          <div key={userProfile.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  {getRoleIcon(userProfile.role)}
                </div>
                <div className="ml-3">
                  <h3 className="font-semibold text-gray-900">{userProfile.name}</h3>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(userProfile.role)}`}>
                    {getRoleLabel(userProfile.role)}
                  </span>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEdit(userProfile)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(userProfile.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              {userProfile.email && (
                <div className="text-gray-600">
                  <strong>Email:</strong> {userProfile.email}
                </div>
              )}
              
              {userProfile.role === 'doctor' && (
                <>
                  <div className="text-gray-600">
                    <strong>CRM:</strong> {userProfile.crm}
                  </div>
                  <div className="text-gray-600">
                    <strong>Especialidade:</strong> {userProfile.specialty}
                  </div>
                </>
              )}
              
              {userProfile.role === 'secretary' && userProfile.doctor && (
                <div className="bg-blue-50 p-2 rounded border border-blue-200">
                  <div className="text-blue-800 text-xs">
                    <strong>Médico Responsável:</strong><br />
                    Dr. {userProfile.doctor.name} - {userProfile.doctor.specialty}
                  </div>
                </div>
              )}
              
              <div className="text-gray-600">
                <strong>Criado em:</strong> {new Date(userProfile.created_at).toLocaleDateString('pt-BR')}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Nenhum usuário encontrado</p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">
                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {!editingUser && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email *
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        required
                        placeholder="usuario@exemplo.com"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Senha (opcional)
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent pr-10"
                          placeholder="Deixe vazio para não definir senha"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Campo opcional - usuário pode definir senha posteriormente
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                    placeholder="Nome completo do usuário"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Função *
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <label className="relative">
                      <input
                        type="radio"
                        name="role"
                        value="admin"
                        checked={formData.role === 'admin'}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value as 'doctor' | 'secretary' | 'admin' })}
                        className="sr-only"
                      />
                      <div className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                        formData.role === 'admin' 
                          ? 'border-green-500 bg-green-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <div className="flex items-center">
                          <Users className="h-6 w-6 text-purple-600 mr-3" />
                          <div>
                            <div className="font-medium text-gray-900">Administrador</div>
                            <div className="text-sm text-gray-600">Acesso total ao sistema</div>
                          </div>
                        </div>
                      </div>
                    </label>

                    <label className="relative">
                      <input
                        type="radio"
                        name="role"
                        value="doctor"
                        checked={formData.role === 'doctor'}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value as 'doctor' | 'secretary' | 'admin' })}
                        className="sr-only"
                      />
                      <div className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                        formData.role === 'doctor' 
                          ? 'border-green-500 bg-green-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <div className="flex items-center">
                          <Stethoscope className="h-6 w-6 text-green-600 mr-3" />
                          <div>
                            <div className="font-medium text-gray-900">Médico</div>
                            <div className="text-sm text-gray-600">Profissional médico</div>
                          </div>
                        </div>
                      </div>
                    </label>

                    <label className="relative">
                      <input
                        type="radio"
                        name="role"
                        value="secretary"
                        checked={formData.role === 'secretary'}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value as 'doctor' | 'secretary' | 'admin' })}
                        className="sr-only"
                      />
                      <div className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                        formData.role === 'secretary' 
                          ? 'border-green-500 bg-green-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <div className="flex items-center">
                          <UserCheck className="h-6 w-6 text-blue-600 mr-3" />
                          <div>
                            <div className="font-medium text-gray-900">Secretária</div>
                            <div className="text-sm text-gray-600">Assistente médica</div>
                          </div>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {formData.role === 'doctor' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        CRM *
                      </label>
                      <input
                        type="text"
                        value={formData.crm}
                        onChange={(e) => setFormData({ ...formData, crm: e.target.value.replace(/\D/g, '') })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="000000"
                        maxLength={7}
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Especialidade *
                      </label>
                      <input
                        type="text"
                        value={formData.specialty}
                        onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Ex: Cardiologia, Ortopedia"
                        required
                      />
                    </div>
                  </div>
                )}

                {formData.role === 'secretary' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Médico Responsável
                    </label>
                    <select
                      value={formData.doctor_id}
                      onChange={(e) => setFormData({ ...formData, doctor_id: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="">Selecione um médico (opcional)</option>
                      <optgroup label="Médicos (Tabela Doctors)">
                        {doctors.map((doctor) => (
                          <option key={`doctors-${doctor.id}`} value={doctor.id}>
                            Dr. {doctor.name} - {doctor.specialty || 'Especialidade não informada'} {doctor.crm ? `(CRM: ${doctor.crm})` : ''}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Médicos (User Profiles)">
                        {doctorsFromUserProfiles.map((doctor) => (
                          <option key={`user-profiles-${doctor.id}`} value={doctor.id}>
                            Dr. {doctor.name} - {doctor.specialty || 'Especialidade não informada'} {doctor.crm ? `(CRM: ${doctor.crm})` : ''}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Campo opcional - Médicos de ambas as tabelas disponíveis
                    </p>
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingUser(null);
                      resetForm();
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={formLoading}
                  >
                    {formLoading ? 'Processando...' : editingUser ? 'Atualizar' : 'Criar Usuário'}
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

