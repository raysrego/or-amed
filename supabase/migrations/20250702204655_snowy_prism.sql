-- Add observations column to budgets table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'observations'
  ) THEN
    ALTER TABLE budgets ADD COLUMN observations text;
  END IF;
END $$;

-- Update the calculate_total_cost function to include 5% service fee
CREATE OR REPLACE FUNCTION calculate_total_cost()
RETURNS TRIGGER AS $$
DECLARE
  icu_days INTEGER := 0;
  ward_days INTEGER := 0;
  room_days INTEGER := 0;
  has_evoked_potential BOOLEAN := false;
  opme_sum NUMERIC := 0;
  quote_item JSONB;
  selected_quote JSONB;
  subtotal NUMERIC := 0;
BEGIN
  -- Get accommodation days and evoked potential info from surgery request
  SELECT
    COALESCE(sr.icu_days, 0),
    COALESCE(sr.ward_days, 0),
    COALESCE(sr.room_days, 0),
    COALESCE(sr.evoked_potential, false)
  INTO icu_days, ward_days, room_days, has_evoked_potential
  FROM surgery_requests sr
  WHERE sr.id = NEW.surgery_request_id;

  -- Calculate OPME costs with proper error handling
  IF NEW.opme_quotes IS NOT NULL THEN
    -- Check if opme_quotes is an array
    IF jsonb_typeof(NEW.opme_quotes) = 'array' THEN
      -- Handle array format - each item should have selected_supplier_id and quotes array
      FOR quote_item IN SELECT * FROM jsonb_array_elements(NEW.opme_quotes)
      LOOP
        IF quote_item ? 'selected_supplier_id' AND quote_item ? 'quotes' THEN
          -- Find the selected quote
          SELECT value INTO selected_quote
          FROM jsonb_array_elements(quote_item->'quotes')
          WHERE value->>'supplier_id' = quote_item->>'selected_supplier_id';
          
          IF selected_quote IS NOT NULL AND selected_quote ? 'price' THEN
            opme_sum := opme_sum + COALESCE((selected_quote->>'price')::NUMERIC, 0);
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- Calculate subtotal (before service fee)
  subtotal := (
    COALESCE(NEW.icu_daily_cost, 0) * icu_days +
    COALESCE(NEW.ward_daily_cost, 0) * ward_days +
    COALESCE(NEW.room_daily_cost, 0) * room_days +
    COALESCE(NEW.anesthetist_fee, 0) +
    COALESCE(NEW.doctor_fee, 0) +
    COALESCE(opme_sum, 0) +
    -- Include evoked potential fee only if the surgery request has evoked potential
    CASE WHEN has_evoked_potential THEN COALESCE(NEW.evoked_potential_fee, 0) ELSE 0 END
  );

  -- Add 5% service fee to get total cost
  NEW.total_cost := subtotal * 1.05;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- In case of any error, set total_cost to sum of known costs without OPME, plus 5% service fee
    subtotal := (
      COALESCE(NEW.icu_daily_cost, 0) * icu_days +
      COALESCE(NEW.ward_daily_cost, 0) * ward_days +
      COALESCE(NEW.room_daily_cost, 0) * room_days +
      COALESCE(NEW.anesthetist_fee, 0) +
      COALESCE(NEW.doctor_fee, 0) +
      CASE WHEN has_evoked_potential THEN COALESCE(NEW.evoked_potential_fee, 0) ELSE 0 END
    );
    
    NEW.total_cost := subtotal * 1.05;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;