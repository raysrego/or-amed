/*
  # Fix user profiles constraints and add missing fields

  1. Schema Updates
    - Fix old_role constraint to allow proper user creation
    - Add proper defaults for required fields
    - Update constraints to be more flexible

  2. Security
    - Maintain RLS policies
    - Ensure data integrity
*/

-- First, let's check if we need to modify the old_role constraint
DO $$
BEGIN
  -- Drop the problematic constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'doctor_fields_check' 
    AND table_name = 'user_profiles'
  ) THEN
    ALTER TABLE user_profiles DROP CONSTRAINT doctor_fields_check;
  END IF;
END $$;

-- Update the user_profiles table to make old_role nullable temporarily
ALTER TABLE user_profiles ALTER COLUMN old_role DROP NOT NULL;

-- Add a new constraint that's more flexible
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_validation CHECK (
  (role = 'admin' AND is_admin = true) OR
  (role = 'doctor' AND crm IS NOT NULL AND specialty IS NOT NULL) OR
  (role = 'secretary')
);

-- Ensure email column exists and is properly set up
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN email text;
  END IF;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- Update any existing records that might have null old_role
UPDATE user_profiles SET old_role = role WHERE old_role IS NULL;

-- Create a function to sync user email from auth.users
CREATE OR REPLACE FUNCTION sync_user_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Get email from auth.users and update user_profiles
  UPDATE user_profiles 
  SET email = (
    SELECT email FROM auth.users WHERE id = NEW.user_id
  )
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to sync email
DROP TRIGGER IF EXISTS trigger_sync_user_email ON user_profiles;
CREATE TRIGGER trigger_sync_user_email
  AFTER INSERT OR UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_email();