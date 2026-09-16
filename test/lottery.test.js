'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  adminView,
  createState,
  joinLottery,
  publicView,
  readState,
  requireAdmin,
  runAdminAction,
} = require('../lib/lottery');

test('persistent lottery handles 175 concurrent entrants and unique draws', async () => {
  const file = path.join(
    os.tmpdir(),
    `gdg-lottery-test-${process.pid}-${Date.now()}.json`
  );
  process.env.LOTTERY_LOCAL_STATE_FILE = file;
  process.env.ADMIN_PASSWORD = 'test-admin-password';
  delete process.env.VERCEL;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;

  try {
    const joins = await Promise.all(
      Array.from({ length: 175 }, (_, index) =>
        joinLottery({
          name: `Entrant ${index + 1}`,
          email: `person${index + 1}@example.com`,
        })
      )
    );
    assert.equal(joins.length, 175);
    assert.equal(new Set(joins.map((join) => join.entry.id)).size, 175);

    const duplicate = await joinLottery({
      name: 'A different display name',
      email: 'PERSON1@EXAMPLE.COM',
    });
    assert.equal(duplicate.alreadyJoined, true);
    assert.equal(duplicate.entry.name, 'Entrant 1');

    const stored = await readState();
    assert.equal(stored.entries.length, 175);
    const publicState = publicView(stored);
    assert.equal('entries' in publicState, false);
    assert.equal(publicState.totalCount, 175);
    assert.equal(adminView(stored).entries.length, 175);

    assert.throws(() => requireAdmin('wrong-password'), /Incorrect/);
    const countdownEnd = Date.now() + 10 * 60 * 1000;
    const scheduled = await runAdminAction('test-admin-password', {
      action: 'setCountdown',
      endsAt: countdownEnd,
    });
    assert.ok(Math.abs(new Date(scheduled.countdownEndsAt).getTime() - countdownEnd) < 10);

    const selectedIds = new Set();
    for (let index = 0; index < 20; index += 1) {
      const draw = await runAdminAction('test-admin-password', { action: 'draw' });
      assert.ok(draw.winner);
      assert.equal(selectedIds.has(draw.winner.id), false);
      selectedIds.add(draw.winner.id);
      await runAdminAction('test-admin-password', { action: 'advance' });
    }
    assert.equal(selectedIds.size, 20);

    const reset = await runAdminAction('test-admin-password', {
      action: 'resetPool',
    });
    assert.equal(reset.eligibleCount, 175);
    assert.equal(reset.history.length, 0);
  } finally {
    await fs.rm(file, { force: true });
  }
});

test('validation rejects malformed entrant data', async () => {
  const file = path.join(os.tmpdir(), `gdg-lottery-validation-${process.pid}.json`);
  process.env.LOTTERY_LOCAL_STATE_FILE = file;
  try {
    await assert.rejects(
      () => joinLottery({ name: 'A', email: 'not-an-email' }),
      /full name/
    );
    await assert.rejects(
      () => joinLottery({ name: 'Valid Name', email: 'not-an-email' }),
      /valid email/
    );
  } finally {
    await fs.rm(file, { force: true });
  }
});

test('admin actions handle winner lifecycle, removal, and pool resets', async () => {
  const file = path.join(
    os.tmpdir(),
    `gdg-lottery-admin-${process.pid}-${Date.now()}.json`
  );
  process.env.LOTTERY_LOCAL_STATE_FILE = file;
  process.env.ADMIN_PASSWORD = 'admin-secret-key';
  try {
    await assert.rejects(
      () => runAdminAction('admin-secret-key', { action: 'draw' }),
      /No one has joined/
    );
    await assert.rejects(
      () => runAdminAction('admin-secret-key', { action: 'advance' }),
      /no current winner/
    );
    await assert.rejects(
      () => runAdminAction('admin-secret-key', { action: 'return' }),
      /no current winner/
    );

    const entrant1 = await joinLottery({
      name: 'Alice Smith',
      email: 'alice@example.com',
    });
    const entrant2 = await joinLottery({
      name: 'Bob Jones',
      email: 'bob@example.com',
    });

    const draw1 = await runAdminAction('admin-secret-key', { action: 'draw' });
    assert.ok(draw1.winner);
    assert.equal(draw1.winnerId, draw1.winner.id);

    await assert.rejects(
      () => runAdminAction('admin-secret-key', { action: 'draw' }),
      /still on stage/
    );

    const returned = await runAdminAction('admin-secret-key', { action: 'return' });
    assert.equal(returned.winner, null);
    assert.equal(returned.winnerId, null);
    assert.equal(returned.eligibleCount, 2);
    assert.equal(returned.history.length, 0);

    await runAdminAction('admin-secret-key', { action: 'draw' });
    await runAdminAction('admin-secret-key', { action: 'advance' });
    await runAdminAction('admin-secret-key', { action: 'draw' });
    await runAdminAction('admin-secret-key', { action: 'advance' });

    await assert.rejects(
      () => runAdminAction('admin-secret-key', { action: 'draw' }),
      /Everyone has already been selected/
    );

    await runAdminAction('admin-secret-key', {
      action: 'remove',
      entryId: entrant1.entry.id,
    });
    const stateAfterRemoval = await readState();
    assert.equal(stateAfterRemoval.entries.length, 1);
    assert.equal(stateAfterRemoval.entries[0].id, entrant2.entry.id);

    await assert.rejects(
      () =>
        runAdminAction('admin-secret-key', {
          action: 'remove',
          entryId: 'non-existent',
        }),
      /no longer exists/
    );

    await assert.rejects(
      () => runAdminAction('admin-secret-key', { action: 'unknown' }),
      /Unknown admin action/
    );

    await runAdminAction('admin-secret-key', { action: 'resetAll' });
    const cleared = await readState();
    assert.equal(cleared.entries.length, 0);
    assert.equal(cleared.history.length, 0);
    assert.equal(cleared.winnerId, null);
  } finally {
    await fs.rm(file, { force: true });
  }
});

test('countdown scheduler enforces future boundary and allows cancellation', async () => {
  const file = path.join(
    os.tmpdir(),
    `gdg-lottery-countdown-${process.pid}-${Date.now()}.json`
  );
  process.env.LOTTERY_LOCAL_STATE_FILE = file;
  process.env.ADMIN_PASSWORD = 'admin-secret-key';
  try {
    await assert.rejects(
      () =>
        runAdminAction('admin-secret-key', {
          action: 'setCountdown',
          endsAt: Date.now(),
        }),
      /between a few seconds and 90 days/
    );

    const over90Days = Date.now() + 91 * 24 * 60 * 60 * 1000;
    await assert.rejects(
      () =>
        runAdminAction('admin-secret-key', {
          action: 'setCountdown',
          endsAt: over90Days,
        }),
      /between a few seconds and 90 days/
    );

    await assert.rejects(
      () =>
        runAdminAction('admin-secret-key', {
          action: 'setCountdown',
          endsAt: 'invalid',
        }),
      /between a few seconds and 90 days/
    );

    const validEndsAt = Date.now() + 60_000;
    const scheduled = await runAdminAction('admin-secret-key', {
      action: 'setCountdown',
      endsAt: validEndsAt,
    });
    assert.ok(scheduled.countdownEndsAt);

    const cancelled = await runAdminAction('admin-secret-key', {
      action: 'cancelCountdown',
    });
    assert.equal(cancelled.countdownEndsAt, null);
  } finally {
    await fs.rm(file, { force: true });
  }
});

test('entrant sanitization normalizes whitespace and rejects control characters', async () => {
  const file = path.join(
    os.tmpdir(),
    `gdg-lottery-sanitize-${process.pid}-${Date.now()}.json`
  );
  process.env.LOTTERY_LOCAL_STATE_FILE = file;
  try {
    const joined = await joinLottery({
      name: '  Grace \x00\x1f Hopper  \t  ',
      email: '  Grace.Hopper@Example.COM  ',
    });
    assert.equal(joined.entry.name, 'Grace Hopper');

    const state = await readState();
    const stored = state.entries.find((e) => e.id === joined.entry.id);
    assert.equal(stored.name, 'Grace Hopper');
    assert.equal(stored.email, 'grace.hopper@example.com');
  } finally {
    await fs.rm(file, { force: true });
  }
});


test('joinLottery rejects submissions once MAX_ENTRIES capacity is reached', async () => {
  const file = path.join(
    os.tmpdir(),
    `gdg-lottery-cap-${process.pid}-${Date.now()}.json`
  );
  process.env.LOTTERY_LOCAL_STATE_FILE = file;
  try {
    const state = createState();
    for (let i = 0; i < 1000; i += 1) {
      state.entries.push({
        id: `entry-${i}`,
        name: `Person ${i}`,
        email: `person${i}@example.com`,
        joinedAt: new Date().toISOString(),
        selectedAt: null,
      });
    }
    await fs.writeFile(file, JSON.stringify(state));

    await assert.rejects(
      () => joinLottery({ name: 'Overflow Entrant', email: 'overflow@example.com' }),
      /capacity/
    );
  } finally {
    await fs.rm(file, { force: true });
  }
});
