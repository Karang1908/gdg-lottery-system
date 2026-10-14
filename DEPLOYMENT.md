# Deployment Guide

This guide details deploying the GDG Persistent Lottery System to Vercel or Node.js server environments.

## Vercel Deployment
The application includes a `vercel.json` configuration that builds and routes frontend assets and serverless functions.

## Upstash Redis Provisioning
1. Create a free Redis database at [Upstash](https://upstash.com).
2. Copy the REST URL and REST Token.
3. Configure the following environment variables in your Vercel Project Settings:
   - `KV_REST_API_URL` (or `UPSTASH_REDIS_REST_URL`)
   - `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_TOKEN`)

## Local File-Backed Development
When running locally via `npm run dev`, if Redis environment variables are absent, the system defaults to persisting state to `.lottery-state.json` in the project root. This file is git-ignored to prevent committing event attendee data.

## Production Environment Variables Checklist
- [ ] `ADMIN_PASSWORD`: Strong administrative password secret.
- [ ] `KV_REST_API_URL`: Upstash or Vercel KV REST URL.
- [ ] `KV_REST_API_TOKEN`: Upstash or Vercel KV REST bearer token.
- [ ] `PORT`: Optional HTTP listening port (defaults to 3000).
