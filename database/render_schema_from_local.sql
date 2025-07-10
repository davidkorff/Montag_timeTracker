-- Complete Database Schema from Local
-- Generated on 2025-07-10T08:08:03.410Z
-- This will recreate the entire database structure

-- Drop and recreate schema
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO public;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- Table: activity_logs
CREATE TABLE activity_logs (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    details JSONB,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: clients
CREATE TABLE clients (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    address TEXT,
    billing_rate NUMERIC(10,2),
    is_active BOOLEAN DEFAULT true,
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    invoice_email VARCHAR(255),
    invoice_cc_email VARCHAR(255),
    invoice_recipient_name VARCHAR(255),
    billed_to VARCHAR(255),
    payment_terms VARCHAR(50) DEFAULT 'Net 30',
    invoice_notes TEXT,
    default_rate NUMERIC(10,2) DEFAULT 175.00,
    company_name VARCHAR(255),
    company_address TEXT
);

-- Table: invoice_items
CREATE TABLE invoice_items (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL,
    description TEXT NOT NULL,
    quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
    rate NUMERIC(10,2) NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    time_entry_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: invoices
CREATE TABLE invoices (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(50) NOT NULL,
    client_id UUID NOT NULL,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
    tax_rate NUMERIC(5,2) DEFAULT 0,
    tax_amount NUMERIC(10,2) DEFAULT 0,
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft',
    payment_status VARCHAR(20) DEFAULT 'unpaid',
    payment_terms VARCHAR(100),
    notes TEXT,
    created_by UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_date DATE
);

-- Table: projects
CREATE TABLE projects (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    client_id UUID,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    description TEXT,
    budget_hours NUMERIC(10,2),
    budget_amount NUMERIC(12,2),
    start_date DATE,
    end_date DATE,
    status VARCHAR(20) DEFAULT 'active',
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    hourly_rate NUMERIC(10,2)
);

-- Table: subcontractors
CREATE TABLE subcontractors (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    hourly_rate NUMERIC(10,2),
    is_active BOOLEAN DEFAULT true,
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: time_entries
CREATE TABLE time_entries (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    user_id UUID,
    project_id UUID,
    date DATE NOT NULL,
    hours NUMERIC(5,2) NOT NULL,
    description TEXT,
    is_billable BOOLEAN DEFAULT true,
    status VARCHAR(20) DEFAULT 'draft',
    timer_start TIMESTAMP,
    timer_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    subcontractor_id UUID,
    entered_by_user_id UUID,
    timer_elapsed_seconds INTEGER DEFAULT 0,
    timer_is_paused BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    invoice_id UUID,
    invoice_number VARCHAR(50),
    rate NUMERIC(10,2),
    amount NUMERIC(10,2)
);

-- Table: time_entry_templates
CREATE TABLE time_entry_templates (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    user_id UUID,
    project_id UUID,
    name VARCHAR(255) NOT NULL,
    hours NUMERIC(5,2) NOT NULL,
    description TEXT,
    is_billable BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: user_sessions
CREATE TABLE user_sessions (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    user_id UUID,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: user_types
CREATE TABLE user_types (
    id INTEGER NOT NULL DEFAULT nextval('user_types_id_seq',
    name VARCHAR(50) NOT NULL,
    description TEXT,
    can_login BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: users
CREATE TABLE users (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    hourly_rate NUMERIC(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_type_id INTEGER DEFAULT 2
);

-- Primary Keys
ALTER TABLE activity_logs ADD PRIMARY KEY (id);
ALTER TABLE clients ADD PRIMARY KEY (id);
ALTER TABLE invoice_items ADD PRIMARY KEY (id);
ALTER TABLE invoices ADD PRIMARY KEY (id);
ALTER TABLE projects ADD PRIMARY KEY (id);
ALTER TABLE subcontractors ADD PRIMARY KEY (id);
ALTER TABLE time_entries ADD PRIMARY KEY (id);
ALTER TABLE time_entry_templates ADD PRIMARY KEY (id);
ALTER TABLE user_sessions ADD PRIMARY KEY (id);
ALTER TABLE user_types ADD PRIMARY KEY (id);
ALTER TABLE users ADD PRIMARY KEY (id);

-- Foreign Keys
ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE clients ADD CONSTRAINT clients_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
ALTER TABLE invoices ADD CONSTRAINT invoices_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id);
ALTER TABLE invoices ADD CONSTRAINT invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE projects ADD CONSTRAINT projects_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE projects ADD CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE subcontractors ADD CONSTRAINT subcontractors_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE time_entries ADD CONSTRAINT fk_time_entry_subcontractor FOREIGN KEY (subcontractor_id) REFERENCES subcontractors(id) ON DELETE CASCADE;
ALTER TABLE time_entries ADD CONSTRAINT time_entries_entered_by_user_id_fkey FOREIGN KEY (entered_by_user_id) REFERENCES users(id);
ALTER TABLE time_entries ADD CONSTRAINT time_entries_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id);
ALTER TABLE time_entries ADD CONSTRAINT time_entries_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE time_entries ADD CONSTRAINT time_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE time_entry_templates ADD CONSTRAINT time_entry_templates_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE time_entry_templates ADD CONSTRAINT time_entry_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE user_sessions ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE users ADD CONSTRAINT users_user_type_id_fkey FOREIGN KEY (user_type_id) REFERENCES user_types(id);

-- Indexes
CREATE INDEX idx_activity_logs_created ON public.activity_logs USING btree (created_at);
CREATE INDEX idx_activity_logs_user ON public.activity_logs USING btree (user_id);
CREATE UNIQUE INDEX clients_code_key ON public.clients USING btree (code);
CREATE INDEX idx_clients_invoice_email ON public.clients USING btree (invoice_email);
CREATE INDEX idx_invoice_items_invoice_id ON public.invoice_items USING btree (invoice_id);
CREATE INDEX idx_invoices_client_id ON public.invoices USING btree (client_id);
CREATE INDEX idx_invoices_payment_status ON public.invoices USING btree (payment_status);
CREATE INDEX idx_invoices_status ON public.invoices USING btree (status);
CREATE UNIQUE INDEX invoices_invoice_number_key ON public.invoices USING btree (invoice_number);
CREATE INDEX idx_projects_client ON public.projects USING btree (client_id);
CREATE INDEX idx_projects_status ON public.projects USING btree (status);
CREATE UNIQUE INDEX projects_client_id_name_key ON public.projects USING btree (client_id, name);
CREATE UNIQUE INDEX subcontractors_email_key ON public.subcontractors USING btree (email);
CREATE INDEX idx_time_entries_invoice_id ON public.time_entries USING btree (invoice_id);
CREATE INDEX idx_time_entries_is_deleted ON public.time_entries USING btree (is_deleted);
CREATE INDEX idx_time_entries_project_date ON public.time_entries USING btree (project_id, date);
CREATE INDEX idx_time_entries_status ON public.time_entries USING btree (status);
CREATE INDEX idx_time_entries_user_date ON public.time_entries USING btree (user_id, date);
CREATE INDEX idx_user_sessions_token ON public.user_sessions USING btree (token_hash);
CREATE UNIQUE INDEX user_types_name_key ON public.user_types USING btree (name);
CREATE INDEX idx_users_user_type ON public.users USING btree (user_type_id);
CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);

-- Check Constraints
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check CHECK ((status)::text = ANY ((ARRAY['draft'::character varying, 'sent'::character varying, 'cancelled'::character varying])::text[]));
ALTER TABLE invoices ADD CONSTRAINT invoices_payment_status_check CHECK ((payment_status)::text = ANY ((ARRAY['unpaid'::character varying, 'partial'::character varying, 'paid'::character varying])::text[]));
ALTER TABLE projects ADD CONSTRAINT projects_status_check CHECK ((status)::text = ANY ((ARRAY['active'::character varying, 'completed'::character varying, 'on_hold'::character varying, 'cancelled'::character varying])::text[]));
ALTER TABLE time_entries ADD CONSTRAINT time_entries_status_check CHECK ((status)::text = ANY ((ARRAY['draft'::character varying, 'submitted'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[]));
ALTER TABLE time_entries ADD CONSTRAINT time_entry_user_check CHECK (((user_id IS NOT NULL) AND (subcontractor_id IS NULL)) OR ((user_id IS NULL) AND (subcontractor_id IS NOT NULL)));
ALTER TABLE time_entries ADD CONSTRAINT time_entries_hours_check CHECK (hours >= (0)::numeric);

-- Unique Constraints
ALTER TABLE clients ADD CONSTRAINT clients_code_key UNIQUE (code);
ALTER TABLE invoices ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);
ALTER TABLE projects ADD CONSTRAINT projects_client_id_name_key UNIQUE (client_id, name);
ALTER TABLE subcontractors ADD CONSTRAINT subcontractors_email_key UNIQUE (email);
ALTER TABLE user_types ADD CONSTRAINT user_types_name_key UNIQUE (name);
ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);

-- Functions
CREATE OR REPLACE FUNCTION uuid_nil()
RETURNS TRIGGER AS $$
uuid_nil
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION uuid_ns_dns()
RETURNS TRIGGER AS $$
uuid_ns_dns
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION uuid_ns_url()
RETURNS TRIGGER AS $$
uuid_ns_url
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION uuid_ns_oid()
RETURNS TRIGGER AS $$
uuid_ns_oid
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION uuid_ns_x500()
RETURNS TRIGGER AS $$
uuid_ns_x500
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION uuid_generate_v1()
RETURNS TRIGGER AS $$
uuid_generate_v1
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION uuid_generate_v1mc()
RETURNS TRIGGER AS $$
uuid_generate_v1mc
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION uuid_generate_v3()
RETURNS TRIGGER AS $$
uuid_generate_v3
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION uuid_generate_v4()
RETURNS TRIGGER AS $$
uuid_generate_v4
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION uuid_generate_v5()
RETURNS TRIGGER AS $$
uuid_generate_v5
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$

BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;

$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_invoices_updated_at()
RETURNS TRIGGER AS $$

      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      
$$ language 'plpgsql';


-- Triggers
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_invoices_updated_at();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subcontractors_updated_at BEFORE UPDATE ON subcontractors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON time_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Initial Data
INSERT INTO user_types (id, name, description, can_login) VALUES 
    (1, 'Admin', 'Full system access', true),
    (2, 'User', 'Regular user access', true),
    (3, 'Subcontractor', 'External contractor', false)
ON CONFLICT (id) DO NOTHING;
