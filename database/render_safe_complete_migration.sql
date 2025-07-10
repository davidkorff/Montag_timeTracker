-- Ultra-Safe Complete Migration for Render
-- Every operation checks if it needs to be done first

-- Enable extensions safely
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create or update user_types table
CREATE TABLE IF NOT EXISTS user_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

-- Add description column if it doesn't exist
ALTER TABLE user_types ADD COLUMN IF NOT EXISTS description TEXT;

-- Insert user types with safe upsert
INSERT INTO user_types (id, name, description) VALUES 
    (1, 'Admin', 'Full system access'),
    (2, 'User', 'Regular user access'),
    (3, 'Subcontractor', 'External contractor')
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    description = COALESCE(EXCLUDED.description, user_types.description);

-- 2. Create users table if not exists
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    hourly_rate DECIMAL(10, 2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add columns to users if they don't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_type_id INTEGER REFERENCES user_types(id) DEFAULT 2;
ALTER TABLE users ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10, 2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Fix username to be NOT NULL and UNIQUE (if not already)
DO $$ 
BEGIN
    -- First populate any NULL usernames
    UPDATE users SET username = LOWER(SPLIT_PART(email, '@', 1)) WHERE username IS NULL;
    
    -- Make username NOT NULL if it isn't already
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'username' 
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE users ALTER COLUMN username SET NOT NULL;
    END IF;
    
    -- Add unique constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'users' 
        AND constraint_type = 'UNIQUE' 
        AND constraint_name = 'users_username_key'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Username constraint already exists or cannot be applied: %', SQLERRM;
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
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add all invoice-related columns to clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS invoice_email VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS invoice_cc_email VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS invoice_recipient_name VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS billed_to TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_address TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(100) DEFAULT 'Net 30';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS invoice_notes TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS default_rate DECIMAL(10, 2) DEFAULT 175;

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
    payment_terms VARCHAR(100),
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add payment_date column
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_date DATE;

-- 6. Create time_entries table
CREATE TABLE IF NOT EXISTS time_entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    project_id INTEGER REFERENCES projects(id),
    date DATE NOT NULL,
    hours DECIMAL(5, 2) NOT NULL,
    rate DECIMAL(10, 2),
    amount DECIMAL(12, 2),
    description TEXT,
    task_type VARCHAR(50),
    is_billable BOOLEAN DEFAULT true,
    status VARCHAR(20) DEFAULT 'draft',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add all additional columns to time_entries
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS invoice_id INTEGER REFERENCES invoices(id);
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(20);
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS timer_started_at TIMESTAMP;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS timer_elapsed_seconds INTEGER DEFAULT 0;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS timer_is_paused BOOLEAN DEFAULT false;

-- Fix hours constraint safely
DO $$
BEGIN
    -- Drop old constraint if exists
    ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS time_entries_hours_check;
    -- Add new constraint
    ALTER TABLE time_entries ADD CONSTRAINT time_entries_hours_check CHECK (hours >= 0);
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Hours constraint already correct or cannot be modified: %', SQLERRM;
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

-- Add subcontractor_id to time_entries
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS subcontractor_id INTEGER REFERENCES subcontractors(id);

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

-- 12. Create all indexes (IF NOT EXISTS)
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

-- 13. Create update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 14. Add update triggers (safely)
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY['users', 'clients', 'projects', 'invoices', 'time_entries', 'subcontractors'];
BEGIN
    FOREACH tbl IN ARRAY tables
    LOOP
        -- Check if table has updated_at column
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = tbl 
            AND column_name = 'updated_at'
        ) THEN
            -- Drop trigger if exists
            EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON %s', tbl, tbl);
            -- Create trigger
            EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %s 
                            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', tbl, tbl);
        END IF;
    END LOOP;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error creating triggers: %', SQLERRM;
END $$;

-- 15. Update any NULL user_type_ids to default (User)
UPDATE users SET user_type_id = 2 WHERE user_type_id IS NULL;

-- 16. Backfill payment_date for paid invoices
UPDATE invoices 
SET payment_date = invoice_date 
WHERE payment_status = 'paid' AND payment_date IS NULL;

-- Final status check
DO $$
DECLARE
    missing_count INTEGER;
BEGIN
    -- Check for users without usernames
    SELECT COUNT(*) INTO missing_count FROM users WHERE username IS NULL;
    IF missing_count > 0 THEN
        RAISE NOTICE 'WARNING: % users still have NULL usernames', missing_count;
    END IF;
    
    -- Check for users without user_type_id
    SELECT COUNT(*) INTO missing_count FROM users WHERE user_type_id IS NULL;
    IF missing_count > 0 THEN
        RAISE NOTICE 'WARNING: % users still have NULL user_type_id', missing_count;
    END IF;
    
    RAISE NOTICE 'Migration completed! All tables and columns should now be in place.';
END $$;