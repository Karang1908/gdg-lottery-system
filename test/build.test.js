'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { walk, hashName, EXCLUDE, kb } = require('../build');

test('walk lists all assets in public directory', () => {
  const files = walk(path.join(__dirname, '../public'));
  assert.ok(files.length > 0);
  assert.ok(files.some((f) => f.endsWith('index.html')));
  assert.ok(files.some((f) => f.endsWith('admin.html')));
});

test('hashName generates 8-character sha256 content hashes', () => {
  const content = Buffer.from('console.log("hello");');
  const hashed = hashName('app.js', content);
  assert.match(hashed, /^app\.[0-9a-f]{8}\.js$/);
});
