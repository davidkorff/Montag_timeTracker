-- Check data in Render database
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'clients', COUNT(*) FROM clients  
UNION ALL
SELECT 'projects', COUNT(*) FROM projects
UNION ALL
SELECT 'time_entries', COUNT(*) FROM time_entries;

-- Check your user
SELECT id, username, email, user_type_id, is_active 
FROM users 
WHERE email = 'david@42consultingllc.com';

-- Check user types
SELECT * FROM user_types;