-- Create admin user with UUID
-- First, generate a password hash locally or use this example
-- Password: 'changeme123' (CHANGE THIS!)

INSERT INTO users (email, password_hash, first_name, last_name, user_type_id, hourly_rate, is_active)
VALUES (
    'david@42consultingllc.com',
    '$2a$10$xQwZ8K3D7IQ6YMLkz8xCY.0qcL0ySjVHgyXjPrYpDZmKHMlBxX3Vy',  -- This is 'changeme123' - CHANGE IT!
    'David',
    'Korff',
    1,  -- Admin
    175,
    true
)
ON CONFLICT (email) DO UPDATE SET
    user_type_id = 1,
    is_active = true;

-- Verify the user was created
SELECT id, email, first_name, last_name, user_type_id, is_active 
FROM users 
WHERE email = 'david@42consultingllc.com';