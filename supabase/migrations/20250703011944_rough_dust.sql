-- Update user_profiles constraint to make doctor_id optional for secretaries
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS doctor_fields_check;
ALTER TABLE user_profiles ADD CONSTRAINT doctor_fields_check CHECK (
  (role = 'doctor' AND crm IS NOT NULL AND specialty IS NOT NULL AND doctor_id IS NULL AND is_admin = false) OR
  (role = 'secretary' AND crm IS NULL AND specialty IS NULL AND is_admin = false) OR
  (role = 'admin' AND is_admin = true)
);

-- Update existing secretary profiles to have null doctor_id if needed
UPDATE user_profiles 
SET doctor_id = NULL 
WHERE role = 'secretary' AND doctor_id IS NOT NULL;