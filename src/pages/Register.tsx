import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, User, Phone, Stethoscope, UserCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import PulseCalculatorLogo from '../components/PulseCalculatorLogo';

interface Doctor {
  id: string;
  name: string;
  crm: string;
  specialty: string;
}

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [role, setRole] = useState<'doctor' | 'secretary'>('secretary');
  const [crm, setCrm] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, name, crm, specialty')
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
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      setLoading(false);
      return;
    }

    if (role === 'doctor' && (!crm || !specialty)) {
      setError('CRM e especialidade são obrigatórios para médicos');
      setLoading(false);
      return;
    }

    try {
      // Create user account
      const { data: authData, error: authError } = await signUp(email, password);
      if (authError) throw authError;

      if (authData.user) {
        // Create user profile
        const profileData = {
          user_id: authData.user.id,
          name: name,
          role: role,
          crm: role === 'doctor' ? crm : null,
          specialty: role === 'doctor' ? specialty : null,
          doctor_id: role === 'secretary' ? (doctorId || null) : null,
          is_admin: false,
        };

        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert([profileData]);

        if (profileError) throw profileError;

        setSuccess(true);
        setTimeout(() => {
          navigate('/');
        }, 2000);
      }
    } catch (error: any) {
      setError(error.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="flex justify-center mb-4">
              <PulseCalculatorLogo size="lg" className="text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Conta Criada!
            </h1>
            <p className="text-gray-600">
              Sua conta foi criada com sucesso. Redirecionando...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <PulseCalculatorLogo size="lg" className="text-green-800" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Criar Conta
            </h1>
            <p className="text-gray-600 mt-2">
              Crie sua conta para acessar o CirPlane
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome Completo *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
                    placeholder="Seu nome completo"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contato *
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
                    placeholder="(11) 99999-9999"
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
                  placeholder="seu@email.com"
                  required
                />
              </div>
            </div>

            {/* Password Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Senha *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
                    placeholder="Mínimo 6 caracteres"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirmar Senha *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
                    placeholder="Confirme sua senha"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Role Selection */}
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
                    checked={role === 'doctor'}
                    onChange={(e) => setRole(e.target.value as 'doctor' | 'secretary')}
                    className="sr-only"
                  />
                  <div className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    role === 'doctor' 
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
                    checked={role === 'secretary'}
                    onChange={(e) => setRole(e.target.value as 'doctor' | 'secretary')}
                    className="sr-only"
                  />
                  <div className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    role === 'secretary' 
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

            {/* Doctor-specific fields */}
            {role === 'doctor' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CRM *
                  </label>
                  <input
                    type="text"
                    value={crm}
                    onChange={(e) => setCrm(e.target.value.replace(/\D/g, ''))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
                    placeholder="000000"
                    maxLength={7}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Especialidade *
                  </label>
                  <input
                    type="text"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
                    placeholder="Ex: Cardiologia, Ortopedia"
                    required
                  />
                </div>
              </div>
            )}

            {/* Secretary-specific fields */}
            {role === 'secretary' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Médico Responsável
                </label>
                <select
                  value={doctorId}
                  onChange={(e) => setDoctorId(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
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

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Criando conta...' : 'Criar Conta'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Já tem uma conta?{' '}
              <Link to="/login" className="text-green-600 hover:text-green-700 font-medium">
                Faça login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}