import React, { useState, useEffect } from 'react';
import { User, UserCheck, Stethoscope, Save, Edit } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';

const UserProfile = () => {
  const { user } = useAuth();
  const { profile, loading: profileLoading, refetch } = useUserProfile();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    role: 'secretary',
    crm: '',
    specialty: '',
  });

  const [doctors, setDoctors] = useState<any[]>([]);

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        role: profile.role || 'secretary',
        crm: profile.crm || '',
        specialty: profile.specialty || '',
      });
    }
  }, [profile]);

  useEffect(() => {
    if (formData.role === 'secretary') {
      fetchDoctors();
    }
  }, [formData.role]);

  const fetchDoctors = async () => {
    try {
      const result = await supabase
        .from('user_profiles')
        .select('*')
        .eq('role', 'doctor')
        .order('name');

      if (result.error) throw result.error;
      setDoctors(result.data || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  // Verificação de carregamento do usuário
  if (user === null || profileLoading) {
    return (
      <div className="text-center text-gray-600 py-10">
        Carregando autenticação...
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Proteção: só continua se usuário estiver autenticado
    if (!user?.id) {
      alert("Usuário não autenticado.");
      return;
    }

    setLoading(true);

    try {
      const updateData = {
        name: formData.name,
        crm: formData.role === 'doctor' ? formData.crm : null,
        specialty: formData.role === 'doctor' ? formData.specialty : null,
      };

      const { error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('user_id', user.id);

      if (error) throw error;

      alert('Perfil atualizado com sucesso!');
      setEditing(false);
      refetch();
    } catch (error: any) {
      alert('Erro ao atualizar perfil: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!profile) {
    return (
      <div className="max-w-xl mx-auto mt-10 p-6 bg-white rounded shadow">
        <h2 className="text-2xl font-bold mb-4">Perfil não encontrado</h2>
        <p className="text-gray-600">
          Seu perfil não foi encontrado. Entre em contato com o administrador.
        </p>
      </div>
    );
  }

  const getRoleLabel = (role: string) => {
    const labels = {
      admin: 'Administrador',
      doctor: 'Médico',
      secretary: 'Secretária',
    };
    return labels[role as keyof typeof labels] || role;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Meu Perfil</h1>
          <p className="text-gray-600 mt-2">Gerencie suas informações pessoais</p>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition-colors"
          >
            <Edit className="h-5 w-5" />
            Editar Perfil
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            {profile.role === 'doctor' ? (
              <Stethoscope className="h-8 w-8 text-green-600" />
            ) : profile.role === 'admin' ? (
              <UserCheck className="h-8 w-8 text-purple-600" />
            ) : (
              <User className="h-8 w-8 text-blue-600" />
            )}
          </div>
          <div className="ml-4">
            <h2 className="text-2xl font-bold text-gray-900">{profile.name}</h2>
            <p className="text-gray-600">{getRoleLabel(profile.role)}</p>
            {profile.email && (
              <p className="text-sm text-gray-500">{profile.email}</p>
            )}
          </div>
        </div>

        {editing ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              name="name"
              placeholder="Nome"
              value={formData.name}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            />

            {profile.role === 'doctor' && (
              <>
                <input
                  type="text"
                  name="crm"
                  placeholder="CRM"
                  value={formData.crm}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
                <input
                  type="text"
                  name="specialty"
                  placeholder="Especialidade"
                  value={formData.specialty}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setFormData({
                    name: profile.name || '',
                    role: profile.role || 'secretary',
                    crm: profile.crm || '',
                    specialty: profile.specialty || '',
                  });
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                disabled={loading}
              >
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Completo
                </label>
                <p className="text-gray-900">{profile.name}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Função
                </label>
                <p className="text-gray-900">{getRoleLabel(profile.role)}</p>
              </div>
            </div>

            {profile.role === 'doctor' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CRM
                  </label>
                  <p className="text-gray-900">{profile.crm || 'Não informado'}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Especialidade
                  </label>
                  <p className="text-gray-900">{profile.specialty || 'Não informada'}</p>
                </div>
              </div>
            )}

            {profile.role === 'secretary' && profile.doctor && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Médico Responsável
                </label>
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <p className="text-blue-900">
                    Dr. {profile.doctor.name} - {profile.doctor.specialty}
                  </p>
                  <p className="text-sm text-blue-700">CRM: {profile.doctor.crm}</p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Membro desde
              </label>
              <p className="text-gray-900">
                {new Date(profile.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
