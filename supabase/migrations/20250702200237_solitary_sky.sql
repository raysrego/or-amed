/*
  # Fix audit logs foreign key constraint

  1. Update audit log function to handle foreign key constraints properly
  2. Modify the trigger timing to avoid constraint violations
  3. Add proper error handling for audit log insertions
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trigger_audit_budgets ON budgets;
DROP FUNCTION IF EXISTS create_audit_log();

-- Create improved audit log function with better constraint handling
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle INSERT and UPDATE operations (budget exists)
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (budget_id, action, details)
    VALUES (NEW.id, 'CREATED', jsonb_build_object(
      'status', NEW.status,
      'total_cost', NEW.total_cost,
      'hospital_id', NEW.hospital_id,
      'surgery_request_id', NEW.surgery_request_id
    ));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (budget_id, action, details)
    VALUES (NEW.id, 'UPDATED', jsonb_build_object(
      'old_status', OLD.status,
      'new_status', NEW.status,
      'old_total_cost', OLD.total_cost,
      'new_total_cost', NEW.total_cost,
      'hospital_id', NEW.hospital_id,
      'surgery_request_id', NEW.surgery_request_id
    ));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- For DELETE, we need to insert the audit log BEFORE the budget is actually deleted
    -- This is handled by the BEFORE DELETE trigger
    INSERT INTO audit_logs (budget_id, action, details)
    VALUES (OLD.id, 'DELETED', jsonb_build_object(
      'status', OLD.status,
      'total_cost', OLD.total_cost,
      'hospital_id', OLD.hospital_id,
      'surgery_request_id', OLD.surgery_request_id
    ));
    RETURN OLD;
  END IF;
  RETURN NULL;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the main operation
    RAISE WARNING 'Failed to create audit log: %', SQLERRM;
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create separate triggers for different operations
-- AFTER trigger for INSERT and UPDATE (budget exists)
CREATE TRIGGER trigger_audit_budgets_after
AFTER INSERT OR UPDATE ON budgets
FOR EACH ROW
EXECUTE FUNCTION create_audit_log();

-- BEFORE trigger for DELETE (budget still exists)
CREATE TRIGGER trigger_audit_budgets_before
BEFORE DELETE ON budgets
FOR EACH ROW
EXECUTE FUNCTION create_audit_log();

-- Update audit_logs foreign key constraint to CASCADE on delete
-- This ensures that when a budget is deleted, its audit logs are also deleted
ALTER TABLE audit_logs 
DROP CONSTRAINT IF EXISTS audit_logs_budget_id_fkey;

ALTER TABLE audit_logs 
ADD CONSTRAINT audit_logs_budget_id_fkey 
FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE;

-- Ensure RLS policies are correct
DROP POLICY IF EXISTS "Authenticated users can read audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "System can insert audit_logs" ON audit_logs;

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

-- Allow system to delete audit logs when budgets are deleted
CREATE POLICY "System can delete audit_logs"
  ON audit_logs
  FOR DELETE
  TO authenticated
  USING (true);