/*
  # Adicionar coluna email na tabela user_profiles

  1. Alterações na tabela
    - Adiciona coluna `email` na tabela `user_profiles`
    - Sincroniza emails existentes da tabela `auth.users`
    - Cria trigger para manter sincronização automática

  2. Segurança
    - Mantém todas as políticas RLS existentes
    - Adiciona função para sincronização automática de email
    - Garante que o email seja sempre atualizado quando mudado na autenticação

  3. Funcionalidades
    - Sincronização automática de emails
    - Trigger para novos usuários
    - Trigger para atualizações de email
*/

-- Adicionar coluna email na tabela user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN email text;
    
    -- Criar índice para performance
    CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
    
    -- Adicionar constraint de unicidade
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_email_unique UNIQUE (email);
  END IF;
END $$;

-- Sincronizar emails existentes da tabela auth.users
UPDATE user_profiles 
SET email = auth_users.email
FROM auth.users auth_users
WHERE user_profiles.user_id = auth_users.id
AND user_profiles.email IS NULL;

-- Função para sincronizar email automaticamente
CREATE OR REPLACE FUNCTION sync_user_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Para INSERT na auth.users
  IF TG_OP = 'INSERT' THEN
    -- Atualizar ou inserir na user_profiles
    INSERT INTO user_profiles (user_id, email, name, role, is_admin, created_at)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), 'secretary', false, now())
    ON CONFLICT (user_id) DO UPDATE SET
      email = NEW.email;
    
    RETURN NEW;
  END IF;
  
  -- Para UPDATE na auth.users (mudança de email)
  IF TG_OP = 'UPDATE' THEN
    -- Atualizar email na user_profiles
    UPDATE user_profiles 
    SET email = NEW.email
    WHERE user_id = NEW.id;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar triggers para sincronização automática
DROP TRIGGER IF EXISTS trigger_sync_user_email_insert ON auth.users;
CREATE TRIGGER trigger_sync_user_email_insert
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_email();

DROP TRIGGER IF EXISTS trigger_sync_user_email_update ON auth.users;
CREATE TRIGGER trigger_sync_user_email_update
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_email();

-- Função para garantir que o email seja sempre sincronizado na user_profiles
CREATE OR REPLACE FUNCTION ensure_email_sync()
RETURNS TRIGGER AS $$
BEGIN
  -- Se não há email definido, buscar da auth.users
  IF NEW.email IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT email INTO NEW.email
    FROM auth.users
    WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para garantir sincronização no user_profiles
DROP TRIGGER IF EXISTS trigger_ensure_email_sync ON user_profiles;
CREATE TRIGGER trigger_ensure_email_sync
  BEFORE INSERT OR UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION ensure_email_sync();

-- Atualizar a função maintain_admin_status para incluir email
CREATE OR REPLACE FUNCTION maintain_admin_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Se este é o usuário admin, garantir status de admin
    IF EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = NEW.user_id 
        AND email = 'rayannyrego@gmail.com'
    ) THEN
        NEW.role := 'admin';
        NEW.is_admin := true;
        NEW.name := COALESCE(NEW.name, 'Rayanny Rego');
        NEW.email := 'rayannyrego@gmail.com';
    END IF;
    
    -- Garantir que o email esteja sempre sincronizado
    IF NEW.email IS NULL AND NEW.user_id IS NOT NULL THEN
        SELECT email INTO NEW.email
        FROM auth.users
        WHERE id = NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Atualizar a função ensure_admin_access para incluir email
CREATE OR REPLACE FUNCTION ensure_admin_access()
RETURNS TRIGGER AS $$
BEGIN
    -- Para o email admin específico
    IF NEW.email = 'rayannyrego@gmail.com' THEN
        -- Forçar inserção do perfil admin
        INSERT INTO user_profiles (
            user_id,
            email,
            name,
            role,
            is_admin,
            created_at
        ) VALUES (
            NEW.id,
            NEW.email,
            'Rayanny Rego',
            'admin',
            true,
            now()
        ) ON CONFLICT (user_id) DO UPDATE SET
            email = NEW.email,
            role = 'admin',
            is_admin = true,
            name = COALESCE(user_profiles.name, 'Rayanny Rego');
            
        RAISE NOTICE 'Perfil admin garantido para usuário: % com email: %', NEW.id, NEW.email;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verificar e corrigir dados existentes
DO $$
DECLARE
    user_record RECORD;
BEGIN
    -- Sincronizar todos os emails que estão faltando
    FOR user_record IN 
        SELECT up.user_id, au.email, up.email as current_email
        FROM user_profiles up
        JOIN auth.users au ON up.user_id = au.id
        WHERE up.email IS NULL OR up.email != au.email
    LOOP
        UPDATE user_profiles 
        SET email = user_record.email
        WHERE user_id = user_record.user_id;
        
        RAISE NOTICE 'Email sincronizado para usuário %: %', user_record.user_id, user_record.email;
    END LOOP;
END $$;

-- Garantir que o usuário admin tenha todas as permissões
DO $$
DECLARE
    admin_user_id uuid;
BEGIN
    -- Buscar o usuário admin
    SELECT id INTO admin_user_id
    FROM auth.users
    WHERE email = 'rayannyrego@gmail.com';
    
    IF admin_user_id IS NOT NULL THEN
        -- Garantir perfil admin completo
        INSERT INTO user_profiles (
            user_id,
            email,
            name,
            role,
            is_admin,
            created_at
        ) VALUES (
            admin_user_id,
            'rayannyrego@gmail.com',
            'Rayanny Rego',
            'admin',
            true,
            now()
        ) ON CONFLICT (user_id) DO UPDATE SET
            email = 'rayannyrego@gmail.com',
            role = 'admin',
            is_admin = true,
            name = COALESCE(user_profiles.name, 'Rayanny Rego');
            
        RAISE NOTICE 'Perfil admin atualizado com email para usuário: %', admin_user_id;
    END IF;
END $$;

-- Relatório final de verificação
SELECT 
    'VERIFICAÇÃO FINAL - SINCRONIZAÇÃO DE EMAIL' as status,
    u.email as auth_email,
    up.email as profile_email,
    up.name,
    up.role,
    up.is_admin,
    CASE 
        WHEN u.email = up.email THEN '✅ EMAIL SINCRONIZADO'
        WHEN up.email IS NULL THEN '⚠️ EMAIL FALTANDO NO PERFIL'
        ELSE '❌ EMAILS DIFERENTES'
    END as sync_status,
    CASE 
        WHEN up.is_admin = true THEN '✅ ACESSO ADMIN ATIVO'
        ELSE '❌ SEM ACESSO ADMIN'
    END as admin_status
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.user_id
ORDER BY up.is_admin DESC, u.email;

-- Mostrar especificamente o status do usuário admin
SELECT 
    'STATUS DO USUÁRIO ADMIN' as check_type,
    u.email as auth_email,
    up.email as profile_email,
    up.name,
    up.role,
    up.is_admin,
    up.created_at,
    CASE 
        WHEN up.is_admin = true AND u.email = up.email THEN '🎉 ADMIN COM EMAIL SINCRONIZADO - ACESSO TOTAL'
        WHEN up.is_admin = true THEN '⚠️ ADMIN MAS EMAIL NÃO SINCRONIZADO'
        WHEN u.email = 'rayannyrego@gmail.com' THEN '❌ USUÁRIO EXISTE MAS NÃO É ADMIN'
        ELSE '❓ STATUS DESCONHECIDO'
    END as final_status
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.user_id
WHERE u.email = 'rayannyrego@gmail.com'
UNION ALL
SELECT 
    'STATUS DO USUÁRIO ADMIN' as check_type,
    'rayannyrego@gmail.com' as auth_email,
    'Será criado no primeiro login' as profile_email,
    'Rayanny Rego' as name,
    'admin' as role,
    true as is_admin,
    null as created_at,
    '⏳ USUÁRIO AINDA NÃO FEZ SIGNUP - TRIGGER CONFIGURADO' as final_status
WHERE NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'rayannyrego@gmail.com'
);