import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Hono } from 'hono';

const usersStore = new Map<string, any>();
const savedStore: Array<{ saved: any; restaurant: any; features: any }> = [];
const queriesStore: any[] = [];

const restaurantRecord = {
  restaurant: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Mock Bistro',
    googlePlaceId: null,
    latitude: '40.7128',
    longitude: '-74.0060',
    address: '123 Mock St',
    city: 'New York',
    state: 'NY',
    zipCode: '10001',
    priceLevel: 2,
    googleRating: '4.6',
    googleReviewCount: 120,
    cuisineTags: ['French'],
    phone: null,
    website: null,
    photoUrls: [],
    hours: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastScrapedAt: null,
  },
  features: null,
};

vi.mock('../../src/repositories/user.repository', () => {
  const { randomUUID } = require('node:crypto');

  class UserRepositoryMock {
    async create(data: any) {
      const now = new Date();
      const record = {
        id: randomUUID(),
        email: data.email,
        passwordHash: data.passwordHash,
        name: data.name ?? null,
        subscriptionTier: data.subscriptionTier ?? 'free',
        createdAt: now,
        updatedAt: now,
        lastLoginAt: null,
        emailVerified: false,
        defaultLatitude: null,
        defaultLongitude: null,
        defaultCity: null,
        tasteProfile: null,
        favoriteCuisines: null,
        subscriptionStartsAt: null,
        subscriptionEndsAt: null,
        lastActiveAt: null,
        queryCount: 0,
      };
      usersStore.set(record.id, record);
      return record;
    }

    async findByEmail(email: string) {
      for (const user of usersStore.values()) {
        if (user.email === email) {
          return user;
        }
      }
      return null;
    }

    async findById(id: string) {
      return usersStore.get(id) ?? null;
    }

    async updateLastLogin(id: string) {
      const user = usersStore.get(id);
      if (!user) {
        return null;
      }
      const now = new Date();
      user.lastLoginAt = now;
      user.lastActiveAt = now;
      user.updatedAt = now;
      return user;
    }

    async recordQueryActivity(id: string) {
      const user = usersStore.get(id);
      if (!user) {
        return null;
      }
      user.queryCount += 1;
      const now = new Date();
      user.lastActiveAt = now;
      user.updatedAt = now;
      return user;
    }
  }

  return {
    UserRepository: UserRepositoryMock,
    __reset: () => usersStore.clear(),
  };
});

vi.mock('../../src/repositories/restaurant.repository', () => ({
  RestaurantRepository: class {
    async findActive() {
      return [restaurantRecord];
    }

    async findById(id: string) {
      return id === restaurantRecord.restaurant.id ? restaurantRecord : null;
    }
  },
  __restaurant: restaurantRecord,
}));

vi.mock('../../src/repositories/saved-restaurant.repository', () => {
  const { randomUUID } = require('node:crypto');

  return {
    SavedRestaurantRepository: class {
      async listByUser(userId: string) {
        return savedStore.filter((item) => item.saved.userId === userId);
      }

      async find(userId: string, restaurantId: string) {
        return (
          savedStore.find(
            (item) => item.saved.userId === userId && item.saved.restaurantId === restaurantId,
          ) ?? null
        );
      }

      async create(data: any) {
        if (restaurantRecord.restaurant.id !== data.restaurantId) {
          throw new Error('Restaurant not found for save operation');
        }
        const saved = {
          id: randomUUID(),
          userId: data.userId,
          restaurantId: data.restaurantId,
          notes: data.notes ?? null,
          tags: data.tags ?? null,
          createdAt: new Date(),
          personalRating: data.personalRating ?? null,
          visited: data.visited ?? false,
          visitedAt: data.visitedAt ?? null,
        };
        savedStore.push({ saved, restaurant: restaurantRecord.restaurant, features: restaurantRecord.features });
        return saved;
      }

      async remove(userId: string, restaurantId: string) {
        const index = savedStore.findIndex(
          (item) => item.saved.userId === userId && item.saved.restaurantId === restaurantId,
        );
        if (index === -1) {
          return null;
        }
        const [removed] = savedStore.splice(index, 1);
        return removed.saved;
      }
    },
    __reset: () => {
      savedStore.length = 0;
    },
  };
});

vi.mock('../../src/repositories/user-query.repository', () => {
  const { randomUUID } = require('node:crypto');

  return {
    UserQueryRepository: class {
      async create(data: any) {
        const record = { id: randomUUID(), createdAt: new Date(), ...data };
        queriesStore.push(record);
        return record;
      }

      async findRecentByUser(userId: string, limit = 20) {
        return queriesStore
          .filter((item) => item.userId === userId)
          .slice(0, limit);
      }
    },
    __reset: () => {
      queriesStore.length = 0;
    },
  };
});

let app: Hono;

beforeEach(async () => {
  vi.resetModules();
  const userRepoModule = await import('../../src/repositories/user.repository');
  userRepoModule.__reset();
  const savedRepoModule = await import('../../src/repositories/saved-restaurant.repository');
  savedRepoModule.__reset();
  const queryRepoModule = await import('../../src/repositories/user-query.repository');
  queryRepoModule.__reset();
  queriesStore.length = 0;
  const appModule = await import('../../src/app');
  app = appModule.default;
});

describe('Phase 2 user flows', () => {
  const headers = {
    'content-type': 'application/json',
  };

  const registerPayload = {
    email: 'test@example.com',
    password: 'Password123',
    name: 'Test User',
  };

  it('registers and logs in a user', async () => {
    const registerRes = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers,
      body: JSON.stringify(registerPayload),
    });

    expect(registerRes.status).toBe(201);
    const registerBody = await registerRes.json();
    expect(registerBody.token).toBeTypeOf('string');
    expect(registerBody.user.email).toBe(registerPayload.email);
    expect(registerBody.user.subscriptionTier).toBe('free');

    const loginRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: registerPayload.email, password: registerPayload.password }),
    });

    expect(loginRes.status).toBe(200);
    const loginBody = await loginRes.json();
    expect(loginBody.user.lastLoginAt).not.toBeNull();
  });

  it('guards protected routes without a token', async () => {
    const response = await app.request('/api/v1/users/me');
    expect(response.status).toBe(401);
  });

  it('saves and lists restaurants for the authenticated user', async () => {
    const registerRes = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers,
      body: JSON.stringify(registerPayload),
    });
    const { token } = await registerRes.json();

    const saveRes = await app.request('/api/v1/users/me/saved', {
      method: 'POST',
      headers: {
        ...headers,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        restaurantId: restaurantRecord.restaurant.id,
        notes: 'Great for celebrations',
        tags: ['favorite'],
      }),
    });

    const saveBody = await saveRes.json();
    expect(saveRes.status).toBe(201);
    expect(saveBody.restaurant.name).toBe('Mock Bistro');
    expect(saveBody.tags).toContain('favorite');
    expect(saveBody.visited).toBe(false);
    expect(saveBody.personalRating).toBeNull();

    const listRes = await app.request('/api/v1/users/me/saved', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(Array.isArray(listBody.items)).toBe(true);
    expect(listBody.items).toHaveLength(1);
    expect(listBody.items[0].restaurant.id).toBe(restaurantRecord.restaurant.id);
    expect(listBody.items[0].visited).toBe(false);
  });
});
