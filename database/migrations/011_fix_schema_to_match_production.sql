-- Fix schema to match production database exactly

-- First, drop any columns that shouldn't exist
ALTER TABLE users DROP COLUMN IF EXISTS username CASCADE;
ALTER TABLE users DROP COLUMN IF EXISTS role CASCADE;

-- Ensure UUID extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create sequences if they don't exist
CREATE SEQUENCE IF NOT EXISTS migrations_id_seq;
CREATE SEQUENCE IF NOT EXISTS user_types_id_seq;

-- Drop tables that need to be recreated with correct schema
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS pinned_projects CASCADE;
DROP TABLE IF EXISTS user_types CASCADE;

-- Create user_types table
CREATE TABLE IF NOT EXISTS user_types (
    name varchar(50) NOT NULL,
    id integer NOT NULL DEFAULT nextval('user_types_id_seq'::regclass),
    can_login boolean DEFAULT true,
    description text,
    PRIMARY KEY (id)
);

-- Insert default user types if they don't exist
INSERT INTO user_types (id, name, description, can_login) VALUES 
(1, 'Admin', 'Administrator with full access', true),
(2, 'Consultant', 'Regular consultant user', true),
(3, 'Client', 'Client user with limited access', false),
(4, 'Manager', 'Manager with team oversight', true)
ON CONFLICT (id) DO NOTHING;

-- Ensure users table has correct columns
ALTER TABLE users DROP COLUMN IF EXISTS role;
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_type_id integer DEFAULT 2;
ALTER TABLE users ADD COLUMN IF NOT EXISTS hourly_rate numeric(10,2);

-- Add foreign key for user_type_id if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'users_user_type_id_fkey') THEN
        ALTER TABLE users ADD CONSTRAINT users_user_type_id_fkey 
        FOREIGN KEY (user_type_id) REFERENCES user_types(id);
    END IF;
END $$;

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    preference_value text,
    preference_key varchar(100) NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create pinned_projects table
CREATE TABLE IF NOT EXISTS pinned_projects (
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL,
    project_id uuid NOT NULL,
    position integer DEFAULT 0,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Ensure time_entries has all required columns
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS timer_start timestamp without time zone;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS timer_end timestamp without time zone;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS timer_is_paused boolean DEFAULT false;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS timer_elapsed_seconds integer DEFAULT 0;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS entered_by_user_id uuid;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS subcontractor_id uuid;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;

-- Ensure other tables exist with correct schema
CREATE TABLE IF NOT EXISTS activity_logs (
    ip_address inet,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    entity_id uuid,
    entity_type varchar(50),
    action varchar(50) NOT NULL,
    user_id uuid,
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    details jsonb,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    expires_at timestamp without time zone NOT NULL,
    user_id uuid,
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    token varchar(255) NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_sessions (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone NOT NULL,
    token varchar(255) NOT NULL,
    user_id uuid,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS time_entry_templates (
    user_id uuid,
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    name varchar(100) NOT NULL,
    description text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_billable boolean DEFAULT true,
    hours numeric(5,2),
    project_id uuid,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_project_id ON time_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(date);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_pinned_projects_user_id ON pinned_projects(user_id);