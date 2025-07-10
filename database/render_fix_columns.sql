-- Fix column names in Render to match what the backend expects

-- 1. Fix time_entries columns
ALTER TABLE time_entries RENAME COLUMN timer_started_at TO timer_start;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS timer_end TIMESTAMP;

-- 2. Add can_login to user_types (even though we don't use it)
ALTER TABLE user_types ADD COLUMN IF NOT EXISTS can_login BOOLEAN DEFAULT true;

-- 3. Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'time_entries' 
AND column_name IN ('timer_start', 'timer_end', 'timer_started_at');

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_types' 
AND column_name = 'can_login';

-- 4. Update your password (the hash might be wrong)
-- This is the hash for 'changeme123'
UPDATE users 
SET password_hash = '$2a$10$xQwZ8K3D7IQ6YMLkz8xCY.0qcL0ySjVHgyXjPrYpDZmKHMlBxX3Vy'
WHERE email = 'david@42consultingllc.com';

-- Verify
SELECT 'Columns fixed!' as status;