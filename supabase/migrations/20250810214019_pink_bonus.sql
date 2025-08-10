/*
  # Criar usuário administrador

  1. Criação do perfil admin
    - Criar perfil para rayannyrego@gmail.com como administrador
    - Garantir acesso total ao sistema
  
  2. Segurança
    - Definir is_admin como true
    - Role como admin
*/

-- Primeiro, verificar se o usuário já existe na tabela auth.users
-- Se não existir, precisará ser criado via interface

-- Criar ou atualizar perfil de administrador
INSERT INTO user_profiles (
  user_id,
  email,
  name,
  role,
  is_admin,
  created_at
)
SELECT 
  au.id,
  'rayannyrego@gmail.com',
  'Rayanny Rego - Administrador',
  'admin',
  true,
  now()
FROM auth.users au
WHERE au.email = 'rayannyrego@gmail.com'
ON CONFLICT (user_id) 
DO UPDATE SET
  email = 'rayannyrego@gmail.com',
  name = 'Rayanny Rego - Administrador',
  role = 'admin',
  is_admin = true,
  updated_at = now();

-- Se não existir usuário na auth.users, criar perfil temporário que será associado quando o usuário fizer login
INSERT INTO user_profiles (
  user_id,
  email,
  name,
  role,
  is_admin,
  created_at
)
SELECT 
  gen_random_uuid(),
  'rayannyrego@gmail.com',
  'Rayanny Rego - Administrador',
  'admin',
  true,
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'rayannyrego@gmail.com'
)
ON CONFLICT (email) DO NOTHING;