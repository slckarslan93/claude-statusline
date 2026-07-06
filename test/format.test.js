'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fmt = require('../src/format');

test('tokens: humanizes counts', () => {
  assert.equal(fmt.tokens(0), '0');
  assert.equal(fmt.tokens(950), '950');
  assert.equal(fmt.tokens(15500), '15.5k');
  assert.equal(fmt.tokens(184000), '184k');
  assert.equal(fmt.tokens(1000000), '1M');
  assert.equal(fmt.tokens(null), '');
});

test('windowSize: compact denominator', () => {
  assert.equal(fmt.windowSize(200000), '200k');
  assert.equal(fmt.windowSize(1000000), '1M');
  assert.equal(fmt.windowSize(0), '');
});

test('duration: ms to human', () => {
  assert.equal(fmt.duration(45000), '45s');
  assert.equal(fmt.duration(720000), '12m');
  assert.equal(fmt.duration(3660000), '1h 1m');
  assert.equal(fmt.duration(3600000), '1h');
  assert.equal(fmt.duration(null), '');
});

test('money: USD with tiny-value collapse', () => {
  assert.equal(fmt.money(0), '$0.00');
  assert.equal(fmt.money(0.1234), '$0.12');
  assert.equal(fmt.money(0.001), '<$0.01');
  assert.equal(fmt.money(549.48), '$549.48');
  assert.equal(fmt.money(null), '');
});

test('pct: rounded percent', () => {
  assert.equal(fmt.pct(0), '0%');
  assert.equal(fmt.pct(23.4), '23%');
  assert.equal(fmt.pct(null), '');
});

test('countdown: future/past', () => {
  const now = 1_000_000_000_000; // fixed
  assert.equal(fmt.countdown(1_000_000_000 + 9240, now), '2h 34m');
  assert.equal(fmt.countdown(1_000_000_000 + 300, now), '5m');
  assert.equal(fmt.countdown(1_000_000_000 - 100, now), ''); // past -> empty
  assert.equal(fmt.countdown(0, now), '');
});

test('stringWidth: strips ANSI, counts wide glyphs', () => {
  assert.equal(fmt.stringWidth('abc'), 3);
  assert.equal(fmt.stringWidth('\x1b[38;5;73mabc\x1b[0m'), 3);
  assert.equal(fmt.stringWidth('│'), 1); // box drawing = 1
  assert.equal(fmt.stringWidth('▓░'), 2); // shade blocks = 1 each
  assert.equal(fmt.stringWidth('📁'), 2); // astral emoji = 2
  assert.equal(fmt.stringWidth('⚡'), 2); // emoji-presentation symbol = 2
  assert.equal(fmt.stringWidth(''), 0);
});
