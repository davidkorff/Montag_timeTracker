-- Fix for refresh_tokens table type mismatch
-- This handles the case where users.id is UUID but refresh_tokens.user_id is INTEGER

-- First, check current state
SELECT 
    c.column_name,
    c.data_type,
    c.udt_name
FROM information_schema.columns c
WHERE c.table_name IN ('users', 'refresh_tokens')
AND c.column_name IN ('id', 'user_id')
ORDER BY c.table_name, c.column_name;

-- Drop the problematic constraint if it exists
ALTER TABLE refresh_tokens DROP CONSTRAINT IF EXISTS refresh_tokens_user_id_fkey;

-- Add a temporary UUID column
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS user_id_uuid UUID;

-- If users table has UUID ids, update the UUID column based on integer mapping
-- This assumes there's still an old_id or some way to map
-- If not, you may need to truncate refresh_tokens table

-- Option 1: If you have old_id column in users table
-- UPDATE refresh_tokens rt 
-- SET user_id_uuid = u.id 
-- FROM users u 
-- WHERE rt.user_id = u.old_id;

-- Option 2: If refresh_tokens is empty or can be cleared (recommended)
TRUNCATE TABLE refresh_tokens;

-- Drop the old integer column
ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS user_id;

-- Rename the UUID column to user_id
ALTER TABLE refresh_tokens RENAME COLUMN user_id_uuid TO user_id;

-- Re-add the foreign key constraint
ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;