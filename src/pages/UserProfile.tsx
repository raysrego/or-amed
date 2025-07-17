import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

const UserProfile = () => {
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    role: 'secretary',
    crm: '',
    specialty: '',
    doctor_id: '',
  });

  const [loading, setLoading] = useState(false);

  // Verificação de carregamento do usuário
  if (user === null) {
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

    const profileData = {
      user_id: user.id,
      name: formData.name,
      role: formData.role,
      crm: formData.role === 'doctor' ? formData.crm : null,
      specialty: formData.role === 'doctor' ? formData.specialty : null,
      doctor_id: formData.role === 'secretary' ? formData.doctor_id || null : null,
      is_admin: false,
    };

    // Verifica se perfil já existe
    const { data: existingProfile, error: fetchError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      alert('Erro ao verificar perfil existente: ' + fetchError.message);
      setLoading(false);
      return;
    }

    if (existingProfile) {
      alert('Perfil já existe para este usuário.');
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from('user_profiles')
      .insert([profileData]);

    setLoading(false);

    if (error) {
      alert('Erro ao criar perfil: ' + error.message);
    } else {
      alert('Perfil criado com sucesso!');
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-10 p-6 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Criar Perfil de Usuário</h2>
      <form onSubmit={handleSubmit} className="space-y-4">

        <input
          type="text"
          name="name"
          placeholder="Nome"
          value={formData.name}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />

        <select
          name="role"
          value={formData.role}
          onChange={handleChange}
          className="w-full p-2 border rounded"
        >
          <option value="secretary">Secretária</option>
          <option value="doctor">Médico</option>
        </select>

        {formData.role === 'doctor' && (
          <>
            <input
              type="text"
              name="crm"
              placeholder="CRM"
              value={formData.crm}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              required
            />
            <input
              type="text"
              name="specialty"
              placeholder="Especialidade"
              value={formData.specialty}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              required
            />
          </>
        )}

        {formData.role === 'secretary' && (
          <input
            type="text"
            name="doctor_id"
            placeholder="ID do médico associado"
            value={formData.doctor_id}
            onChange={handleChange}
            className="w-full p-2 border rounded"
          />
        )}

        <button
          type="submit"
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition"
          disabled={loading}
        >
          {loading ? 'Salvando...' : 'Criar Perfil'}
        </button>
      </form>
    </div>
  );
};

export default UserProfile;
