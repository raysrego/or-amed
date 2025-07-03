/*
  # Admin Access Setup

  1. Security
    - Grant admin access to rayannyrego@gmail.com
    - Add admin role and policies
    - Enable user management for admin

  2. Changes
    - Add is_admin column to user_profiles
    - Update constraints to handle admin role
    - Create admin profile creation trigger
    - Add admin policies for all tables
    - Clean up duplicate user_id entries before adding unique constraint
*/

-- Create admin role check function
CREATE OR REPLACE FUNCTION is_admin(user_email text)
RETURNS boolean AS $$
BEGIN
  RETURN user_email = 'rayannyrego@gmail.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add admin role to user_profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN is_admin boolean DEFAULT false;
  END IF;
END $$;

-- Clean up duplicate user_id entries before adding unique constraint
DO $$
DECLARE
  duplicate_record RECORD;
BEGIN
  -- Find and remove duplicate user_id entries, keeping only the most recent one
  FOR duplicate_record IN 
    SELECT user_id, COUNT(*) as count_duplicates
    FROM user_profiles 
    GROUP BY user_id 
    HAVING COUNT(*) > 1
  LOOP
    -- Delete all but the most recent record for each duplicate user_id
    DELETE FROM user_profiles 
    WHERE user_id = duplicate_record.user_id 
    AND id NOT IN (
      SELECT id FROM user_profiles 
      WHERE user_id = duplicate_record.user_id 
      ORDER BY created_at DESC 
      LIMIT 1
    );
  END LOOP;
END $$;

-- Add unique constraint on user_id if it doesn't exist (after cleaning duplicates)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'user_profiles' AND constraint_name = 'user_profiles_user_id_key'
  ) THEN
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;

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
    -- Insert or update admin profile
    INSERT INTO user_profiles (user_id, name, role, is_admin)
    VALUES (NEW.id, 'Rayanny Rego', 'admin', true)
    ON CONFLICT (user_id) DO UPDATE SET
      name = 'Rayanny Rego',
      role = 'admin',
      is_admin = true,
      crm = NULL,
      specialty = NULL,
      doctor_id = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for admin profile creation
DROP TRIGGER IF EXISTS trigger_create_admin_profile ON auth.users;
CREATE TRIGGER trigger_create_admin_profile
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_admin_profile();

-- Drop existing admin policies if they exist
DROP POLICY IF EXISTS "Admins can manage all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage all surgery requests" ON user_surgery_requests;
DROP POLICY IF EXISTS "Admins can manage all budget tracking" ON user_budget_tracking;

-- Add admin policies for user_profiles
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

-- Add admin policy for user_surgery_requests
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

-- Add admin policy for user_budget_tracking
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

-- Create admin user profile if the user already exists
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Check if admin user exists in auth.users
  SELECT id INTO admin_user_id 
  FROM auth.users 
  WHERE email = 'rayannyrego@gmail.com';
  
  -- If user exists, create/update profile
  IF admin_user_id IS NOT NULL THEN
    -- Check if profile already exists
    IF EXISTS (SELECT 1 FROM user_profiles WHERE user_id = admin_user_id) THEN
      -- Update existing profile
      UPDATE user_profiles SET
        name = 'Rayanny Rego',
        role = 'admin',
        is_admin = true,
        crm = NULL,
        specialty = NULL,
        doctor_id = NULL
      WHERE user_id = admin_user_id;
    ELSE
      -- Insert new profile
      INSERT INTO user_profiles (user_id, name, role, is_admin)
      VALUES (admin_user_id, 'Rayanny Rego', 'admin', true);
    END IF;
  END IF;
END $$;