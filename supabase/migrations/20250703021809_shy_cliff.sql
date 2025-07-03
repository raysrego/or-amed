/*
  # Ensure RLS policies allow full admin access

  1. Security Updates
    - Update all RLS policies to allow full access for admin users
    - Ensure admin users can bypass all restrictions
  
  2. Admin Access
    - Grant full CRUD access to all tables for admin users
    - Override any restrictive policies
*/

-- Update user_profiles policies to ensure admins have full access
DROP POLICY IF EXISTS "Admins can manage all profiles" ON user_profiles;
CREATE POLICY "Admins can manage all profiles"
ON user_profiles
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
);

-- Update user_surgery_requests policies
DROP POLICY IF EXISTS "Admins can manage all surgery requests" ON user_surgery_requests;
CREATE POLICY "Admins can manage all surgery requests"
ON user_surgery_requests
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
);

-- Update user_budget_tracking policies
DROP POLICY IF EXISTS "Admins can manage all budget tracking" ON user_budget_tracking;
CREATE POLICY "Admins can manage all budget tracking"
ON user_budget_tracking
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
);

-- Ensure all other tables have admin policies
DO $$
DECLARE
    table_name text;
    tables_to_update text[] := ARRAY[
        'patients', 'doctors', 'procedures', 'anesthesia_types', 
        'hospitals', 'suppliers', 'opmes', 'surgery_requests', 
        'budgets', 'audit_logs'
    ];
BEGIN
    FOREACH table_name IN ARRAY tables_to_update
    LOOP
        -- Drop existing admin policy if it exists
        EXECUTE format('DROP POLICY IF EXISTS "Admins can manage all %s" ON %I', table_name, table_name);
        
        -- Create new admin policy
        EXECUTE format('
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
            )', table_name, table_name);
            
        RAISE NOTICE 'Updated admin policy for table: %', table_name;
    END LOOP;
END $$;

-- Create a function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE user_id = auth.uid() 
        AND is_admin = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- Verify admin status for the specific user
SELECT 
    'Admin verification' as check_type,
    u.email,
    up.name,
    up.role,
    up.is_admin,
    CASE 
        WHEN up.is_admin = true THEN 'FULL ADMIN ACCESS GRANTED'
        ELSE 'NOT AN ADMIN'
    END as access_level
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.user_id
WHERE u.email = 'rayannyrego@gmail.com';