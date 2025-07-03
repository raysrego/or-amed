/*
  # Create admin user and user management system

  1. New Features
    - Admin user creation for Rayanny Rego
    - User profile management with roles
    - Doctor and secretary role differentiation
    - Secretary-doctor relationship management

  2. Security
    - RLS policies for user management
    - Admin-only access to user management
    - Role-based permissions

  3. Data
    - Insert admin user profile for Rayanny Rego
*/

-- Create admin role check function
CREATE OR REPLACE FUNCTION is_admin(user_email text)
RETURNS boolean AS $$
BEGIN
  RETURN user_email = 'rayannyrego@gmail.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add admin role to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Update user_profiles role constraint to include admin
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check 
  CHECK (role IN ('doctor', 'secretary', 'admin'));

-- Update doctor_fields_check constraint to handle admin role
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS doctor_fields_check;
ALTER TABLE user_profiles ADD CONSTRAINT doctor_fields_check CHECK (
  (role = 'doctor' AND crm IS NOT NULL AND specialty IS NOT NULL AND doctor_id IS NULL AND is_admin = false) OR
  (role = 'secretary' AND crm IS NULL AND specialty IS NULL AND is_admin = false) OR
  (role = 'admin' AND is_admin = true)
);

-- Create function to automatically create user profile for admin
CREATE OR REPLACE FUNCTION create_admin_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this is the admin email
  IF NEW.email = 'rayannyrego@gmail.com' THEN
    INSERT INTO user_profiles (user_id, name, role, is_admin)
    VALUES (NEW.id, 'Rayanny Rego', 'admin', true)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for admin profile creation
DROP TRIGGER IF EXISTS trigger_create_admin_profile ON auth.users;
CREATE TRIGGER trigger_create_admin_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_admin_profile();

-- Add admin policies
CREATE POLICY "Admins can manage all profiles"
  ON user_profiles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.user_id = auth.uid() AND up.is_admin = true
    )
  );

-- Add admin policy for surgery requests
CREATE POLICY "Admins can manage all surgery requests"
  ON user_surgery_requests
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.user_id = auth.uid() AND up.is_admin = true
    )
  );

-- Add admin policy for budget tracking
CREATE POLICY "Admins can manage all budget tracking"
  ON user_budget_tracking
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.user_id = auth.uid() AND up.is_admin = true
    )
  );

-- Insert admin user if it doesn't exist (this will be handled by the trigger when the user signs up)
-- The trigger will automatically create the profile when rayannyrego@gmail.com signs up