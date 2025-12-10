/*
  # Limpeza de Tabelas Duplicadas
  
  1. Objetivo
    - Remover tabelas em português que não são usadas pelo frontend
    - Manter apenas as tabelas em inglês consistentes com o código
    - Remover campos legacy e desnecessários
  
  2. Tabelas a serem removidas
    - `orcamentos` (usar `budgets`)
    - `pacientes` (usar `patients`)
    - `hospitais` (usar `hospitals`)
    - `fornecedores` (usar `suppliers`)
    - `opme` (usar `opmes`)
    - `procedimentos` (usar `procedures`)
    - `orcamento_procedimentos` (não é mais necessária)
  
  3. Campos a serem removidos
    - `user_profiles.old_role` (campo legacy)
    - `surgery_requests.procedure_ids` (usar tabela de junção)
  
  4. Segurança
    - Manter RLS em todas as tabelas existentes
*/

-- Remover tabela orcamento_procedimentos (depende de outras tabelas)
DROP TABLE IF EXISTS public.orcamento_procedimentos CASCADE;

-- Remover tabela orcamentos
DROP TABLE IF EXISTS public.orcamentos CASCADE;

-- Remover tabela opme
DROP TABLE IF EXISTS public.opme CASCADE;

-- Remover tabela fornecedores
DROP TABLE IF EXISTS public.fornecedores CASCADE;

-- Remover tabela procedimentos
DROP TABLE IF EXISTS public.procedimentos CASCADE;

-- Remover tabela pacientes
DROP TABLE IF EXISTS public.pacientes CASCADE;

-- Remover tabela hospitais
DROP TABLE IF EXISTS public.hospitais CASCADE;

-- Remover campo old_role da tabela user_profiles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'old_role'
  ) THEN
    ALTER TABLE public.user_profiles DROP COLUMN old_role;
  END IF;
END $$;

-- Remover campo procedure_ids da tabela surgery_requests (usar tabela de junção)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'surgery_requests' AND column_name = 'procedure_ids'
  ) THEN
    ALTER TABLE public.surgery_requests DROP COLUMN procedure_ids;
  END IF;
END $$;

-- Adicionar campo updated_at em user_profiles se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.user_profiles ADD COLUMN updated_at timestamp with time zone DEFAULT now();
  END IF;
END $$;

-- Garantir que a coluna email em user_profiles seja única
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'user_profiles' AND constraint_name = 'user_profiles_email_key'
  ) THEN
    ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_email_key UNIQUE (email);
  END IF;
END $$;

-- Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_budgets_surgery_request_id ON public.budgets(surgery_request_id);
CREATE INDEX IF NOT EXISTS idx_budgets_hospital_id ON public.budgets(hospital_id);
CREATE INDEX IF NOT EXISTS idx_budgets_status ON public.budgets(status);
CREATE INDEX IF NOT EXISTS idx_surgery_requests_patient_id ON public.surgery_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_surgery_requests_doctor_id ON public.surgery_requests(doctor_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_doctor_id ON public.user_profiles(doctor_id);
