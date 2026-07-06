'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const colors = require('../src/colors');

test('paint: disabled returns plain text', () => {
  assert.equal(colors.paint('accent', 'x', false, false), 'x');
  assert.equal(colors.paint('accent', 'x', false, true), 'x');
});

test('paint: truecolor vs 256', () => {
  const tc = colors.paint('accent', 'x', true, true);
  assert.match(tc, /\x1b\[38;2;95;179;179m/);
  assert.match(tc, /x\x1b\[0m$/);
  const c256 = colors.paint('accent', 'x', true, false);
  assert.match(c256, /\x1b\[38;5;73m/);
});

test('paint: back-compat aliases resolve', () => {
  // white -> text, red -> crit, gray -> dim
  assert.match(colors.paint('white', 'x', true, false), /38;5;252/);
  assert.match(colors.paint('red', 'x', true, false), /38;5;167/);
  assert.match(colors.paint('gray', 'x', true, false), /38;5;245/);
});

test('paint: unknown colour returns plain', () => {
  assert.equal(colors.paint('nope', 'x', true, true), 'x');
});

test('usageColor: higher is worse', () => {
  assert.equal(colors.usageColor(10, 50, 80), 'good');
  assert.equal(colors.usageColor(60, 50, 80), 'warn');
  assert.equal(colors.usageColor(90, 50, 80), 'crit');
});

test('qualityColor: higher is better', () => {
  assert.equal(colors.qualityColor(90, 40, 70), 'good');
  assert.equal(colors.qualityColor(50, 40, 70), 'warn');
  assert.equal(colors.qualityColor(10, 40, 70), 'crit');
});

test('hexToRgb', () => {
  assert.deepEqual(colors.hexToRgb('#5FB3B3'), [95, 179, 179]);
  assert.deepEqual(colors.hexToRgb('85BB65'), [133, 187, 101]);
});

test('sampleStops: endpoints and midpoint', () => {
  const stops = [[0, 0, 0], [10, 20, 30]];
  assert.deepEqual(colors.sampleStops(stops, 0), [0, 0, 0]);
  assert.deepEqual(colors.sampleStops(stops, 1), [10, 20, 30]);
  assert.deepEqual(colors.sampleStops(stops, 0.5), [5, 10, 15]);
});

test('gradientText: truecolor on, else null', () => {
  const stops = [[255, 0, 0], [0, 0, 255]];
  const g = colors.gradientText('abc', stops, { enabled: true, truecolor: true, phase: 0, spread: 0.5 });
  assert.match(g, /\x1b\[38;2;/);
  assert.match(g, /\x1b\[0m$/);
  assert.equal(colors.gradientText('abc', stops, { enabled: false, truecolor: true }), null);
  assert.equal(colors.gradientText('abc', stops, { enabled: true, truecolor: false }), null);
});

test('colorEnabled honours NO_COLOR and cfg', () => {
  const prev = process.env.NO_COLOR;
  delete process.env.NO_COLOR;
  assert.equal(colors.colorEnabled({}), true);
  assert.equal(colors.colorEnabled({ colors: false }), false);
  process.env.NO_COLOR = '1';
  assert.equal(colors.colorEnabled({}), false);
  if (prev === undefined) delete process.env.NO_COLOR;
  else process.env.NO_COLOR = prev;
});
