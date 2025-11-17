# Rate Limiting Runbook

## Overview

The rate limiting system uses a shared PostgreSQL store to enforce limits across all API instances. This prevents attackers from bypassing limits by hitting different instances.

## Architecture

- **Store**: PostgreSQL `rate_limits` table
- **Strategy**: Fixed window (resets after window expires)
- **Key Format**: `user:{userId}` for authenticated users, `ip:{ipAddress}` for anonymous
- **Cleanup**: Expired entries are cleaned up periodically

## Rate Limit Tiers

| Tier | Limit | Window |
|------|-------|--------|
| Anonymous | 30 requests | 1 hour |
| Free | 120 requests | 1 hour |
| Premium | 1200 requests | 1 hour |

## Configuration

### Environment Variables

No additional environment variables required. Rate limiting uses the existing `DATABASE_URL`.

### Tuning Limits

To adjust limits per environment, modify the middleware configuration in `src/middleware/rate-limit.ts`:

```typescript
const DEFAULT_OPTIONS: RateLimiterOptions = {
  windowMs: 60 * 60 * 1000, // 1 hour
  tiers: {
    anonymous: 30,   // Adjust as needed
    free: 120,       // Adjust as needed
    premium: 1200,   // Adjust as needed
  },
};
```

Or pass custom options when initializing:

```typescript
app.use('*', rateLimiter({
  windowMs: 30 * 60 * 1000, // 30 minutes
  tiers: {
    anonymous: 50,
    free: 200,
    premium: 2000,
  },
}));
```

## Monitoring

### Metrics to Track

1. **Rate Limit Hits**: Count of 429 responses per tier
   ```sql
   SELECT COUNT(*) FROM rate_limits WHERE count > limit;
   ```

2. **Active Rate Limits**: Number of active rate limit entries
   ```sql
   SELECT COUNT(*) FROM rate_limits WHERE reset_at > NOW();
   ```

3. **Store Operation Latency**: Monitor database query performance for `rate_limits` table

### Log Queries

Rate limit hits are logged with structured logging:

```json
{
  "level": "warn",
  "msg": "Rate limit exceeded",
  "identifier": "ip:1.2.3.4",
  "limitTier": "anonymous",
  "count": 31,
  "limit": 30,
  "path": "/api/search",
  "method": "POST"
}
```

Search logs for rate limit events:
```bash
# Count rate limit hits
grep "Rate limit exceeded" logs.json | jq '.identifier' | sort | uniq -c

# Find top offenders
grep "Rate limit exceeded" logs.json | jq -r '.identifier' | sort | uniq -c | sort -rn | head -10
```

## Maintenance

### Cleanup Expired Entries

Run the cleanup script periodically to prevent table bloat:

```bash
npm run cleanup:rate-limits
```

**Recommended Schedule**: Every 5 minutes

**Cron Example**:
```cron
*/5 * * * * cd /app && npm run cleanup:rate-limits
```

Or use a process manager like PM2 with a cron job:
```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'rate-limit-cleanup',
      script: 'npm',
      args: 'run cleanup:rate-limits',
      cron_restart: '*/5 * * * *',
      autorestart: false,
    },
  ],
};
```

### Manual Cleanup

To manually clean up expired entries:

```sql
DELETE FROM rate_limits WHERE reset_at < NOW();
```

### Reset a Specific Rate Limit

To reset a rate limit for a specific user or IP:

```sql
DELETE FROM rate_limits WHERE key = 'user:user-id-here';
-- or
DELETE FROM rate_limits WHERE key = 'ip:1.2.3.4';
```

## Troubleshooting

### High Database Load

If rate limiting is causing high database load:

1. **Check Index Usage**: Ensure `idx_rate_limits_reset_at` is being used
   ```sql
   EXPLAIN ANALYZE SELECT * FROM rate_limits WHERE reset_at < NOW();
   ```

2. **Increase Cleanup Frequency**: Run cleanup more often (every 1-2 minutes)

3. **Consider Redis Migration**: For very high traffic, consider migrating to Redis (see ADR)

### Rate Limits Not Working Across Instances

1. **Verify Database Connection**: Ensure all instances connect to the same database
2. **Check Migration**: Ensure migration `007_create_rate_limits.sql` has been run
3. **Verify Store**: Check that `getRateLimitStore()` returns the same instance type

### False Positives (Legitimate Users Getting Blocked)

1. **Check IP Resolution**: Verify proxy headers are being set correctly
2. **Review Logs**: Check if multiple users are sharing the same IP (NAT, corporate proxy)
3. **Consider Whitelisting**: Add IP whitelist for known good actors

### Store Operation Failures

If store operations are failing:

1. **Check Database Connection**: Verify database is accessible
2. **Review Error Logs**: Check for database connection errors
3. **Fail-Open Behavior**: The system fails open (allows requests) on store errors to prevent API outages

## Migration to Redis (Future)

When ready to optimize for higher scale:

1. Implement `RedisRateLimitStore` implementing the same `RateLimitStore` interface
2. Add `RATE_LIMIT_STORE=redis|postgres` environment variable
3. Update `getRateLimitStore()` to return the appropriate implementation
4. No middleware changes required

See `docs/adr-rate-limiting.md` for details.

## Testing

### Unit Tests

```bash
npm test tests/unit/rate-limit.test.ts
```

### Integration Tests

Test with multiple instances:

1. Start two API instances
2. Make requests from the same IP to both instances
3. Verify that limits are enforced across instances

### Load Testing

Use a tool like `k6` or `artillery` to test rate limiting:

```javascript
// k6 script
import http from 'k6/http';

export default function () {
  const res = http.get('http://api.example.com/api/search');
  if (res.status === 429) {
    console.log('Rate limited');
  }
}
```

## References

- [ADR: Production Rate Limiting](./adr-rate-limiting.md)
- [RFC 6585: Additional HTTP Status Codes](https://tools.ietf.org/html/rfc6585#section-4)

