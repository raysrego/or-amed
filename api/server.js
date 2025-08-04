const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Supabase client with service role key for admin operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Validation helpers
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const generateRandomPassword = () => {
  return crypto.randomBytes(12).toString('hex');
};

// Route: Create User
app.post('/api/admin/create-user', async (req, res) => {
  try {
    const { email, password, name, role, crm, specialty, doctor_id } = req.body;

    // Basic validation
    if (!email || !name || !role) {
      return res.status(400).json({
        error: 'Campos obrigatórios: email, name, role'
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        error: 'Email inválido'
      });
    }

    if (!['admin', 'doctor', 'secretary'].includes(role)) {
      return res.status(400).json({
        error: 'Role deve ser: admin, doctor ou secretary'
      });
    }

    // Role-specific validation
    if (role === 'doctor') {
      if (!crm || !specialty) {
        return res.status(400).json({
          error: 'Médicos precisam de CRM e especialidade'
        });
      }
    }

    if (role === 'secretary') {
      if (!doctor_id) {
        return res.status(400).json({
          error: 'Secretárias precisam de doctor_id'
        });
      }

      // Verify doctor exists
      const { data: doctorExists } = await supabase
        .from('doctors')
        .select('id')
        .eq('id', doctor_id)
        .single();

      if (!doctorExists) {
        return res.status(400).json({
          error: 'Médico não encontrado'
        });
      }
    }

    // Check if email already exists
    const { data: existingUser } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({
        error: 'Este email já está cadastrado'
      });
    }

    // Generate password if not provided
    const userPassword = password || generateRandomPassword();

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.trim(),
      password: userPassword,
      email_confirm: true
    });

    if (authError || !authData?.user?.id) {
      console.error('Auth error:', authError);
      return res.status(500).json({
        error: 'Erro ao criar usuário de autenticação: ' + (authError?.message || 'Erro desconhecido')
      });
    }

    const user_id = authData.user.id;

    // Prepare profile data
    const profileData = {
      user_id,
      email: email.trim(),
      name: name.trim(),
      role,
      crm: role === 'doctor' ? crm?.trim() || null : null,
      specialty: role === 'doctor' ? specialty?.trim() || null : null,
      doctor_id: role === 'secretary' ? doctor_id : null,
      is_admin: role === 'admin'
    };

    // Insert into user_profiles
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert([profileData]);

    if (profileError) {
      console.error('Profile error:', profileError);
      
      // Cleanup: delete auth user if profile creation fails
      await supabase.auth.admin.deleteUser(user_id);
      
      return res.status(500).json({
        error: 'Erro ao criar perfil: ' + profileError.message
      });
    }

    // If doctor, also insert into doctors table
    if (role === 'doctor') {
      const doctorData = {
        name: name.trim(),
        cpf: '00000000000',
        crm: crm?.trim() || '',
        contact: 'Não informado',
        pix_key: 'Não informado',
        specialty: specialty?.trim() || '',
        email: email.trim(),
        user_id
      };

      const { error: doctorError } = await supabase
        .from('doctors')
        .insert([doctorData]);

      if (doctorError) {
        console.warn('Warning: Erro ao criar na tabela doctors:', doctorError.message);
        // Don't fail the entire operation, just log the warning
      }
    }

    // Success response
    res.status(201).json({
      message: 'Usuário criado com sucesso',
      user: {
        id: user_id,
        email: email.trim(),
        name: name.trim(),
        role,
        password_generated: !password
      }
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

// Route: List Doctors
app.get('/api/doctors', async (req, res) => {
  try {
    const { data: doctors, error } = await supabase
      .from('doctors')
      .select('id, name, crm, specialty')
      .order('name');

    if (error) {
      console.error('Error fetching doctors:', error);
      return res.status(500).json({
        error: 'Erro ao buscar médicos: ' + error.message
      });
    }

    res.json({
      doctors: doctors || [],
      count: doctors?.length || 0
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

// Health check route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'CirPlane API'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Erro interno do servidor'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Rota não encontrada'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 CirPlane API rodando na porta ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
  console.log(`👥 Create user: POST http://localhost:${PORT}/api/admin/create-user`);
  console.log(`👨‍⚕️ List doctors: GET http://localhost:${PORT}/api/doctors`);
});

module.exports = app;