# Queue Workers Health Runbook

## Overview

Queue workers process background tasks for restaurant data processing. This runbook covers monitoring, recovery, and troubleshooting for queue health.

## Architecture

Three worker types:
- **Review Scraper**: Fetches reviews from Google Places API
- **Feature Extractor**: Extracts features from reviews using OpenAI
- **Feature Aggregator**: Aggregates extracted features into restaurant profiles

## Automatic Recovery

### Stuck Task Detection

Tasks are considered "stuck" if they've been in `processing` status longer than the timeout threshold.

**Default Timeout**: 30 minutes (configurable via `QUEUE_TASK_TIMEOUT_MS`)

### Recovery Mechanisms

1. **Automatic Recovery in `claimNextTask`**: When claiming a new task, the system automatically claims stuck tasks (processing but timed out) and resets them to pending.

2. **Periodic Recovery**: Each worker runs a recovery check every 5 minutes that resets any stuck tasks back to pending status.

3. **Manual Recovery**: Use the monitoring API or direct database queries to reset stuck tasks.

## Configuration

### Environment Variables

```bash
# Task timeout (default: 30 minutes)
QUEUE_TASK_TIMEOUT_MS=1800000

# Feature extraction batch size
FEATURE_EXTRACTOR_BATCH_SIZE=25
```

## Monitoring

### Queue Statistics

Check queue health via the monitoring API:

```bash
curl -H "Authorization: Bearer <token>" \
     https://api.example.com/api/v1/monitoring
```

Response includes:
- `queue.summary`: Overall queue statistics
- `queue.pendingByType`: Tasks pending by type
- `queue.stuckTasks`: Number of stuck tasks

### Log Queries

Workers use structured logging. Key log patterns:

**Task Processing:**
```json
{
  "level": "info",
  "worker": "feature-extraction-processor",
  "taskId": "uuid",
  "restaurantId": "uuid",
  "msg": "Processing extraction task"
}
```

**Stuck Task Recovery:**
```json
{
  "level": "warn",
  "worker": "feature-extraction-processor",
  "taskId": "uuid",
  "msg": "Recovered stuck task"
}
```

**Task Failure:**
```json
{
  "level": "error",
  "worker": "feature-extraction-processor",
  "taskId": "uuid",
  "error": "Error message",
  "msg": "Extraction task failed"
}
```

**Recovery Check:**
```json
{
  "level": "warn",
  "worker": "feature-extraction-processor",
  "resetCount": 3,
  "msg": "Reset stuck tasks"
}
```

### Metrics to Track

1. **Queue Depth**: Number of pending tasks
2. **Processing Time**: Time tasks spend in processing status
3. **Failure Rate**: Percentage of tasks that fail
4. **Stuck Task Count**: Number of tasks stuck in processing
5. **Recovery Events**: Frequency of stuck task recovery

## Manual Operations

### Reset Stuck Tasks

**Via Database:**
```sql
-- View stuck tasks
SELECT id, restaurant_id, task_type, started_at, attempts
FROM processing_queue
WHERE status = 'processing'
  AND started_at < NOW() - INTERVAL '30 minutes';

-- Reset stuck tasks
UPDATE processing_queue
SET status = 'pending',
    started_at = NULL,
    last_error = 'Task was manually reset'
WHERE status = 'processing'
  AND started_at < NOW() - INTERVAL '30 minutes';
```

**Via Repository (in code):**
```typescript
const queueRepo = new QueueRepository();
const resetCount = await queueRepo.resetStuckTasks();
```

### Retry Failed Tasks

```sql
-- View failed tasks
SELECT id, restaurant_id, task_type, attempts, last_error
FROM processing_queue
WHERE status = 'failed'
ORDER BY created_at DESC;

-- Retry a failed task (if under max attempts)
UPDATE processing_queue
SET status = 'pending',
    started_at = NULL,
    last_error = NULL
WHERE id = 'task-id'
  AND attempts < max_attempts;
```

### Cancel a Task

```sql
-- Mark task as failed to prevent retry
UPDATE processing_queue
SET status = 'failed',
    last_error = 'Manually cancelled'
WHERE id = 'task-id';
```

## Troubleshooting

### High Number of Stuck Tasks

**Symptoms:**
- Many tasks in `processing` status for >30 minutes
- Workers appear to be running but not processing tasks

**Possible Causes:**
1. Worker crashed while processing
2. External API timeout (OpenAI, Google Places)
3. Database connection issues
4. Worker process killed (OOM, manual kill)

**Solutions:**
1. Check worker logs for crashes
2. Verify worker processes are running
3. Check external API status
4. Review database connection pool
5. Increase timeout if tasks legitimately take longer

### Tasks Failing Repeatedly

**Symptoms:**
- Tasks reach `max_attempts` and fail
- Same `last_error` across multiple attempts

**Possible Causes:**
1. Invalid restaurant data
2. External API errors (rate limits, invalid keys)
3. Database constraint violations
4. Code bugs

**Solutions:**
1. Check `last_error` field for specific error
2. Review worker logs for detailed error context
3. Verify external API credentials and quotas
4. Check restaurant data integrity
5. Review code for recent changes

### Queue Not Processing

**Symptoms:**
- Pending tasks not being claimed
- Workers running but idle

**Possible Causes:**
1. Workers not running
2. Database connection issues
3. Task type mismatch (worker looking for wrong type)
4. All tasks locked (unlikely with `SKIP LOCKED`)

**Solutions:**
1. Verify workers are running: `ps aux | grep worker`
2. Check worker logs for connection errors
3. Verify task types match worker configuration
4. Check database connectivity

### Performance Issues

**Symptoms:**
- Slow task processing
- High database load
- Timeouts

**Possible Causes:**
1. Large batch sizes
2. External API rate limits
3. Database query performance
4. Insufficient resources

**Solutions:**
1. Reduce `FEATURE_EXTRACTOR_BATCH_SIZE`
2. Add delays between external API calls
3. Optimize database queries
4. Scale worker instances
5. Increase worker resources

## Best Practices

1. **Monitor Queue Depth**: Set up alerts for high pending counts
2. **Track Failure Rates**: Alert on increasing failure rates
3. **Review Stuck Tasks**: Investigate why tasks get stuck
4. **Log Analysis**: Regularly review worker logs for patterns
5. **Resource Monitoring**: Monitor CPU, memory, and database connections
6. **External API Health**: Monitor OpenAI and Google Places API status

## Worker Lifecycle

### Starting Workers

```bash
# Review scraper
npm run worker:scrape

# Feature extractor
npm run worker:extract

# Feature aggregator
npm run worker:aggregate
```

### Stopping Workers

Workers handle `SIGTERM` and `SIGINT` gracefully:
- Stop accepting new tasks
- Complete current task
- Close database connections
- Exit cleanly

### Restarting Workers

For zero-downtime restarts:
1. Start new worker instance
2. Wait for it to start processing
3. Stop old worker instance (SIGTERM)

Tasks are safe to restart - they'll be picked up by another worker if the current one stops.

## References

- [Queue Repository](../src/repositories/queue.repository.ts)
- [Worker Implementations](../src/workers/)
- [Monitoring Service](../src/services/monitoring.service.ts)

