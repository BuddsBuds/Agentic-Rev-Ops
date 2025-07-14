-- Migration: Create User Sessions Table
-- Version: 001
-- Description: Add user session tracking for authentication

-- UP
CREATE TABLE IF NOT EXISTS core.user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_user_sessions_user_id (user_id),
    INDEX idx_user_sessions_token (token),
    INDEX idx_user_sessions_expires_at (expires_at)
);

-- Create cleanup function for expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM core.user_sessions 
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create trigger to clean up expired sessions daily
CREATE OR REPLACE FUNCTION schedule_session_cleanup()
RETURNS trigger AS $$
BEGIN
    -- This would be handled by a cron job in production
    PERFORM cleanup_expired_sessions();
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- DOWN
DROP FUNCTION IF EXISTS schedule_session_cleanup();
DROP FUNCTION IF EXISTS cleanup_expired_sessions();
DROP TABLE IF EXISTS core.user_sessions;