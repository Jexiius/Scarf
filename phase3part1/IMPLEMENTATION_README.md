# Review Scraping Implementation - Midtown NYC

## 📁 Files Created

```
src/
├── services/
│   └── google-places.service.ts    # Google Places API client
├── repositories/
│   ├── restaurant.repository.ts    # Database operations for restaurants
│   └── queue.repository.ts         # Queue management
├── workers/
│   └── review-scraper.ts          # Background worker for scraping
└── scripts/
    └── seed-midtown-restaurants.ts # Initial seeding script
```

## 🚀 Quick Start Guide

### Step 1: Environment Setup

Add to your `.env.local`:

```bash
# Required
DATABASE_URL=postgresql://user:password@localhost:5432/scarf
GOOGLE_PLACES_API_KEY=AIzaSy...your-key-here

# Optional
NODE_ENV=development
PORT=3000
```

### Step 2: Install Dependencies

```bash
npm install axios
npm install -D @types/node
```

### Step 3: Database Setup

Make sure your PostgreSQL database has the required tables. If you need to create them:

```sql
-- Ensure processing_queue table exists
CREATE TABLE IF NOT EXISTS processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_queue_pending ON processing_queue(priority DESC, created_at) 
WHERE status = 'pending';

CREATE UNIQUE INDEX idx_queue_unique_active_task 
ON processing_queue(restaurant_id, task_type) 
WHERE status IN ('pending', 'processing');
```

### Step 4: Add NPM Scripts

Add to your `package.json`:

```json
{
  "scripts": {
    "seed:midtown": "tsx src/scripts/seed-midtown-restaurants.ts",
    "worker": "tsx src/workers/review-scraper.ts",
    "worker:dev": "tsx watch src/workers/review-scraper.ts"
  }
}
```

### Step 5: Run the Pipeline

**Terminal 1 - Seed Restaurants:**
```bash
npm run seed:midtown
```

This will:
- Search for ~100 restaurants in Midtown NYC
- Save them to the database
- Create scraping tasks in the queue

**Terminal 2 - Start Worker:**
```bash
npm run worker
```

This will:
- Process tasks from the queue
- Fetch reviews from Google Places API
- Save reviews to the database
- Create feature extraction tasks

## 📊 Expected Results

After running both scripts:

**Restaurants Table:**
- ~100 restaurants in Midtown NYC area
- Basic info: name, location, rating, price level
- Google Place IDs for reference

**Reviews Table:**
- ~5 reviews per restaurant (Google API limit)
- Review text, rating, author, publish date
- Marked as `is_processed = false` (ready for extraction)

**Processing Queue:**
- Completed `scrape_reviews` tasks
- Pending `extract_features` tasks (for next phase)

## 🔍 Monitoring & Debugging

### Check Database

```sql
-- Count restaurants
SELECT COUNT(*) FROM restaurants WHERE is_active = true;

-- Count reviews
SELECT COUNT(*) FROM reviews;

-- Check queue status
SELECT status, COUNT(*) 
FROM processing_queue 
GROUP BY status;

-- Top 10 restaurants by review count
SELECT r.name, COUNT(rev.id) as review_count
FROM restaurants r
LEFT JOIN reviews rev ON rev.restaurant_id = r.id
GROUP BY r.id, r.name
ORDER BY review_count DESC
LIMIT 10;
```

### Check Logs

The scripts output detailed logs:
- ✅ Success indicators
- ⚠️  Warnings for missing data
- ❌ Errors with details
- 📊 Progress and statistics

### Common Issues

**"API key not valid"**
- Verify key is correct in `.env.local`
- Enable Places API in Google Cloud Console
- Check billing is enabled

**"ZERO_RESULTS"**
- Coordinates might be wrong
- Try increasing search radius
- Check if restaurants exist in that area

**"Rate limit exceeded"**
- Wait for rate limit to reset (usually 1 minute)
- Worker will retry automatically
- Consider upgrading API quota

**"Connection refused" (database)**
- Check PostgreSQL is running
- Verify DATABASE_URL is correct
- Ensure database exists

## 📈 Cost Tracking

Monitor your Google Places API usage:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to: APIs & Services > Dashboard
3. View usage for Places API

**Estimated costs for 100 restaurants:**
- Text Search: 1 request = $0.032
- Place Details: 100 requests = $1.70
- **Total: ~$1.80**

Set up billing alerts to avoid surprises!

## 🎯 Next Steps

After scraping is complete:

1. **Verify data quality**
   ```bash
   npm run db:check-reviews
   ```

2. **Move to Phase 4: Feature Extraction**
   - Implement LLM-based review analysis
   - Extract 32 feature scores from reviews
   - See `TECHNICAL_IMPLEMENTATION_PLAN.txt` Day 18-20

3. **Test search functionality**
   - Try sample queries
   - Verify scoring algorithm works
   - Check response times

## 💡 Tips

- **Start Small**: Test with 10 restaurants before doing 100
- **Monitor Costs**: Check API usage frequently
- **Rate Limiting**: Don't remove delays between requests
- **Error Handling**: Worker retries failed tasks automatically
- **Database Backups**: Take snapshot before running scripts

## 🐛 Troubleshooting Commands

```bash
# Check if services are running
ps aux | grep postgres
ps aux | grep tsx

# View real-time logs
npm run worker 2>&1 | tee worker.log

# Reset stuck tasks
npm run db:reset-stuck-tasks

# Clear queue and restart
npm run db:clear-queue
npm run seed:midtown
npm run worker
```

## 📞 Support

If you encounter issues:

1. Check logs for error messages
2. Verify environment variables
3. Ensure database schema is up to date
4. Review Google Places API documentation
5. Check project documentation files

---

**Happy Scraping! 🗽**
