# Scarf Backend

Natural language restaurant recommendation system backend implemented with Node.js, TypeScript, Hono, and Drizzle ORM.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and update values.
3. Run database migrations:
   ```bash
   npm run migrate
   ```
4. Seed development data (optional but helpful for Phase 1 testing):
   ```bash
   npm run seed
   ```
5. Start the development server:
   ```bash
   npm run dev
   ```

The API exposes:

- `GET /health` – health check
- `POST /api/v1/auth/register` – create an account
- `POST /api/v1/auth/login` – obtain a JWT
- `GET /api/v1/users/me` – authenticated profile details
- `GET|POST|DELETE /api/v1/users/me/saved` – manage saved restaurants
- `GET /api/v1/users/me/queries` – view recent search activity
- `POST /api/v1/search` – natural language search
- `GET /api/v1/restaurants/:id` – restaurant details

See `docs/api.md` for request and response examples.

## Environment Configuration

- `NODE_ENV`, `PORT`, `DATABASE_URL`, `OPENAI_API_KEY`, and `JWT_SECRET` are required for production. `JWT_SECRET` must be at least 32 characters long.
- Optional flags:
  - `DATABASE_SSL`: set to `require` when connecting to managed Postgres instances that mandate TLS. See `docs/database-ssl-configuration.md` for CA/SSL guidance.
  - `DATABASE_CA_PATH`/`DATABASE_CA`: provide CA bundles when your provider issues custom certificates.
  - `DATABASE_SSL_REJECT_UNAUTHORIZED`: set to `false` only in development when working with self-signed certs.
  - `LOG_LEVEL`: `fatal`, `error`, `warn`, `info`, `debug`, `trace`, or `silent` (defaults to `info`).
  - `MONITORING_ADMIN_EMAILS`, `MONITORING_ALLOWED_IPS`, `MONITORING_SERVICE_TOKEN`: configure access paths for `/api/v1/monitoring` (see `docs/monitoring-access-policy.md`).
  - `FEATURE_EXTRACTION_CONCURRENCY` and `FEATURE_EXTRACTOR_BATCH_SIZE` control worker throughput and are bounded to safe values.
  - `QUEUE_TASK_TIMEOUT_MS`: timeout for queue tasks before they're considered stuck (default: 30 minutes).
- Populate `.env` locally or supply variables through your orchestrator/secrets manager. For ad-hoc overrides, point `DOTENV_PATH` to a specific file.

## Production Deployment

1. Build the TypeScript bundle:
   ```bash
   npm run build
   ```
2. Run migrations against the production database:
   ```bash
   npm run migrate:prod
   ```
3. Start the server:
   ```bash
   NODE_ENV=production node dist/server.js
   ```

### Docker

Build and run the containerised API:

```bash
docker build -t scarf-api .
docker run --env-file .env -p 3000:3000 scarf-api




The container entrypoint runs migrations on startup before launching the server. Ensure the environment file contains the production connection string and secrets.

## Testing

### Unit and Integration Tests

```bash
npm test
```

Unit tests currently cover the scoring service. Set `USE_QUERY_PARSER_STUB=true` to exercise the search flow without calling OpenAI.

### End-to-End Testing

End-to-end tests can be run against any environment (local or Railway):

```bash
# Test against local server (default)
npm run test:e2e

# Test against Railway server - set URL inline
RAILWAY_URL=https://scarf-production.up.railway.app npm run test:railway

# Or set TEST_BASE_URL directly
TEST_BASE_URL=https://scarf-production.up.railway.app npm run test:e2e

# Or export it in your shell session (persists for multiple commands)
export RAILWAY_URL=https://scarf-production.up.railway.app
npm run test:railway
```

The E2E test suite (`tests/e2e/railway.test.ts`) covers:
- Health check endpoint
- User authentication (register/login)
- Protected routes
- Search functionality
- Restaurant endpoints
- Saved restaurants management
- Query history
- Error handling and validation

### Manual Server Testing

For quick manual testing of your Railway server:

```bash
# Test against local server
npm run test:server

# Test against Railway server - set URL inline
RAILWAY_URL=https://scarf-production.up.railway.app npm run test:server

# Or pass URL as command-line argument
npm run test:server https://scarf-production.up.railway.app

# Or export it in your shell session
export RAILWAY_URL=https://scarf-production.up.railway.app
npm run test:server
```

This script provides colored output and tests key endpoints interactively.

### Health Check

Quick health check for monitoring or CI/CD:

```bash
# Check local server
npm run health:check

# Check Railway server - set URL inline
RAILWAY_URL=https://scarf-production.up.railway.app npm run health:check

# Or pass URL as command-line argument
npm run health:check https://scarf-production.up.railway.app

# Or export it in your shell session
export RAILWAY_URL=https://scarf-production.up.railway.app
npm run health:check
```

The health check script returns exit code 0 on success and 1 on failure, making it suitable for automated monitoring.

### Operational Scripts

- `npm run cleanup:rate-limits` – purge expired entries from the shared rate limit store (schedule every few minutes in production).

## Operations & Runbooks

- **Rate Limiting** – Architecture, tuning guidance, and cleanup instructions live in `docs/adr-rate-limiting.md` and `docs/rate-limiting-runbook.md`.
- **Monitoring Access** – Authentication paths (JWT flag, email/IP allowlists, service token) are described in `docs/monitoring-access-policy.md`.
- **Database SSL** – Provider-specific TLS setup details are in `docs/database-ssl-configuration.md`.
- **Queue Workers** – Health checks, stuck-task recovery, and worker lifecycle guidance lives in `docs/queue-health-runbook.md`.

## Recent Improvements

### Backend Hardening (Latest Release)

This release includes significant improvements to security, reliability, and scalability:

**Security:**
- ✅ Production-ready rate limiting with shared PostgreSQL store (prevents bypass across instances)
- ✅ Monitoring API access control (JWT admin flag, email/IP allowlists, service tokens)
- ✅ Database SSL certificate validation enabled by default in production

**Reliability:**
- ✅ Circuit breakers and retry logic for OpenAI and Google Places API calls
- ✅ Automatic recovery for stuck queue tasks
- ✅ Structured logging throughout (replaced all `console.log` with Pino)

**Performance:**
- ✅ Geospatial search with SQL-level filtering (earthdistance extension)
- ✅ Pagination support (cursor-based and offset)
- ✅ Normalized API responses with DTO mappers

See `docs/backend-hardening-roadmap.md` for detailed implementation notes and `CHANGELOG.md` for a complete list of changes.

## Tooling

- Runtime: Node.js 20+
- Framework: Hono
- ORM: Drizzle ORM (PostgreSQL)
- Validation: Zod
- Testing: Vitest

## Security & Maintenance

- Hardened response headers are applied globally (HSTS is only enabled when `NODE_ENV=production`).
- Run `npm run security:audit` regularly to check third-party dependencies for known vulnerabilities.
- Keep JWT secrets and API keys outside of version control. Rotate them as part of routine compliance.
