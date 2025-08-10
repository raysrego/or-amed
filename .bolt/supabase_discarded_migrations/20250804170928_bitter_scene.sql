/*
  # Definir usuário rayannyrego@gmail.com como admin

  1. Atualização de Perfil
    - Define is_admin = true para o usuário rayannyrego@gmail.com
    - Define role = 'admin' para garantir permissões completas
  
  2. Segurança
    - Atualiza apenas o usuário específico
    - Mantém outros dados inalterados
*/

-- Atualizar o usuário rayannyrego@gmail.com para admin
UPDATE user_profiles 
SET 
  is_admin = true,
  role = 'admin',
  updated_at = now()
WHERE email = 'rayannyrego@gmail.com';

-- Verificar se a atualização foi bem-sucedida
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE email = 'rayannyrego@gmail.com' AND is_admin = true
  ) THEN
    RAISE NOTICE 'Usuário rayannyrego@gmail.com não encontrado ou não foi possível definir como admin';
  ELSE
    RAISE NOTICE 'Usuário rayannyrego@gmail.com definido como admin com sucesso';
  END IF;
END $$;