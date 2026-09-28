import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrecacheList, cacheVersion } from '../src/ui/pwa.js';

test('buildPrecacheList and cacheVersion are consistent', () => {
  const list = buildPrecacheList();
  const expectedVersion = JSON.stringify(list);
  assert.strictEqual(cacheVersion, expectedVersion);
});
