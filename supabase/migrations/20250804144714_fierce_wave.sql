/*
  # Fix doctor_id foreign key constraint

  1. Changes
    - Remove problematic foreign key constraint on doctor_id
    - Add safer constraint that allows NULL values
    - Clean up any orphaned references

  2. Security
    - Maintain data integrity with application-level validation
    - Allow flexible user profile creation
*/

-- Remove the problematic constraint
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_doctor_id_fkey;

-- Clean up any orphaned doctor_id references
UPDATE user_profiles 
SET doctor_id = NULL 
WHERE doctor_id IS NOT NULL 
AND doctor_id NOT IN (SELECT id FROM user_profiles WHERE role = 'doctor');

-- Add a safer constraint that allows NULL and validates existing references
ALTER TABLE user_profiles 
ADD CONSTRAINT user_profiles_doctor_id_fkey 
FOREIGN KEY (doctor_id) 
REFERENCES user_profiles(id) 
ON DELETE SET NULL 
DEFERRABLE INITIALLY DEFERRED;