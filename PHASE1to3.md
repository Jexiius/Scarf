# Phase 3 Pipeline (Days 15‑22)

This guide covers every deliverable implemented so far: Google Places scraping, the processing queue, feature extraction with OpenAI, aggregation into `restaurant_features`, and the supporting scripts/tests. Follow it to seed real restaurants, run the workers, and verify the data.

---

## 1. Prerequisites

- Node.js 20+
- PostgreSQL URL configured in `.env` (`DATABASE_URL=…`)
- OpenAI API key (`OPENAI_API_KEY=…`)
- Google Places API key (`GOOGLE_PLACES_API_KEY=…`)

Install dependencies once:

```bash
npm install
```

Drizzle migrations are committed through **Day 22**. Apply (or re-apply) them any time:

```bash
npm run migrate
```

---

## 2. What’s Implemented

### Data & Queue Layer
- `processing_queue` table with task types: `scrape_reviews`, `extract_features`, `aggregate_features`
- Repository helpers for enqueueing, claiming, retrying, and reporting on tasks
- Review storage (`reviews` table) with processed flags  
- `feature_extractions` table storing per-review JSON feature maps, token usage, and cost
- `restaurant_features` table (one row per restaurant) populated by aggregation

### Services & Workers
- `GooglePlacesService` for search/detail fetching and utility mapping
- `ReviewScraperWorker` pulls `scrape_reviews` tasks and keeps restaurant metadata current
- `FeatureExtractionService` wraps OpenAI Chat Completions (stubbed in tests)
- `FeatureExtractorWorker` batches unprocessed reviews, writes extractions, and re-queues aggregation
- `FeatureAggregationService` weights by recency, review rating, and LLM confidence
- `FeatureAggregatorWorker` upserts rolled-up scores into `restaurant_features`

### Tooling & Tests
- `npm run seed:midtown` to import 100 Midtown NYC restaurants and enqueue scrape jobs
- Scripts/tests cover scoring, extraction stubs, and aggregation behaviour
- Package scripts for each worker: `worker:scrape`, `worker:extract`, `worker:aggregate`

---

## 3. Running the Pipeline

### Step 1 – Seed Restaurants
```bash
npm run seed:midtown
```
What happens:
- Upserts 100 Google Places results in Midtown
- Schedules a high-priority `scrape_reviews` task (if none active) per restaurant

### Step 2 – Scrape Reviews
```bash
npm run worker:scrape
```
Keep the worker running; it loops until the queue is empty. For each task it:
- Fetches fresh place details + top 5 reviews
- Inserts new reviews (skips duplicates)
- Queues `extract_features` when new unprocessed reviews exist

### Step 3 – Extract Feature Scores
In a second terminal:
```bash
npm run worker:extract
```
The worker:
- Batches unprocessed reviews per restaurant (configurable size/concurrency)
- Calls OpenAI (or stub in test mode)
- Writes to `feature_extractions`, marks reviews processed, tracks cost
- Queues `aggregate_features` when extractions succeed

### Step 4 – Aggregate Restaurant Features
Third terminal:
```bash
npm run worker:aggregate
```
For each aggregation task the worker:
- Loads all extractions for the restaurant along with review metadata
- Computes weighted averages for the 32 feature columns
- Updates `restaurant_features` + metadata (confidence score, review_count_analyzed)

You can stop workers with `Ctrl+C` once queue stats report zero pending tasks.

---

## 4. Monitoring & Troubleshooting

- **Queue stats:** `npm run seed:midtown` prints totals, and workers log counts after each task.
- **Database quick check:**
  ```sql
  SELECT task_type, status, COUNT(*)
  FROM processing_queue
  GROUP BY 1,2
  ORDER BY 1,2;
  ```
- **Feature rows present?**  
  `SELECT COUNT(*) FROM feature_extractions;`  
  `SELECT COUNT(*) FROM restaurant_features WHERE review_count_analyzed IS NOT NULL;`
- **Duplicate task errors (23505):** indicate an existing pending/processing row for that restaurant/task. Clean duplicates, then requeue using an `UPDATE … WHERE NOT EXISTS (...)` guard.
- **OpenAI costs:** `feature_extractions` stores `tokens_used` and `cost_usd` for reporting.

---

## 5. Configuration Knobs

| Setting | Default | Description |
| ------- | ------- | ----------- |
| `FEATURE_EXTRACTOR_BATCH_SIZE` | `25` | Max reviews processed per cycle |
| `FEATURE_EXTRACTION_CONCURRENCY` | `3` | Parallel OpenAI calls per batch |

Set environment variables before running workers to override.

---

## 6. Tests & Validation

```bash
npm test
```
Runs unit coverage for:
- Feature extraction stub pipeline
- Aggregation weighting logic
- Scoring service (from earlier milestones)

Run `npm run build` to ensure TypeScript stays happy.

---

## 7. Next Steps (Beyond Day 22)

The groundwork is in place for Phase 3 → 4:
- Add monitoring dashboards
- Expand to more cities, handle incremental scrape scheduling
- Plug aggregated features into the search API and matching logic

Until then, this README keeps the review → feature pipeline reproducible end-to-end. Enjoy!

