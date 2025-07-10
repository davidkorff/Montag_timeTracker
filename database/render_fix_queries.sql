-- Fix Queries for Render Database
-- Run these after reviewing the diagnostic results

-- 1. Ensure all users have valid user_type_id
UPDATE users 
SET user_type_id = 2 
WHERE user_type_id IS NULL;

-- 2. Create sample client if none exist
INSERT INTO clients (name, code, is_active, created_by, billing_rate, default_rate)
SELECT 
    'Sample Client',
    'SAMPLE',
    true,
    (SELECT id FROM users WHERE user_type_id = 1 LIMIT 1),
    175,
    175
WHERE NOT EXISTS (SELECT 1 FROM clients LIMIT 1);

-- 3. Create sample project if none exist
INSERT INTO projects (name, client_id, status, created_by)
SELECT 
    'Sample Project',
    (SELECT id FROM clients LIMIT 1),
    'active',
    (SELECT id FROM users WHERE user_type_id = 1 LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM projects LIMIT 1);

-- 4. Fix any time entries with invalid foreign keys
-- Delete time entries without valid users
DELETE FROM time_entries 
WHERE user_id NOT IN (SELECT id FROM users);

-- Delete time entries without valid projects
DELETE FROM time_entries 
WHERE project_id NOT IN (SELECT id FROM projects);

-- 5. Ensure your user can login
UPDATE users 
SET is_active = true,
    user_type_id = CASE 
        WHEN email = 'david@42consultingllc.com' THEN 1  -- Make you admin
        ELSE COALESCE(user_type_id, 2)
    END
WHERE email = 'david@42consultingllc.com';

-- 6. Check final status
SELECT 
    'Total Users' as metric,
    COUNT(*) as count
FROM users
WHERE is_active = true

UNION ALL

SELECT 
    'Total Clients' as metric,
    COUNT(*) as count
FROM clients
WHERE is_active = true

UNION ALL

SELECT 
    'Total Projects' as metric,
    COUNT(*) as count
FROM projects
WHERE status = 'active'

UNION ALL

SELECT 
    'Total Time Entries' as metric,
    COUNT(*) as count
FROM time_entries
WHERE is_deleted = false OR is_deleted IS NULL;