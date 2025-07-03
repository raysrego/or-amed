-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('doctor', 'secretary')),
  crm text,
  specialty text,
  doctor_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT doctor_fields_check CHECK (
    (role = 'doctor' AND crm IS NOT NULL AND specialty IS NOT NULL AND doctor_id IS NULL) OR
    (role = 'secretary' AND crm IS NULL AND specialty IS NULL)
  )
);

-- Create user_surgery_requests table
CREATE TABLE IF NOT EXISTS user_surgery_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  patient_name text NOT NULL,
  patient_cpf text NOT NULL,
  patient_birth_date date NOT NULL,
  patient_contact text NOT NULL,
  procedure_description text NOT NULL,
  urgency_level text NOT NULL CHECK (urgency_level IN ('low', 'medium', 'high', 'urgent')),
  preferred_date date,
  observations text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'in_progress')),
  created_at timestamptz DEFAULT now()
);

-- Create user_budget_tracking table
CREATE TABLE IF NOT EXISTS user_budget_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surgery_request_id uuid REFERENCES user_surgery_requests(id) ON DELETE CASCADE,
  budget_id uuid REFERENCES budgets(id) ON DELETE SET NULL,
  status text DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'awaiting_patient', 'approved', 'revision_requested', 'rejected')),
  user_approval text CHECK (user_approval IN ('approved', 'revision_requested', 'rejected')),
  user_feedback text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_surgery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_budget_tracking ENABLE ROW LEVEL SECURITY;

-- Policies for user_profiles
CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Doctors can read their secretaries"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    doctor_id IN (
      SELECT id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- Policies for user_surgery_requests
CREATE POLICY "Users can manage own surgery requests"
  ON user_surgery_requests
  FOR ALL
  TO authenticated
  USING (
    user_profile_id IN (
      SELECT id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Doctors can read secretary requests"
  ON user_surgery_requests
  FOR SELECT
  TO authenticated
  USING (
    user_profile_id IN (
      SELECT id FROM user_profiles 
      WHERE doctor_id IN (
        SELECT id FROM user_profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Policies for user_budget_tracking
CREATE POLICY "Users can manage own budget tracking"
  ON user_budget_tracking
  FOR ALL
  TO authenticated
  USING (
    surgery_request_id IN (
      SELECT id FROM user_surgery_requests
      WHERE user_profile_id IN (
        SELECT id FROM user_profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Doctors can read secretary budget tracking"
  ON user_budget_tracking
  FOR SELECT
  TO authenticated
  USING (
    surgery_request_id IN (
      SELECT usr.id FROM user_surgery_requests usr
      JOIN user_profiles up ON usr.user_profile_id = up.id
      WHERE up.doctor_id IN (
        SELECT id FROM user_profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_doctor_id ON user_profiles(doctor_id);
CREATE INDEX IF NOT EXISTS idx_user_surgery_requests_user_profile_id ON user_surgery_requests(user_profile_id);
CREATE INDEX IF NOT EXISTS idx_user_budget_tracking_surgery_request_id ON user_budget_tracking(surgery_request_id);
CREATE INDEX IF NOT EXISTS idx_user_budget_tracking_budget_id ON user_budget_tracking(budget_id);

-- Function to automatically create budget tracking when surgery request is created
CREATE OR REPLACE FUNCTION create_budget_tracking()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_budget_tracking (surgery_request_id, status)
  VALUES (NEW.id, 'in_progress');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create budget tracking
CREATE TRIGGER trigger_create_budget_tracking
  AFTER INSERT ON user_surgery_requests
  FOR EACH ROW
  EXECUTE FUNCTION create_budget_tracking();

-- Function to update budget tracking when budget status changes
CREATE OR REPLACE FUNCTION update_budget_tracking_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update tracking status when budget status changes to awaiting_patient
  IF NEW.status = 'AWAITING_PATIENT' AND OLD.status != 'AWAITING_PATIENT' THEN
    UPDATE user_budget_tracking 
    SET status = 'awaiting_patient', updated_at = now()
    WHERE budget_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update budget tracking
CREATE TRIGGER trigger_update_budget_tracking_status
  AFTER UPDATE ON budgets
  FOR EACH ROW
  EXECUTE FUNCTION update_budget_tracking_status();