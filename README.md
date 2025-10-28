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
