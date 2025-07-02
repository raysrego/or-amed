/*
  # Make OPME brand field nullable

  1. Changes
    - Remove NOT NULL constraint from brand column in opmes table
    - Allow brand to be optional when creating OPME materials

  2. Security
    - No changes to RLS policies needed
*/

-- Make brand column nullable in opmes table
ALTER TABLE opmes ALTER COLUMN brand DROP NOT NULL;