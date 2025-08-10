/*
  # Tornar usuário rayannyrego@gmail.com administrador

  1. Atualização
    - Atualiza o perfil do usuário rayannyrego@gmail.com para administrador
    - Define is_admin como true e role como admin
*/

-- Atualizar o usuário para administrador
UPDATE user_profiles 
SET 
  role = 'admin',
  is_admin = true,
  updated_at = now()
WHERE email = 'rayannyrego@gmail.com';

-- Se o usuário não existir, criar o perfil (caso já tenha conta no auth)
INSERT INTO user_profiles (user_id, email, name, role, is_admin)
SELECT 
  id,
  'rayannyrego@gmail.com',
  'Rayanny Rego',
  'admin',
  true
FROM auth.users 
WHERE email = 'rayannyrego@gmail.com'
AND NOT EXISTS (
  SELECT 1 FROM user_profiles WHERE email = 'rayannyrego@gmail.com'
);