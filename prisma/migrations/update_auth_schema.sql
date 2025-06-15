-- Migration: Update authentication schema for enhanced security
-- Date: 2025-06-16
-- Description: Add security fields to admin and user models, create token management and security event tracking

BEGIN;

-- Update admins table with security fields
ALTER TABLE public.admins 
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'admin',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP(6),
ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(255),
ADD COLUMN IF NOT EXISTS password_changed TIMESTAMP(6),
ADD COLUMN IF NOT EXISTS failed_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP(6);

-- Create admin_tokens table for JWT token management
CREATE TABLE IF NOT EXISTS public.admin_tokens (
    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
    admin_id UUID NOT NULL,
    token_type VARCHAR(50) NOT NULL, -- access_token, refresh_token
    jti VARCHAR(255) UNIQUE NOT NULL, -- JWT ID for token identification
    expires_at TIMESTAMP(6) NOT NULL,
    revoked_at TIMESTAMP(6),
    created_at TIMESTAMP(6) DEFAULT LOCALTIMESTAMP,
    ip_address VARCHAR(255),
    user_agent TEXT
);

-- Create indexes for admin_tokens
CREATE INDEX IF NOT EXISTS idx_admin_tokens_admin_id ON public.admin_tokens(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_tokens_jti ON public.admin_tokens(jti);
CREATE INDEX IF NOT EXISTS idx_admin_tokens_expires_at ON public.admin_tokens(expires_at);

-- Update users table with authentication tracking
ALTER TABLE users.users 
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP(6),
ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create security_events table for tracking authentication and security events
CREATE TABLE IF NOT EXISTS public.security_events (
    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
    event_type VARCHAR(100) NOT NULL, -- login_success, login_failure, password_change, etc.
    user_id UUID,
    admin_id UUID,
    tenant_id UUID,
    ip_address VARCHAR(255),
    user_agent TEXT,
    details JSONB,
    risk_score INTEGER, -- 1-100 risk assessment
    blocked BOOLEAN DEFAULT false,
    timestamp TIMESTAMP(6) DEFAULT LOCALTIMESTAMP
);

-- Create indexes for security_events
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON public.security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON public.security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_admin_id ON public.security_events(admin_id);
CREATE INDEX IF NOT EXISTS idx_security_events_ip_address ON public.security_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON public.security_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_security_events_risk_score ON public.security_events(risk_score);

-- Update audit_logs table with additional security fields
ALTER TABLE users.audit_logs 
ADD COLUMN IF NOT EXISTS admin_id UUID,
ADD COLUMN IF NOT EXISTS ip_address VARCHAR(255),
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS session_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20); -- low, medium, high, critical

-- Create additional indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON users.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON users.audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON users.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON users.audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_log_type ON users.audit_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_risk_level ON users.audit_logs(risk_level);

-- Update tenant_users table with additional fields
ALTER TABLE users.tenant_users 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS invited_by UUID,
ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP(6),
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP(6);

-- Create additional indexes for tenant_users
CREATE INDEX IF NOT EXISTS idx_tenant_users_is_active ON users.tenant_users(is_active);

-- Add some default admin roles if they don't exist
UPDATE public.admins SET role = 'admin' WHERE role IS NULL;

-- Create a function to clean up expired tokens (optional, for maintenance)
CREATE OR REPLACE FUNCTION public.cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.admin_tokens 
    WHERE expires_at < NOW() 
    AND (revoked_at IS NULL OR revoked_at < NOW() - INTERVAL '7 days');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a function to log security events
CREATE OR REPLACE FUNCTION public.log_security_event(
    p_event_type VARCHAR(100),
    p_user_id UUID DEFAULT NULL,
    p_admin_id UUID DEFAULT NULL,
    p_tenant_id UUID DEFAULT NULL,
    p_ip_address VARCHAR(255) DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_details JSONB DEFAULT NULL,
    p_risk_score INTEGER DEFAULT NULL,
    p_blocked BOOLEAN DEFAULT false
)
RETURNS UUID AS $$
DECLARE
    event_id UUID;
BEGIN
    INSERT INTO public.security_events (
        event_type, user_id, admin_id, tenant_id, ip_address, 
        user_agent, details, risk_score, blocked
    ) VALUES (
        p_event_type, p_user_id, p_admin_id, p_tenant_id, p_ip_address,
        p_user_agent, p_details, p_risk_score, p_blocked
    ) RETURNING id INTO event_id;
    
    RETURN event_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- Log this migration
SELECT public.log_security_event(
    'schema_migration',
    NULL,
    NULL,
    NULL,
    NULL,
    'database-migration',
    '{"migration": "update_auth_schema", "version": "2025-06-16"}'::jsonb,
    1,
    false
);
