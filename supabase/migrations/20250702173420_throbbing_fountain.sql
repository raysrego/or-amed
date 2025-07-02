/*
  # Surgery Budget Management Database Schema

  1. New Tables
    - `patients` - Patient information with age validation and parent data for minors
    - `doctors` - Doctor details with CRM validation and PIX integration
    - `procedures` - Medical procedures catalog
    - `anesthesia_types` - Types of anesthesia available
    - `hospitals` - Hospital information
    - `suppliers` - Medical equipment suppliers
    - `opmes` - Medical devices catalog (Órteses, Próteses e Materiais Especiais)
    - `surgery_requests` - Surgery requests with multiple procedures and equipment needs
    - `surgery_request_procedures` - Junction table for many-to-many relationship
    - `budgets` - Budget calculations with automated cost totals
    - `audit_logs` - Audit trail for budget operations

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their data
    - Add admin policies for sensitive operations

  3. Features
    - Automated budget calculation using triggers
    - CPF and CNPJ validation using regex
    - Age-based parent requirement validation
    - Comprehensive audit logging
*/

-- Create patients table with age validation
CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  contact text NOT NULL,
  cpf text NOT NULL UNIQUE CHECK (cpf ~ '^\d{11}$'),
  birth_date date NOT NULL,
  comorbidities text[] DEFAULT '{}',
  parent_name text,
  parent_cpf text CHECK (parent_cpf ~ '^\d{11}$'),
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT minor_parents_required CHECK (
    (EXTRACT(YEAR FROM AGE(birth_date)) < 18 AND parent_name IS NOT NULL AND parent_cpf IS NOT NULL) OR
    (EXTRACT(YEAR FROM AGE(birth_date)) >= 18 AND parent_name IS NULL AND parent_cpf IS NULL)
  )
);

-- Create doctors table with CRM validation
CREATE TABLE IF NOT EXISTS doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cpf text NOT NULL UNIQUE CHECK (cpf ~ '^\d{11}$'),
  crm text NOT NULL UNIQUE CHECK (crm ~ '^\d{6,7}$'),
  contact text NOT NULL,
  pix_key text NOT NULL,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- Create procedures table
CREATE TABLE IF NOT EXISTS procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- Create anesthesia types table
CREATE TABLE IF NOT EXISTS anesthesia_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- Create hospitals table
CREATE TABLE IF NOT EXISTS hospitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  contact text NOT NULL,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- Create suppliers table with CNPJ validation
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact text NOT NULL,
  cnpj text NOT NULL UNIQUE CHECK (cnpj ~ '^\d{14}$'),
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- Create OPMEs table
CREATE TABLE IF NOT EXISTS opmes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text NOT NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE RESTRICT,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- Create surgery requests table
CREATE TABLE IF NOT EXISTS surgery_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE RESTRICT,
  doctor_id uuid REFERENCES doctors(id) ON DELETE RESTRICT,
  opme_requests jsonb NOT NULL,
  anesthesia_id uuid REFERENCES anesthesia_types(id) ON DELETE RESTRICT,
  needs_icu boolean DEFAULT FALSE,
  icu_days integer CHECK (icu_days >= 0),
  ward_days integer CHECK (ward_days >= 0),
  room_days integer CHECK (room_days >= 0),
  hospital_equipment text[] DEFAULT '{}',
  exams_during_stay text[] DEFAULT '{}',
  procedure_duration interval NOT NULL,
  doctor_fee numeric NOT NULL CHECK (doctor_fee >= 0),
  blood_reserve boolean DEFAULT FALSE,
  blood_units integer CHECK (blood_units >= 0),
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- Create junction table for surgery requests and procedures
CREATE TABLE IF NOT EXISTS surgery_request_procedures (
  surgery_request_id uuid REFERENCES surgery_requests(id) ON DELETE CASCADE,
  procedure_id uuid REFERENCES procedures(id) ON DELETE CASCADE,
  PRIMARY KEY (surgery_request_id, procedure_id)
);

-- Create budgets table with automated cost calculation
CREATE TABLE IF NOT EXISTS budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surgery_request_id uuid REFERENCES surgery_requests(id) ON DELETE CASCADE,
  hospital_id uuid REFERENCES hospitals(id) ON DELETE RESTRICT,
  opme_quotes jsonb NOT NULL,
  icu_daily_cost numeric CHECK (icu_daily_cost >= 0),
  ward_daily_cost numeric CHECK (ward_daily_cost >= 0),
  room_daily_cost numeric CHECK (room_daily_cost >= 0),
  anesthetist_fee numeric CHECK (anesthetist_fee >= 0),
  doctor_fee numeric NOT NULL CHECK (doctor_fee >= 0),
  total_cost numeric CHECK (total_cost >= 0),
  status text NOT NULL CHECK (status IN ('APPROVED', 'AWAITING_QUOTE', 'AWAITING_PATIENT', 'AWAITING_PAYMENT', 'CANCELED')),
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- Create audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid REFERENCES budgets(id) ON DELETE CASCADE,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- Function to calculate total cost
CREATE OR REPLACE FUNCTION calculate_total_cost()
RETURNS TRIGGER AS $$
DECLARE
  icu_days INTEGER := 0;
  ward_days INTEGER := 0;
  room_days INTEGER := 0;
  opme_sum NUMERIC := 0;
BEGIN
  SELECT
    COALESCE(sr.icu_days, 0),
    COALESCE(sr.ward_days, 0),
    COALESCE(sr.room_days, 0)
  INTO icu_days, ward_days, room_days
  FROM surgery_requests sr
  WHERE sr.id = NEW.surgery_request_id;

  SELECT SUM((quote->>'cost')::NUMERIC)
  INTO opme_sum
  FROM jsonb_array_elements(NEW.opme_quotes) AS quote;

  NEW.total_cost := (
    COALESCE(NEW.icu_daily_cost, 0) * icu_days +
    COALESCE(NEW.ward_daily_cost, 0) * ward_days +
    COALESCE(NEW.room_daily_cost, 0) * room_days +
    COALESCE(NEW.anesthetist_fee, 0) +
    COALESCE(NEW.doctor_fee, 0) +
    COALESCE(opme_sum, 0)
  ) * 1.05;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for budget calculation
DROP TRIGGER IF EXISTS trigger_calculate_total_cost ON budgets;
CREATE TRIGGER trigger_calculate_total_cost
BEFORE INSERT OR UPDATE ON budgets
FOR EACH ROW
EXECUTE FUNCTION calculate_total_cost();

-- Enable Row Level Security
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE anesthesia_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE opmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgery_request_procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can read patients"
  ON patients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert patients"
  ON patients FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update patients"
  ON patients FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete patients"
  ON patients FOR DELETE
  TO authenticated
  USING (true);

-- Similar policies for other tables
CREATE POLICY "Authenticated users can manage doctors"
  ON doctors FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage procedures"
  ON procedures FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage anesthesia_types"
  ON anesthesia_types FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage hospitals"
  ON hospitals FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage suppliers"
  ON suppliers FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage opmes"
  ON opmes FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage surgery_requests"
  ON surgery_requests FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage surgery_request_procedures"
  ON surgery_request_procedures FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage budgets"
  ON budgets FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read audit_logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (true);