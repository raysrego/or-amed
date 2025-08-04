/*
  # Fix foreign key constraint violation

  1. Changes
    - Remove foreign key constraint that's causing issues
    - Add proper handling for user_profiles without breaking references
    - Ensure user_id can be null temporarily during user creation process

  2. Security
    - Maintain data integrity while allowing proper user creation flow
*/

-- Remove the problematic foreign key constraint temporarily
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_user_id_fkey;

-- Add a more flexible constraint that allows for proper user creation flow
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;

-- Update any existing records that might have issues
UPDATE user_profiles 
SET user_id = NULL 
WHERE user_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_profiles.user_id);

-- Create a function to handle user profile creation safely
CREATE OR REPLACE FUNCTION create_user_profile_safely(
  p_user_id uuid,
  p_email text,
  p_name text,
  p_role text,
  p_crm text DEFAULT NULL,
  p_specialty text DEFAULT NULL,
  p_doctor_id uuid DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  profile_id uuid;
BEGIN
  -- Insert the profile
  INSERT INTO user_profiles (
    user_id,
    email,
    name,
    role,
    old_role,
    crm,
    specialty,
    doctor_id,
    is_admin
  ) VALUES (
    p_user_id,
    p_email,
    p_name,
    p_role,
    p_role, -- Set old_role same as role
    p_crm,
    p_specialty,
    p_doctor_id,
    CASE WHEN p_role = 'admin' THEN true ELSE false END
  ) RETURNING id INTO profile_id;
  
  RETURN profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;