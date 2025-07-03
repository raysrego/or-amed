import React, { useState, useEffect } from 'react';
import { User, UserCheck, Stethoscope, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { UserProfile as UserProfileType } from '../lib/userTypes';

export default function UserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfileType | null>(null);
  const [doctors, setDoctors] = useState<UserProfileType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    role: 'secretary' as 'doctor' | 'secretary',
    crm: '',
    specialty: '',
    doctor_id: '',
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchDoctors();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select(`
          *,
          doctor:user_profiles!doctor_id(*)
        `)
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setProfile(data);
        setFormData({
          name: data.name,
          role: data.role,
          crm: data.crm || '',
          specialty: data.specialty || '',
          doctor_id: data.doctor_id || '',
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('role', 'doctor')
        .order('name');

      if (error) throw error;
      setDoctors(data || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const profileData = {
        user_id: user?.id,
        name: formData.name,
        role: formData.role,
        crm: formData.role === 'doctor' ? formData.crm : null,
        specialty: formData.role === 'doctor' ? formData.specialty : null,
        doctor_id: formData.role === 'secretary' ? formData.doctor_id || null : null,
      };

      if (profile) {
        const { error } = await supabase
          .from('user_profiles')
          .update(profileData)
          .eq('id', profile.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_profiles')
          .insert([profileData]);
        if (error) throw error;
      }

      await fetchProfile();
      alert('Perfil salvo com sucesso!');
    } catch (error: any) {
      alert('Erro ao salvar perfil: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-6">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <User className="h-6 w-6 text-green-600" />
          </div>
          <div className="ml-4">
            <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
            <p className="text-gray-600">Configure suas informações pessoais</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
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
                    <UserCheck className="h-6 w-6 text-green-600 mr-3" />
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
                Vincule-se a um médico para gerenciar seus pedidos
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-5 w-5 mr-2" />
              {saving ? 'Salvando...' : 'Salvar Perfil'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}