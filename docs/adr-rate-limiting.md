# ADR: Production Rate Limiting with Shared Store

## Status
Accepted

## Context
The current rate limiting implementation uses an in-memory `Map` store, which has critical limitations:
- **No shared state**: Each API instance maintains its own counters, allowing attackers to bypass limits by hitting different instances
- **Header spoofing vulnerability**: The `resolveIdentifier` function prioritizes user-controlled headers (`x-request-id`) before trusted proxy headers
- **Memory leaks**: Timeout-based cleanup may not work reliably in all environments
- **No persistence**: Rate limit state is lost on server restart

## Decision
Implement a shared rate limiting store using PostgreSQL with Redis as an optional optimization path.

### Why PostgreSQL First?
- Already available in the infrastructure
- No additional dependencies to manage
- ACID guarantees for counter updates
- Easy to query and debug
- Can migrate to Redis later without changing the interface

### Why Not Redis First?
- Adds infrastructure complexity
- Requires additional connection management
- May not be available in all deployment environments
- PostgreSQL can handle the load for initial scale

## Implementation Details

### Store Interface
Create an abstraction layer (`RateLimitStore`) that supports:
- `increment(key: string, windowMs: number): Promise<RateLimitRecord>`
- `get(key: string): Promise<RateLimitRecord | null>`
- `reset(key: string): Promise<void>`

### Database Schema
```sql
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  reset_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rate_limits_reset_at ON rate_limits(reset_at);
```

### Key Resolution Priority
1. Authenticated users: `user.id` (most reliable)
2. Trusted proxy headers: `cf-connecting-ip` (Cloudflare)
3. Trusted proxy headers: `x-real-ip` (nginx, etc.)
4. Fallback: `x-forwarded-for` (less trusted, may contain multiple IPs)
5. Never use: `x-request-id` or other user-controlled headers

### Window Strategy
- Fixed window (current approach) for simplicity
- Future: Consider sliding window for smoother rate limiting

### Cleanup Strategy
- Background job to delete expired entries (older than `reset_at`)
- Run every 5 minutes via a scheduled task
- Alternatively: Use PostgreSQL's `pg_cron` extension if available

## Consequences

### Positive
- ✅ Shared state across all API instances
- ✅ Prevents header spoofing attacks
- ✅ Persistent rate limit state
- ✅ Easy to monitor and debug
- ✅ Can scale to Redis later without code changes

### Negative
- ⚠️ Additional database load (mitigated by indexes and cleanup)
- ⚠️ Slightly higher latency than in-memory (acceptable for rate limiting)
- ⚠️ Requires cleanup job or extension

### Migration Path to Redis
When ready to optimize:
1. Implement `RedisRateLimitStore` implementing the same interface
2. Add `RATE_LIMIT_STORE=redis|postgres` env var
3. Switch implementation based on env var
4. No middleware changes required

## Metrics to Track
- Rate limit hits per tier (anonymous, free, premium)
- Store operation latency (increment, get)
- Cleanup job execution time
- Number of active rate limit keys

## References
- [RFC 6585: Additional HTTP Status Codes](https://tools.ietf.org/html/rfc6585#section-4)
- [Cloudflare IP Headers](https://developers.cloudflare.com/fundamentals/get-started/reference/http-request-headers/)

