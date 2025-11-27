# Monitoring API Access Policy

## Overview

The `/api/v1/monitoring` endpoint exposes sensitive operational data including:
- Queue statistics (pending, processing, failed tasks)
- Data quality metrics (confidence scores, review counts)
- Low-confidence restaurant samples
- System health indicators

This endpoint is restricted to authorized operators only.

## Access Methods

Access is granted if **ANY** of the following conditions are met. JWT-based paths require the request to include a valid bearer token (handled by the global `auth` middleware). Service-token/IP paths can be used without a JWT.

### 1. JWT Admin Flag

Users with `isAdmin: true` in their JWT payload can access monitoring endpoints.

**How to grant:**
- Add the operator's email to `MONITORING_ADMIN_EMAILS` (tokens automatically include `isAdmin: true` when issued to an allowlisted email), or update the JWT token generation to include `isAdmin: true` for admin users via another mechanism.
- Example payload:
  ```json
  {
    "id": "user-uuid",
    "email": "admin@example.com",
    "subscriptionTier": "premium",
    "isAdmin": true
  }
  ```

### 2. Email Allowlist

Users with emails in the `MONITORING_ADMIN_EMAILS` environment variable can access monitoring.

**Configuration:**
```bash
MONITORING_ADMIN_EMAILS=admin@example.com,ops@example.com,devops@example.com
```

**Note:** User must still be authenticated (valid JWT token).

### 3. IP Allowlist

Requests from IP addresses in the `MONITORING_ALLOWED_IPS` environment variable can access monitoring.

**Configuration:**
```bash
# Single IPs
MONITORING_ALLOWED_IPS=192.168.1.100,10.0.0.50

# CIDR blocks (supports /8, /16, /24)
MONITORING_ALLOWED_IPS=192.168.1.0/24,10.0.0.0/16
```

**Note:** IP resolution uses trusted proxy headers (`cf-connecting-ip`, `x-real-ip`). If behind a proxy, ensure these headers are set correctly. This method does not require a JWT.

### 4. Service Token

Requests with a valid `X-Monitoring-Token` header matching `MONITORING_SERVICE_TOKEN` can access monitoring.

**Configuration:**
```bash
MONITORING_SERVICE_TOKEN=your-secure-random-token-here
```

**Usage:**
```bash
curl -H "X-Monitoring-Token: your-secure-random-token-here" \
     https://api.example.com/api/v1/monitoring
```

**Security Note:** Use a strong, randomly generated token. Store it securely (e.g., in a secrets manager). This method does not require a JWT.

## Development Mode

In development (`NODE_ENV=development`), monitoring access is **always granted** for easier testing. This bypass is logged at debug level.

## Access Flow

1. Requests pass through the standard `auth` middleware so JWTs can be decoded if present.
2. `requireAdmin` then evaluates the four access paths. Service-token/IP checks run even when no JWT is supplied.
3. If any access method matches, the request proceeds; otherwise a 403 is returned.

## Example Usage

### Using JWT with Admin Flag

```bash
curl -H "Authorization: Bearer <jwt-token-with-isAdmin-true>" \
     https://api.example.com/api/v1/monitoring
```

### Using Service Token (no JWT required)

```bash
curl -H "X-Monitoring-Token: <service-token>" \
     https://api.example.com/api/v1/monitoring
```

### Using Email Allowlist

```bash
# User must be authenticated with JWT
# Email in JWT must match MONITORING_ADMIN_EMAILS
curl -H "Authorization: Bearer <jwt-token>" \
     https://api.example.com/api/v1/monitoring
```

## Security Considerations

1. **Rotate Service Tokens**: Regularly rotate `MONITORING_SERVICE_TOKEN`
2. **Limit IP Ranges**: Use specific IPs or small CIDR blocks, not `0.0.0.0/0`
3. **Audit Access**: Monitor logs for monitoring endpoint access
4. **HTTPS Only**: Always use HTTPS in production
5. **Rate Limiting**: Monitoring endpoints should have stricter rate limits (future enhancement)

## Logging

All access attempts (granted and denied) are logged:

**Granted:**
```json
{
  "level": "debug",
  "msg": "Monitoring access granted via JWT admin flag",
  "userId": "user-uuid",
  "email": "admin@example.com"
}
```

**Denied:**
```json
{
  "level": "warn",
  "msg": "Monitoring access denied",
  "userId": "user-uuid",
  "email": "user@example.com",
  "clientIp": "1.2.3.4",
  "path": "/api/v1/monitoring",
  "method": "GET"
}
```

## Troubleshooting

### Getting 403 Forbidden

1. **Check Authentication**: Ensure JWT token is valid
2. **Check Admin Flag**: Verify `isAdmin: true` in JWT payload (if using method 1)
3. **Check Email**: Verify email matches `MONITORING_ADMIN_EMAILS` (if using method 2)
4. **Check IP**: Verify client IP matches `MONITORING_ALLOWED_IPS` (if using method 3; JWT optional)
5. **Check Token**: Verify `X-Monitoring-Token` header matches `MONITORING_SERVICE_TOKEN` (if using method 4; JWT optional)
6. **Check Environment**: Verify environment variables are set correctly
7. **Check Logs**: Review logs for specific denial reason

### IP Not Matching

- Ensure proxy headers (`cf-connecting-ip`, `x-real-ip`) are set correctly
- Verify IP format (no spaces, correct CIDR notation)
- Check if behind multiple proxies (may need to adjust header priority)

## Migration from Previous Version

Previously, monitoring required only authentication (`requireAuth`). Now all requests must satisfy one of the access methods listed above.

**To migrate existing users:**
1. Add their emails to `MONITORING_ADMIN_EMAILS`, OR
2. Update JWT generation to include `isAdmin: true` for admin users (JWT path), OR
3. Add their IPs to `MONITORING_ALLOWED_IPS`, OR
4. Issue and distribute a service token (`MONITORING_SERVICE_TOKEN`)

## References

- [Middleware Implementation](../src/middleware/require-admin.ts)
- [Monitoring Route](../src/routes/monitoring.ts)
