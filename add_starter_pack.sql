-- Run this in your Supabase SQL Editor to support the new multi-tier pricing and starter pack

-- 1. Add the starter pack boolean column to track if a user bought the Tripwire offer
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS has_starter_pack BOOLEAN DEFAULT false;

-- Note: The "tier" column already exists taking 'normal', 'premium', etc. 
-- In the new app logic, we will upgrade it to 'pro' or 'founder' upon successful payment.
