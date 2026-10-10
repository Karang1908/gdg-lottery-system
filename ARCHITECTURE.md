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
