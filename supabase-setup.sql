-- =====================================================
-- TechCloud Supabase Authentication Setup
-- =====================================================
-- Run these queries in your Supabase SQL Editor
-- Go to: Dashboard > SQL Editor > New Query

-- =====================================================
-- 1. USER PROFILES TABLE
-- =====================================================
-- This table extends the built-in auth.users table with additional user information
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    website TEXT,
    location TEXT,
    company TEXT,
    job_title TEXT,
    phone TEXT,
    date_of_birth DATE,
    gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
    is_public BOOLEAN DEFAULT true,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. USER ACTIVITY LOG TABLE
-- =====================================================
-- Track user activities like logins, profile updates, etc.
CREATE TABLE public.user_activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    activity_type TEXT NOT NULL, -- 'login', 'logout', 'profile_update', 'password_change', etc.
    activity_description TEXT,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.user_activities ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 3. USER PREFERENCES TABLE
-- =====================================================
-- Store user-specific preferences and settings
CREATE TABLE public.user_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    preference_key TEXT NOT NULL,
    preference_value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, preference_key)
);

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. EMAIL SUBSCRIPTIONS TABLE
-- =====================================================
-- Track newsletter and email subscriptions
CREATE TABLE public.email_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    subscription_type TEXT DEFAULT 'newsletter', -- 'newsletter', 'updates', 'events', etc.
    is_active BOOLEAN DEFAULT true,
    subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    unsubscribed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    UNIQUE(email, subscription_type)
);

-- Enable RLS
ALTER TABLE public.email_subscriptions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 5. USER SESSIONS TABLE (Optional - for advanced session tracking)
-- =====================================================
-- Track active user sessions
CREATE TABLE public.user_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    device_info JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Enable RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Profiles: Users can view and update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- User Activities: Users can view their own activities
CREATE POLICY "Users can view own activities" ON public.user_activities
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert activities" ON public.user_activities
    FOR INSERT WITH CHECK (true); -- Allow system to log activities

-- User Preferences: Users can manage their own preferences
CREATE POLICY "Users can view own preferences" ON public.user_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON public.user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON public.user_preferences
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own preferences" ON public.user_preferences
    FOR DELETE USING (auth.uid() = user_id);

-- Email Subscriptions: Users can manage their own subscriptions
CREATE POLICY "Users can view own subscriptions" ON public.email_subscriptions
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Anyone can subscribe" ON public.email_subscriptions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own subscriptions" ON public.email_subscriptions
    FOR UPDATE USING (auth.uid() = user_id);

-- User Sessions: Users can view their own sessions
CREATE POLICY "Users can view own sessions" ON public.user_sessions
    FOR SELECT USING (auth.uid() = user_id);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name)
    VALUES (new.id, new.raw_user_meta_data->>'full_name');
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function when a new user is created
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at timestamps
CREATE TRIGGER handle_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER handle_user_preferences_updated_at
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Function to log user activities
CREATE OR REPLACE FUNCTION public.log_user_activity(
    p_user_id UUID,
    p_activity_type TEXT,
    p_activity_description TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    activity_id UUID;
BEGIN
    INSERT INTO public.user_activities (user_id, activity_type, activity_description, metadata)
    VALUES (p_user_id, p_activity_type, p_activity_description, p_metadata)
    RETURNING id INTO activity_id;
    
    RETURN activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Profiles indexes
CREATE INDEX idx_profiles_full_name ON public.profiles(full_name);
CREATE INDEX idx_profiles_created_at ON public.profiles(created_at);

-- User activities indexes
CREATE INDEX idx_user_activities_user_id ON public.user_activities(user_id);
CREATE INDEX idx_user_activities_type ON public.user_activities(activity_type);
CREATE INDEX idx_user_activities_created_at ON public.user_activities(created_at);

-- User preferences indexes
CREATE INDEX idx_user_preferences_user_id ON public.user_preferences(user_id);
CREATE INDEX idx_user_preferences_key ON public.user_preferences(preference_key);

-- Email subscriptions indexes
CREATE INDEX idx_email_subscriptions_email ON public.email_subscriptions(email);
CREATE INDEX idx_email_subscriptions_user_id ON public.email_subscriptions(user_id);
CREATE INDEX idx_email_subscriptions_type ON public.email_subscriptions(subscription_type);

-- User sessions indexes
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON public.user_sessions(session_token);
CREATE INDEX idx_user_sessions_active ON public.user_sessions(is_active);

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================

-- Insert sample email subscription types
INSERT INTO public.email_subscriptions (email, subscription_type, metadata) VALUES
('sample@example.com', 'newsletter', '{"source": "website", "preferences": {"frequency": "weekly"}}'),
('test@example.com', 'events', '{"source": "website", "preferences": {"categories": ["tech", "cloud"]}}')
ON CONFLICT (email, subscription_type) DO NOTHING;

-- =====================================================
-- VIEWS FOR EASIER QUERYING
-- =====================================================

-- View to get user profile with auth data
CREATE VIEW public.user_profiles_view AS
SELECT 
    u.id,
    u.email,
    u.created_at as user_created_at,
    u.last_sign_in_at,
    u.email_confirmed_at,
    p.full_name,
    p.avatar_url,
    p.bio,
    p.website,
    p.location,
    p.company,
    p.job_title,
    p.phone,
    p.date_of_birth,
    p.gender,
    p.is_public,
    p.preferences,
    p.created_at as profile_created_at,
    p.updated_at as profile_updated_at
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id;

-- View for user activity summary
CREATE VIEW public.user_activity_summary AS
SELECT 
    user_id,
    COUNT(*) as total_activities,
    COUNT(CASE WHEN activity_type = 'login' THEN 1 END) as login_count,
    MAX(CASE WHEN activity_type = 'login' THEN created_at END) as last_login,
    MIN(created_at) as first_activity,
    MAX(created_at) as last_activity
FROM public.user_activities
GROUP BY user_id;

-- =====================================================
-- CLEANUP FUNCTIONS (Optional)
-- =====================================================

-- Function to clean up old user activities (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_old_activities(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.user_activities 
    WHERE created_at < (NOW() - INTERVAL '1 day' * days_to_keep);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.user_sessions 
    WHERE expires_at < NOW() OR (is_active = false AND last_activity < (NOW() - INTERVAL '7 days'));
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant permissions on tables
GRANT ALL ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

GRANT ALL ON public.user_activities TO authenticated;
GRANT INSERT ON public.user_activities TO anon;

GRANT ALL ON public.user_preferences TO authenticated;

GRANT ALL ON public.email_subscriptions TO authenticated;
GRANT INSERT, SELECT ON public.email_subscriptions TO anon;

GRANT ALL ON public.user_sessions TO authenticated;

-- Grant permissions on views
GRANT SELECT ON public.user_profiles_view TO authenticated;
GRANT SELECT ON public.user_activity_summary TO authenticated;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================
-- All tables, policies, functions, and triggers have been created successfully!
-- Your TechCloud authentication system is now ready to use.
-- 
-- Next steps:
-- 1. Test user registration and login
-- 2. Verify profile creation works automatically
-- 3. Check that RLS policies are working correctly
-- 4. Customize the tables based on your specific needs
