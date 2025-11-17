# API Reference

Base URL: `/api/v1`

All authenticated endpoints expect a `Bearer` token in the `Authorization` header. Tokens are obtained from the authentication endpoints and expire after 7 days.

## Authentication

### POST `/auth/register`
Create a new account.

Body:
```json
{
  "email": "user@example.com",
  "password": "s3curePwd",
  "name": "Ada Lovelace"
}
```

Response `201`:
```json
{
  "token": "<jwt>",
  "user": {
    "id": "...",
    "email": "user@example.com",
    "name": "Ada Lovelace",
    "subscriptionTier": "free",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "lastLoginAt": null
  }
}
```

### POST `/auth/login`
Authenticate with email and password. Response body matches the register endpoint.

## Users

### GET `/users/me`
Return the authenticated user's profile.

Response `200`:
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "emailVerified": false,
    "name": "Ada Lovelace",
    "defaultLocation": {
      "latitude": 40.7589,
      "longitude": -73.9851,
      "city": "New York"
    },
    "favoriteCuisines": ["Italian", "Japanese"],
    "subscriptionTier": "free",
    "subscriptionStartsAt": null,
    "subscriptionEndsAt": null,
    "lastLoginAt": "2024-01-01T00:00:00.000Z",
    "lastActiveAt": "2024-01-01T00:00:00.000Z",
    "queryCount": 42
  }
}
```

**Note:** Internal fields like `passwordHash`, `createdAt`, `updatedAt` are stripped from the response.

### GET `/users/me/saved`
List saved restaurants for the authenticated user.

Response `200`:
```json
{
  "items": [
    {
      "id": "saved-id",
      "notes": "Perfect for anniversaries",
      "tags": ["date-night"],
      "savedAt": "2024-01-01T00:00:00.000Z",
      "personalRating": null,
      "visited": false,
      "visitedAt": null,
      "restaurant": {
        "id": "restaurant-uuid",
        "name": "Restaurant Name",
        "address": "123 Main St",
        "city": "New York",
        "state": "NY",
        "zipCode": "10001",
        "coordinates": {
          "lat": 40.7589,
          "lng": -73.9851
        },
        "priceLevel": 3,
        "rating": 4.5,
        "reviewCount": 250,
        "cuisineTags": ["Italian", "Fine Dining"],
        "phone": "+1-212-555-1234",
        "website": "https://example.com",
        "photos": ["https://..."],
        "hours": {
          "monday": "11:00 AM – 10:00 PM",
          "tuesday": "11:00 AM – 10:00 PM"
        },
        "features": {
          "romantic": 0.9,
          "cozy": 0.85,
          "noiseLevel": 0.3
        }
      }
    }
  ]
}
```

**Note:** Restaurant features are included in the restaurant object. All decimal values are normalized to numbers.

### POST `/users/me/saved`
Add a restaurant to the saved list.

Body:
```json
{
  "restaurantId": "uuid",
  "notes": "Optional notes",
  "tags": ["favorite", "try-soon"],
  "personalRating": 5,
  "visited": true,
  "visitedAt": "2024-01-15T19:30:00.000Z"
}
```

Response `201`: the saved item payload described above.

### DELETE `/users/me/saved/:restaurantId`
Remove a restaurant from the saved list.

Response `200`:
```json
{
  "success": true
}
```

### GET `/users/me/queries?limit=20`
Return recent search activity. Each item includes the stored query text, parser output, filters applied, location metadata, and the number of results returned. `limit` defaults to 20 and maxes at 100.

## Search

### POST `/search`
Natural language search endpoint. When authenticated, the request is logged to `user_queries`.

**Request Body:**
```json
{
  "query": "romantic Italian restaurant",
  "latitude": 40.7589,
  "longitude": -73.9851,
  "radiusMiles": 5,
  "maxPrice": 3,
  "cuisines": ["Italian"],
  "limit": 10,
  "offset": 0,
  "cursor": "optional-cursor-for-pagination"
}
```

**Query Parameters:**
- `query` (required): Natural language search query (3-500 characters)
- `latitude` (required): User's latitude (-90 to 90)
- `longitude` (required): User's longitude (-180 to 180)
- `radiusMiles` (optional): Search radius in miles (1-50, default: 10)
- `maxPrice` (optional): Maximum price level (1-4)
- `cuisines` (optional): Array of cuisine types to filter by
- `limit` (optional): Number of results to return (1-20, default: 10)
- `offset` (optional): Offset for pagination (0+)
- `cursor` (optional): Cursor for cursor-based pagination (UUID of last restaurant from previous page)

**Response `200`:**
```json
{
  "results": [
    {
      "id": "restaurant-uuid",
      "name": "Restaurant Name",
      "coordinates": {
        "lat": 40.7589,
        "lng": -73.9851
      },
      "priceLevel": 3,
      "rating": 4.5,
      "cuisineTags": ["Italian"],
      "photos": ["https://..."],
      "distanceMiles": 2.3,
      "matchScore": 0.92,
      "featureScore": 0.88,
      "featureMatches": {
        "romantic": {
          "target": 0.9,
          "actual": 0.9,
          "match": 1.0
        }
      },
      "explanation": "Restaurant Name matches your preferences with strong scores for romantic and good for dates.",
      "dataQuality": {
        "confidence": 0.85,
        "reviewCount": 150,
        "lastUpdatedAt": "2024-01-15T00:00:00.000Z",
        "warnings": []
      }
    }
  ],
  "queryUnderstood": {
    "features": {
      "romantic": {
        "weight": 1.0,
        "target": 0.9,
        "required": true
      }
    },
    "intent": "date_night",
    "confidence": 0.95,
    "cuisines": ["Italian"],
    "maxPrice": 3
  },
  "meta": {
    "totalResults": 15,
    "queryId": "query-uuid",
    "processingTimeMs": 245,
    "nextCursor": "last-restaurant-id-if-more-results"
  }
}
```

**Pagination:**
- Use `cursor` for cursor-based pagination (recommended for consistent results)
- Use `offset` for offset-based pagination
- Response includes `nextCursor` in `meta` when more results are available

### GET `/restaurants/:id`
Get detailed information about a specific restaurant.

**Response `200`:**
```json
{
  "id": "restaurant-uuid",
  "name": "Restaurant Name",
  "address": "123 Main St",
  "city": "New York",
  "state": "NY",
  "zipCode": "10001",
  "coordinates": {
    "lat": 40.7589,
    "lng": -73.9851
  },
  "priceLevel": 3,
  "rating": 4.5,
  "reviewCount": 250,
  "cuisineTags": ["Italian", "Fine Dining"],
  "phone": "+1-212-555-1234",
  "website": "https://example.com",
  "photos": ["https://..."],
  "hours": {
    "monday": "11:00 AM – 10:00 PM",
    "tuesday": "11:00 AM – 10:00 PM"
  },
  "features": {
    "romantic": 0.9,
    "cozy": 0.85,
    "casual": 0.2,
    "noiseLevel": 0.3,
    "energyLevel": 0.4,
    "goodForDates": 0.95
  }
}
```

**Note:** All decimal values are normalized to numbers. Internal fields like `isActive`, `modelVersion`, `createdAt`, `updatedAt` are not included in the response.

## Rate Limiting

Rate limits are enforced across all API instances using a shared PostgreSQL store.

**Limits:**
- Anonymous clients: 30 requests/hour
- Free accounts: 120 requests/hour
- Premium accounts: 1200 requests/hour

**Headers:**
All responses include rate limit headers:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: ISO timestamp when the limit resets
- `X-RateLimit-Window`: Window size in seconds

When rate limited (429), the response includes:
- `Retry-After`: Seconds until the limit resets

**Identifier Resolution:**
- Authenticated users: Identified by user ID
- Anonymous users: Identified by IP address (prioritizes trusted proxy headers: `cf-connecting-ip`, `x-real-ip`)

See `docs/rate-limiting-runbook.md` for configuration and monitoring details.

## Health

### GET `/health`
Health check endpoint. Returns current timestamp.
