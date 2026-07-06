'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { merge, stripJsonComments, loadConfig, DEFAULTS } = require('../src/config');

test('merge: deep-merges nested objects, overwrites scalars/arrays', () => {
  const base = { a: 1, nested: { x: 1, y: 2 }, arr: [1, 2] };
  const over = { a: 2, nested: { y: 9 }, arr: [3] };
  const out = merge(base, over);
  assert.equal(out.a, 2);
  assert.deepEqual(out.nested, { x: 1, y: 9 });
  assert.deepEqual(out.arr, [3]);
  // base not mutated
  assert.deepEqual(base.nested, { x: 1, y: 2 });
});

test('stripJsonComments: removes // and /* */, preserves strings', () => {
  const src = `{
    // line comment
    "a": 1, /* block */ "b": "keep // this",
    "url": "http://x/y" /* trailing */
  }`;
  const parsed = JSON.parse(stripJsonComments(src));
  assert.equal(parsed.a, 1);
  assert.equal(parsed.b, 'keep // this');
  assert.equal(parsed.url, 'http://x/y');
});

test('loadConfig: reads JSONC via CLAUDE_STATUSLINE_CONFIG and merges defaults', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-'));
  const file = path.join(dir, 'config.json');
  fs.writeFileSync(file, `{
    // a commented config
    "icons": true,           // flip icons
    "cost": { "sessionLabel": "ses" }
  }`);
  const prev = process.env.CLAUDE_STATUSLINE_CONFIG;
  process.env.CLAUDE_STATUSLINE_CONFIG = file;
  try {
    const cfg = loadConfig();
    assert.equal(cfg.icons, true);                 // from user file
    assert.equal(cfg.cost.sessionLabel, 'ses');    // nested override
    assert.equal(cfg.cost.decimals, DEFAULTS.cost.decimals); // merged default kept
    assert.ok(Array.isArray(cfg.segments));        // default segments present
  } finally {
    if (prev === undefined) delete process.env.CLAUDE_STATUSLINE_CONFIG;
    else process.env.CLAUDE_STATUSLINE_CONFIG = prev;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('loadConfig: broken config falls back to defaults (never throws)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-'));
  const file = path.join(dir, 'config.json');
  fs.writeFileSync(file, '{ this is not json ');
  const prev = process.env.CLAUDE_STATUSLINE_CONFIG;
  process.env.CLAUDE_STATUSLINE_CONFIG = file;
  try {
    const cfg = loadConfig();
    assert.ok(cfg && Array.isArray(cfg.segments)); // defaults
  } finally {
    if (prev === undefined) delete process.env.CLAUDE_STATUSLINE_CONFIG;
    else process.env.CLAUDE_STATUSLINE_CONFIG = prev;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
