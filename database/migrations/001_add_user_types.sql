-- Create user_types table
CREATE TABLE IF NOT EXISTS user_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    can_login BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default user types
INSERT INTO user_types (id, name, description, can_login) VALUES 
(1, 'Admin', 'Full system access, can manage everything', true),
(2, 'Contractor', 'Can track time, manage projects, view reports', true),
(3, 'Subcontractor', 'External resource, cannot login but can be assigned time', false);

-- Add user_type_id to users table
ALTER TABLE users 
ADD COLUMN user_type_id INTEGER REFERENCES user_types(id) DEFAULT 2;

-- Update existing admin user to have admin type
UPDATE users 
SET user_type_id = 1 
WHERE email = 'admin@42consulting.com';

-- Drop the old role column and check constraint
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS users_role_check,
DROP COLUMN IF EXISTS role;

-- Create index for performance
CREATE INDEX idx_users_user_type ON users(user_type_id);

-- Update time entries to allow null user_id for subcontractor entries
ALTER TABLE time_entries 
ADD COLUMN subcontractor_id UUID,
ADD COLUMN entered_by_user_id UUID REFERENCES users(id),
ALTER COLUMN user_id DROP NOT NULL;

-- Add constraint to ensure either user_id or subcontractor_id is set
ALTER TABLE time_entries 
ADD CONSTRAINT time_entry_user_check 
CHECK (
    (user_id IS NOT NULL AND subcontractor_id IS NULL) OR 
    (user_id IS NULL AND subcontractor_id IS NOT NULL)
);

-- Create subcontractors table
CREATE TABLE subcontractors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50),
    hourly_rate DECIMAL(10, 2),
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key for subcontractor time entries
ALTER TABLE time_entries 
ADD CONSTRAINT fk_time_entry_subcontractor 
FOREIGN KEY (subcontractor_id) REFERENCES subcontractors(id) ON DELETE CASCADE;

-- Update trigger for subcontractors
CREATE TRIGGER update_subcontractors_updated_at BEFORE UPDATE ON subcontractors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();