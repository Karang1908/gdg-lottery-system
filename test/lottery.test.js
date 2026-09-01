'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  adminView,
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
