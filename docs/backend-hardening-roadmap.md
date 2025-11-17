# Backend Hardening & Expansion Roadmap

This document converts the latest backend review into actionable initiatives. Treat each section as a self-contained effort that can be tackled by a junior engineer with light guidance. Focus on understanding the intent before writing code, and keep architectural decisions documented alongside PRs.

---

## 1. Rate Limiting That Works in Production
**Goal:** prevent abuse across all API instances without letting attackers reset their quota.

- Audit the current in-memory limiter (`src/middleware/rate-limit.ts`). Document how it relies on `Map` and spoofable headers.  
- Select a shared store (Redis is ideal; Postgres can work in a pinch). Capture required keys, TTLs, and metrics.  
- Redesign the middleware to:
  - Key authenticated users by `user.id`.
  - Key anonymous callers by IP-derived identity (fall back to `cf-connecting-ip`/`x-real-ip`, never to user-controlled headers first).
  - Store counters + window metadata centrally so every instance enforces the same limits.
- Add structured logging around limit hits and expose headers consistently.
- Provide a short runbook for tuning tiers per environment.

Deliverables: ADR or short design doc, updated middleware, regression tests that simulate multiple instances, and metrics (log or Prometheus counters) for ops.

---

## 2. Lock Down the Monitoring API
**Goal:** keep queue health and data-quality dashboards internal.

- Identify the sensitivity of `/api/v1/monitoring` output (queue lengths, confidence scores, etc.).  
- Decide on an access policy: either JWT role claim (e.g., `isAdmin`), an environment allowlist, or service-to-service tokens.  
- Update the auth middleware/route to enforce the policy and document expected headers/claims.
- Add tests verifying unauthorized users receive 403 and authorized operators can still read the dashboard.
- Update docs/runbooks describing how operators authenticate in prod (e.g., via CLI, dashboard).

Deliverables: policy description, code changes, automated tests, README snippet for ops.

---

## 3. Make Search Scale
**Goal:** avoid loading the entire restaurant table on each query.

- Map the current flow (query parser → repo → scoring). Quantify how many restaurants are fetched and why filters are applied in memory.  
- Collaborate with the data layer to push filters to SQL:
  - Add price/cuisine/radius predicates to the Drizzle query.
  - Introduce pagination parameters (cursor or offset/limit) so the API can stream results.
  - Consider geospatial helpers (Postgres `cube`/`earthdistance` or haversine in SQL) to sort by distance before hitting Node.
- Update repositories to return typed DTOs instead of raw Drizzle rows. Normalize decimals to numbers.
- Extend tests (unit + integration) to cover pagination and radius filtering.

Deliverables: design notes, repository/query updates, DTO mappers, benchmarks comparing before/after latency.

---

## 4. Normalize API Responses
**Goal:** expose consistent, client-friendly payloads.

- Inventory every route returning raw DB rows (`restaurants`, `users/me/saved`, search results, etc.). Note fields that should stay internal (`isActive`, `modelVersion`, timestamps in PG `string` form).
- Create mapper utilities that:
  - Convert decimals to numbers.
  - Rename fields to the camelCase / snake_case the frontend expects.
  - Strip server-only flags.
  - Present restaurant features in the same shape everywhere.
- Refactor routers to use these mappers and add unit tests that lock down the schemas.
- Update API docs (`docs/api.md` + README summaries) to reflect the cleaned responses.

Deliverables: mapper module(s), router updates, tests, refreshed documentation.

---

## 5. Harden Database Connectivity
**Goal:** ensure TLS validation in production and flexible config in dev.

- Document the current SSL behavior (`src/config/database.ts`). Highlight the implicit `rejectUnauthorized: false`.
- Implement environment-driven options:
  - `DATABASE_SSL=require` → `ssl: { rejectUnauthorized: true, ca?: ... }`.
  - `DATABASE_SSL=disable` → no SSL (dev only).
  - Default production behavior should validate certs unless explicitly disabled.
- Allow specifying CA bundles via file path or env var (coordinate with DevOps).
- Add a smoke test (`npm run db:test:prod`) that fails loudly when SSL negotiation breaks.

Deliverables: config changes, migration instructions, updated README section on database security.

---

## 6. Keep Queue Workers Healthy
**Goal:** prevent stuck tasks and improve observability.

- Review queue lifecycle in `QueueRepository`. Note unused helpers (`getStuckTasks`, `resetStuckTasks`).
- Decide on a timeout (e.g., 15–30 min). Implement automatic recovery:
  - Option A: Worker loop calls `resetStuckTasks` every few minutes.
  - Option B: `claimNextTask` treats stale `startedAt` rows as eligible.
- Replace `console.log` with the shared Pino logger (pass a child logger with `taskId`, `restaurantId`).
- Emit metrics/logs for task transitions, retries, and external API failures (OpenAI, Google Places).
- Expand tests/mocks so queue failure paths are covered.

Deliverables: worker updates, logging improvements, runbook describing how to monitor and manually reset tasks if needed.

---

## 7. Guard Third-Party Calls
**Goal:** stop OpenAI/Google hiccups from cascading.

- Introduce circuit breakers or retry policies around OpenAI (feature extraction + query parsing) and Google Places (review scraper).  
- Define per-plan budgets (e.g., free vs. premium users) and document fallback behavior when quotas are exhausted.
- Add structured error handling so failures degrade gracefully (use stub parser, queue retry with exponential backoff, etc.).
- Capture metrics (success/failure counts, latency) for each provider.

Deliverables: resilience strategy doc, updated services/workers, dashboards or log queries for monitoring upstream health.

---

## 8. Testing & Documentation Pass
**Goal:** keep confidence high as the backend evolves.

- Expand automated tests to cover:
  - Middleware (rate limiter, security headers).
  - Monitoring authorization.
  - Queue recovery logic.
  - DTO mappers and response schemas.
  - Edge cases for search pagination and OpenAI fallbacks.
- Refresh README/testing sections with any new commands or env vars.
- Maintain a changelog entry summarizing these initiatives for the frontend/ops teams.

Deliverables: new/updated tests, documentation updates, and a short summary for release notes.

---

## Execution Tips
- Work in feature branches per initiative; keep PRs focused.
- Log exploratory findings (metrics, traces) in the PR description so future engineers understand trade-offs.
- When blocked (e.g., needing Redis/Secrets), document assumptions and raise the dependency early.
- Pair with senior engineers on the first iteration of each theme, then update this roadmap with lessons learned.

