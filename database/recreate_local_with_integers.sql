-- Drop and recreate local database to match Render's schema
-- WARNING: This will DELETE all data in your local database!

-- Drop all tables
DROP TABLE IF EXISTS time_entries CASCADE;
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS pinned_projects CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS subcontractors CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS user_types CASCADE;
DROP TABLE IF EXISTS migrations CASCADE;

-- Now run the render_safe_complete_migration.sql file to recreate everything with INTEGER keys