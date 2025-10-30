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
  - `DATABASE_SSL`: set to `require` when connecting to managed Postgres instances that mandate TLS.
  - `LOG_LEVEL`: `fatal`, `error`, `warn`, `info`, `debug`, `trace`, or `silent` (defaults to `info`).
  - `FEATURE_EXTRACTION_CONCURRENCY` and `FEATURE_EXTRACTOR_BATCH_SIZE` control worker throughput and are bounded to safe values.
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

```bash
npm test
```

Unit tests currently cover the scoring service. Set `USE_QUERY_PARSER_STUB=true` to exercise the search flow without calling OpenAI.

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
