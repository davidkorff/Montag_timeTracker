-- Remove username requirement from users table
ALTER TABLE users ALTER COLUMN username DROP NOT NULL;

-- Optionally, you can drop the username column entirely if you don't need it
-- ALTER TABLE users DROP COLUMN username;