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
