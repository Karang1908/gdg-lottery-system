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
