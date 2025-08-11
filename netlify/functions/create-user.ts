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
  console.log('🚀 Function create-user called');
  console.log('Method:', event.httpMethod);
  console.log('Headers:', JSON.stringify(event.headers, null, 2));
  
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    console.log('✅ Handling CORS preflight');
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
      urlStart: supabaseUrl?.substring(0, 30),
      keyStart: supabaseServiceKey?.substring(0, 30),
      fullUrl: supabaseUrl,
      nodeEnv: process.env.NODE_ENV
    });

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing environment variables');
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
    });

    console.log('✅ Supabase client created');

    // Parse request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
      console.log('📝 Request body parsed:', { ...requestBody, password: requestBody.password ? '[HIDDEN]' : undefined });
    } catch (error) {
      console.error('❌ JSON parse error:', error);
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
        console.log('❌ Secretary missing doctor_id');
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Secretárias precisam de doctor_id' }),
        };
      }

      // Verify doctor exists
      console.log('🔍 Checking if doctor exists:', doctor_id);
      const { data: doctorExists } = await supabase
        .from('doctors')
        .select('id')
        .eq('id', doctor_id)
        .single();

      console.log('Doctor check result:', doctorExists);

      if (!doctorExists) {
        // Try checking in user_profiles table
        console.log('🔍 Checking doctor in user_profiles table');
        const { data: doctorInUserProfiles } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('id', doctor_id)
          .eq('role', 'doctor')
          .single();

        console.log('Doctor in user_profiles result:', doctorInUserProfiles);

        if (!doctorInUserProfiles) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Médico não encontrado em nenhuma tabela' }),
          };
        }
      }
    }

    // Check if email already exists
    console.log('🔍 Checking if email exists:', email);
    const { data: existingUser } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('email', email)
      .single();

    console.log('Existing user check:', existingUser);

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
    console.log('🔐 Creating user in Supabase Auth...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.trim(),
      password: userPassword,
      email_confirm: true,
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
    console.log('📝 Preparing profile data...');
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
    console.log('💾 Inserting into user_profiles...');
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert([profileData]);

    if (profileError) {
      console.error('Profile error:', profileError);

      // Cleanup: delete auth user if profile creation fails
      console.log('🧹 Cleaning up auth user due to profile error...');
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
      console.log('👨‍⚕️ Creating doctor record...');
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
      } else {
        console.log('✅ Doctor record created successfully');
      }
    }

    // Success response
    console.log('✅ User creation completed successfully');
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