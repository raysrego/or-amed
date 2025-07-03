/*
  # Corrigir acesso administrativo para Rayanny Rego

  1. Verificações e Correções
    - Verificar se o usuário existe na tabela auth.users
    - Criar/atualizar perfil administrativo
    - Garantir sincronização de email
    - Verificar políticas RLS

  2. Segurança
    - Manter todas as políticas RLS
    - Garantir acesso administrativo completo
    - Sincronizar dados entre auth.users e user_profiles
*/

-- Primeiro, vamos verificar o status atual do usuário
DO $$
DECLARE
    user_uuid uuid;
    profile_exists boolean := false;
    current_email text;
BEGIN
    -- Buscar o usuário por email
    SELECT id, email INTO user_uuid, current_email
    FROM auth.users 
    WHERE email ILIKE '%rayanny%' OR email = 'rayannyrego@gmail.com';
    
    IF user_uuid IS NOT NULL THEN
        RAISE NOTICE 'Usuário encontrado: % com email: %', user_uuid, current_email;
        
        -- Verificar se perfil existe
        SELECT EXISTS(SELECT 1 FROM user_profiles WHERE user_id = user_uuid) INTO profile_exists;
        
        IF profile_exists THEN
            -- Atualizar perfil existente para admin
            UPDATE user_profiles 
            SET 
                role = 'admin',
                is_admin = true,
                name = COALESCE(name, 'Rayanny Rego'),
                email = current_email
            WHERE user_id = user_uuid;
            
            RAISE NOTICE 'Perfil atualizado para administrador';
        ELSE
            -- Criar novo perfil admin
            INSERT INTO user_profiles (
                user_id,
                email,
                name,
                role,
                is_admin,
                crm,
                specialty,
                doctor_id,
                created_at
            ) VALUES (
                user_uuid,
                current_email,
                'Rayanny Rego',
                'admin',
                true,
                null,
                null,
                null,
                now()
            );
            
            RAISE NOTICE 'Novo perfil administrativo criado';
        END IF;
    ELSE
        RAISE NOTICE 'Usuário não encontrado. Verificando possíveis variações...';
        
        -- Buscar por variações do nome/email
        FOR user_uuid, current_email IN 
            SELECT id, email FROM auth.users 
            WHERE email ILIKE '%rayanny%' OR email ILIKE '%rego%'
        LOOP
            RAISE NOTICE 'Usuário similar encontrado: % - %', current_email, user_uuid;
        END LOOP;
    END IF;
END $$;

-- Função melhorada para garantir acesso admin
CREATE OR REPLACE FUNCTION ensure_rayanny_admin_access()
RETURNS TRIGGER AS $$
BEGIN
    -- Para emails que contenham "rayanny" ou sejam especificamente o email admin
    IF NEW.email ILIKE '%rayanny%' OR NEW.email = 'rayannyrego@gmail.com' THEN
        -- Inserir/atualizar perfil admin
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
            
        RAISE NOTICE 'Acesso administrativo garantido para: % (%)', NEW.email, NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualizar trigger
DROP TRIGGER IF EXISTS trigger_ensure_rayanny_admin ON auth.users;
CREATE TRIGGER trigger_ensure_rayanny_admin
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION ensure_rayanny_admin_access();

-- Função para manter status admin
CREATE OR REPLACE FUNCTION maintain_rayanny_admin()
RETURNS TRIGGER AS $$
BEGIN
    -- Se este é um usuário Rayanny, garantir status admin
    IF EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = NEW.user_id 
        AND (email ILIKE '%rayanny%' OR email = 'rayannyrego@gmail.com')
    ) THEN
        NEW.role := 'admin';
        NEW.is_admin := true;
        NEW.name := COALESCE(NEW.name, 'Rayanny Rego');
        
        -- Sincronizar email
        IF NEW.email IS NULL THEN
            SELECT email INTO NEW.email
            FROM auth.users
            WHERE id = NEW.user_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Atualizar trigger no user_profiles
DROP TRIGGER IF EXISTS trigger_maintain_rayanny_admin ON user_profiles;
CREATE TRIGGER trigger_maintain_rayanny_admin
    BEFORE INSERT OR UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION maintain_rayanny_admin();

-- Verificar e corrigir qualquer usuário Rayanny existente
DO $$
DECLARE
    user_record RECORD;
BEGIN
    -- Buscar todos os usuários que possam ser a Rayanny
    FOR user_record IN 
        SELECT u.id, u.email, up.id as profile_id
        FROM auth.users u
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE u.email ILIKE '%rayanny%' OR u.email = 'rayannyrego@gmail.com'
    LOOP
        -- Garantir perfil admin
        INSERT INTO user_profiles (
            user_id,
            email,
            name,
            role,
            is_admin,
            created_at
        ) VALUES (
            user_record.id,
            user_record.email,
            'Rayanny Rego',
            'admin',
            true,
            now()
        ) ON CONFLICT (user_id) DO UPDATE SET
            email = user_record.email,
            role = 'admin',
            is_admin = true,
            name = COALESCE(user_profiles.name, 'Rayanny Rego');
            
        RAISE NOTICE 'Acesso admin configurado para: % (%)', user_record.email, user_record.id;
    END LOOP;
END $$;

-- Verificar políticas RLS para garantir que admins tenham acesso total
DO $$
DECLARE
    table_name text;
    policy_name text;
    tables_to_check text[] := ARRAY[
        'user_profiles', 'user_surgery_requests', 'user_budget_tracking',
        'patients', 'doctors', 'procedures', 'anesthesia_types', 
        'hospitals', 'suppliers', 'opmes', 'surgery_requests', 
        'budgets', 'audit_logs'
    ];
BEGIN
    FOREACH table_name IN ARRAY tables_to_check
    LOOP
        policy_name := 'Admins can manage all ' || table_name;
        
        -- Recriar política admin para garantir acesso total
        EXECUTE format('DROP POLICY IF EXISTS "%s" ON %I', policy_name, table_name);
        
        EXECUTE format('
            CREATE POLICY "%s"
            ON %I
            FOR ALL
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM user_profiles up 
                    WHERE up.user_id = auth.uid() 
                    AND up.is_admin = true
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM user_profiles up 
                    WHERE up.user_id = auth.uid() 
                    AND up.is_admin = true
                )
            )', policy_name, table_name);
            
        RAISE NOTICE 'Política admin atualizada para: %', table_name;
    END LOOP;
END $$;

-- Relatório final de status
SELECT 
    '🔍 VERIFICAÇÃO FINAL - ACESSO RAYANNY REGO' as status_check,
    u.email,
    u.id as user_id,
    up.name,
    up.role,
    up.is_admin,
    up.email as profile_email,
    up.created_at,
    CASE 
        WHEN up.is_admin = true THEN '✅ ACESSO ADMINISTRATIVO ATIVO'
        WHEN up.role = 'admin' THEN '⚠️ ROLE ADMIN MAS is_admin = false'
        WHEN up.user_id IS NOT NULL THEN '❌ USUÁRIO SEM ACESSO ADMIN'
        ELSE '❌ PERFIL NÃO ENCONTRADO'
    END as access_status,
    CASE 
        WHEN u.email = up.email THEN '✅ EMAIL SINCRONIZADO'
        WHEN up.email IS NULL THEN '⚠️ EMAIL FALTANDO NO PERFIL'
        ELSE '❌ EMAILS DIFERENTES'
    END as email_sync_status
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.user_id
WHERE u.email ILIKE '%rayanny%' OR u.email = 'rayannyrego@gmail.com'
ORDER BY u.created_at DESC;

-- Mostrar todos os usuários admin para verificação
SELECT 
    '👑 TODOS OS ADMINISTRADORES' as admin_list,
    u.email,
    up.name,
    up.role,
    up.is_admin,
    up.created_at
FROM user_profiles up
JOIN auth.users u ON up.user_id = u.id
WHERE up.is_admin = true
ORDER BY up.created_at DESC;

-- Instruções finais
SELECT 
    '📋 INSTRUÇÕES' as info_type,
    'Se o usuário ainda não aparece acima, ele precisa:' as step_1,
    '1. Fazer logout completo da aplicação' as step_2,
    '2. Fazer login novamente com o email correto' as step_3,
    '3. O sistema automaticamente dará acesso admin' as step_4,
    'Triggers configurados para garantir acesso automático' as note;