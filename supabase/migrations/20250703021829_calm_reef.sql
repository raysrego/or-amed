/*
  # Force admin profile creation for rayannyrego@gmail.com

  1. Direct Admin Creation
    - Create admin profile directly if user exists
    - Set up fallback for when user signs up
  
  2. Verification
    - Verify admin access is properly configured
    - Show current status
*/

-- Create or update admin profile with maximum privileges
DO $$
DECLARE
    user_uuid uuid;
    admin_profile_id uuid;
BEGIN
    -- Try to find existing user
    SELECT id INTO user_uuid 
    FROM auth.users 
    WHERE email = 'rayannyrego@gmail.com';
    
    IF user_uuid IS NOT NULL THEN
        -- User exists, create/update profile
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
        )
        ON CONFLICT (user_id) DO UPDATE SET
            role = 'admin',
            is_admin = true,
            name = COALESCE(EXCLUDED.name, user_profiles.name, 'Rayanny Rego')
        RETURNING id INTO admin_profile_id;
        
        RAISE NOTICE 'Admin profile created/updated with ID: % for user: %', admin_profile_id, user_uuid;
    ELSE
        RAISE NOTICE 'User rayannyrego@gmail.com not found. Will be granted admin on first signup.';
    END IF;
END $$;

-- Create a more robust trigger for admin creation
CREATE OR REPLACE FUNCTION ensure_admin_access()
RETURNS TRIGGER AS $$
BEGIN
    -- For the specific admin email
    IF NEW.email = 'rayannyrego@gmail.com' THEN
        -- Force insert admin profile
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
            
        RAISE NOTICE 'Admin profile ensured for user: %', NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Replace the trigger
DROP TRIGGER IF EXISTS trigger_ensure_admin_access ON auth.users;
CREATE TRIGGER trigger_ensure_admin_access
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION ensure_admin_access();

-- Also create a trigger for profile updates to maintain admin status
CREATE OR REPLACE FUNCTION maintain_admin_status()
RETURNS TRIGGER AS $$
BEGIN
    -- If this is the admin user, ensure admin status is maintained
    IF EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = NEW.user_id 
        AND email = 'rayannyrego@gmail.com'
    ) THEN
        NEW.role := 'admin';
        NEW.is_admin := true;
        NEW.name := COALESCE(NEW.name, 'Rayanny Rego');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_maintain_admin_status ON user_profiles;
CREATE TRIGGER trigger_maintain_admin_status
    BEFORE INSERT OR UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION maintain_admin_status();

-- Final verification and status report
SELECT 
    'FINAL ADMIN STATUS CHECK' as status_check,
    COALESCE(u.email, 'rayannyrego@gmail.com') as email,
    COALESCE(up.name, 'Will be created on signup') as name,
    COALESCE(up.role, 'admin (pending)') as role,
    COALESCE(up.is_admin::text, 'true (pending)') as is_admin,
    CASE 
        WHEN u.id IS NOT NULL AND up.is_admin = true THEN '✅ ADMIN ACCESS ACTIVE'
        WHEN u.id IS NOT NULL AND up.is_admin IS NOT true THEN '❌ USER EXISTS BUT NOT ADMIN'
        WHEN u.id IS NULL THEN '⏳ USER NOT SIGNED UP YET - ADMIN TRIGGER READY'
        ELSE '❓ UNKNOWN STATUS'
    END as access_status,
    CASE 
        WHEN u.id IS NOT NULL THEN 'User can login and access admin features'
        ELSE 'User will get admin access automatically on first signup/login'
    END as instructions
FROM auth.users u
RIGHT JOIN (SELECT 'rayannyrego@gmail.com' as target_email) t ON u.email = t.target_email
LEFT JOIN user_profiles up ON u.id = up.user_id;

-- Show all admin users for verification
SELECT 
    'ALL ADMIN USERS' as list_type,
    u.email,
    up.name,
    up.role,
    up.is_admin,
    up.created_at
FROM user_profiles up
JOIN auth.users u ON up.user_id = u.id
WHERE up.is_admin = true
ORDER BY up.created_at DESC;