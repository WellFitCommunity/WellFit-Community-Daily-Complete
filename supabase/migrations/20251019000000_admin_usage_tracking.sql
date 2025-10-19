-- Admin Dashboard Usage Tracking
-- Enables AI-powered personalization by tracking what sections users interact with

CREATE TABLE IF NOT EXISTS admin_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,
  section_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('open', 'close', 'click', 'view')),
  time_spent INTEGER, -- seconds spent in section
  role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Indexes for fast queries
  INDEX idx_usage_user_id (user_id),
  INDEX idx_usage_created_at (created_at),
  INDEX idx_usage_section_id (section_id)
);

-- Enable Row Level Security
ALTER TABLE admin_usage_tracking ENABLE ROW LEVEL SECURITY;

-- Users can only see their own usage data
CREATE POLICY "Users can view own usage data"
  ON admin_usage_tracking
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own usage data
CREATE POLICY "Users can insert own usage data"
  ON admin_usage_tracking
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can see all usage data for analytics
CREATE POLICY "Admins can view all usage data"
  ON admin_usage_tracking
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Create aggregated view for analytics
CREATE OR REPLACE VIEW admin_usage_analytics AS
SELECT
  user_id,
  section_id,
  section_name,
  role,
  COUNT(*) as total_interactions,
  COUNT(CASE WHEN action = 'open' THEN 1 END) as open_count,
  SUM(COALESCE(time_spent, 0)) as total_time_spent,
  MAX(created_at) as last_accessed,
  DATE_TRUNC('day', created_at) as day
FROM admin_usage_tracking
GROUP BY user_id, section_id, section_name, role, DATE_TRUNC('day', created_at);

COMMENT ON TABLE admin_usage_tracking IS 'Tracks admin panel section usage for AI-powered dashboard personalization using Claude Haiku 4.5';
COMMENT ON VIEW admin_usage_analytics IS 'Aggregated usage statistics for dashboard personalization';
