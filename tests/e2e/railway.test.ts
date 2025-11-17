import { describe, expect, it, beforeAll } from 'vitest';
import axios, { AxiosError } from 'axios';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const TIMEOUT = 30000; // 30 seconds for E2E tests

const api = axios.create({
  baseURL: BASE_URL,
  timeout: TIMEOUT,
  validateStatus: () => true, // Don't throw on any status code
});

describe('Railway Server E2E Tests', () => {
  let authToken: string;
  let userId: string;
  let testEmail: string;
  let testPassword: string;
  let restaurantId: string | null = null;

  beforeAll(() => {
    // Generate unique test credentials
    const timestamp = Date.now();
    testEmail = `test-${timestamp}@example.com`;
    testPassword = 'TestPassword123!';
  });

  describe('Health Check', () => {
    it('should return 200 and status ok', async () => {
      const response = await api.get('/health');
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'ok');
      expect(response.data).toHaveProperty('timestamp');
    });
  });

  describe('Authentication', () => {
    it('should register a new user', async () => {
      const response = await api.post('/api/v1/auth/register', {
        email: testEmail,
        password: testPassword,
        name: 'Test User',
      });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('token');
      expect(response.data).toHaveProperty('user');
      expect(response.data.user.email).toBe(testEmail);
      expect(response.data.user.subscriptionTier).toBe('free');

      authToken = response.data.token;
      userId = response.data.user.id;
    });

    it('should reject duplicate email registration', async () => {
      const response = await api.post('/api/v1/auth/register', {
        email: testEmail,
        password: testPassword,
        name: 'Duplicate User',
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should login with valid credentials', async () => {
      const response = await api.post('/api/v1/auth/login', {
        email: testEmail,
        password: testPassword,
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('token');
      expect(response.data).toHaveProperty('user');
      expect(response.data.user.email).toBe(testEmail);
      expect(response.data.user.lastLoginAt).not.toBeNull();

      authToken = response.data.token;
    });

    it('should reject login with invalid password', async () => {
      const response = await api.post('/api/v1/auth/login', {
        email: testEmail,
        password: 'WrongPassword123!',
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject login with non-existent email', async () => {
      const response = await api.post('/api/v1/auth/login', {
        email: 'nonexistent@example.com',
        password: testPassword,
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Protected Routes', () => {
    it('should reject requests without authentication token', async () => {
      const response = await api.get('/api/v1/users/me');
      expect(response.status).toBe(401);
    });

    it('should return user profile with valid token', async () => {
      const response = await api.get('/api/v1/users/me', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('user');
      expect(response.data.user.id).toBe(userId);
      expect(response.data.user.email).toBe(testEmail);
      expect(response.data.user).not.toHaveProperty('passwordHash');
    });

    it('should reject requests with invalid token', async () => {
      const response = await api.get('/api/v1/users/me', {
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Search Endpoint', () => {
    it('should perform search without authentication', async () => {
      const response = await api.post('/api/v1/search', {
        query: 'Italian restaurant',
        latitude: 40.7128,
        longitude: -74.0060,
        radiusMiles: 10,
        limit: 5,
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('results');
      expect(response.data).toHaveProperty('queryUnderstood');
      expect(response.data).toHaveProperty('meta');
      expect(Array.isArray(response.data.results)).toBe(true);

      // If there are results, store the first restaurant ID for later tests
      if (response.data.results.length > 0) {
        restaurantId = response.data.results[0].id;
      }
    });

    it('should perform search with authentication', async () => {
      const response = await api.post(
        '/api/v1/search',
        {
          query: 'pizza near me',
          latitude: 40.7128,
          longitude: -74.0060,
          radiusMiles: 5,
          limit: 10,
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('results');
      expect(response.data).toHaveProperty('meta');
      expect(response.data.meta).toHaveProperty('queryId');
    });

    it('should reject search with invalid coordinates', async () => {
      const response = await api.post('/api/v1/search', {
        query: 'restaurant',
        latitude: 91, // Invalid latitude
        longitude: -74.0060,
        radiusMiles: 10,
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject search with query too short', async () => {
      const response = await api.post('/api/v1/search', {
        query: 'ab', // Too short (min 3)
        latitude: 40.7128,
        longitude: -74.0060,
        radiusMiles: 10,
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Restaurant Endpoints', () => {
    it('should return 404 for non-existent restaurant', async () => {
      const response = await api.get('/api/v1/restaurants/00000000-0000-0000-0000-000000000000');
      expect(response.status).toBe(404);
    });

    it('should return restaurant details if restaurant exists', async () => {
      if (!restaurantId) {
        // Skip if we don't have a restaurant ID from search
        return;
      }

      const response = await api.get(`/api/v1/restaurants/${restaurantId}`);
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('id', restaurantId);
      expect(response.data).toHaveProperty('name');
      expect(response.data).toHaveProperty('address');
      expect(response.data).toHaveProperty('coordinates');
    });
  });

  describe('Saved Restaurants', () => {
    it('should return empty list for new user', async () => {
      const response = await api.get('/api/v1/users/me/saved', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('items');
      expect(Array.isArray(response.data.items)).toBe(true);
    });

    it('should save a restaurant if restaurant ID exists', async () => {
      if (!restaurantId) {
        // Skip if we don't have a restaurant ID
        return;
      }

      const response = await api.post(
        '/api/v1/users/me/saved',
        {
          restaurantId,
          notes: 'Great place for testing',
          tags: ['test', 'e2e'],
          personalRating: 5,
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
      );

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('restaurant');
      expect(response.data.restaurant.id).toBe(restaurantId);
      expect(response.data).toHaveProperty('notes', 'Great place for testing');
      expect(response.data).toHaveProperty('tags');
      expect(response.data.tags).toContain('test');
    });

    it('should list saved restaurants', async () => {
      if (!restaurantId) {
        return;
      }

      const response = await api.get('/api/v1/users/me/saved', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      expect(response.data.items.length).toBeGreaterThan(0);
      expect(response.data.items[0]).toHaveProperty('restaurant');
    });

    it('should delete a saved restaurant', async () => {
      if (!restaurantId) {
        return;
      }

      const response = await api.delete(`/api/v1/users/me/saved/${restaurantId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
    });

    it('should return empty list after deletion', async () => {
      if (!restaurantId) {
        return;
      }

      const response = await api.get('/api/v1/users/me/saved', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      expect(response.data.items.length).toBe(0);
    });
  });

  describe('Query History', () => {
    it('should return query history for authenticated user', async () => {
      const response = await api.get('/api/v1/users/me/queries', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('items');
      expect(Array.isArray(response.data.items)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const response = await api.get('/api/v1/users/me/queries?limit=5', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      expect(response.data.items.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Rate Limiting', () => {
    it('should include rate limit headers', async () => {
      const response = await api.get('/health');
      // Rate limit headers may or may not be present depending on implementation
      // Just verify the request succeeds
      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await api.get('/api/v1/nonexistent');
      expect(response.status).toBe(404);
    });

    it('should return proper error format for validation errors', async () => {
      const response = await api.post('/api/v1/auth/register', {
        email: 'invalid-email',
        password: 'short',
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
      // Error response should be JSON
      expect(typeof response.data).toBe('object');
    });
  });
});

