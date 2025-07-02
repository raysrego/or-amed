/*
  # Add evoked potential field to surgery requests

  1. New Columns
    - `evoked_potential` (boolean) - Whether evoked potential monitoring is needed

  2. Changes
    - Add evoked_potential column to surgery_requests table with default false
*/

-- Add evoked potential field to surgery_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'surgery_requests' AND column_name = 'evoked_potential'
  ) THEN
    ALTER TABLE surgery_requests ADD COLUMN evoked_potential boolean DEFAULT false;
  END IF;
END $$;