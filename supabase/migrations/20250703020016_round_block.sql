/*
  # Corrigir configuração do usuário administrador

  1. Limpeza de dados duplicados
    - Remove registros duplicados na tabela user_profiles
    - Mantém apenas o registro mais recente para cada user_id
  
  2. Configuração do administrador
    - Adiciona coluna is_admin se não existir
    - Configura constraints apropriadas
    - Cria função para auto-criação de perfil admin
    
  3. Políticas de segurança
    - Adiciona políticas RLS para administradores
    - Permite acesso total aos admins
*/

-- Primeiro, vamos limpar dados duplicados se existirem
DO $$
DECLARE
  duplicate_record RECORD;
BEGIN
  -- Remove registros duplicados, mantendo apenas o mais recente
  FOR duplicate_record IN 
    SELECT user_id, COUNT(*) as count_duplicates
    FROM user_profiles 
    GROUP BY user_id 
    HAVING COUNT(*) > 1
  LOOP
    -- Delete todos exceto o mais recente para cada user_id duplicado
    DELETE FROM user_profiles 
    WHERE user_id = duplicate_record.user_id 
    AND id NOT IN (
      SELECT id FROM user_profiles 
      WHERE user_id = duplicate_record.user_id 
      ORDER BY created_at DESC 
      LIMIT 1
    );
  END LOOP;
END $$;

-- Adicionar coluna is_admin se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN is_admin boolean DEFAULT false;
  END IF;
END $$;

-- Adicionar constraint única em user_id se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'user_profiles' AND constraint_name = 'user_profiles_user_id_key'
  ) THEN
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- Atualizar constraint de role para incluir admin
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check 
  CHECK (role IN ('doctor', 'secretary', 'admin'));

-- Atualizar constraint de campos do médico para incluir admin
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS doctor_fields_check;
ALTER TABLE user_profiles ADD CONSTRAINT doctor_fields_check CHECK (
  (role = 'doctor' AND crm IS NOT NULL AND specialty IS NOT NULL AND doctor_id IS NULL AND is_admin = false) OR
  (role = 'secretary' AND crm IS NULL AND specialty IS NULL AND is_admin = false) OR
  (role = 'admin' AND is_admin = true)
);

-- Função para criar perfil de administrador automaticamente
CREATE OR REPLACE FUNCTION create_admin_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se é o email do administrador
  IF NEW.email = 'rayannyrego@gmail.com' THEN
    -- Inserir ou atualizar perfil de admin
    INSERT INTO user_profiles (user_id, name, role, is_admin)
    VALUES (NEW.id, 'Rayanny Rego', 'admin', true)
    ON CONFLICT (user_id) DO UPDATE SET
      name = 'Rayanny Rego',
      role = 'admin',
      is_admin = true,
      crm = NULL,
      specialty = NULL,
      doctor_id = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger para criação automática de perfil admin
DROP TRIGGER IF EXISTS trigger_create_admin_profile ON auth.users;
CREATE TRIGGER trigger_create_admin_profile
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_admin_profile();

-- Remover políticas admin existentes se existirem
DROP POLICY IF EXISTS "Admins can manage all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage all surgery requests" ON user_surgery_requests;
DROP POLICY IF EXISTS "Admins can manage all budget tracking" ON user_budget_tracking;

-- Políticas para administradores - user_profiles
CREATE POLICY "Admins can manage all profiles"
  ON user_profiles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.user_id = auth.uid() AND up.is_admin = true
    )
  );

-- Políticas para administradores - user_surgery_requests
CREATE POLICY "Admins can manage all surgery requests"
  ON user_surgery_requests
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.user_id = auth.uid() AND up.is_admin = true
    )
  );

-- Políticas para administradores - user_budget_tracking
CREATE POLICY "Admins can manage all budget tracking"
  ON user_budget_tracking
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.user_id = auth.uid() AND up.is_admin = true
    )
  );

-- Criar/atualizar perfil de admin se o usuário já existir
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Verificar se usuário admin existe em auth.users
  SELECT id INTO admin_user_id 
  FROM auth.users 
  WHERE email = 'rayannyrego@gmail.com';
  
  -- Se usuário existe, criar/atualizar perfil
  IF admin_user_id IS NOT NULL THEN
    -- Usar INSERT ... ON CONFLICT para evitar erros
    INSERT INTO user_profiles (user_id, name, role, is_admin)
    VALUES (admin_user_id, 'Rayanny Rego', 'admin', true)
    ON CONFLICT (user_id) DO UPDATE SET
      name = 'Rayanny Rego',
      role = 'admin',
      is_admin = true,
      crm = NULL,
      specialty = NULL,
      doctor_id = NULL;
  END IF;
END $$;

-- Função auxiliar para verificar se usuário é admin
CREATE OR REPLACE FUNCTION is_admin(user_email text)
RETURNS boolean AS $$
BEGIN
  RETURN user_email = 'rayannyrego@gmail.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;