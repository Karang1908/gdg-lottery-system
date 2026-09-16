# GDG Persistent Lottery

A Vercel-ready lottery for large live events. Entrants submit a name and email,
their entry persists after they close the tab, and the admin draws from a wheel
that remains responsive at 150+ people.

## What is included

- Entrant page at `/` with name/email validation and durable confirmation.
- Password-protected admin console at `/admin`.
- Shared, persistent “Next lottery in” countdown.
- Server-committed random draws using Node's `crypto.randomInt`.
- Previous-winner exclusion, winner history, return-to-pool, individual removal,
  eligibility reset, and full reset.
- Public API payloads never contain entrant emails.
- Canvas wheel with fitted names at smaller counts and initials plus hover lookup
  at high density. A semantic roster is always available.
- Light/dark themes, reduced-motion support, responsive layouts, and self-hosted
  brand fonts/assets.

## Local development

```bash
cp .env.example .env
# Set ADMIN_PASSWORD in .env
npm install
npm run dev
```

Open the port configured in `.env` (for example `http://localhost:3001` and
`http://localhost:3001/admin`). Local development stores state in
`.lottery-state.json`, which is ignored by Git.

Run verification with:

```bash
npm test
npm run build
```

## Deploy to Vercel

1. Import this directory as a Vercel project.
2. Add an **Upstash Redis** integration from the Vercel Marketplace and connect
   it to the project. Vercel injects the REST URL and token automatically.
3. Add `ADMIN_PASSWORD` in Project Settings → Environment Variables. Use a long,
   random value and enable it for Production (and Preview if needed).
4. Deploy. The included `vercel.json` builds the static frontend and deploys the
   files in `api/` as Node.js Functions.

The app supports both environment-variable pairs used by current Upstash/Vercel
integrations:

```text
KV_REST_API_URL / KV_REST_API_TOKEN
UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
```

If a Vercel deployment has no Redis credentials, API calls return a clear 503
configuration error instead of accepting entries into temporary memory.

## Data and privacy

Each entry stores an ID, name, normalized email, join time, and optional selected
time. Email is used for case-insensitive deduplication and is returned only to an
authenticated admin request. No email is sent and no third-party analytics are
included.

Use **Clear every entry** after the event to remove the current roster from the
database. Upstash retention and account-level backups remain governed by the
settings of the connected database.

## API overview

- `GET /api/state` — public names, counts, winner, history, countdown.
- `POST /api/join` — add or resume an entry by email (`{ name, email }`).
- `GET /api/state?admin=1` — full state including entry email addresses (requires `x-admin-password` header).
- `POST /api/admin` — authenticated draw and management actions (requires `x-admin-password` header).

### Admin actions

| Action | Payload properties | Description |
| --- | --- | --- |
| `get` | — | Retrieves current administrative state snapshot |
| `draw` | — | Randomly selects one eligible entrant via `crypto.randomInt` and stages them as winner |
| `advance` | — | Clears the active winner from the stage, allowing subsequent draws |
| `return` | — | Returns current winner to the pool, restoring eligibility and removing them from history |
| `remove` | `entryId` (string) | Removes a specific entrant from the giveaway roster |
| `resetPool` | — | Resets eligibility for all registered entrants and clears winner history |
| `resetAll` | — | Completely resets the giveaway state back to empty |
| `setCountdown` | `endsAt` (number, epoch ms) | Sets a scheduled countdown timestamp (between +2s and +90 days) |
| `cancelCountdown` | — | Cancels any active countdown schedule |

All state-changing operations run under a distributed Redis lock. This prevents
simultaneous joins or admin actions from overwriting one another in Vercel's
concurrent serverless execution model.

