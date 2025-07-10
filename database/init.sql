-- Create database if not exists (run this separately as superuser)
-- CREATE DATABASE consulting_time_tracker;

-- Connect to the database before running the rest
\c consulting_time_tracker;

-- Run the schema (this assumes you're in the database directory)
\i database/schema.sql

-- Create initial admin user with password 'admin123'
-- This hash is for 'admin123' - CHANGE THIS IMMEDIATELY
UPDATE users 
SET password_hash = '$2a$10$YjXoWmRQrPNM8Hs7kH5YCuHbYJtGYJ8SQGjqWKwJgR.wFKG0pjBxO' 
WHERE email = 'admin@42consulting.com';