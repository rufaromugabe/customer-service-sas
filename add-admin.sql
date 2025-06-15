-- SQL to add admin users to the database
-- Note: Passwords should be hashed using bcrypt before inserting

-- Method 1: Direct SQL INSERT (you'll need to hash the password separately)
-- Replace 'your_email@example.com', 'Your Name', and 'HASHED_PASSWORD_HERE' with actual values

-- Example 1: Insert admin with hashed password (you need to generate the hash)
INSERT INTO public.admins (email, password_hash, name) 
VALUES (
    'admin@example.com', 
    '$2a$12$LQv3c1yqBwlkqWEsrXUfX.MNFTvKFOQmxKuOdcVtOmcUZBYGzG2Oa', -- This is 'password123' hashed
    'System Administrator'
);

-- Example 2: Insert another admin
INSERT INTO public.admins (email, password_hash, name) 
VALUES (
    'superadmin@example.com', 
    '$2a$12$LQv3c1yqBwlkqWEsrXUfX.MNFTvKFOQmxKuOdcVtOmcUZBYGzG2Oa', -- This is 'password123' hashed
    'Super Administrator'
);

-- Method 2: Using PostgreSQL's crypt function (if pgcrypto extension is available)
-- This will hash the password directly in the database
INSERT INTO public.admins (email, password_hash, name) 
VALUES (
    'admin@company.com', 
    crypt('your_password_here', gen_salt('bf')), -- bcrypt hash
    'Company Administrator'
);

-- Method 3: Check if admin exists before inserting (prevents duplicates)
INSERT INTO public.admins (email, password_hash, name) 
SELECT 'admin@example.com', '$2a$12$LQv3c1yqBwlkqWEsrXUfX.MNFTvKFOQmxKuOdcVtOmcUZBYGzG2Oa', 'Admin User'
WHERE NOT EXISTS (
    SELECT 1 FROM public.admins WHERE email = 'admin@example.com'
);

-- Query to verify the admin was created
SELECT id, email, name, created, updated FROM public.admins WHERE email = 'admin@example.com';

-- Query to list all admins (excluding password hash for security)
SELECT id, email, name, created, updated, deleted FROM public.admins ORDER BY created DESC;
