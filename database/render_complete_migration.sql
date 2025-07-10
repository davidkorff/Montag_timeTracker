-- Complete Safe Migration for 42 Consulting Time Tracker on Render
-- This file combines all migrations into a single, safe execution
-- Run this in your Render database console

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create user_types table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT
);

-- Insert default user types (safe with ON CONFLICT)
INSERT INTO user_types (id, name, description) VALUES 
    (1, 'Admin', 'Full system access'),
    (2, 'User', 'Regular user access'),
    (3, 'Subcontractor', 'External contractor')
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- 2. Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    user_type_id INTEGER REFERENCES user_types(id) DEFAULT 2,
    hourly_rate DECIMAL(10, 2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add user_type_id column if it doesn't exist (for migration from old schema)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='user_type_id') THEN
        ALTER TABLE users ADD COLUMN user_type_id INTEGER REFERENCES user_types(id) DEFAULT 2;
        -- Migrate existing roles to user_type_id
        UPDATE users SET user_type_id = 
            CASE 
                WHEN role = 'admin' THEN 1
                WHEN role = 'consultant' THEN 2
                WHEN role = 'subcontractor' THEN 3
                ELSE 2
            END
        WHERE user_type_id IS NULL;
    END IF;
END $$;

-- 3. Create clients table
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE,
    contact_email VARCHAR(100),
    contact_phone VARCHAR(20),
    address TEXT,
    billing_rate DECIMAL(10, 2),
    invoice_email VARCHAR(255),
    invoice_cc_email VARCHAR(255),
    invoice_recipient_name VARCHAR(255),
    billed_to TEXT,
    company_name VARCHAR(255),
    company_address TEXT,
    payment_terms VARCHAR(100) DEFAULT 'Net 30',
    invoice_notes TEXT,
    default_rate DECIMAL(10, 2) DEFAULT 175,
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add invoice configuration columns if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='invoice_email') THEN
        ALTER TABLE clients ADD COLUMN invoice_email VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='invoice_cc_email') THEN
        ALTER TABLE clients ADD COLUMN invoice_cc_email VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='invoice_recipient_name') THEN
        ALTER TABLE clients ADD COLUMN invoice_recipient_name VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='billed_to') THEN
        ALTER TABLE clients ADD COLUMN billed_to TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='company_name') THEN
        ALTER TABLE clients ADD COLUMN company_name VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='company_address') THEN
        ALTER TABLE clients ADD COLUMN company_address TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='payment_terms') THEN
        ALTER TABLE clients ADD COLUMN payment_terms VARCHAR(100) DEFAULT 'Net 30';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='invoice_notes') THEN
        ALTER TABLE clients ADD COLUMN invoice_notes TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='default_rate') THEN
        ALTER TABLE clients ADD COLUMN default_rate DECIMAL(10, 2) DEFAULT 175;
    END IF;
END $$;

-- 4. Create projects table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    client_id INTEGER REFERENCES clients(id),
    description TEXT,
    status VARCHAR(20) DEFAULT 'active',
    budget DECIMAL(12, 2),
    hourly_rate DECIMAL(10, 2),
    start_date DATE,
    end_date DATE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(20) UNIQUE NOT NULL,
    client_id INTEGER REFERENCES clients(id),
    invoice_date DATE NOT NULL,
    due_date DATE,
    subtotal DECIMAL(12, 2) NOT NULL,
    tax_rate DECIMAL(5, 2) DEFAULT 0,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    payment_status VARCHAR(20) DEFAULT 'unpaid',
    payment_date DATE,
    payment_terms VARCHAR(100),
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add payment_date column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='payment_date') THEN
        ALTER TABLE invoices ADD COLUMN payment_date DATE;
        -- Update existing paid invoices
        UPDATE invoices SET payment_date = invoice_date WHERE payment_status = 'paid' AND payment_date IS NULL;
    END IF;
END $$;

-- 6. Create time_entries table
CREATE TABLE IF NOT EXISTS time_entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    project_id INTEGER REFERENCES projects(id),
    date DATE NOT NULL,
    hours DECIMAL(5, 2) NOT NULL CHECK (hours >= 0),
    rate DECIMAL(10, 2),
    amount DECIMAL(12, 2),
    description TEXT,
    task_type VARCHAR(50),
    is_billable BOOLEAN DEFAULT true,
    status VARCHAR(20) DEFAULT 'draft',
    invoice_id INTEGER REFERENCES invoices(id),
    invoice_number VARCHAR(20),
    notes TEXT,
    is_deleted BOOLEAN DEFAULT false,
    timer_started_at TIMESTAMP,
    timer_elapsed_seconds INTEGER DEFAULT 0,
    timer_is_paused BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add timer and soft delete columns if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='time_entries' AND column_name='timer_elapsed_seconds') THEN
        ALTER TABLE time_entries ADD COLUMN timer_elapsed_seconds INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='time_entries' AND column_name='timer_is_paused') THEN
        ALTER TABLE time_entries ADD COLUMN timer_is_paused BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='time_entries' AND column_name='is_deleted') THEN
        ALTER TABLE time_entries ADD COLUMN is_deleted BOOLEAN DEFAULT false;
        -- Migrate any 'deleted' status to is_deleted
        UPDATE time_entries SET is_deleted = true, status = 'draft' WHERE status = 'deleted';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='time_entries' AND column_name='invoice_id') THEN
        ALTER TABLE time_entries ADD COLUMN invoice_id INTEGER REFERENCES invoices(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='time_entries' AND column_name='invoice_number') THEN
        ALTER TABLE time_entries ADD COLUMN invoice_number VARCHAR(20);
    END IF;
END $$;

-- Fix hours constraint to allow 0 hours
DO $$
BEGIN
    ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS time_entries_hours_check;
    ALTER TABLE time_entries ADD CONSTRAINT time_entries_hours_check CHECK (hours >= 0);
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- 7. Create invoice_items table
CREATE TABLE IF NOT EXISTS invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    rate DECIMAL(10, 2) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    time_entry_ids INTEGER[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Create subcontractors table
CREATE TABLE IF NOT EXISTS subcontractors (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) UNIQUE,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    hourly_rate DECIMAL(10, 2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add subcontractor_id to time_entries if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='time_entries' AND column_name='subcontractor_id') THEN
        ALTER TABLE time_entries ADD COLUMN subcontractor_id INTEGER REFERENCES subcontractors(id);
    END IF;
END $$;

-- 9. Create pinned_projects table
CREATE TABLE IF NOT EXISTS pinned_projects (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, project_id)
);

-- 10. Create activity_logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    details JSONB,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Create refresh_tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. Create all necessary indexes
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_project_id ON time_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(date);
CREATE INDEX IF NOT EXISTS idx_time_entries_invoice_id ON time_entries(invoice_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_is_deleted ON time_entries(is_deleted);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_clients_invoice_email ON clients(invoice_email);

-- 13. Create update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 14. Add update triggers to all tables with updated_at
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'updated_at' 
        AND table_schema = 'public'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON %s', t, t);
        EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %s 
                        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t);
    END LOOP;
END $$;

-- 15. Grant necessary permissions (if needed)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO consulting_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO consulting_user;

-- Final message
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully!';
END $$;