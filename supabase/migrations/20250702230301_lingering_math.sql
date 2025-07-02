/*
  # Fix Budget System with OPME Quotes

  1. Database Changes
    - Update calculate_total_cost function to handle new OPME quote structure
    - Add audit logging functionality
    - Fix trigger dependencies

  2. Security
    - Maintain existing RLS policies
*/

-- Drop trigger first, then function to avoid dependency issues
DROP TRIGGER IF EXISTS trigger_calculate_total_cost ON budgets;
DROP FUNCTION IF EXISTS calculate_total_cost();

-- Create the calculate_total_cost function with better error handling
CREATE OR REPLACE FUNCTION calculate_total_cost()
RETURNS TRIGGER AS $$
DECLARE
  icu_days INTEGER := 0;
  ward_days INTEGER := 0;
  room_days INTEGER := 0;
  opme_sum NUMERIC := 0;
  quote_item JSONB;
BEGIN
  -- Get accommodation days from surgery request
  SELECT
    COALESCE(sr.icu_days, 0),
    COALESCE(sr.ward_days, 0),
    COALESCE(sr.room_days, 0)
  INTO icu_days, ward_days, room_days
  FROM surgery_requests sr
  WHERE sr.id = NEW.surgery_request_id;

  -- Calculate OPME costs with proper error handling
  IF NEW.opme_quotes IS NOT NULL THEN
    -- Check if opme_quotes is an array
    IF jsonb_typeof(NEW.opme_quotes) = 'array' THEN
      -- Handle array format
      FOR quote_item IN SELECT * FROM jsonb_array_elements(NEW.opme_quotes)
      LOOP
        IF quote_item ? 'cost' AND jsonb_typeof(quote_item->'cost') IN ('number', 'string') THEN
          opme_sum := opme_sum + COALESCE((quote_item->>'cost')::NUMERIC, 0);
        END IF;
      END LOOP;
    ELSIF jsonb_typeof(NEW.opme_quotes) = 'object' THEN
      -- Handle object format where each key might contain cost information
      FOR quote_item IN SELECT value FROM jsonb_each(NEW.opme_quotes)
      LOOP
        IF jsonb_typeof(quote_item) = 'object' AND quote_item ? 'cost' THEN
          opme_sum := opme_sum + COALESCE((quote_item->>'cost')::NUMERIC, 0);
        ELSIF jsonb_typeof(quote_item) IN ('number', 'string') THEN
          opme_sum := opme_sum + COALESCE(quote_item::text::NUMERIC, 0);
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- Calculate total cost with 5% markup
  NEW.total_cost := (
    COALESCE(NEW.icu_daily_cost, 0) * icu_days +
    COALESCE(NEW.ward_daily_cost, 0) * ward_days +
    COALESCE(NEW.room_daily_cost, 0) * room_days +
    COALESCE(NEW.anesthetist_fee, 0) +
    COALESCE(NEW.doctor_fee, 0) +
    COALESCE(opme_sum, 0)
  ) * 1.05;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- In case of any error, set total_cost to sum of known costs without OPME
    NEW.total_cost := (
      COALESCE(NEW.icu_daily_cost, 0) * icu_days +
      COALESCE(NEW.ward_daily_cost, 0) * ward_days +
      COALESCE(NEW.room_daily_cost, 0) * room_days +
      COALESCE(NEW.anesthetist_fee, 0) +
      COALESCE(NEW.doctor_fee, 0)
    ) * 1.05;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER trigger_calculate_total_cost
BEFORE INSERT OR UPDATE ON budgets
FOR EACH ROW
EXECUTE FUNCTION calculate_total_cost();

-- Function to create audit log entries
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (budget_id, action, details)
    VALUES (NEW.id, 'CREATED', jsonb_build_object(
      'status', NEW.status,
      'total_cost', NEW.total_cost,
      'hospital_id', NEW.hospital_id
    ));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (budget_id, action, details)
    VALUES (NEW.id, 'UPDATED', jsonb_build_object(
      'old_status', OLD.status,
      'new_status', NEW.status,
      'old_total_cost', OLD.total_cost,
      'new_total_cost', NEW.total_cost,
      'changed_fields', (
        SELECT jsonb_object_agg(key, value)
        FROM jsonb_each(to_jsonb(NEW))
        WHERE to_jsonb(NEW) -> key != to_jsonb(OLD) -> key
      )
    ));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (budget_id, action, details)
    VALUES (OLD.id, 'DELETED', jsonb_build_object(
      'status', OLD.status,
      'total_cost', OLD.total_cost
    ));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create audit trigger
DROP TRIGGER IF EXISTS trigger_audit_budgets ON budgets;
CREATE TRIGGER trigger_audit_budgets
AFTER INSERT OR UPDATE OR DELETE ON budgets
FOR EACH ROW
EXECUTE FUNCTION create_audit_log();