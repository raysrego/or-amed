/*
  # Fix audit_logs RLS policy

  1. Security Changes
    - Update RLS policy for audit_logs table to allow INSERT operations
    - Ensure triggers can write audit logs properly
*/

-- Update the audit_logs RLS policy to allow INSERT operations
DROP POLICY IF EXISTS "Authenticated users can read audit_logs" ON audit_logs;

-- Create comprehensive RLS policies for audit_logs
CREATE POLICY "Authenticated users can read audit_logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert audit_logs"
  ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Ensure the audit_logs table has RLS enabled
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;