-- Diagnostic Queries to Run in Both Local and Render Databases

-- 1. Check table structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name IN ('users', 'user_types', 'time_entries', 'projects', 'clients')
ORDER BY table_name, ordinal_position;

-- 2. Check if user_types table has data
SELECT * FROM user_types;

-- 3. Check users table structure and sample data
SELECT 
    id, 
    username, 
    email, 
    user_type_id,
    first_name,
    last_name,
    is_active,
    created_at
FROM users 
LIMIT 5;

-- 4. Check if there are any time entries
SELECT COUNT(*) as total_entries FROM time_entries;

-- 5. Check if there are any projects
SELECT COUNT(*) as total_projects FROM projects;

-- 6. Check if there are any clients  
SELECT COUNT(*) as total_clients FROM clients;

-- 7. Check for any active timers
SELECT 
    te.id,
    te.user_id,
    te.timer_started_at,
    te.timer_is_paused,
    te.hours,
    p.name as project_name
FROM time_entries te
LEFT JOIN projects p ON te.project_id = p.id
WHERE te.timer_started_at IS NOT NULL
AND te.hours = 0;

-- 8. Check today's entries (adjust date as needed)
SELECT 
    te.id,
    te.date,
    te.hours,
    te.description,
    p.name as project_name,
    u.username
FROM time_entries te
LEFT JOIN projects p ON te.project_id = p.id
LEFT JOIN users u ON te.user_id = u.id
WHERE te.date = CURRENT_DATE
OR te.timer_started_at IS NOT NULL;

-- 9. Check for missing foreign key relationships
SELECT 
    'time_entries without valid user' as issue,
    COUNT(*) as count
FROM time_entries te
LEFT JOIN users u ON te.user_id = u.id
WHERE u.id IS NULL

UNION ALL

SELECT 
    'time_entries without valid project' as issue,
    COUNT(*) as count
FROM time_entries te
LEFT JOIN projects p ON te.project_id = p.id
WHERE p.id IS NULL

UNION ALL

SELECT 
    'projects without valid client' as issue,
    COUNT(*) as count
FROM projects p
LEFT JOIN clients c ON p.client_id = c.id
WHERE c.id IS NULL;

-- 10. Check user login capability
SELECT 
    u.id,
    u.username,
    u.email,
    ut.name as user_type,
    u.is_active
FROM users u
LEFT JOIN user_types ut ON u.user_type_id = ut.id
WHERE u.email = 'david@42consultingllc.com';