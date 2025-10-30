# Scarf Backend Roadmap (Phases 1 – 3)

This document captures everything implemented so far—from the initial API skeleton through the end of Phase 3’s feature-extraction pipeline—and explains how to run and operate each part of the system.

---

## 1. Project Overview

Scarf is a restaurant recommendation backend built with **Node.js 20 + TypeScript**, **Hono** for HTTP routing, and **Drizzle ORM** on **PostgreSQL**. The core value is surfacing restaurants that match nuanced, natural-language requests by blending LLM-powered query parsing, review understanding, and a traditional scoring pipeline.

The phases completed to date:

| Phase | Focus | Key Deliverables |
| ----- | ----- | ---------------- |
| **Phase 1 (Days 1 – 14)** | Core API & search | Hono app scaffold, query parsing with OpenAI, scoring service, `/api/v1/search` |
| **Phase 2 (Days 15 – 22)** | User accounts | JWT auth, saved restaurants CRUD, rate limiting, logging, error handling |
| **Phase 3 (Days 15 – 22)** | Real data pipeline | Google Places scraping, background queue, feature extraction with OpenAI, restaurant feature aggregation |

---

## 2. Repository Structure (Highlights)

```
src/
  app.ts / server.ts          -- Hono app + HTTP entry
  routes/                     -- REST endpoints (search, auth, saved restaurants, etc.)
  services/
    query-parser.service.ts   -- LLM query parsing
    search.service.ts         -- Search orchestration
    scoring.service.ts        -- Weighted restaurant scoring
    google-places.service.ts  -- Google Places wrapper with pagination
    feature-extraction.service.ts -- Review → feature LLM wrapper
    feature-aggregation.service.ts -- Aggregate per-restaurant feature scores
  repositories/               -- Database access layer
  workers/                    -- Queue workers (scrape, extract, aggregate)
  config/                     -- Environment, DB, OpenAI configuration
  db/                         -- Drizzle schema & migrations
docs/
  PHASE1to3.md                -- (this file)
  PHASE3_PIPELINE_README.md   -- Detailed pipeline quick-start
```

---

## 3. Environment & Setup

1. **Prerequisites**
   - Node.js 20+
   - PostgreSQL (local or managed) with extensions `uuid-ossp`, `cube`, `earthdistance`
   - Accounts/API keys:
     - OpenAI (`OPENAI_API_KEY`)
     - Google Places (`GOOGLE_PLACES_API_KEY`)

2. **Environment Variables**  
   Copy `.env.example` → `.env` and fill in values:
   ```ini
   DATABASE_URL=postgresql://user:password@host:5432/scarf
   OPENAI_API_KEY=sk-...
   GOOGLE_PLACES_API_KEY=AIza...
   JWT_SECRET=your-32-char-secret
   NODE_ENV=development
   PORT=3000
   ```

3. **Install & Migrate**
   ```bash
   npm install
   npm run migrate
   ```
   `npm run migrate` executes all SQL migrations (000–005) including schema additions for reviews, feature extractions, queue tables, and unique constraints required by the workers.

---

## 4. Phase-by-Phase Capabilities

### Phase 1 – Core Search Flow

- **Query Parsing** (`QueryParserService`): Calls OpenAI to transform natural-language text into weighted feature targets (romantic, cozy, etc.), with a rule-based fallback.
- **Search Orchestration** (`SearchService`):
  - Pulls restaurants + features via `RestaurantRepository`
  - Filters by price, cuisine, and distance (Earthdistance)
  - Scores matches using `ScoringService` (distance, rating, feature fit)
- **Route**: `POST /api/v1/search` accepts user location, query, filters, and returns sorted restaurant matches with explanations.

### Phase 2 – User Accounts & Persistence

- **Auth**: `/api/v1/auth/register` & `/api/v1/auth/login` using JWT; middleware for optional or required auth.
- **Saved Restaurants**: CRUD endpoints to manage user collections (`/api/v1/users/me/saved`).
- **User Queries**: Logging of parsed query, filters, results for analytics and personalization.
- **Rate Limiting & Logging**: Simple in-memory rate limiter and Pino-based request logging.

### Phase 3 – Data Pipeline & Feature Extraction

**Google Places Integration**
- `GooglePlacesService.searchRestaurants` now supports pagination (up to 3 pages / ~60 results) with `next_page_token`.
- `getPlaceDetails` fetches metadata, photos, hours, and top five reviews per restaurant.

**Processing Queue (`processing_queue` table)**
- Task types: `scrape_reviews`, `extract_features`, `aggregate_features`
- Unique constraint prevents multiple active tasks for the same restaurant/type.
- `QueueRepository` handles enqueueing, claiming with row locks, completion, retries, and stats.

**Workers**
- `npm run worker:scrape`: processes `scrape_reviews`
  - Upserts restaurant metadata
  - Inserts new reviews (skipping duplicates)
  - Queues `extract_features` if unprocessed reviews exist
- `npm run worker:extract`: processes `extract_features`
  - Batches reviews (`FEATURE_EXTRACTOR_BATCH_SIZE`)
  - Calls OpenAI via `FeatureExtractionService`, which uses the enhanced prompt with bullet-point guidance
  - Persists to `feature_extractions` (with cost/tokens), marks reviews processed, queues aggregation
  - Respects `FEATURE_EXTRACTION_CONCURRENCY`
- `npm run worker:aggregate`: processes `aggregate_features`
  - Aggregates review-level features into `restaurant_features`
  - Stores weighted averages, confidence score, review count, model version

**Seeding Workflow (`npm run seed:midtown`)**
- Coordinates around Times Square (40.758, -73.9855), radius 2,500 m.
- Uses paginated nearby search to fetch up to `TARGET_RESTAURANT_COUNT` results (default 100; limited by API to ~60 per call).
- Upserts restaurants, creates `scrape_reviews` tasks (priority 100) when no active job exists.
- Prints queue stats and prompts you to start the scraper worker.

---

## 5. Command Reference

| Command | Purpose |
| ------- | ------- |
| `npm run dev` | Start the Hono API server with live reload |
| `npm run build` | Type-check and transpile TypeScript |
| `npm test` | Run Vitest unit & integration suites |
| `npm run migrate` | Apply all SQL migrations in order |
| `npm run seed:midtown` | Seed Midtown NYC restaurants and enqueue scrape jobs |
| `npm run worker:scrape` | Background worker for `scrape_reviews` tasks |
| `npm run worker:extract` | Feature extraction worker |
| `npm run worker:aggregate` | Feature aggregation worker |

**Worker Tip:** Each worker keeps DB connections open. Add `await closePool()` in shutdown handlers (SIGINT/SIGTERM) if you want the terminal prompt to return immediately when stopping them.

---

## 6. Configuration Knobs & Defaults

| Setting | Where Defined | Default | Notes |
| ------- | ------------- | ------- | ----- |
| `TARGET_RESTAURANT_COUNT` | `seed-midtown-restaurants.ts` | 100 | Capped by Google Places pagination (~60 per search). Adjust for different datasets or run multiple seeds. |
| `SEARCH_RADIUS_METERS` | `seed-midtown-restaurants.ts` | 2,500 | Increase to widen the Midtown search radius. |
| `FEATURE_EXTRACTOR_BATCH_SIZE` | `FeatureExtractorWorker` | 25 | Override with env var to process more reviews per cycle. |
| `FEATURE_EXTRACTION_CONCURRENCY` | `FeatureExtractionService` | 3 | Controls parallel OpenAI calls. |
| `GooglePlacesService.rateLimitDelay` | service | 1 s (detail) / 2 s (pagination) | Adjust if you hit rate limits. |

Set environment variables (e.g., `export FEATURE_EXTRACTION_CONCURRENCY=6`) before running workers to override defaults.

---

## 7. Data Model Snapshot

- `restaurants`: base metadata; unique on `google_place_id`.
- `restaurant_features`: one-to-one with `restaurants`, 32 experiential feature columns, confidence, review count.
- `reviews`: raw review text, rating, source, processed flag.
- `feature_extractions`: per-review JSON feature map, confidence, model, prompt version, tokens, cost; unique on `review_id`.
- `processing_queue`: task scheduler with per-restaurant constraints.
- `users`, `saved_restaurants`, `user_queries`: authentication and personalization data.

Migrations 000–005 align the live schema with the TypeScript definitions.

---

## 8. Running the End-to-End Pipeline

1. **Seed**
   ```bash
   npm run seed:midtown
   ```
2. **Scrape Reviews** (Terminal A)
   ```bash
   npm run worker:scrape
   ```
3. **Extract Features** (Terminal B)
   ```bash
   npm run worker:extract
   ```
4. **Aggregate Features** (Terminal C)
   ```bash
   npm run worker:aggregate
   ```
5. **Inspect Results**
   ```sql
   SELECT COUNT(*) FROM feature_extractions;
   SELECT COUNT(*) FROM restaurant_features WHERE review_count_analyzed > 0;
   ```
6. **API Search Test**
   ```bash
   curl -X POST http://localhost:3000/api/v1/search \
     -H 'Content-Type: application/json' \
     -d '{"query":"romantic cozy dinner","latitude":40.758,"longitude":-73.9855,"radiusMiles":5,"limit":5}'
   ```

---

## 9. Troubleshooting & Tips

- **Worker idle immediately?** Check `processing_queue`—the task type might have no pending rows, or the scraper may not have added new reviews.
- **Duplicate task errors (23505)** happen when a pending job already exists. Use guarded `INSERT ... WHERE NOT EXISTS` or reset completed rows with a `NOT EXISTS` check.
- **“ON CONFLICT” errors**: ensure migrations 003–005 ran; `feature_extractions.review_id` must be unique.
- **Feature extractions missing columns**: run `npm run migrate` to pick up migration 004 (adds confidence, cost, timestamps).
- **Google API pagination**: Google requires ~2 s delay before a `next_page_token` is valid; the service handles this automatically.

---

## 10. Next Steps & Future Work

- Broaden seeding beyond Midtown, or schedule recurring scrapes by city.
- Add monitoring/analytics dashboards for queue depth, extraction cost, and success rates.
- Surface aggregated features in the search response for explainability.
- Implement feedback loops: use `user_queries` & `saved_restaurants` to personalize recommendations.
- Prepare for Phase 4: deployment automation, production-ready observability, mobile integration.

With these phases complete, you can move from synthetic data to real-world review understanding, keeping the entire review → feature → scoring pipeline reproducible and debuggable. Enjoy building the next layer! 🚀

