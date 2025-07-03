/*
  # Corrigir erro de banco de dados ao conceder usuário

  1. Problemas identificados
    - Políticas RLS conflitantes ou mal configuradas
    - Constraints que impedem inserção de dados
    - Triggers que podem estar causando problemas

  2. Soluções
    - Reorganizar políticas RLS
    - Corrigir constraints
    - Verificar e corrigir triggers
    - Garantir que o sistema de usuários funcione corretamente
*/

-- Primeiro, vamos limpar e reorganizar tudo relacionado a user_profiles

-- Desabilitar RLS temporariamente para limpeza
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- Remover todas as políticas existentes
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Doctors can read their secretaries" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON user_profiles;

-- Remover triggers problemáticos temporariamente
DROP TRIGGER IF EXISTS trigger_create_admin_profile ON auth.users;

-- Remover constraints problemáticas
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS doctor_fields_check;

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

-- Limpar dados duplicados
DO $$
DECLARE
  duplicate_record RECORD;
BEGIN
  FOR duplicate_record IN 
    SELECT user_id, COUNT(*) as count_duplicates
    FROM user_profiles 
    GROUP BY user_id 
    HAVING COUNT(*) > 1
  LOOP
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

-- Adicionar constraint única em user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'user_profiles' AND constraint_name = 'user_profiles_user_id_key'
  ) THEN
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- Recriar constraints mais flexíveis
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check 
  CHECK (role IN ('doctor', 'secretary', 'admin'));

-- Constraint mais flexível para campos do médico
ALTER TABLE user_profiles ADD CONSTRAINT doctor_fields_check CHECK (
  (role = 'doctor' AND crm IS NOT NULL AND specialty IS NOT NULL AND doctor_id IS NULL) OR
  (role = 'secretary') OR
  (role = 'admin' AND is_admin = true)
);

-- Reabilitar RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Recriar políticas mais simples e funcionais
CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política para administradores (mais simples)
CREATE POLICY "Admins can manage all profiles"
  ON user_profiles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.user_id = auth.uid() AND up.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.user_id = auth.uid() AND up.is_admin = true
    )
  );

-- Política para médicos lerem suas secretárias
CREATE POLICY "Doctors can read their secretaries"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    doctor_id IN (
      SELECT id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- Função simplificada para criar perfil admin
CREATE OR REPLACE FUNCTION create_admin_profile()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email = 'rayannyrego@gmail.com' THEN
    INSERT INTO user_profiles (user_id, name, role, is_admin)
    VALUES (NEW.id, 'Rayanny Rego', 'admin', true)
    ON CONFLICT (user_id) DO UPDATE SET
      name = 'Rayanny Rego',
      role = 'admin',
      is_admin = true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar trigger
CREATE TRIGGER trigger_create_admin_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_admin_profile();

-- Aplicar políticas similares para outras tabelas do módulo de usuário
ALTER TABLE user_surgery_requests DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own surgery requests" ON user_surgery_requests;
DROP POLICY IF EXISTS "Doctors can read secretary requests" ON user_surgery_requests;
DROP POLICY IF EXISTS "Admins can manage all surgery requests" ON user_surgery_requests;

ALTER TABLE user_surgery_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own surgery requests"
  ON user_surgery_requests
  FOR ALL
  TO authenticated
  USING (
    user_profile_id IN (
      SELECT id FROM user_profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_profile_id IN (
      SELECT id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Doctors can read secretary requests"
  ON user_surgery_requests
  FOR SELECT
  TO authenticated
  USING (
    user_profile_id IN (
      SELECT id FROM user_profiles 
      WHERE doctor_id IN (
        SELECT id FROM user_profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage all surgery requests"
  ON user_surgery_requests
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.user_id = auth.uid() AND up.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.user_id = auth.uid() AND up.is_admin = true
    )
  );

-- Aplicar para user_budget_tracking
ALTER TABLE user_budget_tracking DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own budget tracking" ON user_budget_tracking;
DROP POLICY IF EXISTS "Doctors can read secretary budget tracking" ON user_budget_tracking;
DROP POLICY IF EXISTS "Admins can manage all budget tracking" ON user_budget_tracking;

ALTER TABLE user_budget_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own budget tracking"
  ON user_budget_tracking
  FOR ALL
  TO authenticated
  USING (
    surgery_request_id IN (
      SELECT id FROM user_surgery_requests
      WHERE user_profile_id IN (
        SELECT id FROM user_profiles WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    surgery_request_id IN (
      SELECT id FROM user_surgery_requests
      WHERE user_profile_id IN (
        SELECT id FROM user_profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Doctors can read secretary budget tracking"
  ON user_budget_tracking
  FOR SELECT
  TO authenticated
  USING (
    surgery_request_id IN (
      SELECT usr.id FROM user_surgery_requests usr
      JOIN user_profiles up ON usr.user_profile_id = up.id
      WHERE up.doctor_id IN (
        SELECT id FROM user_profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage all budget tracking"
  ON user_budget_tracking
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.user_id = auth.uid() AND up.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.user_id = auth.uid() AND up.is_admin = true
    )
  );

-- Criar perfil admin se o usuário já existir
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  SELECT id INTO admin_user_id 
  FROM auth.users 
  WHERE email = 'rayannyrego@gmail.com';
  
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO user_profiles (user_id, name, role, is_admin)
    VALUES (admin_user_id, 'Rayanny Rego', 'admin', true)
    ON CONFLICT (user_id) DO UPDATE SET
      name = 'Rayanny Rego',
      role = 'admin',
      is_admin = true;
  END IF;
END $$;

-- Função auxiliar para verificar admin
CREATE OR REPLACE FUNCTION is_admin(user_email text)
RETURNS boolean AS $$
BEGIN
  RETURN user_email = 'rayannyrego@gmail.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;