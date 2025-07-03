/*
  # Remove Admin Authentication System

  This migration removes all admin-specific authentication and authorization,
  granting all authenticated users access to the entire application.

  ## Changes Made

  1. **Policy Updates**
     - Replace all admin-restricted policies with universal authenticated access
     - Remove role-based access controls
     - Grant full CRUD permissions to all authenticated users

  2. **Function Updates**
     - Remove admin-checking functions
     - Update triggers to remove admin validations
     - Maintain user profile functionality without admin restrictions

  3. **Security Changes**
     - All authenticated users can access all features
     - Remove is_admin column restrictions
     - Maintain data integrity while removing access barriers

  ## Tables Affected
  - user_profiles
  - patients, doctors, procedures, anesthesia_types
  - hospitals, suppliers, opmes
  - surgery_requests, budgets, audit_logs
  - user_surgery_requests, user_budget_tracking
*/

-- Step 1: Update all table policies to grant universal authenticated access
DO $$
DECLARE
    table_record RECORD;
    policy_record RECORD;
    tables_to_update text[] := ARRAY[
        'user_profiles', 'patients', 'doctors', 'procedures', 'anesthesia_types',
        'hospitals', 'suppliers', 'opmes', 'surgery_requests', 'budgets',
        'audit_logs', 'user_surgery_requests', 'user_budget_tracking'
    ];
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY tables_to_update
    LOOP
        -- Drop all existing policies for this table
        FOR policy_record IN
            SELECT policyname
            FROM pg_policies
            WHERE schemaname = 'public'
            AND tablename = table_name
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS "%s" ON %I', 
                policy_record.policyname, table_name);
        END LOOP;
        
        -- Create single universal policy for authenticated users
        EXECUTE format('
            CREATE POLICY "Authenticated users can manage all %s"
            ON %I
            FOR ALL
            TO authenticated
            USING (true)
            WITH CHECK (true)', 
            table_name, table_name);
            
        RAISE NOTICE 'Updated policies for table: %', table_name;
    END LOOP;
END $$;

-- Step 2: Remove admin-specific functions
DROP FUNCTION IF EXISTS is_admin() CASCADE;
DROP FUNCTION IF EXISTS check_admin_access() CASCADE;

-- Step 3: Update user profile triggers to remove admin checks
CREATE OR REPLACE FUNCTION sync_user_email()
RETURNS TRIGGER AS $$
BEGIN
  -- For INSERT on auth.users
  IF TG_OP = 'INSERT' THEN
    -- Insert basic profile without admin checks
    INSERT INTO user_profiles (user_id, email, name, role, is_admin, created_at)
    VALUES (
        NEW.id, 
        NEW.email, 
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), 
        'secretary', 
        false, 
        now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      email = NEW.email;
    
    RETURN NEW;
  END IF;
  
  -- For UPDATE on auth.users (email change)
  IF TG_OP = 'UPDATE' THEN
    UPDATE user_profiles 
    SET email = NEW.email
    WHERE user_id = NEW.id;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Update profile management function
CREATE OR REPLACE FUNCTION ensure_email_sync()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure email is always synced from auth.users
  IF NEW.email IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT email INTO NEW.email
    FROM auth.users
    WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Remove admin-specific triggers and replace with simplified ones
DROP TRIGGER IF EXISTS trigger_maintain_admin_status ON user_profiles;
DROP TRIGGER IF EXISTS trigger_maintain_rayanny_admin ON user_profiles;
DROP TRIGGER IF EXISTS trigger_ensure_admin_on_auth ON auth.users;
DROP TRIGGER IF EXISTS trigger_ensure_admin_access ON auth.users;
DROP TRIGGER IF EXISTS trigger_ensure_rayanny_admin ON auth.users;
DROP TRIGGER IF EXISTS trigger_grant_admin_on_signup ON auth.users;

-- Create simplified triggers for basic user management
CREATE TRIGGER trigger_sync_user_email_insert
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_email();

CREATE TRIGGER trigger_sync_user_email_update
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_email();

CREATE TRIGGER trigger_ensure_email_sync
  BEFORE INSERT OR UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION ensure_email_sync();

-- Step 6: Update any remaining admin-specific functions
DROP FUNCTION IF EXISTS ensure_admin_access() CASCADE;
DROP FUNCTION IF EXISTS ensure_rayanny_admin_access() CASCADE;
DROP FUNCTION IF EXISTS ensure_admin_on_auth() CASCADE;
DROP FUNCTION IF EXISTS maintain_admin_status() CASCADE;
DROP FUNCTION IF EXISTS maintain_rayanny_admin() CASCADE;
DROP FUNCTION IF EXISTS grant_admin_access(text) CASCADE;
DROP FUNCTION IF EXISTS test_admin_access(uuid) CASCADE;

-- Step 7: Ensure all users have basic profiles
DO $$
DECLARE
    user_record RECORD;
BEGIN
    -- Create profiles for any users missing them
    FOR user_record IN 
        SELECT u.id, u.email
        FROM auth.users u
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE up.user_id IS NULL
    LOOP
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
            user_record.email,
            'secretary',
            false,
            now()
        );
        
        RAISE NOTICE 'Created profile for user: %', user_record.email;
    END LOOP;
END $$;

-- Step 8: Verify all tables have proper access policies
SELECT 
    'POLICY VERIFICATION' as check_type,
    schemaname,
    tablename,
    policyname,
    CASE 
        WHEN qual = 'true' THEN '✅ UNIVERSAL ACCESS'
        ELSE '⚠️ RESTRICTED ACCESS'
    END as access_level
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
    'user_profiles', 'patients', 'doctors', 'procedures', 'anesthesia_types',
    'hospitals', 'suppliers', 'opmes', 'surgery_requests', 'budgets',
    'audit_logs', 'user_surgery_requests', 'user_budget_tracking'
)
ORDER BY tablename, policyname;

-- Step 9: Final status report
SELECT 
    'SYSTEM UPDATE COMPLETE' as status,
    'All authenticated users now have full application access' as message,
    'Admin restrictions have been completely removed' as change,
    'Users can access all features without role-based limitations' as result;

-- Step 10: Show current user count and access status
SELECT 
    'USER ACCESS SUMMARY' as summary_type,
    COUNT(u.id) as total_users,
    COUNT(up.id) as users_with_profiles,
    COUNT(CASE WHEN up.is_admin = true THEN 1 END) as admin_users,
    'All users have equal access regardless of admin status' as note
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.user_id;