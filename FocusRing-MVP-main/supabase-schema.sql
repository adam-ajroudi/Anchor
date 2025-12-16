-- Anchor Database Schema for Supabase
-- Run this in Supabase SQL Editor (Database → SQL Editor)

-- Enable Row Level Security
-- Note: Users table is managed by Supabase Auth automatically

-- Logs table: stores click/redirect events
CREATE TABLE IF NOT EXISTS logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    value DECIMAL(3,1) NOT NULL DEFAULT 1.0, -- 1.0 for ring, 0.5 for keyboard
    source TEXT NOT NULL DEFAULT 'ring', -- 'ring' or 'keyboard'
    session_id UUID, -- optional link to session
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on logs
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see/insert their own logs
CREATE POLICY "Users can view own logs" ON logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logs" ON logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Sessions table: stores task/reward context for each focus session
CREATE TABLE IF NOT EXISTS sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    task TEXT NOT NULL, -- "What are you working on?"
    reward TEXT NOT NULL, -- "What are you looking forward to?"
    started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    ended_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

-- Enable RLS on sessions
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only manage their own sessions
CREATE POLICY "Users can view own sessions" ON sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON sessions
    FOR UPDATE USING (auth.uid() = user_id);

-- Assets table: stores AI-generated quotes/images
CREATE TABLE IF NOT EXISTS assets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL, -- 'quote' or 'image_prompt'
    content TEXT NOT NULL, -- the actual quote or image URL/prompt
    approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on assets
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only manage their own assets
CREATE POLICY "Users can view own assets" ON assets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assets" ON assets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assets" ON assets
    FOR UPDATE USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_logs_user_timestamp ON logs(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON sessions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_assets_session ON assets(session_id);
