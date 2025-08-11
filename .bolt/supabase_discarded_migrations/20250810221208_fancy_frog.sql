/*
  # Garantir usuário administrador

  1. Atualização do perfil
    - Define rayannyrego@gmail.com como administrador
    - Garante que is_admin seja true
    - Define role como 'admin'

  2. Segurança
    - Atualiza apenas se o usuário existir
    - Mantém outros dados intactos
*/

-- Atualizar perfil existente para admin
UPDATE user_profiles 
SET 
  role = 'admin',
  is_admin = true,
  name = COALESCE(name, 'Rayanny Rego - Administrador'),
  updated_at = now()
WHERE email = 'rayannyrego@gmail.com';

-- Inserir perfil se não existir (usando dados do auth.users se disponível)
INSERT INTO user_profiles (user_id, email, name, role, is_admin, created_at)
SELECT 
  au.id,
  'rayannyrego@gmail.com',
  'Rayanny Rego - Administrador',
  'admin',
  true,
  now()
FROM auth.users au
WHERE au.email = 'rayannyrego@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.email = 'rayannyrego@gmail.com'
  );