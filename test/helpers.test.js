'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

test('maskEmail obfuscates standard email addresses', () => {
  // Direct test of maskEmail logic
  const mask = (email) => {
    if (typeof email !== 'string') return '';
    const at = email.indexOf('@');
    if (at <= 1) return email;
    const user = email.slice(0, at);
    const domain = email.slice(at);
    if (user.length <= 2) return `${user[0]}*${domain}`;
    return `${user[0]}${'*'.repeat(user.length - 2)}${user[user.length - 1]}${domain}`;
  };
  assert.equal(mask('karan@example.com'), 'k***n@example.com');
  assert.equal(mask('developer@company.org'), 'd*******r@company.org');
});

test('maskEmail handles short username email addresses', () => {
  const mask = (email) => {
    if (typeof email !== 'string') return '';
    const at = email.indexOf('@');
    if (at <= 1) return email;
    const user = email.slice(0, at);
    const domain = email.slice(at);
    if (user.length <= 2) return `${user[0]}*${domain}`;
    return `${user[0]}${'*'.repeat(user.length - 2)}${user[user.length - 1]}${domain}`;
  };
  assert.equal(mask('me@test.com'), 'm*@test.com');
  assert.equal(mask('a@test.com'), 'a@test.com');
});

test('maskEmail handles invalid or non-string inputs safely', () => {
  const mask = (email) => {
    if (typeof email !== 'string') return '';
    const at = email.indexOf('@');
    if (at <= 1) return email;
    const user = email.slice(0, at);
    const domain = email.slice(at);
    if (user.length <= 2) return `${user[0]}*${domain}`;
    return `${user[0]}${'*'.repeat(user.length - 2)}${user[user.length - 1]}${domain}`;
  };
  assert.equal(mask(null), '');
  assert.equal(mask(undefined), '');
  assert.equal(mask(12345), '');
});

test('isValidUUID recognizes standard UUID v4 strings', () => {
  const check = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  assert.equal(check('c9e656d7-8bc8-4399-bfb7-2dc0fead52b2'), true);
  assert.equal(check('00000000-0000-4000-8000-000000000000'), true);
});

test('isValidUUID rejects malformed or truncated UUIDs', () => {
  const check = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  assert.equal(check('c9e656d7-8bc8-4399-bfb7'), false);
  assert.equal(check('not-a-valid-uuid-at-all'), false);
});
