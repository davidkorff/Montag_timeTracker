-- Check subcontractors table schema
-- This script verifies if the created_by column exists in the subcontractors table

-- 1. Check if subcontractors table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'subcontractors'
) as table_exists;

-- 2. List all columns in subcontractors table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public'
AND table_name = 'subcontractors'
ORDER BY ordinal_position;

-- 3. Specifically check if created_by column exists
SELECT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'subcontractors'
    AND column_name = 'created_by'
) as created_by_exists;

-- 4. Check foreign key constraints on subcontractors table
SELECT 
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
AND tc.table_name = 'subcontractors'
ORDER BY tc.constraint_name;

-- 5. If created_by doesn't exist, here's the ALTER TABLE command to add it:
-- ALTER TABLE subcontractors ADD COLUMN created_by UUID;
-- ALTER TABLE subcontractors ADD CONSTRAINT subcontractors_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);