/*
  # Grant full admin permissions to rayannyrego@gmail.com

  1. Security Changes
    - Create or update user profile with admin privileges
    - Ensure is_admin flag is set to true
    - Set role to 'admin'
  
  2. Fallback Strategy
    - If user doesn't exist in auth.users yet, create a placeholder that will be updated on first login
    - Handle both existing and new user scenarios
*/

-- First, let's try to find and update the existing user
DO $$
DECLARE
    user_uuid uuid;
    profile_exists boolean := false;
BEGIN
    -- Try to find the user in auth.users
    SELECT id INTO user_uuid 
    FROM auth.users 
    WHERE email = 'rayannyrego@gmail.com';
    
    -- Check if profile already exists
    SELECT EXISTS(SELECT 1 FROM user_profiles WHERE user_id = user_uuid) INTO profile_exists;
    
    -- If user exists in auth.users
    IF user_uuid IS NOT NULL THEN
        IF profile_exists THEN
            -- Update existing profile
            UPDATE user_profiles 
            SET 
                role = 'admin',
                is_admin = true,
                name = COALESCE(name, 'Rayanny Rego')
            WHERE user_id = user_uuid;
            
            RAISE NOTICE 'Admin profile updated for user: %', user_uuid;
        ELSE
            -- Create new profile
            INSERT INTO user_profiles (
                user_id,
                name,
                role,
                is_admin,
                crm,
                specialty,
                doctor_id,
                created_at
            ) VALUES (
                user_uuid,
                'Rayanny Rego',
                'admin',
                true,
                null,
                null,
                null,
                now()
            );
            
            RAISE NOTICE 'New admin profile created for user: %', user_uuid;
        END IF;
    ELSE
        RAISE NOTICE 'User rayannyrego@gmail.com not found in auth.users table';
        RAISE NOTICE 'User needs to sign up/login first to appear in the system';
    END IF;
END $$;

-- Also create a function to automatically grant admin on first login
CREATE OR REPLACE FUNCTION grant_admin_on_signup()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if this is the admin email
    IF NEW.email = 'rayannyrego@gmail.com' THEN
        -- Insert admin profile
        INSERT INTO user_profiles (
            user_id,
            name,
            role,
            is_admin,
            created_at
        ) VALUES (
            NEW.id,
            'Rayanny Rego',
            'admin',
            true,
            now()
        ) ON CONFLICT (user_id) DO UPDATE SET
            role = 'admin',
            is_admin = true,
            name = COALESCE(user_profiles.name, 'Rayanny Rego');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically grant admin privileges on signup
DROP TRIGGER IF EXISTS trigger_grant_admin_on_signup ON auth.users;
CREATE TRIGGER trigger_grant_admin_on_signup
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION grant_admin_on_signup();

-- Verify the current state
SELECT 
    u.email,
    up.name,
    up.role,
    up.is_admin,
    up.created_at,
    CASE 
        WHEN up.user_id IS NULL THEN 'No profile found'
        WHEN up.is_admin = true THEN 'Admin access granted'
        ELSE 'Regular user'
    END as status
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.user_id
WHERE u.email = 'rayannyrego@gmail.com'
UNION ALL
SELECT 
    'rayannyrego@gmail.com' as email,
    'Not signed up yet' as name,
    'Will be admin on signup' as role,
    null as is_admin,
    null as created_at,
    'Trigger ready for first login' as status
WHERE NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'rayannyrego@gmail.com'
);