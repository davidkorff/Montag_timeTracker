-- Create pinned_projects table
CREATE TABLE IF NOT EXISTS pinned_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, project_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_pinned_projects_user_id ON pinned_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_pinned_projects_position ON pinned_projects(position);