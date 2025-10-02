-- Authentication helper functions for the Library Management System
-- This script creates functions for user authentication and session management

-- Function to verify user login credentials
CREATE OR REPLACE FUNCTION verify_user_login(
    user_email TEXT,
    user_password TEXT
) RETURNS TABLE (
    user_id UUID,
    email TEXT,
    full_name TEXT,
    role TEXT,
    is_active BOOLEAN
) AS $$
BEGIN
    -- Update last_login timestamp
    UPDATE users 
    SET last_login = NOW() 
    WHERE email = user_email 
    AND is_active = true;
    
    -- Return user details if credentials match
    RETURN QUERY
    SELECT 
        u.id,
        u.email,
        u.full_name,
        u.role,
        u.is_active
    FROM users u
    WHERE u.email = user_email 
    AND u.is_active = true;
    -- Note: Password verification should be done in your backend application
    -- This function assumes password verification is handled by your auth system
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user by ID
CREATE OR REPLACE FUNCTION get_user_by_id(user_uuid UUID)
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    full_name TEXT,
    role TEXT,
    is_active BOOLEAN,
    last_login TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.email,
        u.full_name,
        u.role,
        u.is_active,
        u.last_login
    FROM users u
    WHERE u.id = user_uuid 
    AND u.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create new user
CREATE OR REPLACE FUNCTION create_user(
    user_email TEXT,
    password_hash TEXT,
    user_full_name TEXT,
    user_role TEXT DEFAULT 'staff'
) RETURNS UUID AS $$
DECLARE
    new_user_id UUID;
BEGIN
    INSERT INTO users (email, password_hash, full_name, role)
    VALUES (user_email, password_hash, user_full_name, user_role)
    RETURNING id INTO new_user_id;
    
    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user role
CREATE OR REPLACE FUNCTION update_user_role(
    user_uuid UUID,
    new_role TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE users 
    SET role = new_role, updated_at = NOW()
    WHERE id = user_uuid;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deactivate user
CREATE OR REPLACE FUNCTION deactivate_user(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE users 
    SET is_active = false, updated_at = NOW()
    WHERE id = user_uuid;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
