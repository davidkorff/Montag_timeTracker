-- Fix Migration for Render Database
-- This handles the existing user_types table without description column

-- 1. Add description column to user_types if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='user_types' AND column_name='description') THEN
        ALTER TABLE user_types ADD COLUMN description TEXT;
    END IF;
END $$;

-- 2. Now insert/update user types safely
INSERT INTO user_types (id, name, description) VALUES 
    (1, 'Admin', 'Full system access'),
    (2, 'User', 'Regular user access'),
    (3, 'Subcontractor', 'External contractor')
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- 3. Ensure users table has all required columns
DO $$ 
BEGIN
    -- Add username if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='username') THEN
        ALTER TABLE users ADD COLUMN username VARCHAR(50);
        -- Generate usernames from email for existing users
        UPDATE users SET username = SPLIT_PART(email, '@', 1) WHERE username IS NULL;
        -- Now make it NOT NULL and UNIQUE
        ALTER TABLE users ALTER COLUMN username SET NOT NULL;
        ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
    END IF;

    -- Add user_type_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='user_type_id') THEN
        ALTER TABLE users ADD COLUMN user_type_id INTEGER REFERENCES user_types(id) DEFAULT 2;
    END IF;
END $$;

-- 4. Fix any other missing columns in critical tables
DO $$ 
BEGIN
    -- Add payment_date to invoices if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='invoices' AND column_name='payment_date') THEN
        ALTER TABLE invoices ADD COLUMN payment_date DATE;
        UPDATE invoices SET payment_date = invoice_date WHERE payment_status = 'paid' AND payment_date IS NULL;
    END IF;

    -- Add timer columns to time_entries if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='time_entries' AND column_name='timer_elapsed_seconds') THEN
        ALTER TABLE time_entries ADD COLUMN timer_elapsed_seconds INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='time_entries' AND column_name='timer_is_paused') THEN
        ALTER TABLE time_entries ADD COLUMN timer_is_paused BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='time_entries' AND column_name='is_deleted') THEN
        ALTER TABLE time_entries ADD COLUMN is_deleted BOOLEAN DEFAULT false;
    END IF;

    -- Add invoice columns to time_entries if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='time_entries' AND column_name='invoice_id') THEN
        ALTER TABLE time_entries ADD COLUMN invoice_id INTEGER REFERENCES invoices(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='time_entries' AND column_name='invoice_number') THEN
        ALTER TABLE time_entries ADD COLUMN invoice_number VARCHAR(20);
    END IF;
END $$;

-- 5. Add all client invoice configuration columns if missing
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

-- 6. Create missing tables
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

CREATE TABLE IF NOT EXISTS pinned_projects (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, project_id)
);

-- 7. Fix time_entries hours constraint
DO $$
BEGIN
    ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS time_entries_hours_check;
    ALTER TABLE time_entries ADD CONSTRAINT time_entries_hours_check CHECK (hours >= 0);
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- 8. Create all indexes
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

-- 9. Create or replace the update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 10. Add update triggers
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT DISTINCT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'updated_at' 
        AND table_schema = 'public'
        AND table_name IN ('users', 'clients', 'projects', 'invoices', 'time_entries', 'subcontractors')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON %s', t, t);
        EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %s 
                        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t);
    END LOOP;
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Fix migration completed successfully!';
END $$;