/*
  # Verify and Ensure Rayanny Admin Access

  This migration performs a comprehensive check and fix for Rayanny Rego's admin access.
*/

-- Step 1: Find all possible Rayanny users and show current status
DO $$
DECLARE
    user_record RECORD;
    total_users integer;
    admin_users integer;
BEGIN
    -- Count total users
    SELECT COUNT(*) INTO total_users FROM auth.users;
    SELECT COUNT(*) INTO admin_users FROM user_profiles WHERE is_admin = true;
    
    RAISE NOTICE '=== SYSTEM STATUS ===';
    RAISE NOTICE 'Total users in system: %', total_users;
    RAISE NOTICE 'Total admin users: %', admin_users;
    RAISE NOTICE '';
    
    RAISE NOTICE '=== SEARCHING FOR RAYANNY REGO ===';
    
    -- Look for Rayanny in various ways
    FOR user_record IN 
        SELECT 
            u.id,
            u.email,
            u.created_at as user_created,
            up.name,
            up.role,
            up.is_admin,
            up.created_at as profile_created
        FROM auth.users u
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE u.email ILIKE '%rayanny%' 
           OR u.email ILIKE '%rego%'
           OR u.email = 'rayannyrego@gmail.com'
        ORDER BY u.created_at DESC
    LOOP
        RAISE NOTICE 'Found user: %', user_record.email;
        RAISE NOTICE '  User ID: %', user_record.id;
        RAISE NOTICE '  Profile Name: %', COALESCE(user_record.name, 'NO PROFILE');
        RAISE NOTICE '  Role: %', COALESCE(user_record.role, 'NO ROLE');
        RAISE NOTICE '  Is Admin: %', COALESCE(user_record.is_admin::text, 'NO PROFILE');
        RAISE NOTICE '  User Created: %', user_record.user_created;
        RAISE NOTICE '  Profile Created: %', COALESCE(user_record.profile_created::text, 'NO PROFILE');
        RAISE NOTICE '';
        
        -- Fix this user if needed
        IF user_record.is_admin IS NOT TRUE THEN
            RAISE NOTICE 'FIXING ADMIN ACCESS FOR: %', user_record.email;
            
            -- Delete any existing profile to avoid conflicts
            DELETE FROM user_profiles WHERE user_id = user_record.id;
            
            -- Create fresh admin profile
            INSERT INTO user_profiles (
                user_id,
                email,
                name,
                role,
                is_admin,
                created_at
            ) VALUES (
                user_record.id,
                user_record.email,
                'Rayanny Rego',
                'admin',
                true,
                now()
            );
            
            RAISE NOTICE 'ADMIN ACCESS GRANTED FOR: %', user_record.email;
        ELSE
            RAISE NOTICE 'USER ALREADY HAS ADMIN ACCESS: %', user_record.email;
        END IF;
    END LOOP;
    
    -- If no Rayanny found, show recent users for debugging
    IF NOT FOUND THEN
        RAISE NOTICE 'NO RAYANNY USER FOUND. Recent users:';
        FOR user_record IN 
            SELECT u.email, u.created_at
            FROM auth.users u
            ORDER BY u.created_at DESC
            LIMIT 5
        LOOP
            RAISE NOTICE '  - % (created: %)', user_record.email, user_record.created_at;
        END LOOP;
    END IF;
END $$;

-- Step 2: Create a super-robust trigger that handles any admin email
CREATE OR REPLACE FUNCTION ensure_admin_on_auth()
RETURNS TRIGGER AS $$
DECLARE
    is_admin_user boolean := false;
    admin_name text := 'Admin User';
BEGIN
    -- Check if this is an admin email (multiple patterns)
    IF NEW.email = 'rayannyrego@gmail.com' 
       OR NEW.email ILIKE '%rayanny%'
       OR NEW.email ILIKE '%rego%' THEN
        is_admin_user := true;
        admin_name := 'Rayanny Rego';
    END IF;
    
    -- If this is an admin user, ensure admin profile
    IF is_admin_user THEN
        -- Delete any existing profile first to avoid conflicts
        DELETE FROM user_profiles WHERE user_id = NEW.id;
        
        -- Insert fresh admin profile
        INSERT INTO user_profiles (
            user_id,
            email,
            name,
            role,
            is_admin,
            created_at
        ) VALUES (
            NEW.id,
            NEW.email,
            admin_name,
            'admin',
            true,
            now()
        );
        
        RAISE NOTICE 'Admin profile created for: % (%)', NEW.email, NEW.id;
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the user creation
    RAISE NOTICE 'Error creating admin profile for %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Replace all existing triggers
DROP TRIGGER IF EXISTS trigger_handle_admin_creation ON auth.users;
DROP TRIGGER IF EXISTS trigger_ensure_admin_access ON auth.users;
DROP TRIGGER IF EXISTS trigger_ensure_rayanny_admin ON auth.users;
DROP TRIGGER IF EXISTS trigger_grant_admin_on_signup ON auth.users;

CREATE TRIGGER trigger_ensure_admin_on_auth
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION ensure_admin_on_auth();

-- Step 3: Ensure all RLS policies allow admin access
DO $$
DECLARE
    table_name text;
    policy_count integer;
BEGIN
    -- List of all tables that need admin policies
    FOR table_name IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT LIKE 'pg_%'
        AND tablename NOT LIKE 'sql_%'
    LOOP
        -- Check if table has RLS enabled
        IF EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = table_name
            AND n.nspname = 'public'
            AND c.relrowsecurity = true
        ) THEN
            -- Create admin policy for this table
            BEGIN
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
                    
                RAISE NOTICE 'Admin policy created for table: %', table_name;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Could not create admin policy for %: %', table_name, SQLERRM;
            END;
        END IF;
    END LOOP;
END $$;

-- Step 4: Test admin access function
CREATE OR REPLACE FUNCTION test_admin_access(test_user_id uuid)
RETURNS text AS $$
DECLARE
    result text;
    user_email text;
    is_admin_result boolean;
BEGIN
    -- Get user email
    SELECT email INTO user_email
    FROM auth.users
    WHERE id = test_user_id;
    
    -- Check admin status
    SELECT is_admin INTO is_admin_result
    FROM user_profiles
    WHERE user_id = test_user_id;
    
    IF is_admin_result = true THEN
        result := 'ADMIN ACCESS CONFIRMED for ' || user_email;
    ELSIF is_admin_result = false THEN
        result := 'USER EXISTS BUT NOT ADMIN: ' || user_email;
    ELSE
        result := 'NO PROFILE FOUND for ' || COALESCE(user_email, 'unknown user');
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Final verification and report
DO $$
DECLARE
    user_record RECORD;
    test_result text;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== FINAL VERIFICATION ===';
    
    -- Check all admin users
    FOR user_record IN 
        SELECT u.email, u.id, up.name, up.is_admin, up.created_at
        FROM user_profiles up
        JOIN auth.users u ON up.user_id = u.id
        WHERE up.is_admin = true
        ORDER BY up.created_at DESC
    LOOP
        SELECT test_admin_access(user_record.id) INTO test_result;
        RAISE NOTICE 'Admin user: % - %', user_record.email, test_result;
    END LOOP;
    
    -- Specific check for Rayanny
    FOR user_record IN 
        SELECT u.email, u.id
        FROM auth.users u
        WHERE u.email ILIKE '%rayanny%' OR u.email = 'rayannyrego@gmail.com'
    LOOP
        SELECT test_admin_access(user_record.id) INTO test_result;
        RAISE NOTICE 'Rayanny status: %', test_result;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== TROUBLESHOOTING GUIDE ===';
    RAISE NOTICE 'If Rayanny still cannot access:';
    RAISE NOTICE '1. Verify the exact email address being used';
    RAISE NOTICE '2. Clear browser cache completely';
    RAISE NOTICE '3. Try incognito/private browsing mode';
    RAISE NOTICE '4. Check browser console for JavaScript errors';
    RAISE NOTICE '5. Ensure the user is logging out completely before trying again';
END $$;

-- Create a simple function to manually grant admin access
CREATE OR REPLACE FUNCTION grant_admin_access(user_email text)
RETURNS text AS $$
DECLARE
    user_uuid uuid;
    result text;
BEGIN
    -- Find user
    SELECT id INTO user_uuid
    FROM auth.users
    WHERE email = user_email;
    
    IF user_uuid IS NULL THEN
        RETURN 'ERROR: User with email ' || user_email || ' not found';
    END IF;
    
    -- Delete existing profile
    DELETE FROM user_profiles WHERE user_id = user_uuid;
    
    -- Create admin profile
    INSERT INTO user_profiles (
        user_id,
        email,
        name,
        role,
        is_admin,
        created_at
    ) VALUES (
        user_uuid,
        user_email,
        'Rayanny Rego',
        'admin',
        true,
        now()
    );
    
    RETURN 'SUCCESS: Admin access granted to ' || user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Show final status
SELECT 
    'FINAL STATUS REPORT' as report_type,
    u.email,
    up.name,
    up.role,
    up.is_admin,
    CASE 
        WHEN up.is_admin = true THEN '✅ READY FOR ADMIN ACCESS'
        ELSE '❌ NEEDS ATTENTION'
    END as status
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.user_id
WHERE u.email ILIKE '%rayanny%' OR u.email = 'rayannyrego@gmail.com'
UNION ALL
SELECT 
    'SYSTEM READY' as report_type,
    'Triggers configured for automatic admin access' as email,
    'Any user with rayanny in email will get admin' as name,
    'admin' as role,
    true as is_admin,
    '✅ SYSTEM CONFIGURED' as status
WHERE NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email ILIKE '%rayanny%'
);