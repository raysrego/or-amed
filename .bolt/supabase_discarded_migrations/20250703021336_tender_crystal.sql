/*
  # Conceder permissões de administrador para rayannyrego@gmail.com

  1. Localizar o usuário pelo email
  2. Criar ou atualizar perfil como administrador
  3. Garantir acesso total ao sistema

  Este script irá:
  - Encontrar o usuário rayannyrego@gmail.com na tabela auth.users
  - Criar ou atualizar seu perfil na tabela user_profiles
  - Definir is_admin = true para acesso completo
  - Definir role = 'admin' para identificação
*/

-- Primeiro, vamos verificar se o usuário existe e criar/atualizar seu perfil
DO $$
DECLARE
    user_uuid uuid;
BEGIN
    -- Buscar o UUID do usuário pelo email
    SELECT id INTO user_uuid 
    FROM auth.users 
    WHERE email = 'rayannyrego@gmail.com';
    
    -- Se o usuário foi encontrado
    IF user_uuid IS NOT NULL THEN
        -- Verificar se já existe um perfil
        IF EXISTS (SELECT 1 FROM user_profiles WHERE user_id = user_uuid) THEN
            -- Atualizar perfil existente para admin
            UPDATE user_profiles 
            SET 
                role = 'admin',
                is_admin = true,
                name = COALESCE(name, 'Rayanny Rego'),
                updated_at = now()
            WHERE user_id = user_uuid;
            
            RAISE NOTICE 'Perfil atualizado para administrador: %', user_uuid;
        ELSE
            -- Criar novo perfil como admin
            INSERT INTO user_profiles (
                user_id,
                name,
                role,
                is_admin,
                crm,
                specialty,
                doctor_id,
                created_at
            ) VALUES (
                user_uuid,
                'Rayanny Rego',
                'admin',
                true,
                null,
                null,
                null,
                now()
            );
            
            RAISE NOTICE 'Novo perfil de administrador criado: %', user_uuid;
        END IF;
    ELSE
        RAISE NOTICE 'Usuário rayannyrego@gmail.com não encontrado na tabela auth.users';
        RAISE NOTICE 'O usuário precisa fazer login pelo menos uma vez para ser encontrado';
    END IF;
END $$;

-- Verificar o resultado
SELECT 
    u.email,
    up.name,
    up.role,
    up.is_admin,
    up.created_at
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.user_id
WHERE u.email = 'rayannyrego@gmail.com';