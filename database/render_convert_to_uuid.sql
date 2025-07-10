-- Convert Render database from INTEGER to UUID primary keys
-- This is a major migration - backup your data first!

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 1: Add UUID columns to all tables
ALTER TABLE user_types ADD COLUMN IF NOT EXISTS uuid_id UUID DEFAULT uuid_generate_v4();
ALTER TABLE users ADD COLUMN IF NOT EXISTS uuid_id UUID DEFAULT uuid_generate_v4();
ALTER TABLE clients ADD COLUMN IF NOT EXISTS uuid_id UUID DEFAULT uuid_generate_v4();
ALTER TABLE projects ADD COLUMN IF NOT EXISTS uuid_id UUID DEFAULT uuid_generate_v4();
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS uuid_id UUID DEFAULT uuid_generate_v4();
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS uuid_id UUID DEFAULT uuid_generate_v4();
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS uuid_id UUID DEFAULT uuid_generate_v4();
ALTER TABLE subcontractors ADD COLUMN IF NOT EXISTS uuid_id UUID DEFAULT uuid_generate_v4();
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS uuid_id UUID DEFAULT uuid_generate_v4();
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS uuid_id UUID DEFAULT uuid_generate_v4();

-- Step 2: Add UUID foreign key columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_type_uuid UUID;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS created_by_uuid UUID;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_uuid UUID;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_by_uuid UUID;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS user_uuid UUID;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS project_uuid UUID;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS invoice_uuid UUID;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS subcontractor_uuid UUID;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_uuid UUID;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by_uuid UUID;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS invoice_uuid UUID;
ALTER TABLE subcontractors ADD COLUMN IF NOT EXISTS user_uuid UUID;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS user_uuid UUID;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS user_uuid UUID;

-- Step 3: Populate UUID foreign keys based on existing relationships
UPDATE users u SET user_type_uuid = ut.uuid_id FROM user_types ut WHERE u.user_type_id = ut.id;
UPDATE clients c SET created_by_uuid = u.uuid_id FROM users u WHERE c.created_by = u.id;
UPDATE projects p SET client_uuid = c.uuid_id FROM clients c WHERE p.client_id = c.id;
UPDATE projects p SET created_by_uuid = u.uuid_id FROM users u WHERE p.created_by = u.id;
UPDATE time_entries te SET user_uuid = u.uuid_id FROM users u WHERE te.user_id = u.id;
UPDATE time_entries te SET project_uuid = p.uuid_id FROM projects p WHERE te.project_id = p.id;
UPDATE time_entries te SET invoice_uuid = i.uuid_id FROM invoices i WHERE te.invoice_id = i.id;
UPDATE time_entries te SET subcontractor_uuid = s.uuid_id FROM subcontractors s WHERE te.subcontractor_id = s.id;
UPDATE invoices i SET client_uuid = c.uuid_id FROM clients c WHERE i.client_id = c.id;
UPDATE invoices i SET created_by_uuid = u.uuid_id FROM users u WHERE i.created_by = u.id;
UPDATE invoice_items ii SET invoice_uuid = i.uuid_id FROM invoices i WHERE ii.invoice_id = i.id;
UPDATE subcontractors s SET user_uuid = u.uuid_id FROM users u WHERE s.user_id = u.id;
UPDATE activity_logs al SET user_uuid = u.uuid_id FROM users u WHERE al.user_id = u.id;
UPDATE refresh_tokens rt SET user_uuid = u.uuid_id FROM users u WHERE rt.user_id = u.id;

-- Step 4: Drop old foreign key constraints
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_user_type_id_fkey;
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_created_by_fkey;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_client_id_fkey;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_created_by_fkey;
ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS time_entries_user_id_fkey;
ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS time_entries_project_id_fkey;
ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS time_entries_invoice_id_fkey;
ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS time_entries_subcontractor_id_fkey;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_client_id_fkey;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_created_by_fkey;
ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS invoice_items_invoice_id_fkey;
ALTER TABLE subcontractors DROP CONSTRAINT IF EXISTS subcontractors_user_id_fkey;
ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_user_id_fkey;
ALTER TABLE refresh_tokens DROP CONSTRAINT IF EXISTS refresh_tokens_user_id_fkey;

-- Step 5: Rename columns
-- Rename old ID columns to keep as backup
ALTER TABLE user_types RENAME COLUMN id TO old_id;
ALTER TABLE users RENAME COLUMN id TO old_id;
ALTER TABLE clients RENAME COLUMN id TO old_id;
ALTER TABLE projects RENAME COLUMN id TO old_id;
ALTER TABLE time_entries RENAME COLUMN id TO old_id;
ALTER TABLE invoices RENAME COLUMN id TO old_id;
ALTER TABLE invoice_items RENAME COLUMN id TO old_id;
ALTER TABLE subcontractors RENAME COLUMN id TO old_id;
ALTER TABLE activity_logs RENAME COLUMN id TO old_id;
ALTER TABLE refresh_tokens RENAME COLUMN id TO old_id;

-- Rename UUID columns to id
ALTER TABLE user_types RENAME COLUMN uuid_id TO id;
ALTER TABLE users RENAME COLUMN uuid_id TO id;
ALTER TABLE clients RENAME COLUMN uuid_id TO id;
ALTER TABLE projects RENAME COLUMN uuid_id TO id;
ALTER TABLE time_entries RENAME COLUMN uuid_id TO id;
ALTER TABLE invoices RENAME COLUMN uuid_id TO id;
ALTER TABLE invoice_items RENAME COLUMN uuid_id TO id;
ALTER TABLE subcontractors RENAME COLUMN uuid_id TO id;
ALTER TABLE activity_logs RENAME COLUMN uuid_id TO id;
ALTER TABLE refresh_tokens RENAME COLUMN uuid_id TO id;

-- Rename foreign key columns
ALTER TABLE users RENAME COLUMN user_type_uuid TO user_type_id;
ALTER TABLE clients RENAME COLUMN created_by_uuid TO created_by;
ALTER TABLE projects RENAME COLUMN client_uuid TO client_id;
ALTER TABLE projects RENAME COLUMN created_by_uuid TO created_by;
ALTER TABLE time_entries RENAME COLUMN user_uuid TO user_id;
ALTER TABLE time_entries RENAME COLUMN project_uuid TO project_id;
ALTER TABLE time_entries RENAME COLUMN invoice_uuid TO invoice_id;
ALTER TABLE time_entries RENAME COLUMN subcontractor_uuid TO subcontractor_id;
ALTER TABLE invoices RENAME COLUMN client_uuid TO client_id;
ALTER TABLE invoices RENAME COLUMN created_by_uuid TO created_by;
ALTER TABLE invoice_items RENAME COLUMN invoice_uuid TO invoice_id;
ALTER TABLE subcontractors RENAME COLUMN user_uuid TO user_id;
ALTER TABLE activity_logs RENAME COLUMN user_uuid TO user_id;
ALTER TABLE refresh_tokens RENAME COLUMN user_uuid TO user_id;

-- Step 6: Add primary key constraints
ALTER TABLE user_types ADD PRIMARY KEY (id);
ALTER TABLE users ADD PRIMARY KEY (id);
ALTER TABLE clients ADD PRIMARY KEY (id);
ALTER TABLE projects ADD PRIMARY KEY (id);
ALTER TABLE time_entries ADD PRIMARY KEY (id);
ALTER TABLE invoices ADD PRIMARY KEY (id);
ALTER TABLE invoice_items ADD PRIMARY KEY (id);
ALTER TABLE subcontractors ADD PRIMARY KEY (id);
ALTER TABLE activity_logs ADD PRIMARY KEY (id);
ALTER TABLE refresh_tokens ADD PRIMARY KEY (id);

-- Step 7: Add foreign key constraints back
ALTER TABLE users ADD CONSTRAINT users_user_type_id_fkey FOREIGN KEY (user_type_id) REFERENCES user_types(id);
ALTER TABLE clients ADD CONSTRAINT clients_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE projects ADD CONSTRAINT projects_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id);
ALTER TABLE projects ADD CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE time_entries ADD CONSTRAINT time_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE time_entries ADD CONSTRAINT time_entries_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id);
ALTER TABLE time_entries ADD CONSTRAINT time_entries_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id);
ALTER TABLE time_entries ADD CONSTRAINT time_entries_subcontractor_id_fkey FOREIGN KEY (subcontractor_id) REFERENCES subcontractors(id);
ALTER TABLE invoices ADD CONSTRAINT invoices_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id);
ALTER TABLE invoices ADD CONSTRAINT invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
ALTER TABLE subcontractors ADD CONSTRAINT subcontractors_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);

-- Step 8: Update column types and names to match local schema
-- Remove username from users (not in local schema)
ALTER TABLE users DROP COLUMN IF EXISTS username;

-- Rename timer_started_at to timer_start in time_entries
ALTER TABLE time_entries RENAME COLUMN timer_started_at TO timer_start;

-- Add timer_end column
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS timer_end TIMESTAMP;

-- Add missing columns to match local
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS entered_by_user_id UUID;

-- Add missing columns to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS code VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget_hours NUMERIC(10,2);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget_amount NUMERIC(12,2);
ALTER TABLE projects RENAME COLUMN budget TO budget_amount_old; -- Keep old column as backup

-- Update user_types to add can_login if missing
ALTER TABLE user_types ADD COLUMN IF NOT EXISTS can_login BOOLEAN DEFAULT true;
ALTER TABLE user_types ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Step 9: Drop old integer columns (optional - keep for backup)
-- ALTER TABLE user_types DROP COLUMN old_id;
-- ALTER TABLE users DROP COLUMN old_id;
-- etc...

-- Step 10: Set default values for UUID columns
ALTER TABLE user_types ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE users ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE clients ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE projects ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE time_entries ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE invoices ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE invoice_items ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE subcontractors ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE activity_logs ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE refresh_tokens ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- Verify the migration
SELECT 
    'Migration complete! Checking new schema...' as status;

SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name IN ('users', 'clients', 'projects', 'time_entries')
AND column_name = 'id'
ORDER BY table_name;