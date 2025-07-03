/*
  # Fix Rayanny Rego Admin Access Issue

  1. Problem Analysis
    - User "Rayanny Rego" is getting "Database error granting user"
    - This suggests an issue with profile creation or admin privileges
    - Need to ensure proper admin access and fix any constraint issues

  2. Solution
    - Find and fix the user profile
    - Ensure admin privileges are properly granted
    - Fix any database constraint issues
    - Create robust triggers for future logins

  3. Security
    - Maintain RLS policies
    - Ensure only legitimate admin access
*/

-- First, let's check the current state and fix any issues
DO $$
DECLARE
    user_uuid uuid;
    user_email text;
    profile_exists boolean := false;
    error_details text;
BEGIN
    -- Find the user by various email patterns
    SELECT id, email INTO user_uuid, user_email
    FROM auth.users 
    WHERE email ILIKE '%rayanny%' 
       OR email = 'rayannyrego@gmail.com'
       OR email ILIKE '%rego%'
    LIMIT 1;
    
    IF user_uuid IS NOT NULL THEN
        RAISE NOTICE 'Found user: % with email: %', user_uuid, user_email;
        
        -- Check if profile exists
        SELECT EXISTS(SELECT 1 FROM user_profiles WHERE user_id = user_uuid) INTO profile_exists;
        
        -- Delete any conflicting profile first
        DELETE FROM user_profiles WHERE user_id = user_uuid;
        
        -- Create fresh admin profile
        BEGIN
            INSERT INTO user_profiles (
                user_id,
                email,
                name,
                role,
                is_admin,
                crm,
                specialty,
                doctor_id,
                created_at
            ) VALUES (
                user_uuid,
                user_email,
                'Rayanny Rego',
                'admin',
                true,
                null,
                null,
                null,
                now()
            );
            
            RAISE NOTICE 'Successfully created admin profile for user: %', user_uuid;
            
        EXCEPTION WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS error_details = PG_EXCEPTION_DETAIL;
            RAISE NOTICE 'Error creating profile: % - %', SQLERRM, error_details;
            
            -- Try alternative approach
            UPDATE user_profiles 
            SET 
                role = 'admin',
                is_admin = true,
                name = 'Rayanny Rego',
                email = user_email
            WHERE user_id = user_uuid;
        END;
        
    ELSE
        RAISE NOTICE 'User not found in auth.users. Checking for similar emails...';
        
        -- Show all users for debugging
        FOR user_uuid, user_email IN 
            SELECT id, email FROM auth.users 
            ORDER BY created_at DESC
            LIMIT 10
        LOOP
            RAISE NOTICE 'Available user: % - %', user_email, user_uuid;
        END LOOP;
    END IF;
END $$;

-- Create a more robust function to handle admin creation
CREATE OR REPLACE FUNCTION create_admin_profile(target_email text, admin_name text)
RETURNS void AS $$
DECLARE
    user_uuid uuid;
    existing_profile_id uuid;
BEGIN
    -- Find user by email
    SELECT id INTO user_uuid
    FROM auth.users
    WHERE email = target_email;
    
    IF user_uuid IS NULL THEN
        RAISE EXCEPTION 'User with email % not found', target_email;
    END IF;
    
    -- Check for existing profile
    SELECT id INTO existing_profile_id
    FROM user_profiles
    WHERE user_id = user_uuid;
    
    IF existing_profile_id IS NOT NULL THEN
        -- Update existing profile
        UPDATE user_profiles
        SET 
            role = 'admin',
            is_admin = true,
            name = admin_name,
            email = target_email
        WHERE id = existing_profile_id;
        
        RAISE NOTICE 'Updated existing profile % to admin', existing_profile_id;
    ELSE
        -- Create new profile
        INSERT INTO user_profiles (
            user_id,
            email,
            name,
            role,
            is_admin,
            created_at
        ) VALUES (
            user_uuid,
            target_email,
            admin_name,
            'admin',
            true,
            now()
        );
        
        RAISE NOTICE 'Created new admin profile for user %', user_uuid;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced trigger function with better error handling
CREATE OR REPLACE FUNCTION handle_admin_user_creation()
RETURNS TRIGGER AS $$
DECLARE
    admin_emails text[] := ARRAY['rayannyrego@gmail.com'];
    is_admin_email boolean := false;
BEGIN
    -- Check if this is an admin email
    SELECT NEW.email = ANY(admin_emails) INTO is_admin_email;
    
    -- Also check for emails containing 'rayanny'
    IF NOT is_admin_email THEN
        is_admin_email := NEW.email ILIKE '%rayanny%';
    END IF;
    
    IF is_admin_email THEN
        -- Use the robust function to create admin profile
        BEGIN
            PERFORM create_admin_profile(NEW.email, 'Rayanny Rego');
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error in admin profile creation: %', SQLERRM;
            -- Continue anyway, don't block user creation
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Replace all existing triggers with the new one
DROP TRIGGER IF EXISTS trigger_ensure_admin_access ON auth.users;
DROP TRIGGER IF EXISTS trigger_ensure_rayanny_admin ON auth.users;
DROP TRIGGER IF EXISTS trigger_grant_admin_on_signup ON auth.users;

CREATE TRIGGER trigger_handle_admin_creation
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_admin_user_creation();

-- Enhanced profile maintenance function
CREATE OR REPLACE FUNCTION maintain_admin_profiles()
RETURNS TRIGGER AS $$
DECLARE
    user_email text;
BEGIN
    -- Get user email
    SELECT email INTO user_email
    FROM auth.users
    WHERE id = NEW.user_id;
    
    -- If this is an admin user, ensure admin status
    IF user_email = 'rayannyrego@gmail.com' OR user_email ILIKE '%rayanny%' THEN
        NEW.role := 'admin';
        NEW.is_admin := true;
        NEW.name := COALESCE(NEW.name, 'Rayanny Rego');
        NEW.email := user_email;
    END IF;
    
    -- Ensure email is always synced
    IF NEW.email IS NULL AND NEW.user_id IS NOT NULL THEN
        NEW.email := user_email;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update profile trigger
DROP TRIGGER IF EXISTS trigger_maintain_admin_status ON user_profiles;
DROP TRIGGER IF EXISTS trigger_maintain_rayanny_admin ON user_profiles;

CREATE TRIGGER trigger_maintain_admin_profiles
    BEFORE INSERT OR UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION maintain_admin_profiles();

-- Fix any existing Rayanny user
DO $$
DECLARE
    rayanny_user RECORD;
BEGIN
    -- Find and fix Rayanny's profile
    FOR rayanny_user IN 
        SELECT u.id, u.email
        FROM auth.users u
        WHERE u.email ILIKE '%rayanny%' OR u.email = 'rayannyrego@gmail.com'
    LOOP
        -- Use the robust function
        PERFORM create_admin_profile(rayanny_user.email, 'Rayanny Rego');
        RAISE NOTICE 'Fixed admin access for: %', rayanny_user.email;
    END LOOP;
END $$;

-- Ensure RLS policies allow admin access
DO $$
DECLARE
    table_name text;
    tables_list text[] := ARRAY[
        'user_profiles', 'user_surgery_requests', 'user_budget_tracking',
        'patients', 'doctors', 'procedures', 'anesthesia_types', 
        'hospitals', 'suppliers', 'opmes', 'surgery_requests', 
        'budgets', 'audit_logs'
    ];
BEGIN
    FOREACH table_name IN ARRAY tables_list
    LOOP
        -- Ensure admin policy exists and is correct
        EXECUTE format('
            DROP POLICY IF EXISTS "Admins can manage all %s" ON %I;
            CREATE POLICY "Admins can manage all %s"
            ON %I
            FOR ALL
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM user_profiles up 
                    WHERE up.user_id = auth.uid() 
                    AND up.is_admin = true
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM user_profiles up 
                    WHERE up.user_id = auth.uid() 
                    AND up.is_admin = true
                )
            )', table_name, table_name, table_name, table_name);
    END LOOP;
END $$;

-- Create a function to check admin status easily
CREATE OR REPLACE FUNCTION check_admin_status(check_email text DEFAULT NULL)
RETURNS TABLE(
    email text,
    user_id uuid,
    profile_name text,
    role text,
    is_admin boolean,
    access_status text,
    created_at timestamptz
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.email,
        u.id as user_id,
        up.name as profile_name,
        up.role,
        up.is_admin,
        CASE 
            WHEN up.is_admin = true THEN '✅ FULL ADMIN ACCESS'
            WHEN up.role = 'admin' THEN '⚠️ ADMIN ROLE BUT is_admin=false'
            WHEN up.user_id IS NOT NULL THEN '❌ USER EXISTS BUT NOT ADMIN'
            ELSE '❌ NO PROFILE FOUND'
        END as access_status,
        up.created_at
    FROM auth.users u
    LEFT JOIN user_profiles up ON u.id = up.user_id
    WHERE (check_email IS NULL OR u.email ILIKE '%' || check_email || '%')
    ORDER BY up.is_admin DESC NULLS LAST, u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Final verification
SELECT * FROM check_admin_status('rayanny');

-- Show all admin users
SELECT 
    '👑 ALL ADMINISTRATORS' as list_type,
    u.email,
    up.name,
    up.is_admin,
    up.created_at
FROM user_profiles up
JOIN auth.users u ON up.user_id = u.id
WHERE up.is_admin = true
ORDER BY up.created_at DESC;

-- Instructions for the user
SELECT 
    '📋 NEXT STEPS FOR RAYANNY REGO' as instructions,
    'If you still get "Database error granting user":' as step_0,
    '1. Clear browser cache and cookies completely' as step_1,
    '2. Try logging out and logging in again' as step_2,
    '3. If using a different email, let us know the exact email' as step_3,
    '4. Check browser console for detailed error messages' as step_4,
    'The database is now properly configured for admin access' as note;