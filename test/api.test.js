'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const stateFile = path.join(
  os.tmpdir(),
  `gdg-lottery-api-test-${process.pid}-${Date.now()}.json`
);
process.env.LOTTERY_LOCAL_STATE_FILE = stateFile;
process.env.ADMIN_PASSWORD = 'api-test-password';
delete process.env.VERCEL;
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const { app } = require('../server');

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(stateFile, { force: true });
});

async function apiRequest(endpoint, { method = 'GET', headers = {}, body } = {}) {
  const options = {
    method,
    headers: { ...headers },
  };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${baseUrl}${endpoint}`, options);
  const data = await res.json().catch(() => null);
  return { status: res.status, headers: res.headers, data };
}

test('GET /healthz returns ok text status', async () => {
  const res = await fetch(`${baseUrl}/healthz`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.equal(text, 'ok');
});

test('GET /api/state returns public snapshot without entrant personal info', async () => {
  const { status, data } = await apiRequest('/api/state');
  assert.equal(status, 200);
  assert.equal(typeof data.revision, 'number');
  assert.equal(typeof data.totalCount, 'number');
  assert.equal(typeof data.eligibleCount, 'number');
  assert.equal('entries' in data, false);
});

test('POST /api/join registers entrant and rejects invalid submissions', async () => {
  const badRes = await apiRequest('/api/join', {
    method: 'POST',
    body: { name: 'X', email: 'invalid-email' },
  });
  assert.equal(badRes.status, 400);
  assert.ok(badRes.data.error);

  const goodRes = await apiRequest('/api/join', {
    method: 'POST',
    body: { name: 'Ada Lovelace', email: 'ada@example.com' },
  });
  assert.equal(goodRes.status, 201);
  assert.equal(goodRes.data.entry.name, 'Ada Lovelace');
  assert.equal(goodRes.data.alreadyJoined, false);

  const dupRes = await apiRequest('/api/join', {
    method: 'POST',
    body: { name: 'Ada L.', email: 'ADA@EXAMPLE.COM' },
  });
  assert.equal(dupRes.status, 200);
  assert.equal(dupRes.data.alreadyJoined, true);
  assert.equal(dupRes.data.entry.name, 'Ada Lovelace');
});

test('GET /api/state?admin=1 requires password and exposes full roster', async () => {
  const unauthRes = await apiRequest('/api/state?admin=1');
  assert.equal(unauthRes.status, 401);

  const wrongRes = await apiRequest('/api/state?admin=1', {
    headers: { 'x-admin-password': 'wrong' },
  });
  assert.equal(wrongRes.status, 401);

  const authRes = await apiRequest('/api/state?admin=1', {
    headers: { 'x-admin-password': 'api-test-password' },
  });
  assert.equal(authRes.status, 200);
  assert.ok(Array.isArray(authRes.data.entries));
  assert.equal(authRes.data.entries.length, 1);
  assert.equal(authRes.data.entries[0].email, 'ada@example.com');
});

test('POST /api/admin validates credentials and runs operations', async () => {
  const unauthRes = await apiRequest('/api/admin', {
    method: 'POST',
    body: { action: 'draw' },
  });
  assert.equal(unauthRes.status, 401);

  const countdownMs = Date.now() + 120_000;
  const adminRes = await apiRequest('/api/admin', {
    method: 'POST',
    headers: { 'x-admin-password': 'api-test-password' },
    body: { action: 'setCountdown', endsAt: countdownMs },
  });
  assert.equal(adminRes.status, 200);
  assert.ok(adminRes.data.countdownEndsAt);

  const cancelRes = await apiRequest('/api/admin', {
    method: 'POST',
    headers: { 'x-admin-password': 'api-test-password' },
    body: { action: 'cancelCountdown' },
  });
  assert.equal(cancelRes.status, 200);
  assert.equal(cancelRes.data.countdownEndsAt, null);
});

test('POST /api/join returns 400 when body contains malformed JSON syntax', async () => {
  const res = await fetch(`${baseUrl}/api/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"invalidJson',
  });
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.match(json.error, /Request body must be valid JSON/);
});

test('POST /api/admin returns 400 when body contains malformed JSON syntax', async () => {
  const res = await fetch(`${baseUrl}/api/admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{broken',
  });
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.match(json.error, /Request body must be valid JSON/);
});

test('API endpoints set Cache-Control private no-store headers to prevent intermediate caching', async () => {
  const stateRes = await fetch(`${baseUrl}/api/state`);
  assert.equal(stateRes.headers.get('cache-control'), 'private, no-store, max-age=0');

  const joinRes = await fetch(`${baseUrl}/api/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Header Check', email: 'header@test.com' }),
  });
  assert.equal(joinRes.headers.get('cache-control'), 'private, no-store, max-age=0');
});

test('server disables x-powered-by header across all HTTP responses', async () => {
  const res = await fetch(`${baseUrl}/healthz`);
  assert.equal(res.headers.has('x-powered-by'), false);
});

test('GET /api/nonexistent returns 404 status code', async () => {
  const res = await fetch(`${baseUrl}/api/nonexistent`);
  assert.equal(res.status, 404);
});

test('GET /api/state?admin=0 returns public view and ignores admin credentials', async () => {
  const res = await apiRequest('/api/state?admin=0', {
    headers: { 'x-admin-password': 'api-test-password' },
  });
  assert.equal(res.status, 200);
  assert.equal('entries' in res.data, false);
});

test('GET /admin serves HTML content-type', async () => {
  const res = await fetch(`${baseUrl}/admin`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /text\/html/);
});
