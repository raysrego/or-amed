/*
  # Remove Admin Authentication System

  This migration removes all admin-based restrictions and grants universal access
  to all authenticated users across the entire application.

  ## Changes Made:
  1. Remove all admin-specific functions and triggers
  2. Create universal access policies for all tables
  3. Ensure all users have proper profiles
  4. Enable full application access for all authenticated users
*/

-- Step 1: Drop all existing triggers first to avoid conflicts
DROP TRIGGER IF EXISTS trigger_sync_user_email_insert ON auth.users;
DROP TRIGGER IF EXISTS trigger_sync_user_email_update ON auth.users;
DROP TRIGGER IF EXISTS trigger_ensure_email_sync ON user_profiles;
DROP TRIGGER IF EXISTS trigger_maintain_admin_status ON user_profiles;
DROP TRIGGER IF EXISTS trigger_maintain_rayanny_admin ON user_profiles;
DROP TRIGGER IF EXISTS trigger_ensure_admin_on_auth ON auth.users;
DROP TRIGGER IF EXISTS trigger_ensure_admin_access ON auth.users;
DROP TRIGGER IF EXISTS trigger_ensure_rayanny_admin ON auth.users;
DROP TRIGGER IF EXISTS trigger_grant_admin_on_signup ON auth.users;

-- Step 2: Drop all admin-specific functions
DROP FUNCTION IF EXISTS is_admin() CASCADE;
DROP FUNCTION IF EXISTS check_admin_access() CASCADE;
DROP FUNCTION IF EXISTS ensure_admin_access() CASCADE;
DROP FUNCTION IF EXISTS ensure_rayanny_admin_access() CASCADE;
DROP FUNCTION IF EXISTS ensure_admin_on_auth() CASCADE;
DROP FUNCTION IF EXISTS maintain_admin_status() CASCADE;
DROP FUNCTION IF EXISTS maintain_rayanny_admin() CASCADE;
DROP FUNCTION IF EXISTS grant_admin_access(text) CASCADE;
DROP FUNCTION IF EXISTS test_admin_access(uuid) CASCADE;
DROP FUNCTION IF EXISTS sync_user_email() CASCADE;
DROP FUNCTION IF EXISTS ensure_email_sync() CASCADE;

-- Step 3: Update all table policies to grant universal authenticated access
DO $$
DECLARE
    policy_record RECORD;
    tables_to_update text[] := ARRAY[
        'user_profiles', 'patients', 'doctors', 'procedures', 'anesthesia_types',
        'hospitals', 'suppliers', 'opmes', 'surgery_requests', 'budgets',
        'audit_logs', 'user_surgery_requests', 'user_budget_tracking',
        'surgery_request_procedures', 'orcamentos', 'orcamento_procedimentos',
        'fornecedores', 'opme', 'pacientes', 'medicos', 'hospitais', 'procedimentos'
    ];
    current_table text;
BEGIN
    FOREACH current_table IN ARRAY tables_to_update
    LOOP
        -- Check if table exists before processing
        IF EXISTS (
            SELECT 1 
            FROM information_schema.tables t
            WHERE t.table_name = current_table 
            AND t.table_schema = 'public'
        ) THEN
            -- Drop all existing policies for this table
            FOR policy_record IN
                SELECT policyname
                FROM pg_policies
                WHERE schemaname = 'public'
                AND tablename = current_table
            LOOP
                EXECUTE format('DROP POLICY IF EXISTS "%s" ON %I', 
                    policy_record.policyname, current_table);
            END LOOP;
            
            -- Create single universal policy for authenticated users
            EXECUTE format('
                CREATE POLICY "Authenticated users can manage all %s"
                ON %I
                FOR ALL
                TO authenticated
                USING (true)
                WITH CHECK (true)', 
                current_table, current_table);
                
            RAISE NOTICE 'Updated policies for table: %', current_table;
        ELSE
            RAISE NOTICE 'Table does not exist, skipping: %', current_table;
        END IF;
    END LOOP;
END $$;

-- Step 4: Create simplified user management functions
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

-- Step 5: Create email sync function for profiles
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

-- Step 6: Create simplified triggers for basic user management
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

-- Step 8: Update any existing user profiles to ensure they have proper access
UPDATE user_profiles 
SET is_admin = false 
WHERE is_admin IS NULL;

-- Step 9: Verify all tables have RLS enabled and proper policies
DO $$
DECLARE
    current_table text;
    tables_to_check text[] := ARRAY[
        'user_profiles', 'patients', 'doctors', 'procedures', 'anesthesia_types',
        'hospitals', 'suppliers', 'opmes', 'surgery_requests', 'budgets',
        'audit_logs', 'user_surgery_requests', 'user_budget_tracking'
    ];
BEGIN
    FOREACH current_table IN ARRAY tables_to_check
    LOOP
        IF EXISTS (
            SELECT 1 
            FROM information_schema.tables t
            WHERE t.table_name = current_table 
            AND t.table_schema = 'public'
        ) THEN
            -- Ensure RLS is enabled
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', current_table);
            RAISE NOTICE 'RLS enabled for table: %', current_table;
        END IF;
    END LOOP;
END $$;

-- Step 10: Final verification and status report
DO $$
DECLARE
    policy_count integer;
    user_count integer;
    profile_count integer;
BEGIN
    -- Count policies with universal access
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    AND qual = 'true'
    AND with_check = 'true';
    
    -- Count users and profiles
    SELECT COUNT(*) INTO user_count FROM auth.users;
    SELECT COUNT(*) INTO profile_count FROM user_profiles;
    
    RAISE NOTICE '=== MIGRATION COMPLETE ===';
    RAISE NOTICE 'Universal access policies created: %', policy_count;
    RAISE NOTICE 'Total users: %', user_count;
    RAISE NOTICE 'User profiles: %', profile_count;
    RAISE NOTICE 'All authenticated users now have full application access';
    RAISE NOTICE 'Admin restrictions have been completely removed';
END $$;