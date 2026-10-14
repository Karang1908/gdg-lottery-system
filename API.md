# API Reference

This document describes the HTTP REST endpoints provided by the GDG Persistent Lottery System.

## Base URL
In local development, the API is mounted at `http://localhost:3000`. In production, requests route through the Vercel edge deployment.

### GET /healthz
Liveness probe used by container orchestrators and monitoring systems.
- **Method**: `GET`
- **Headers**: None
- **Response**: `200 OK`
- **Content-Type**: `text/plain`
- **Body**: `ok`

### GET /api/state
Returns public lottery status, entrant counts, winner on stage, and recent history.
- **Method**: `GET`
- **Query Parameters**:
  - `admin` (optional, "1"): If set, returns complete administrative view. Requires `x-admin-password` header.
- **Response**: `200 OK` application/json

### POST /api/join
Registers an entrant into the active giveaway.
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "name": "Jane Doe",
    "email": "jane@example.com"
  }
  ```
- **Status Codes**:
  - `201 Created`: Fresh registration created.
  - `200 OK`: Entrant previously joined (`alreadyJoined: true`).
  - `400 Bad Request`: Invalid name or email.
  - `409 Conflict`: Event capacity reached (1,000 entries).

### POST /api/admin
Administrative command interface for operating giveaway flow.
- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
  - `x-admin-password`: Configured `ADMIN_PASSWORD` secret

#### Action: `draw`
Selects an unselected entrant uniformly at random and puts them on stage.
```json
{ "action": "draw" }
```
- `409 Conflict` (WINNER_ACTIVE): Another winner is already on stage.
- `409 Conflict` (NO_ELIGIBLE_ENTRIES): No eligible entrants remain.

#### Action: `advance`
Confirms winner on stage and clears stage for next giveaway.
```json
{ "action": "advance" }
```

#### Action: `return`
Returns stage winner back to eligible pool and removes from history.
```json
{ "action": "return" }
```

#### Action: `remove`
Deletes an entrant record by ID.
```json
{ "action": "remove", "entryId": "<uuid>" }
```

#### Action: `resetPool`
Restores eligibility for all entrants without deleting attendee records.
```json
{ "action": "resetPool" }
```

#### Action: `setCountdown`
Sets target countdown timestamp.
```json
{ "action": "setCountdown", "endsAt": 1792000000000 }
```

#### Action: `cancelCountdown`
Cancels any active countdown schedule.
```json
{ "action": "cancelCountdown" }
```
