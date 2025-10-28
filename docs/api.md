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
      "restaurant": { /* restaurant record */ },
      "features": { /* feature vector, may be null */ }
    }
  ]
}
```

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
Existing natural language search endpoint. When authenticated, the request is logged to `user_queries`.

## Rate Limiting

Anonymous clients: 30 requests/hour
Free accounts: 120 requests/hour
Premium accounts: 1200 requests/hour

Limits reset every hour. Responses include the standard `X-RateLimit-*` headers and a `Retry-After` header when throttled.

## Health

### GET `/health`
Health check endpoint. Returns current timestamp.
