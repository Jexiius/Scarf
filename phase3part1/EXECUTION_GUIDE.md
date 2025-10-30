# 🚀 EXECUTION GUIDE: Review Scraping for Midtown NYC

## What You're Building

A system that:
1. **Searches** for 100 restaurants in Midtown Manhattan
2. **Scrapes** reviews from Google Places API
3. **Stores** everything in your PostgreSQL database
4. **Queues** tasks for future feature extraction

## 📋 Prerequisites Checklist

- [ ] PostgreSQL 15+ running locally
- [ ] Node.js 20+ installed
- [ ] Google Cloud account with Places API enabled
- [ ] ~$5 budget for API calls
- [ ] Database schema created (from DATABASE_DOCUMENTATION.txt)

## 🎯 Step-by-Step Execution

### STEP 1: Get Google Places API Key (10 minutes)

1. Go to https://console.cloud.google.com/
2. Create a new project: "Scarf Backend"
3. Enable APIs:
   - Click "Enable APIs and Services"
   - Search for "Places API"
   - Click "Enable"
4. Create API Key:
   - Go to Credentials
   - Click "Create Credentials" → "API Key"
   - Copy the key (starts with AIzaSy...)
5. Optional but recommended:
   - Click "Edit API Key"
   - Under "API restrictions", select "Restrict key"
   - Select only "Places API"

### STEP 2: Set Up Environment (5 minutes)

Create or update `.env.local`:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/scarf

# Google Places API
GOOGLE_PLACES_API_KEY=AIzaSy...paste-your-key-here

# App Config
NODE_ENV=development
PORT=3000
```

### STEP 3: Install Dependencies (2 minutes)

```bash
# Core dependencies
npm install axios drizzle-orm pg

# Dev dependencies
npm install -D @types/node @types/pg tsx

# If you don't have tsx globally:
npm install -D tsx
```

### STEP 4: Update package.json Scripts

Add these to your `"scripts"` section:

```json
{
  "scripts": {
    "test:setup": "tsx src/scripts/test-setup.ts",
    "seed:midtown": "tsx src/scripts/seed-midtown-restaurants.ts",
    "worker": "tsx src/workers/review-scraper.ts"
  }
}
```

### STEP 5: Test Your Setup (3 minutes)

**This is important! Don't skip this step.**

```bash
npm run test:setup
```

Expected output:
```
🧪 Running Pre-Flight Checks
===========================

1. Google Places API Key...
   ✅ API key configured

2. Database Connection...
   ✅ Database connected

3. Required Tables...
   ✅ Table 'restaurants' exists
   ✅ Table 'reviews' exists
   ✅ Table 'processing_queue' exists

4. Test API Search...
   ✅ API search successful
   Found 20 restaurants
   Example: Junior's Restaurant

📊 Test Summary
==============
✅ 1. Google Places API Key
✅ 2. Database Connection
✅ 3. Required Tables
✅ 4. Test API Search

4/4 tests passed

🎉 All systems go! Ready to run:
   npm run seed:midtown
   npm run worker
```

If any test fails, fix it before proceeding (see troubleshooting below).

### STEP 6: Seed Restaurants (10 minutes)

```bash
npm run seed:midtown
```

This will:
- Search Midtown NYC (Times Square area, 1.5 mile radius)
- Import ~100 restaurants
- Create scraping tasks

Expected output:
```
🗽 Starting Midtown NYC Restaurant Seeding
=====================================
📍 Center: 40.758, -73.9855
📏 Radius: 2500m (~1.5 miles)
🎯 Target: 100 restaurants

🔍 Searching for restaurants...
✅ Found 100 restaurants

💾 Importing restaurants...
✨ New: Carmine's Italian Restaurant
✨ New: Ellen's Stardust Diner
✨ New: Joe's Pizza
...
📊 Progress: 100/100 restaurants processed

✅ Seeding Complete!
===================
✨ New restaurants: 100
🔄 Updated restaurants: 0
📋 Tasks created: 100
```

**Checkpoint:** Verify in database:
```sql
SELECT COUNT(*) FROM restaurants; -- Should be ~100
SELECT COUNT(*) FROM processing_queue WHERE status = 'pending'; -- Should be ~100
```

### STEP 7: Run the Worker (20-30 minutes)

Open a NEW terminal window and run:

```bash
npm run worker
```

This will:
- Process each restaurant one-by-one
- Fetch reviews from Google Places
- Save to database
- Display progress

Expected output:
```
🚀 Review Scraper Worker Started
================================
Watching for scrape_reviews tasks...

⚡ Processing task: abc-123-def
   Restaurant: def-456-ghi
   Attempt: 1/3

🔍 Scraping reviews for restaurant: def-456-ghi
📍 Restaurant: Carmine's Italian Restaurant
✅ Updated restaurant metadata
📝 Found 5 reviews
✅ Saved 5 new reviews
📊 Total reviews in DB: 5
📋 Queued feature extraction task (5 reviews to process)
✅ Task completed successfully

📊 Queue: 99 pending, 0 processing, 1 completed
```

**Let it run!** It will process all 100 restaurants. This takes 20-30 minutes due to:
- API rate limiting (2 seconds between requests)
- API call time (~1 second per restaurant)

**You can stop it anytime with Ctrl+C** and restart later. It will resume where it left off.

### STEP 8: Verify Results (2 minutes)

After worker completes, check your database:

```sql
-- Total restaurants
SELECT COUNT(*) FROM restaurants;
-- Expected: ~100

-- Total reviews
SELECT COUNT(*) FROM reviews;
-- Expected: ~400-500 (Google returns 5 reviews per restaurant)

-- Reviews by rating
SELECT rating, COUNT(*) 
FROM reviews 
GROUP BY rating 
ORDER BY rating DESC;

-- Top 10 restaurants by review count
SELECT r.name, COUNT(rev.id) as review_count
FROM restaurants r
LEFT JOIN reviews rev ON rev.restaurant_id = r.id
GROUP BY r.id, r.name
ORDER BY review_count DESC
LIMIT 10;

-- Queue status
SELECT status, COUNT(*) 
FROM processing_queue 
GROUP BY status;
-- Expected: 100 completed scrape_reviews, ~100 pending extract_features
```

## 🎉 Success Criteria

You're done when you have:
- ✅ ~100 restaurants in Midtown NYC
- ✅ ~400-500 reviews total
- ✅ All scrape_reviews tasks completed
- ✅ extract_features tasks queued (for next phase)

## 🐛 Troubleshooting

### "API key not valid"
```bash
# Fix:
# 1. Double-check key in .env.local
# 2. Ensure no extra spaces or quotes
# 3. Verify Places API is enabled in Google Cloud Console
```

### "Database connection failed"
```bash
# Fix:
# 1. Check PostgreSQL is running:
sudo systemctl status postgresql  # Linux
brew services list  # Mac

# 2. Verify DATABASE_URL is correct
# 3. Test connection:
psql $DATABASE_URL
```

### "Table 'processing_queue' does not exist"
```sql
-- Run this SQL:
CREATE TABLE processing_queue (
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
```

### "ZERO_RESULTS from API"
```bash
# This is rare but can happen. Try:
# 1. Increase search radius in seed script (change 2500 to 3000)
# 2. Verify coordinates are correct for Times Square
# 3. Try a different search center point
```

### Worker is slow
```bash
# This is normal! Expected speed:
# - 2-3 seconds per restaurant
# - 100 restaurants = 5-8 minutes minimum
# - Plus API processing time = 20-30 minutes total

# DON'T:
# - Remove rate limiting (you'll hit API limits)
# - Run multiple workers (will create duplicate tasks)
```

## 💰 Cost Tracking

After completion, check your usage:

1. Go to https://console.cloud.google.com/
2. Navigate to: APIs & Services → Dashboard
3. Click on "Places API"
4. View usage graph

Expected costs for 100 restaurants:
- Nearby Search: ~$0.03
- Place Details: 100 × $0.017 = ~$1.70
- **Total: ~$1.73**

## 🎯 Next Steps

After completing this phase:

1. **Verify data quality**
   - Check sample reviews for quality
   - Ensure diverse ratings (not all 5 stars)
   - Verify restaurant metadata is complete

2. **Move to Phase 4: Feature Extraction** (Day 18-20)
   - Implement LLM integration for review analysis
   - Extract 32 feature scores from review text
   - See TECHNICAL_IMPLEMENTATION_PLAN.txt

3. **Test the search API**
   - Implement search endpoint
   - Test with sample queries
   - Verify scoring works correctly

## 📚 Related Documentation

- `IMPLEMENTATION_README.md` - Detailed technical docs
- `REVIEW_SCRAPING_GUIDE.md` - Additional context
- `DATABASE_DOCUMENTATION.txt` - Schema reference
- `TECHNICAL_IMPLEMENTATION_PLAN.txt` - Full project plan

## 💡 Pro Tips

1. **Start small**: Test with 10 restaurants first by changing TARGET_RESTAURANT_COUNT in the seed script
2. **Monitor costs**: Check Google Cloud Console frequently
3. **Take breaks**: Worker can run in background, resume anytime
4. **Database backups**: Take snapshot before running
5. **Log everything**: Save terminal output to files for debugging

---

**Good luck! 🍀 You've got this!**

Questions? Check the troubleshooting section or review the documentation files.
