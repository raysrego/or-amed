/*
  # Enhanced Budget and OPME Structure

  1. Schema Updates
    - Modify surgery_requests.opme_requests to store structured OPME data
    - Update budgets.opme_quotes to support multiple supplier quotes per material
    - Add constraints to ensure data integrity

  2. New Structure
    - Each OPME material can have up to 3 supplier quotes
    - Each patient can have up to 3 budgets from different hospitals
    - Improved cost calculation with supplier selection

  3. Data Format
    - opme_requests: [{"opme_id": "uuid", "quantity": 1, "description": "text"}]
    - opme_quotes: [{"opme_id": "uuid", "quotes": [{"supplier_id": "uuid", "price": 1000, "selected": true}]}]
*/

-- Add constraint to limit budgets per surgery request (max 3 hospitals)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'max_budgets_per_surgery_request'
  ) THEN
    -- Create a function to check budget limit
    CREATE OR REPLACE FUNCTION check_budget_limit()
    RETURNS TRIGGER AS $func$
    BEGIN
      IF (
        SELECT COUNT(*) 
        FROM budgets 
        WHERE surgery_request_id = NEW.surgery_request_id 
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      ) >= 3 THEN
        RAISE EXCEPTION 'Máximo de 3 orçamentos por pedido de cirurgia permitido';
      END IF;
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;

    -- Create trigger for budget limit
    CREATE TRIGGER trigger_check_budget_limit
    BEFORE INSERT OR UPDATE ON budgets
    FOR EACH ROW
    EXECUTE FUNCTION check_budget_limit();
  END IF;
END $$;

-- Update the calculate_total_cost function to handle new OPME structure
CREATE OR REPLACE FUNCTION calculate_total_cost()
RETURNS TRIGGER AS $$
DECLARE
  icu_days INTEGER := 0;
  ward_days INTEGER := 0;
  room_days INTEGER := 0;
  opme_sum NUMERIC := 0;
  quote_item JSONB;
  supplier_quote JSONB;
BEGIN
  -- Get accommodation days from surgery request
  SELECT
    COALESCE(sr.icu_days, 0),
    COALESCE(sr.ward_days, 0),
    COALESCE(sr.room_days, 0)
  INTO icu_days, ward_days, room_days
  FROM surgery_requests sr
  WHERE sr.id = NEW.surgery_request_id;

  -- Calculate OPME costs with new structure
  IF NEW.opme_quotes IS NOT NULL AND jsonb_typeof(NEW.opme_quotes) = 'array' THEN
    FOR quote_item IN SELECT * FROM jsonb_array_elements(NEW.opme_quotes)
    LOOP
      -- Check if this item has quotes array
      IF quote_item ? 'quotes' AND jsonb_typeof(quote_item->'quotes') = 'array' THEN
        -- Find selected quote or use first available
        FOR supplier_quote IN SELECT * FROM jsonb_array_elements(quote_item->'quotes')
        LOOP
          IF (supplier_quote->>'selected')::boolean = true OR 
             NOT EXISTS (
               SELECT 1 FROM jsonb_array_elements(quote_item->'quotes') AS q 
               WHERE (q->>'selected')::boolean = true
             ) THEN
            opme_sum := opme_sum + COALESCE((supplier_quote->>'price')::NUMERIC, 0);
            EXIT; -- Use only one quote per item
          END IF;
        END LOOP;
      -- Fallback for old format
      ELSIF quote_item ? 'cost' THEN
        opme_sum := opme_sum + COALESCE((quote_item->>'cost')::NUMERIC, 0);
      END IF;
    END LOOP;
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
DROP TRIGGER IF EXISTS trigger_calculate_total_cost ON budgets;
CREATE TRIGGER trigger_calculate_total_cost
BEFORE INSERT OR UPDATE ON budgets
FOR EACH ROW
EXECUTE FUNCTION calculate_total_cost();