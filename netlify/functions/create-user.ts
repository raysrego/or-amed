import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Validation helpers
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const generateRandomPassword = (): string => {
  return crypto.randomBytes(16).toString('hex');
};

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  // Only allow POST method
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log('Environment check:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseServiceKey,
      urlStart: supabaseUrl?.substring(0, 20),
      keyStart: supabaseServiceKey?.substring(0, 20)
    });

    if (!supabaseUrl || !supabaseServiceKey) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Configuração do servidor incompleta' }),
      };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
      },
    });

    // Parse request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch (error) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'JSON inválido' }),
      };
    }

    const { email, password, name, role, crm, specialty, doctor_id } = requestBody;

    // Basic validation
    if (!email || !name || !role) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Campos obrigatórios: email, name, role' }),
      };
    }

    if (!validateEmail(email)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Email inválido' }),
      };
    }

    if (!['admin', 'doctor', 'secretary'].includes(role)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Role deve ser: admin, doctor ou secretary' }),
      };
    }

    // Role-specific validation
    if (role === 'doctor') {
      if (!crm || !specialty) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Médicos precisam de CRM e especialidade' }),
        };
      }
    }

    if (role === 'secretary') {
      if (!doctor_id) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Secretárias precisam de doctor_id' }),
        };
      }

      // Verify doctor exists
      const { data: doctorExists } = await supabase
        .from('doctors')
        .select('id')
        .eq('id', doctor_id)
        .single();

      if (!doctorExists) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Médico não encontrado' }),
        };
      }
    }

    // Check if email already exists
    const { data: existingUser } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('email', email)
      .single();

    if (existingUser) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Este email já está cadastrado' }),
      };
    }

    // Generate password if not provided
    const userPassword = password || generateRandomPassword();

    console.log('Creating user with email:', email);

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.trim(),
      password: userPassword,
      email_confirm: true,
      user_metadata: {
        name: name.trim(),
        role: role,
      },
    });

    if (authError || !authData?.user?.id) {
      console.error('Auth error:', authError);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Erro ao criar usuário de autenticação: ' + (authError?.message || 'Erro desconhecido'),
        }),
      };
    }

    const user_id = authData.user.id;
    console.log('User created with ID:', user_id);

    // Prepare profile data
    const profileData = {
      user_id,
      email: email.trim(),
      name: name.trim(),
      role,
      crm: role === 'doctor' ? crm?.trim() || null : null,
      specialty: role === 'doctor' ? specialty?.trim() || null : null,
      doctor_id: role === 'secretary' ? doctor_id : null,
      is_admin: role === 'admin',
    };

    console.log('Inserting profile data:', profileData);

    // Insert into user_profiles
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert([profileData]);

    if (profileError) {
      console.error('Profile error:', profileError);

      // Cleanup: delete auth user if profile creation fails
      await supabase.auth.admin.deleteUser(user_id);

      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Erro ao criar perfil: ' + profileError.message }),
      };
    }

    console.log('Profile created successfully');

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
        user_id,
      };

      console.log('Creating doctor record:', doctorData);

      const { error: doctorError } = await supabase
        .from('doctors')
        .insert([doctorData]);

      if (doctorError) {
        console.warn('Warning: Erro ao criar na tabela doctors:', doctorError.message);
        // Don't fail the entire operation, just log the warning
      }
    }

    // Success response
    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Usuário criado com sucesso',
        user: {
          id: user_id,
          email: email.trim(),
          name: name.trim(),
          role,
          password_generated: !password,
          password: !password ? userPassword : undefined,
        },
      }),
    };
  } catch (error) {
    console.error('Unexpected error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Erro interno do servidor' }),
    };
  }
};