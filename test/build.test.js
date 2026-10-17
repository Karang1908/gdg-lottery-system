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

test('hashName preserves directory structure and file extension', () => {
  const content = Buffer.from('body { margin: 0; }');
  const hashed = hashName('css/sub/style.css', content);
  assert.ok(hashed.startsWith('css/sub/style.'));
  assert.ok(hashed.endsWith('.css'));
});

test('EXCLUDE set contains unreferenced assets', () => {
  assert.ok(EXCLUDE.has('assets/gdg-logo.png'));
});

test('kb formats byte sizes with one decimal precision', () => {
  assert.equal(kb(1024), '1.0 KB');
  assert.equal(kb(2048), '2.0 KB');
  assert.equal(kb(1536), '1.5 KB');
});
