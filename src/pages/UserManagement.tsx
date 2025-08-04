import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Users, UserCheck, Stethoscope, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { UserProfile } from '../lib/userTypes';

export default function UserManagement() {
  const { user } = useAuth();
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [doctors, setDoctors] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'secretary' as 'doctor' | 'secretary',
    crm: '',
    specialty: '',
    doctor_id: '',
  });

  useEffect(() => {
    if (user) {
      fetchCurrentUserProfile();
    }
  }, [user]);

  useEffect(() => {
    fetchUsers();
    fetchDoctors();
  }, []);

  const fetchCurrentUserProfile = async () => {
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
        setCurrentUserProfile(result.data);
      }
    } catch (error) {
      console.error('Error fetching current user profile:', error);
    } finally {
      setLoading(false);
    }
  };

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
    }
  };

  const fetchDoctors = async () => {
    try {
      const result = await supabase
        .from('user_profiles')
        .select('*')
        .eq('role', 'doctor')
        .order('name');

      if (result.error) {
        throw result.error;
      }

      setDoctors(result.data || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingUser) {
        // Update existing user profile
        const profileData = {
          name: formData.name,
          role: formData.role,
          crm: formData.role === 'doctor' ? formData.crm : null,
          specialty: formData.role === 'doctor' ? formData.specialty : null,
          doctor_id: formData.role === 'secretary' ? formData.doctor_id || null : null,
        };

        const result = await supabase
          .from('user_profiles')
          .update(profileData)
          .eq('id', editingUser.id);
        
        if (result.error) throw result.error;
      } else {
        // Create new user
        console.log('Creating new user with email:', formData.email);
        
        // Generate default password: first name + "123"
        const defaultPassword = formData.name.split(' ')[0].toLowerCase() + '123';
        
        // Step 1: Create auth user
        const authResult = await supabase.auth.signUp({
          email: formData.email.trim(),
          password: formData.password || defaultPassword,
          options: {
            emailRedirectTo: undefined // Disable email confirmation
          }
        });

        if (authResult.error) {
          console.error('Auth signup error:', authResult.error);
          throw new Error(`Erro ao criar usuário: ${authResult.error.message}`);
        }

        if (!authResult.data.user) {
          throw new Error('Usuário não foi criado corretamente');
        }

        console.log('Auth user created:', authResult.data.user.id);

        // Step 2: Wait a moment for the user to be fully created
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Step 3: Create user profile
        const profileData = {
          user_id: authResult.data.user.id,
          email: formData.email.trim(),
          name: formData.name,
          role: formData.role,
          crm: formData.role === 'doctor' ? formData.crm : null,
          specialty: formData.role === 'doctor' ? formData.specialty : null,
          doctor_id: formData.role === 'secretary' ? formData.doctor_id || null : null,
          is_admin: false,
        };

        console.log('Creating profile with data:', profileData);

        const profileResult = await supabase
          .from('user_profiles')
          .insert([profileData]);

        if (profileResult.error) {
          console.error('Profile creation error:', profileResult.error);
          
          // If profile creation fails, try to clean up the auth user
          try {
            await supabase.auth.admin.deleteUser(authResult.data.user.id);
          } catch (cleanupError) {
            console.error('Failed to cleanup auth user:', cleanupError);
          }
          
          throw new Error(`Erro ao criar perfil do usuário: ${profileResult.error.message}`);
        }

        console.log('Profile created successfully');
        
        // Show the generated password to admin
        if (!formData.password) {
          alert(`Usuário criado com sucesso!\nSenha padrão gerada: ${defaultPassword}\nInforme esta senha ao usuário.`);
        }
      }

      setShowModal(false);
      setEditingUser(null);
      resetForm();
      fetchUsers();
      if (editingUser) {
        alert('Usuário atualizado com sucesso!');
      }
    } catch (error: any) {
      console.error('Error in handleSubmit:', error);
      alert(`Erro: ${error.message || 'Erro desconhecido ao salvar usuário'}`);
    }
  };

  const handleEdit = (userProfile: UserProfile) => {
    setEditingUser(userProfile);
    setFormData({
      email: '', // Email não pode ser editado
      password: '',
      name: userProfile.name,
      role: userProfile.role as 'doctor' | 'secretary',
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
                        Senha {!editingUser && '(deixe vazio para gerar automaticamente)'}
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent pr-10"
                          placeholder={!editingUser ? "Deixe vazio para gerar automaticamente" : "Mínimo 6 caracteres"}
                          minLength={6}
                          required={!!editingUser}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                      {!editingUser && (
                        <p className="text-xs text-gray-500 mt-1">
                          Se não informar uma senha, será gerada automaticamente: [primeiro nome]123
                        </p>
                      )}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="relative">
                      <input
                        type="radio"
                        name="role"
                        value="doctor"
                        checked={formData.role === 'doctor'}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value as 'doctor' | 'secretary' })}
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
                        onChange={(e) => setFormData({ ...formData, role: e.target.value as 'doctor' | 'secretary' })}
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
                      {doctors.map((doctor) => (
                        <option key={doctor.id} value={doctor.id}>
                          Dr. {doctor.name} - {doctor.specialty} (CRM: {doctor.crm})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Vincule a secretária a um médico para gerenciar seus pedidos
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
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    {editingUser ? 'Atualizar' : 'Criar Usuário'}
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