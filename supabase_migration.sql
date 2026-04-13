-- Run this SQL in your Supabase SQL Editor

-- 1. Add simulations_run column to profiles (lifetime counter)
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS simulations_run integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_sim_date date;

-- 2. Create an atomic increment RPC so concurrent requests don't race
CREATE OR REPLACE FUNCTION increment_sim_count(p_user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET 
    simulations_run = simulations_run + 1,
    last_sim_date = CURRENT_DATE
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION increment_sim_count(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION increment_sim_count(uuid) TO authenticated;

-- 4. Backfill existing users' simulations_run from the simulations tables
UPDATE profiles p
SET simulations_run = (
  SELECT COUNT(*) FROM simulations s WHERE s.user_id::text = p.id::text
) + (
  SELECT COUNT(*) FROM custom_simulations cs WHERE cs.user_id::text = p.id::text
);
