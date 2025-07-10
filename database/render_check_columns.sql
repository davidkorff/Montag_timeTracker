-- Check what columns actually exist in Render

-- 1. Check time_entries columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'time_entries' 
AND column_name LIKE 'timer%'
ORDER BY column_name;

-- 2. Check user_types columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_types'
ORDER BY column_name;

-- 3. Check users columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users'
ORDER BY column_name;

-- 4. Show current user
SELECT id, email, user_type_id, is_active 
FROM users 
WHERE email = 'david@42consultingllc.com';