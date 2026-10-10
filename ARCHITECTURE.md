# System Architecture

## Overview
The GDG Persistent Lottery System is an event-grade giveaway platform designed for high-concurrency event attendance, resilient stage presentation, and real-time entrant registration.

```
       +-----------------------+
       |   Audience Devices    |
       |  (Mobile Registration)|
       +-----------+-----------+
                   | POST /api/join
                   v
       +-----------------------+
       |   Express HTTP API    | <==== Operator Display (/admin)
       +-----------+-----------+
                   | Atomic Mutex Serialization
                   v
       +-----------------------+
       | Persistence Storage   |
       | (Upstash / Disk File) |
       +-----------------------+
```

## Client-Side Polling and State Reconciliation
The frontend client uses adaptive short-polling against `/api/state`. When polling returns a state with an identical `revision` number, the DOM reconciliation short-circuits to avoid wasteful re-rendering of the canvas wheel. When revision increments, the client updates entrant counts and current winner display.

## Atomic Mutation and Local Mutex Locking
Mutations to the lottery roster (joins, draws, advance, returns) are serialized through an asynchronous promise queue (`withLocalLock`). This guarantees that concurrent entrant submissions never produce race conditions or overwrite each other in single-process or development mode.

## Dual-Store Persistence Abstraction
The system seamlessly toggles between two persistence layers:
1. **Upstash Redis REST API**: Used in serverless environments (e.g. Vercel) where local filesystems are ephemeral.
2. **Local JSON State File**: Used in local development and offline event environments, persisting state across server restarts to a single JSON document.
