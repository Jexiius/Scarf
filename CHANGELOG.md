# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### Rate Limiting
- Production-ready rate limiting with shared PostgreSQL store
- Support for multiple rate limit tiers (anonymous, free, premium)
- Proper IP resolution prioritizing trusted proxy headers
- Automatic cleanup of expired rate limit entries
- Structured logging for rate limit events
- See `docs/adr-rate-limiting.md` and `docs/rate-limiting-runbook.md`

#### Monitoring API Security
- Admin-only access control for `/api/v1/monitoring` endpoint
- Multiple access methods: JWT admin flag, email allowlist, IP allowlist, service tokens
- Development mode bypass for easier testing
- See `docs/monitoring-access-policy.md`

#### Database Security
- SSL certificate validation enabled by default in production
- Support for CA certificate files and inline certificates
- Enhanced connection testing with SSL verification
- Provider-specific configuration guides
- See `docs/database-ssl-configuration.md`

#### Queue Worker Health
- Automatic recovery for stuck tasks (configurable timeout)
- Structured logging throughout all workers
- Periodic recovery checks (every 5 minutes)
- Configurable task timeout via `QUEUE_TASK_TIMEOUT_MS`
- See `docs/queue-health-runbook.md`

#### Third-Party API Resilience
- Circuit breakers for OpenAI and Google Places API calls
- Retry logic with exponential backoff
- Graceful fallbacks (query parser falls back to keyword extraction)
- Structured logging for all third-party calls

#### Search Performance
- Geospatial filtering using PostgreSQL earthdistance extension
- SQL-level filtering for price, cuisine, and radius
- Pagination support (cursor-based and offset)
- Database indexes for common query patterns
- See migration `008_add_geospatial_indexes.sql`

#### API Response Normalization
- DTO mappers for consistent API responses
- Automatic decimal-to-number conversion
- Stripped internal fields (isActive, modelVersion, etc.)
- Consistent field naming across all endpoints
- See `src/mappers/` directory

### Changed

#### Breaking Changes
- **Rate Limiting**: Rate limits are now enforced across all API instances. Previously, each instance had separate limits.
- **Monitoring API**: Now requires admin access. Previously only required authentication.
- **Database SSL**: Certificate validation is now enabled by default in production. Previously was disabled.

#### Non-Breaking Changes
- All `console.log` statements replaced with structured logging (Pino)
- Search queries now filter at SQL level instead of in-memory
- API responses now use consistent DTO format
- Queue workers automatically recover stuck tasks

### Fixed

- Rate limiting header spoofing vulnerability (removed `x-request-id` from identifier resolution)
- Database SSL certificate validation was disabled even when `DATABASE_SSL=require`
- Queue tasks could get stuck indefinitely if worker crashed
- Search performance degraded with large restaurant datasets (now uses SQL filtering)

### Security

- Rate limiting now uses shared store (prevents bypass across instances)
- Monitoring API access restricted to authorized operators
- Database connections validate SSL certificates in production
- Proper IP resolution prevents header spoofing attacks

## Migration Guide

### Rate Limiting

No migration needed. The new rate limiting system is backward compatible. However, rate limits are now shared across instances, so users may experience different behavior if hitting multiple instances.

### Monitoring API

To access the monitoring API, configure one of the following:
1. Add `isAdmin: true` to JWT payload for admin users
2. Set `MONITORING_ADMIN_EMAILS` environment variable
3. Set `MONITORING_ALLOWED_IPS` environment variable
4. Set `MONITORING_SERVICE_TOKEN` environment variable

See `docs/monitoring-access-policy.md` for details.

### Database SSL

If using a managed database provider:
1. Set `DATABASE_SSL=require`
2. If using custom CA, set `DATABASE_CA_PATH` or `DATABASE_CA`
3. Test connection: `npm run db:test:prod`

See `docs/database-ssl-configuration.md` for provider-specific instructions.

### Search API

Search now supports pagination:
- Use `cursor` parameter for cursor-based pagination (recommended)
- Use `offset` parameter for offset-based pagination
- Response includes `nextCursor` in `meta` when more results available

Example:
```json
{
  "query": "romantic Italian restaurant",
  "latitude": 40.7589,
  "longitude": -73.9851,
  "radiusMiles": 5,
  "limit": 10,
  "cursor": "previous-page-last-restaurant-id"
}
```

### API Response Format

API responses now use consistent DTO format. All decimal values are converted to numbers, and internal fields are stripped. No breaking changes for clients, but response structure is more consistent.

## Upgrade Instructions

1. **Run new migrations:**
   ```bash
   npm run migrate
   ```
   This will create the `rate_limits` table and add geospatial indexes.

2. **Update environment variables:**
   - Add `QUEUE_TASK_TIMEOUT_MS` if you want to customize task timeout (optional)
   - Configure monitoring access (see `docs/monitoring-access-policy.md`)
   - Configure database SSL (see `docs/database-ssl-configuration.md`)

3. **Deploy and test:**
   - Verify rate limiting works across instances
   - Test monitoring API access
   - Verify database SSL connection
   - Test search with pagination

4. **Set up cleanup job:**
   - Schedule `npm run cleanup:rate-limits` to run every 5 minutes

## References

- [Backend Hardening Roadmap](./docs/backend-hardening-roadmap.md)
- [Rate Limiting ADR](./docs/adr-rate-limiting.md)
- [Rate Limiting Runbook](./docs/rate-limiting-runbook.md)
- [Monitoring Access Policy](./docs/monitoring-access-policy.md)
- [Database SSL Configuration](./docs/database-ssl-configuration.md)
- [Queue Health Runbook](./docs/queue-health-runbook.md)

