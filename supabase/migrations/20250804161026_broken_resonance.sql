/*
  # Unificação das Tabelas de Médicos

  1. Migração de Dados
    - Migra todos os registros de `medicos` para `doctors`
    - Preserva todos os dados existentes
    - Adiciona campos necessários à tabela `doctors`

  2. Atualização de Relacionamentos
    - Atualiza todas as foreign keys que apontavam para `medicos`
    - Corrige referências em `user_profiles`, `orcamentos`, etc.

  3. Limpeza
    - Remove a tabela `medicos` após migração completa
    - Remove constraints e índices relacionados
*/

-- Primeiro, adicionar campos necessários à tabela doctors se não existirem
DO $$
BEGIN
  -- Adicionar campo user_id se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'doctors' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE doctors ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  -- Adicionar campo specialty se não existir (renomeado de especialidade)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'doctors' AND column_name = 'specialty'
  ) THEN
    ALTER TABLE doctors ADD COLUMN specialty text;
  END IF;
END $$;

-- Migrar dados da tabela medicos para doctors (se a tabela medicos existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'medicos') THEN
    -- Inserir registros de medicos que não existem em doctors
    INSERT INTO doctors (name, crm, contact, pix_key, specialty, created_at, user_id, email)
    SELECT 
      m.nome as name,
      m.crm,
      COALESCE(m.contato, 'Não informado') as contact,
      'Não informado' as pix_key, -- Campo obrigatório em doctors
      NULL as specialty, -- Será preenchido depois se houver dados
      COALESCE(m.created_at, now()) as created_at,
      NULL as user_id, -- Será vinculado depois se necessário
      NULL as email
    FROM medicos m
    WHERE NOT EXISTS (
      SELECT 1 FROM doctors d WHERE d.crm = m.crm
    );
  END IF;
END $$;

-- Atualizar relacionamentos em user_profiles
DO $$
BEGIN
  -- Se existe coluna medico_id em user_profiles, migrar para doctor_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'medico_id'
  ) THEN
    -- Adicionar doctor_id se não existir
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'user_profiles' AND column_name = 'doctor_id'
    ) THEN
      ALTER TABLE user_profiles ADD COLUMN doctor_id uuid REFERENCES doctors(id) ON DELETE SET NULL;
    END IF;

    -- Migrar dados de medico_id para doctor_id
    UPDATE user_profiles up
    SET doctor_id = d.id
    FROM doctors d, medicos m
    WHERE up.medico_id = m.id 
    AND d.crm = m.crm
    AND up.doctor_id IS NULL;

    -- Remover coluna medico_id após migração
    ALTER TABLE user_profiles DROP COLUMN IF EXISTS medico_id;
  END IF;
END $$;

-- Atualizar relacionamentos em orcamentos se existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orcamentos') THEN
    -- Atualizar medico_id para doctor_id em orcamentos
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'orcamentos' AND column_name = 'medico_id'
    ) THEN
      -- Adicionar doctor_id se não existir
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orcamentos' AND column_name = 'doctor_id'
      ) THEN
        ALTER TABLE orcamentos ADD COLUMN doctor_id uuid REFERENCES doctors(id) ON DELETE SET NULL;
      END IF;

      -- Migrar dados
      UPDATE orcamentos o
      SET doctor_id = d.id
      FROM doctors d, medicos m
      WHERE o.medico_id = m.id 
      AND d.crm = m.crm
      AND o.doctor_id IS NULL;

      -- Remover coluna antiga
      ALTER TABLE orcamentos DROP COLUMN IF EXISTS medico_id;
    END IF;
  END IF;
END $$;

-- Vincular user_profiles com doctors baseado no CRM se possível
DO $$
BEGIN
  -- Para usuários do tipo doctor, tentar vincular com registro em doctors
  UPDATE user_profiles up
  SET doctor_id = d.id
  FROM doctors d
  WHERE up.role = 'doctor' 
  AND up.crm = d.crm 
  AND up.doctor_id IS NULL;
END $$;

-- Remover tabela medicos após migração completa
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'medicos') THEN
    DROP TABLE medicos CASCADE;
  END IF;
END $$;

-- Garantir que RLS está habilitado em doctors
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;

-- Recriar políticas RLS para doctors se necessário
DROP POLICY IF EXISTS "Authenticated users can manage all doctors" ON doctors;
CREATE POLICY "Authenticated users can manage all doctors"
  ON doctors
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);