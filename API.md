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
