'use strict';

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const STATE_KEY = process.env.LOTTERY_STATE_KEY || 'gdg-lottery:state:v1';
const LOCK_KEY = `${STATE_KEY}:lock`;
const MAX_ENTRIES = 1000;
const MAX_NAME_LENGTH = 80;
const MAX_EMAIL_LENGTH = 254;
const LOCK_MS = 8_000;

class AppError extends Error {
  constructor(message, status = 400, code = 'BAD_REQUEST') {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

function timestamp() {
  return new Date().toISOString();
}

function createState() {
  const now = timestamp();
  return {
    version: 1,
    revision: 0,
    createdAt: now,
    updatedAt: now,
    countdownEndsAt: null,
    winnerId: null,
    entries: [],
    history: [],
  };
}

function normalizeState(value) {
  const fallback = createState();
  if (!value || typeof value !== 'object') return fallback;

  const entries = Array.isArray(value.entries)
    ? value.entries
        .filter((entry) => entry && typeof entry.id === 'string')
        .slice(0, MAX_ENTRIES)
        .map((entry) => ({
          id: entry.id,
          name: String(entry.name || '').slice(0, MAX_NAME_LENGTH),
          email: String(entry.email || '').slice(0, MAX_EMAIL_LENGTH),
          joinedAt: entry.joinedAt || fallback.createdAt,
          selectedAt: entry.selectedAt || null,
        }))
    : [];

  const entryIds = new Set(entries.map((entry) => entry.id));
  return {
    version: 1,
    revision: Number.isSafeInteger(value.revision) ? value.revision : 0,
    createdAt: value.createdAt || fallback.createdAt,
    updatedAt: value.updatedAt || fallback.updatedAt,
    countdownEndsAt:
      typeof value.countdownEndsAt === 'string' ? value.countdownEndsAt : null,
    winnerId: entryIds.has(value.winnerId) ? value.winnerId : null,
    entries,
    history: Array.isArray(value.history)
      ? value.history
          .filter((item) => item && typeof item.name === 'string')
          .slice(0, 100)
          .map((item) => ({
            id: String(item.id || crypto.randomUUID()),
            entryId: String(item.entryId || ''),
            name: item.name.slice(0, MAX_NAME_LENGTH),
            drawnAt: item.drawnAt || fallback.createdAt,
          }))
      : [],
  };
}

function redisConfig() {
  const url =
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

function localStateFile() {
  return (
    process.env.LOTTERY_LOCAL_STATE_FILE ||
    path.join(__dirname, '..', '.lottery-state.json')
  );
}

async function redisCommand(command) {
  const config = redisConfig();
  if (!config) {
    throw new AppError(
      'Persistent storage is not configured. Connect Upstash Redis in Vercel.',
      503,
      'STORAGE_NOT_CONFIGURED'
    );
  }

  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    throw new AppError(
      'The lottery database is temporarily unavailable. Please try again.',
      503,
      'STORAGE_UNAVAILABLE'
    );
  }
  return payload.result;
}

function cloudRequiresRedis() {
  return Boolean(process.env.VERCEL) && !process.env.LOTTERY_ALLOW_LOCAL_FILE;
}

async function readLocalState() {
  try {
    const raw = await fs.readFile(localStateFile(), 'utf8');
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    if (error.code === 'ENOENT') return createState();
    if (error instanceof SyntaxError) {
      throw new AppError(
        'The local lottery state file is invalid JSON.',
        500,
        'LOCAL_STATE_INVALID'
      );
    }
    throw error;
  }
}

async function writeLocalState(state) {
  const file = localStateFile();
  const temporary = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(state, null, 2), 'utf8');
  await fs.rename(temporary, file);
}

async function readState() {
  if (redisConfig()) {
    const raw = await redisCommand(['GET', STATE_KEY]);
    if (raw === null) return createState();
    try {
      return normalizeState(typeof raw === 'string' ? JSON.parse(raw) : raw);
    } catch {
      throw new AppError(
        'Stored lottery data could not be read.',
        500,
        'STORAGE_DATA_INVALID'
      );
    }
  }
  if (cloudRequiresRedis()) {
    throw new AppError(
      'Persistent storage is not configured. Connect Upstash Redis in Vercel.',
      503,
      'STORAGE_NOT_CONFIGURED'
    );
  }
  return readLocalState();
}

let localQueue = Promise.resolve();

async function withLocalLock(operation) {
  const result = localQueue.then(operation, operation);
  localQueue = result.catch(() => undefined);
  return result;
}

async function acquireRedisLock() {
  const token = crypto.randomUUID();
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const result = await redisCommand([
      'SET',
      LOCK_KEY,
      token,
      'PX',
      String(LOCK_MS),
      'NX',
    ]);
    if (result === 'OK') return token;
    await new Promise((resolve) =>
      setTimeout(resolve, 35 + crypto.randomInt(0, 55))
    );
  }
  throw new AppError(
    'The lottery is busy with another update. Please try again.',
    409,
    'LOTTERY_BUSY'
  );
}

async function releaseRedisLock(token) {
  try {
    await redisCommand([
      'EVAL',
      'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
      '1',
      LOCK_KEY,
      token,
    ]);
  } catch {
    // The expiry is the final safety net; a failed release must not mask a
    // successfully persisted mutation.
  }
}

async function mutateState(mutator) {
  const run = async () => {
    const state = await readState();
    const result = (await mutator(state)) || {};
    state.revision += 1;
    state.updatedAt = timestamp();
    const normalized = normalizeState(state);
    if (redisConfig()) {
      await redisCommand(['SET', STATE_KEY, JSON.stringify(normalized)]);
    } else {
      await writeLocalState(normalized);
    }
    return { state: normalized, ...result };
  };

  if (!redisConfig()) {
    if (cloudRequiresRedis()) return run();
    return withLocalLock(run);
  }

  const token = await acquireRedisLock();
  try {
    return await run();
  } finally {
    await releaseRedisLock(token);
  }
}

function cleanName(value) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

function cleanEmail(value) {
  return String(value || '').trim().toLowerCase().slice(0, MAX_EMAIL_LENGTH);
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function publicView(state) {
  const winner = state.entries.find((entry) => entry.id === state.winnerId) || null;
  const eligibleCount = state.entries.reduce(
    (count, entry) => count + (entry.selectedAt ? 0 : 1),
    0
  );
  return {
    revision: state.revision,
    updatedAt: state.updatedAt,
    countdownEndsAt: state.countdownEndsAt,
    eligibleCount,
    totalCount: state.entries.length,
    winner: winner ? { id: winner.id, name: winner.name } : null,
    // The entrant roster is deliberately absent. Entrants only ever learn that
    // they are in; the names live on the admin console alone. adminView adds
    // the full list back for the operator.
    history: state.history.slice(0, 8).map(({ id, name, drawnAt }) => ({
      id,
      name,
      drawnAt,
    })),
  };
}

function adminView(state) {
  return {
    ...publicView(state),
    entries: state.entries.map((entry) => ({ ...entry })),
  };
}

function passwordMatches(supplied) {
  const configured = process.env.ADMIN_PASSWORD || '';
  if (!configured) {
    throw new AppError(
      'ADMIN_PASSWORD is not configured on this deployment.',
      503,
      'ADMIN_PASSWORD_MISSING'
    );
  }
  const actual = Buffer.from(configured);
  const given = Buffer.from(String(supplied || ''));
  return actual.length === given.length && crypto.timingSafeEqual(actual, given);
}

function requireAdmin(password) {
  if (!passwordMatches(password)) {
    throw new AppError('Incorrect admin password.', 401, 'UNAUTHORIZED');
  }
}

async function joinLottery(payload) {
  const name = cleanName(payload && payload.name);
  const email = cleanEmail(payload && payload.email);
  if (name.length < 2) {
    throw new AppError(
      'Enter your full name using at least 2 characters.',
      400,
      'NAME_REQUIRED'
    );
  }
  if (!validEmail(email)) {
    throw new AppError(
      'Enter a valid email address, such as name@example.com.',
      400,
      'EMAIL_INVALID'
    );
  }

  const result = await mutateState((state) => {
    const existing = state.entries.find((entry) => entry.email === email);
    if (existing) return { entry: existing, alreadyJoined: true };
    if (state.entries.length >= MAX_ENTRIES) {
      throw new AppError(
        'This lottery has reached its 1,000-person capacity. Ask the admin to start a new round.',
        409,
        'LOTTERY_FULL'
      );
    }
    const entry = {
      id: crypto.randomUUID(),
      name,
      email,
      joinedAt: timestamp(),
      selectedAt: null,
    };
    state.entries.push(entry);
    return { entry, alreadyJoined: false };
  });

  return {
    entry: {
      id: result.entry.id,
      name: result.entry.name,
      joinedAt: result.entry.joinedAt,
    },
    alreadyJoined: result.alreadyJoined,
    state: publicView(result.state),
  };
}

function replaceWithFreshState(state) {
  const next = createState();
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, next);
}

async function runAdminAction(password, payload) {
  requireAdmin(password);
  const action = String((payload && payload.action) || '');
  if (action === 'get') return adminView(await readState());

  const result = await mutateState((state) => {
    if (action === 'draw') {
      if (state.winnerId) {
        throw new AppError(
          'A winner is still on stage. Advance or return them before drawing again.',
          409,
          'WINNER_ACTIVE'
        );
      }
      const pool = state.entries.filter((entry) => !entry.selectedAt);
      if (!pool.length) {
        throw new AppError(
          state.entries.length
            ? 'Everyone has already been selected. Reset eligibility to draw again.'
            : 'No one has joined the lottery yet.',
          409,
          'NO_ELIGIBLE_ENTRIES'
        );
      }
      const winner = pool[crypto.randomInt(pool.length)];
      const drawnAt = timestamp();
      winner.selectedAt = drawnAt;
      state.winnerId = winner.id;
      state.history.unshift({
        id: crypto.randomUUID(),
        entryId: winner.id,
        name: winner.name,
        drawnAt,
      });
      state.history = state.history.slice(0, 100);
      return { winnerId: winner.id };
    }

    if (action === 'advance') {
      if (!state.winnerId) {
        throw new AppError('There is no current winner to clear.', 409, 'NO_WINNER');
      }
      state.winnerId = null;
      return {};
    }

    if (action === 'return') {
      if (!state.winnerId) {
        throw new AppError('There is no current winner to return.', 409, 'NO_WINNER');
      }
      const winnerId = state.winnerId;
      const winner = state.entries.find((entry) => entry.id === winnerId);
      if (winner) winner.selectedAt = null;
      state.winnerId = null;
      const historyIndex = state.history.findIndex(
        (item) => item.entryId === winnerId
      );
      if (historyIndex !== -1) state.history.splice(historyIndex, 1);
      return {};
    }

    if (action === 'remove') {
      const entryId = String(payload.entryId || '');
      const before = state.entries.length;
      state.entries = state.entries.filter((entry) => entry.id !== entryId);
      if (state.entries.length === before) {
        throw new AppError('That entry no longer exists.', 404, 'ENTRY_NOT_FOUND');
      }
      if (state.winnerId === entryId) state.winnerId = null;
      return {};
    }

    if (action === 'resetPool') {
      state.entries.forEach((entry) => {
        entry.selectedAt = null;
      });
      state.winnerId = null;
      state.history = [];
      return {};
    }

    if (action === 'resetAll') {
      replaceWithFreshState(state);
      return {};
    }

    if (action === 'setCountdown') {
      const endsAtMs = Number(payload.endsAt);
      const now = Date.now();
      const max = now + 90 * 24 * 60 * 60 * 1000;
      if (!Number.isFinite(endsAtMs) || endsAtMs < now + 2_000 || endsAtMs > max) {
        throw new AppError(
          'Choose a countdown between a few seconds and 90 days from now.',
          400,
          'COUNTDOWN_INVALID'
        );
      }
      state.countdownEndsAt = new Date(endsAtMs).toISOString();
      return {};
    }

    if (action === 'cancelCountdown') {
      state.countdownEndsAt = null;
      return {};
    }

    throw new AppError('Unknown admin action.', 400, 'ACTION_INVALID');
  });

  return { ...adminView(result.state), winnerId: result.winnerId || null };
}

module.exports = {
  AppError,
  MAX_ENTRIES,
  adminView,
  createState,
  joinLottery,
  publicView,
  readState,
  requireAdmin,
  runAdminAction,
};
