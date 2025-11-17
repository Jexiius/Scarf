-- Create rate_limits table for shared rate limiting across API instances
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  reset_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for efficient cleanup of expired entries
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits(reset_at);

-- Add comment for documentation
COMMENT ON TABLE rate_limits IS 'Stores rate limit counters for API requests. Keys are user IDs or IP addresses.';
COMMENT ON COLUMN rate_limits.key IS 'Rate limit key (e.g., "user:uuid" or "ip:1.2.3.4")';
COMMENT ON COLUMN rate_limits.count IS 'Current request count within the window';
COMMENT ON COLUMN rate_limits.reset_at IS 'Timestamp when the rate limit window resets';
COMMENT ON COLUMN rate_limits.created_at IS 'When this rate limit entry was first created';

