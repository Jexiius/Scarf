import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { SearchService, type SearchParams } from '../services/search.service';
import type { AppBindings } from '../types/app';

const searchSchema = z.object({
  query: z.string().min(3).max(500),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMiles: z.number().min(1).max(50).default(10),
  maxPrice: z.number().int().min(1).max(4).optional(),
  cuisines: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(20).default(10),
});

const searchService = new SearchService();
export const searchRouter = new Hono<AppBindings>();

searchRouter.post('/', zValidator('json', searchSchema), async (c) => {
  const startTime = Date.now();
  const body = c.req.valid('json');
  const user = c.get('user');

  const searchParams: SearchParams = {
    query: body.query,
    latitude: body.latitude,
    longitude: body.longitude,
    radiusMiles: body.radiusMiles,
    limit: body.limit,
  };

  if (user?.id) {
    searchParams.userId = user.id;
  }

  if (typeof body.maxPrice === 'number') {
    Object.assign(searchParams, { maxPrice: body.maxPrice });
  }

  if (body.cuisines && body.cuisines.length > 0) {
    Object.assign(searchParams, { cuisines: body.cuisines });
  }

  const result = await searchService.search(searchParams);

  const processingTime = Date.now() - startTime;

  return c.json({
    results: result.restaurants,
    queryUnderstood: result.parsedQuery,
    meta: {
      totalResults: result.totalCount,
      queryId: result.queryId,
      processingTimeMs: processingTime,
    },
  });
});

export default searchRouter;
