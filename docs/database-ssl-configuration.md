# Database SSL Configuration Guide

## Overview

The database connection now enforces SSL certificate validation in production by default. This prevents man-in-the-middle attacks and ensures secure connections to your database.

## Security Defaults

- **Production**: SSL with certificate validation enabled (`rejectUnauthorized: true`)
- **Development**: SSL optional, certificate validation can be disabled for self-signed certs

## Configuration

### Environment Variables

#### `DATABASE_SSL`

Controls whether SSL is used for database connections.

- `require`: Enable SSL (default in production)
- `disable`: Disable SSL (not recommended in production)

**Example:**
```bash
DATABASE_SSL=require
```

#### `DATABASE_CA_PATH`

Path to a CA certificate file for validating the database server's certificate.

**Example:**
```bash
DATABASE_CA_PATH=/path/to/ca-certificate.crt
```

**Use Case:** When using a custom CA or self-signed certificate.

#### `DATABASE_CA`

Inline CA certificate content (alternative to `DATABASE_CA_PATH`).

**Example:**
```bash
DATABASE_CA="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
```

**Use Case:** Containerized deployments where mounting files is difficult.

#### `DATABASE_SSL_REJECT_UNAUTHORIZED`

Controls certificate validation. **Only works in development mode.**

- `true`: Validate certificates (default)
- `false`: Skip certificate validation (development only)

**Warning:** Setting this to `false` in production will cause the application to fail to start.

**Example (development only):**
```bash
DATABASE_SSL_REJECT_UNAUTHORIZED=false
```

## Provider-Specific Configuration

### Railway

Railway provides SSL certificates automatically. No additional configuration needed.

```bash
DATABASE_SSL=require
```

### Supabase

Supabase requires downloading their CA certificate.

1. Download the certificate:
   ```bash
   curl -o supabase-ca.crt https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler-ssl
   ```

2. Configure:
   ```bash
   DATABASE_SSL=require
   DATABASE_CA_PATH=./supabase-ca.crt
   ```

### AWS RDS

AWS RDS uses Amazon RDS CA certificates.

1. Download the certificate:
   ```bash
   curl -o rds-ca-2019-root.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
   ```

2. Configure:
   ```bash
   DATABASE_SSL=require
   DATABASE_CA_PATH=./rds-ca-2019-root.pem
   ```

### Google Cloud SQL

Google Cloud SQL provides certificates via the Cloud SQL Proxy or requires downloading the server CA certificate.

**Option 1: Using Cloud SQL Proxy (Recommended)**
```bash
DATABASE_SSL=disable  # Proxy handles SSL
```

**Option 2: Direct Connection with Certificate**
```bash
DATABASE_SSL=require
DATABASE_CA_PATH=/path/to/server-ca.pem
```

### Self-Signed Certificates (Development Only)

For local development with self-signed certificates:

```bash
NODE_ENV=development
DATABASE_SSL=require
DATABASE_SSL_REJECT_UNAUTHORIZED=false
```

**Warning:** Never use this in production.

## Testing SSL Configuration

### Test Connection

```bash
npm run db:test:prod
```

This will:
1. Connect to the database
2. Verify SSL handshake
3. Validate certificate (if enabled)
4. Report any SSL-related errors

### Common Errors

#### `self signed certificate`

**Cause:** Using a self-signed certificate without disabling validation.

**Solution (development only):**
```bash
DATABASE_SSL_REJECT_UNAUTHORIZED=false
```

**Solution (production):** Provide the CA certificate via `DATABASE_CA_PATH` or `DATABASE_CA`.

#### `certificate has expired`

**Cause:** The database server's certificate has expired.

**Solution:** Contact your database provider to renew the certificate.

#### `unable to verify the first certificate`

**Cause:** The CA certificate is missing or incorrect.

**Solution:** 
1. Download the correct CA certificate from your provider
2. Set `DATABASE_CA_PATH` or `DATABASE_CA`
3. Verify the certificate matches your database provider

#### `ECONNREFUSED` or connection timeout

**Cause:** SSL might be required but the connection string doesn't specify it, or firewall blocking.

**Solution:**
1. Check if `DATABASE_SSL=require` is set
2. Verify database allows SSL connections
3. Check firewall rules

## Migration from Previous Version

### Before (Insecure)

```typescript
// Old code always set rejectUnauthorized: false
ssl: { rejectUnauthorized: false }
```

### After (Secure)

```typescript
// New code validates certificates by default
ssl: { rejectUnauthorized: true, ca?: ... }
```

### Migration Steps

1. **Identify your database provider** (Railway, Supabase, AWS RDS, etc.)

2. **Set SSL mode:**
   ```bash
   DATABASE_SSL=require
   ```

3. **If using a custom CA, download and configure:**
   ```bash
   DATABASE_CA_PATH=/path/to/ca-certificate.crt
   ```

4. **Test the connection:**
   ```bash
   npm run db:test:prod
   ```

5. **If connection fails:**
   - Check error message
   - Verify CA certificate is correct
   - For development with self-signed certs, use `DATABASE_SSL_REJECT_UNAUTHORIZED=false` (dev only)

## Security Best Practices

1. **Always use SSL in production** - Set `DATABASE_SSL=require`

2. **Validate certificates** - Never disable `rejectUnauthorized` in production

3. **Use CA certificates** - Provide CA certificates for custom/self-signed certs

4. **Rotate certificates** - Keep database certificates up to date

5. **Monitor connections** - Log SSL connection failures for security monitoring

6. **Use connection pooling** - Already configured in the codebase

## Troubleshooting

### Check Current SSL Configuration

The application logs SSL configuration at startup (debug level):

```json
{
  "level": "info",
  "msg": "Loaded database CA certificate from file",
  "caPath": "/path/to/ca.crt"
}
```

### Verify SSL is Working

Connect to the database and check:

```sql
SHOW ssl;
-- Should return 'on'

SELECT * FROM pg_stat_ssl;
-- Shows SSL connection statistics
```

### Connection String SSL Parameters

Some providers include SSL parameters in the connection string. The code handles this, but you can also set:

```
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
```

The `DATABASE_SSL` environment variable takes precedence over connection string parameters.

## References

- [PostgreSQL SSL Documentation](https://www.postgresql.org/docs/current/ssl-tcp.html)
- [Node.js pg SSL Options](https://node-postgres.com/features/ssl)
- [Railway Database SSL](https://docs.railway.app/databases/postgresql#ssl-connections)
- [Supabase SSL Connection](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler-ssl)

