import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, User, UserCheck, Stethoscope, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../lib/userTypes';

interface Doctor {
  id: string;
  name: string;
  crm?: string;
  specialty?: string;
  source: 'doctors' | 'user_profiles';
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'secretary' as 'admin' | 'doctor' | 'secretary',
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
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctorsFromBothTables = async () => {
    try {
      const [doctorsResult, userProfilesResult] = await Promise.all([
        supabase
          .from('doctors')
          .select('id, name, crm, specialty')
          .order('name'),
        supabase
          .from('user_profiles')
          .select('id, name, crm, specialty')
          .eq('role', 'doctor')
          .order('name')
      ]);

      const doctorsList: Doctor[] = [];

      // Add from doctors table
      if (doctorsResult.data) {
        doctorsList.push(...doctorsResult.data.map(doc => ({
          ...doc,
          source: 'doctors' as const
        })));
      }

      // Add from user_profiles table
      if (userProfilesResult.data) {
        doctorsList.push(...userProfilesResult.data.map(doc => ({
          ...doc,
          source: 'user_profiles' as const
        })));
      }

      setDoctors(doctorsList);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      console.log('Sending user data:', { ...formData, password: formData.password ? '[HIDDEN]' : undefined });
      
      const response = await fetch('/.netlify/functions/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar usuário');
      }

      console.log('User created successfully:', result);
      
      // Show generated password if any
      if (result.user?.password) {
        setGeneratedPassword(result.user.password);
        alert(`Usuário criado com sucesso!\nSenha gerada: ${result.user.password}\n\nAnote esta senha, ela não será mostrada novamente.`);
      } else {
        alert('Usuário criado com sucesso!');
      }

      setShowModal(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      console.error('Error in handleSubmit:', error);
      alert('Erro ao criar usuário: ' + error.message);
    }
  };

  const handleEdit = (user: UserProfile) => {
    setEditingUser(user);
    setFormData({
      email: user.email || '',
      password: '',
      name: user.name,
      role: user.role,
      crm: user.crm || '',
      specialty: user.specialty || '',
      doctor_id: user.doctor_id || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      fetchUsers();
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
    setEditingUser(null);
    setGeneratedPassword('');
  };

  const getRoleLabel = (role: string) => {
    const labels = {
      admin: 'Administrador',
      doctor: 'Médico',
      secretary: 'Secretária',
    };
    return labels[role as keyof typeof labels] || role;
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800';
      case 'doctor': return 'bg-green-100 text-green-800';
      case 'secretary': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
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
          <p className="text-gray-600 mt-2">Gerencie os usuários do sistema</p>
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
          placeholder="Buscar por nome, email ou função..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.map((user) => (
          <div key={user.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  {user.role === 'admin' ? (
                    <UserCheck className="h-6 w-6 text-purple-600" />
                  ) : user.role === 'doctor' ? (
                    <Stethoscope className="h-6 w-6 text-green-600" />
                  ) : (
                    <User className="h-6 w-6 text-blue-600" />
                  )}
                </div>
                <div className="ml-3">
                  <h3 className="font-semibold text-gray-900">{user.name}</h3>
                  <p className="text-sm text-gray-600">{user.email}</p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEdit(user)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(user.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                  {getRoleLabel(user.role)}
                </span>
                {user.is_admin && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    Admin
                  </span>
                )}
              </div>
              
              {user.role === 'doctor' && (
                <div className="text-gray-600">
                  {user.crm && <div><strong>CRM:</strong> {user.crm}</div>}
                  {user.specialty && <div><strong>Especialidade:</strong> {user.specialty}</div>}
                </div>
              )}
              
              <div className="text-gray-600">
                <strong>Criado em:</strong> {new Date(user.created_at).toLocaleDateString('pt-BR')}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <div className="text-center py-12">
          <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
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
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    />
                  </div>
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
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent pr-10"
                      placeholder={editingUser ? 'Deixe vazio para manter a atual' : 'Será gerada automaticamente'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Função *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  >
                    <option value="secretary">Secretária</option>
                    <option value="doctor">Médico</option>
                    <option value="admin">Administrador</option>
                  </select>
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
                        onChange={(e) => setFormData({ ...formData, crm: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Ex: Cardiologia"
                        required
                      />
                    </div>
                  </div>
                )}

                {formData.role === 'secretary' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Médico Responsável *
                    </label>
                    <select
                      value={formData.doctor_id}
                      onChange={(e) => setFormData({ ...formData, doctor_id: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    >
                      <option value="">Selecione um médico</option>
                      
                      {doctors.filter(d => d.source === 'doctors').length > 0 && (
                        <optgroup label="Médicos Cadastrados">
                          {doctors
                            .filter(doctor => doctor.source === 'doctors')
                            .map((doctor) => (
                              <option key={`doctors-${doctor.id}`} value={doctor.id}>
                                Dr. {doctor.name} - {doctor.specialty || 'Especialidade não informada'} {doctor.crm ? `(CRM: ${doctor.crm})` : ''}
                              </option>
                            ))}
                        </optgroup>
                      )}
                      
                      {doctors.filter(d => d.source === 'user_profiles').length > 0 && (
                        <optgroup label="Usuários Médicos">
                          {doctors
                            .filter(doctor => doctor.source === 'user_profiles')
                            .map((doctor) => (
                              <option key={`profiles-${doctor.id}`} value={doctor.id}>
                                Dr. {doctor.name} - {doctor.specialty || 'Especialidade não informada'} {doctor.crm ? `(CRM: ${doctor.crm})` : ''}
                              </option>
                            ))}
                        </optgroup>
                      )}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Campo opcional
                    </p>
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