# Grovyn One — Engineering Backend API

## Overview

NestJS 10 REST API for the Grovyn One engineering performance platform. All endpoints are org-scoped via JWT payload. Interactive docs available at `/api/docs` when running.

## Stack

- NestJS 10 + TypeScript (strict mode)
- Prisma 5 + PostgreSQL
- JWT (access 15m + refresh 7d)
- Passport.js (jwt strategy)
- class-validator + class-transformer
- @nestjs/swagger

## Quick Start

```bash
cd backend
cp .env.example .env
# Edit DATABASE_URL and JWT secrets in .env

# Start PostgreSQL
docker compose up postgres -d

# Install dependencies and run migrations
npm install
npm run db:generate
npm run db:migrate

# Start dev server
npm run start:dev
```

Or from root:

```bash
npm run api:dev
```

API runs on http://localhost:3001. Swagger UI at http://localhost:3001/api/docs.

## Auth

All responses are wrapped in `{ success, message, data }`. All protected routes require `Authorization: Bearer <accessToken>`.

### POST /auth/register
Creates a new organization and owner user account.

```json
{
  "organizationName": "Acme Corp",
  "organizationSlug": "acme-corp",
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@acme.com",
  "password": "password123"
}
```

### POST /auth/login
Returns `{ accessToken, refreshToken, user }`.

### POST /auth/refresh
Exchange refresh token for new tokens. Body: `{ refreshToken }`.

### POST /auth/logout
Invalidate refresh token session. Body: `{ refreshToken }`.

### GET /auth/me
Returns current authenticated user profile.

---

## Users

All org-scoped. The JWT `orgId` is used for isolation.

| Method | Path | Description |
|--------|------|-------------|
| GET | /users | List org users (paginated, search, isActive filter) |
| GET | /users/:id | Get user by ID |
| POST | /users | Create a new user in org |
| PATCH | /users/:id | Update user (own or manager) |
| DELETE | /users/:id | Deactivate user |
| PATCH | /users/:id/avatar | Update avatar URL |
| GET | /users/:id/preference | Get user preferences |
| PATCH | /users/:id/preference | Update user preferences |

Query params for GET /users: `?search=&isActive=true&page=1&limit=20`

---

## Organizations

| Method | Path | Description |
|--------|------|-------------|
| GET | /organizations/me | Get current org |
| PATCH | /organizations/me | Update org name / logo |

---

## Check-ins

Daily check-ins scoped to org. One per user per day enforced via unique constraint.

| Method | Path | Description |
|--------|------|-------------|
| POST | /check-ins | Submit daily check-in |
| PATCH | /check-ins/:id | Update (own, same day only) |
| DELETE | /check-ins/:id | Delete (own, same day only) |
| GET | /check-ins/mine | My check-ins (paginated, from/to filter) |
| GET | /check-ins/today | Today's org check-ins |
| GET | /check-ins/stats | Check-in rate and weekly trends |
| GET | /check-ins | All org check-ins (paginated, userId/date filter) |

Check-in statuses: `on_track`, `blocked`, `completed`

---

## Goals

Progress-tracked goals with history.

| Method | Path | Description |
|--------|------|-------------|
| POST | /goals | Create a goal |
| GET | /goals/mine | My goals (status filter) |
| GET | /goals | Org goals (userId, status filter) |
| GET | /goals/:id | Single goal with full history |
| PATCH | /goals/:id | Update title/description/dueDate |
| PATCH | /goals/:id/progress | Update progress 0-100 (records history entry) |
| PATCH | /goals/:id/complete | Mark complete (sets progress=100) |
| PATCH | /goals/:id/archive | Archive goal |

Goal statuses: `active`, `completed`, `archived`. Archived goals cannot be updated.

---

## Weekly Reviews

Self and manager reviews, one per (reviewee, reviewer, type, weekStart).

| Method | Path | Description |
|--------|------|-------------|
| POST | /reviews | Create review (self or manager) |
| GET | /reviews/mine | Reviews where I am reviewee |
| GET | /reviews/given | Reviews I authored |
| GET | /reviews/pending | Reviews I still need to complete |
| GET | /reviews/user/:userId | All reviews for a user |
| GET | /reviews/:id | Single review |
| PATCH | /reviews/:id | Update draft review |
| PATCH | /reviews/:id/submit | Submit (locks permanently) |

Review types: `self`, `manager`. `weekStart` must be a Monday. Rating is 1-5.

---

## Recognition

Peer-to-peer recognition feed.

| Method | Path | Description |
|--------|------|-------------|
| POST | /recognition | Create recognition |
| GET | /recognition | Org feed (most recent first) |
| GET | /recognition/mine | Received by me |
| GET | /recognition/given | Given by me |
| GET | /recognition/user/:userId | Received by specific user |

Self-recognition is blocked. Both author and recipient must be in the same org.

---

## Dashboard

Computed in real time — no separate storage.

### GET /dashboard

Returns:

```json
{
  "checkInRate": 85,
  "blockedMembers": 2,
  "pendingReviews": 3,
  "activeGoals": 12,
  "recognitionCount": 5,
  "avgPerformanceScore": 4.2,
  "weeklyTrends": [{ "date": "2024-01-15", "count": 8 }],
  "goalDistribution": { "active": 10, "completed": 25, "archived": 3 },
  "recentRecognitions": [],
  "topContributors": []
}
```

---

## Leaderboard

Computed from check-ins, goals, and recognitions. Never stored.

### GET /leaderboard?period=week|month|quarter

Scoring: 40% check-in rate + 40% goal completion + 20% recognitions received.

```json
{
  "rankings": [
    {
      "rank": 1,
      "user": { "id": "...", "firstName": "Jane", "lastName": "Doe" },
      "checkInScore": 90,
      "goalScore": 75,
      "recognitionScore": 30,
      "totalScore": 78,
      "trend": "up"
    }
  ],
  "period": "week",
  "periodStart": "2024-01-15T00:00:00.000Z"
}
```

---

## People

Profile views composed from all domains.

| Method | Path | Description |
|--------|------|-------------|
| GET | /people | Org members (search, dept, isActive filter) |
| GET | /people/:id | Full person profile |
| GET | /people/:id/check-ins | Their check-in history |
| GET | /people/:id/goals | Their goals |
| GET | /people/:id/reviews | Their reviews |
| GET | /people/:id/recognitions | Their recognitions |
| GET | /people/:id/timeline | Performance timeline (last 90 days, chronological) |

Timeline item structure:

```json
{
  "type": "check-in" | "goal" | "review" | "recognition",
  "date": "2024-01-15T00:00:00.000Z",
  "data": {}
}
```

---

## Response Format

### Success

```json
{ "success": true, "message": "OK", "data": {} }
```

### Paginated

```json
{
  "success": true,
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
}
```

### Error

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": { "validation": ["field must be..."] },
  "path": "/check-ins",
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

---

## Docker

```bash
# Start just the database
docker compose up postgres -d

# Start full stack (API + DB)
docker compose up

# Build and run
docker build -t grovyn-api .
docker run -p 3001:3001 --env-file .env grovyn-api
```

---

## Database

```bash
# Generate Prisma client
npm run db:generate

# Apply migrations (dev)
npm run db:migrate

# Push schema without migration (prototyping)
npm run db:push

# Open Prisma Studio
npm run db:studio
```

---

## Tests

```bash
# E2E tests (requires running database)
npm run test:e2e

# Unit tests
npm test
```
