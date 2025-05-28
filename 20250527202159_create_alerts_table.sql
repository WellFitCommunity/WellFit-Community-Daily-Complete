-- migrate:skip
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT now() NOT NULL,
    details TEXT
);

-- Optional: Add an index on user_id for faster lookups if needed
-- CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);

-- Optional: Add an index on timestamp
-- CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp);
