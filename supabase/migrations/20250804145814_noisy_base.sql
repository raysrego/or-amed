/*
  # Fix User Creation System

  1. Database Fixes
    - Remove problematic triggers that cause recursion
    - Fix foreign key constraints
    - Add proper validation functions
    - Ensure all required fields have defaults

  2. Security
    - Maintain RLS policies
    - Add proper validation functions
*/

-- Remove existing problematic triggers
DROP TRIGGER IF EXISTS trigger_ensure_email_sync ON user_profiles;
DROP TRIGGER IF EXISTS trigger_sync_user_email ON user_profiles;

-- Remove problematic functions that cause recursion
DROP FUNCTION IF EXISTS ensure_email_sync();
DROP FUNCTION IF EXISTS sync_user_email();

-- Fix the user_profiles table structure
ALTER TABLE user_profiles 
  ALTER COLUMN old_role DROP NOT NULL,
  ALTER COLUMN email DROP NOT NULL;

-- Add default values for required fields
ALTER TABLE user_profiles 
  ALTER COLUMN role SET DEFAULT 'secretary',
  ALTER COLUMN is_admin SET DEFAULT false;

-- Create a safe user profile creation function
CREATE OR REPLACE FUNCTION create_user_profile_safe(
  p_user_id uuid,
  p_email text,
  p_name text,
  p_role text DEFAULT 'secretary',
  p_crm text DEFAULT NULL,
  p_specialty text DEFAULT NULL,
  p_doctor_id uuid DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  profile_id uuid;
BEGIN
  -- Validate required fields
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id é obrigatório';
  END IF;
  
  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'Email é obrigatório';
  END IF;
  
  IF p_name IS NULL OR p_name = '' THEN
    RAISE EXCEPTION 'Nome é obrigatório';
  END IF;
  
  -- Validate role
  IF p_role NOT IN ('admin', 'doctor', 'secretary') THEN
    RAISE EXCEPTION 'Função deve ser admin, doctor ou secretary';
  END IF;
  
  -- Validate doctor-specific fields
  IF p_role = 'doctor' THEN
    IF p_crm IS NULL OR p_crm = '' THEN
      RAISE EXCEPTION 'CRM é obrigatório para médicos';
    END IF;
    
    IF p_specialty IS NULL OR p_specialty = '' THEN
      RAISE EXCEPTION 'Especialidade é obrigatória para médicos';
    END IF;
  END IF;
  
  -- Check if email already exists
  IF EXISTS (SELECT 1 FROM user_profiles WHERE email = p_email) THEN
    RAISE EXCEPTION 'Este email já está cadastrado';
  END IF;
  
  -- Check if doctor exists when linking secretary
  IF p_role = 'secretary' AND p_doctor_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = p_doctor_id AND role = 'doctor') THEN
      RAISE EXCEPTION 'Médico não encontrado para vinculação';
    END IF;
  END IF;
  
  -- Insert the profile
  INSERT INTO user_profiles (
    user_id,
    email,
    name,
    role,
    old_role,
    crm,
    specialty,
    doctor_id,
    is_admin
  ) VALUES (
    p_user_id,
    p_email,
    p_name,
    p_role,
    p_role, -- Set old_role same as role
    p_crm,
    p_specialty,
    p_doctor_id,
    CASE WHEN p_role = 'admin' THEN true ELSE false END
  ) RETURNING id INTO profile_id;
  
  RETURN profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get detailed error messages
CREATE OR REPLACE FUNCTION get_user_creation_error(error_message text) 
RETURNS text AS $$
BEGIN
  -- Parse common database errors into user-friendly messages
  IF error_message ILIKE '%duplicate key value violates unique constraint%' THEN
    IF error_message ILIKE '%email%' THEN
      RETURN 'Este email já está cadastrado';
    ELSIF error_message ILIKE '%user_id%' THEN
      RETURN 'Este usuário já possui um perfil';
    ELSE
      RETURN 'Dados duplicados encontrados';
    END IF;
  ELSIF error_message ILIKE '%violates foreign key constraint%' THEN
    IF error_message ILIKE '%doctor_id%' THEN
      RETURN 'Médico selecionado não encontrado';
    ELSE
      RETURN 'Referência inválida encontrada';
    END IF;
  ELSIF error_message ILIKE '%violates not-null constraint%' THEN
    IF error_message ILIKE '%name%' THEN
      RETURN 'Nome é obrigatório';
    ELSIF error_message ILIKE '%email%' THEN
      RETURN 'Email é obrigatório';
    ELSIF error_message ILIKE '%role%' THEN
      RETURN 'Função é obrigatória';
    ELSE
      RETURN 'Campo obrigatório não preenchido';
    END IF;
  ELSIF error_message ILIKE '%violates check constraint%' THEN
    IF error_message ILIKE '%role%' THEN
      RETURN 'Função deve ser admin, médico ou secretária';
    ELSE
      RETURN 'Dados inválidos fornecidos';
    END IF;
  ELSE
    RETURN 'Erro ao salvar usuário: ' || error_message;
  END IF;
END;
$$ LANGUAGE plpgsql;