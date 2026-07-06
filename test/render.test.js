'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { render, wrapPieces, terminalWidth } = require('../src/index');
const { prettyModel } = require('../src/segments');
const { merge, DEFAULTS } = require('../src/config');

const SAMPLE = {
  session_id: 's1',
  model: { id: 'claude-opus-4-8', display_name: 'Opus' },
  context_window: { used_percentage: 8, total_input_tokens: 82000, context_window_size: 1000000 },
  cost: { total_cost_usd: 549.48 },
};

function cfg(over) {
  return merge(DEFAULTS, Object.assign({ colors: false, wrap: { enabled: false } }, over));
}

test('prettyModel: known ids and fallback', () => {
  assert.equal(prettyModel({ id: 'claude-opus-4-8' }), 'Opus 4.8');
  assert.equal(prettyModel({ id: 'claude-sonnet-4-6' }), 'Sonnet 4.6');
  assert.equal(prettyModel({ id: 'claude-opus-4-8[1m]' }), 'Opus 4.8');
  assert.equal(prettyModel({ id: 'claude-haiku-4-5-20251001' }), 'Haiku 4.5');
  assert.equal(prettyModel({ display_name: 'Foo' }), 'Foo');
  assert.equal(prettyModel({}), '');
});

test('render: empty payload never throws, returns string', () => {
  const c = cfg({ segments: ['model', 'context', 'cost'] });
  assert.doesNotThrow(() => render({}, c));
  assert.equal(typeof render({}, c), 'string');
});

test('render: sample produces expected plain segments', () => {
  const out = render(SAMPLE, cfg({ segments: ['model', 'context', 'cost'] }));
  assert.match(out, /Opus 4\.8/);
  assert.match(out, /ctx/);
  assert.match(out, /8%/);
  assert.match(out, /82k\/1M/);
  assert.match(out, /\$549\.48/);
});

test('render: no ANSI when colors off', () => {
  const out = render(SAMPLE, cfg({ segments: ['model', 'cost'] }));
  assert.equal(/\x1b\[/.test(out), false);
});

test('render: multi-line via array-of-arrays', () => {
  const out = render(SAMPLE, cfg({ segments: [['model'], ['cost']] }));
  const lines = out.split('\n');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /Opus 4\.8/);
  assert.match(lines[1], /\$549\.48/);
});

test('render: empty logical line is dropped', () => {
  // 'pr' has no data in SAMPLE -> that line is empty and removed
  const out = render(SAMPLE, cfg({ segments: [['pr'], ['model']] }));
  assert.equal(out.split('\n').length, 1);
  assert.match(out, /Opus 4\.8/);
});

test('render: per-task cost baseline + delta', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-'));
  const prev = process.env.CLAUDE_CONFIG_DIR;
  process.env.CLAUDE_CONFIG_DIR = dir;
  try {
    const c = cfg({
      segments: ['cost'],
      cost: { decimals: 2, showSession: false, showTask: true, taskLabel: 'task', sessionLabel: '' },
    });
    const first = render({ session_id: 's1', cost: { total_cost_usd: 1.0 } }, c);
    assert.match(first, /\(task \$0\.00\)/);
    const second = render({ session_id: 's1', cost: { total_cost_usd: 1.3 } }, c);
    assert.match(second, /\(task \$0\.30\)/);
  } finally {
    if (prev === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = prev;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('render: lines showTask baseline + delta', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-'));
  const prev = process.env.CLAUDE_CONFIG_DIR;
  process.env.CLAUDE_CONFIG_DIR = dir;
  try {
    const c = cfg({ segments: ['lines'], lines: { showTask: true } });
    const first = render({ session_id: 's1', cost: { total_lines_added: 100, total_lines_removed: 20 } }, c);
    assert.equal(first.includes('+'), false); // delta 0/0 -> segment empty
    const second = render({ session_id: 's1', cost: { total_lines_added: 156, total_lines_removed: 23 } }, c);
    assert.match(second, /\+56\/-3/); // +56 added, -3 removed since baseline
  } finally {
    if (prev === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = prev;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('wrapPieces: packs to width, never exceeds', () => {
  const pieces = ['aaaa', 'bbbb', 'cccc', 'dddd'];
  const lines = wrapPieces(pieces, ' | ', 3, 10);
  assert.ok(lines.length >= 2);
  for (const l of lines) {
    assert.ok(l.replace(/\x1b\[[0-9;]*m/g, '').length <= 10);
  }
});

test('terminalWidth: explicit maxWidth wins; always positive', () => {
  assert.equal(terminalWidth({ wrap: { maxWidth: 120 } }), 120);
  const w = terminalWidth({ wrap: { maxWidth: 0, fallbackWidth: 77 } });
  assert.equal(typeof w, 'number');
  assert.ok(w > 0);
});
