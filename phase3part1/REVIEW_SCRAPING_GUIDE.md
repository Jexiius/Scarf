# Review Scraping Implementation Guide - Midtown NYC

## Overview
This guide walks through implementing the review scraping system for restaurants in Midtown Manhattan (Times Square, Bryant Park, Grand Central area).

## Geographic Scope: Midtown NYC
- **Center Point**: Times Square (40.7580° N, 73.9855° W)
- **Radius**: 1.5 miles (covers Midtown West to Midtown East)
- **Target**: 100+ restaurants

---

## Phase 1: Google Places API Setup

### 1.1 Get API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable APIs:
   - **Places API** (for place search and details)
   - **Places API (New)** if available (better features)
4. Create credentials:
   - API Key with restrictions
   - Restrict to Places API only
   - Add IP restrictions for production

### 1.2 Add to Environment

```bash
# .env.local
GOOGLE_PLACES_API_KEY=AIzaSy...your-key-here
```

### 1.3 Pricing Awareness
- **Text Search**: $32 per 1000 requests
- **Place Details**: $17 per 1000 requests (Basic)
- **Reviews**: Included in Place Details
- **Budget for 100 restaurants**: ~$5-7

---

## Phase 2: Implementation Files

You'll need to create these files:
1. `src/services/google-places.service.ts` - API client
2. `src/workers/review-scraper.ts` - Worker that processes reviews
3. `src/scripts/seed-midtown-restaurants.ts` - Initial seeding script
4. `src/repositories/queue.repository.ts` - Queue management
5. `src/db/schema.ts` - Update with queue table if not exists

---

## Key Implementation Notes

### Error Handling
- Google API has rate limits: 1000 requests/day free tier
- Implement exponential backoff for rate limit errors
- Track API usage to avoid overage charges

### Data Quality
- Not all restaurants have reviews
- Some restaurants may be closed
- Handle missing data gracefully (null checks)

### Queue Strategy
1. Seed restaurants first (INSERT into `restaurants`)
2. Create queue tasks (INSERT into `processing_queue`)
3. Workers process queue (scrape reviews)
4. Mark restaurants as scraped (`last_scraped_at`)

### Database Considerations
- Use transactions for queue task claiming
- Implement `FOR UPDATE SKIP LOCKED` to avoid race conditions
- Handle duplicate review prevention (unique constraint)

---

## Next Steps After This Phase

Once scraping is complete:
1. **Verify Data**: Check that reviews are in database
2. **Phase 4 (Day 18-20)**: Feature extraction with LLM
3. **Phase 5 (Day 21-22)**: Feature aggregation
4. **Phase 6 (Day 23-24)**: Data quality checks

---

## Troubleshooting

### "API key not valid"
- Check key is enabled for Places API
- Remove IP restrictions during development
- Verify billing is enabled on GCP project

### "ZERO_RESULTS" from API
- Adjust search radius (try 2-3 miles)
- Change search query (use "restaurant" instead of specific cuisine)
- Verify coordinates are correct for Midtown NYC

### "Rate limit exceeded"
- Add delays between requests (1 second minimum)
- Implement exponential backoff
- Consider upgrading to paid tier

### Reviews not appearing
- Some restaurants have no Google reviews
- Check `google_review_count` field
- API only returns max 5 reviews per request (limitation)

---

## Cost Optimization Tips

1. **Cache Place IDs**: Don't re-search for same restaurants
2. **Batch Processing**: Process multiple restaurants between API calls
3. **Selective Scraping**: Only scrape restaurants with >10 reviews
4. **Incremental Updates**: Only fetch new reviews, not all reviews
5. **Monitor Usage**: Set up billing alerts in GCP
