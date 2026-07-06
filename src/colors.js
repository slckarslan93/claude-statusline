'use strict';

// 256-color ANSI palette. Names are semantic so segments never hardcode a code.
const CODES = {
  orange: 172,
  blue: 39,
  cyan: 44,
  green: 34,
  greenBright: 76,
  yellow: 220,
  red: 196,
  magenta: 201,
  purple: 141,
  gray: 244,
  grayDim: 240,
  white: 253,
};

const ESC = '\x1b';
const RESET = `${ESC}[0m`;

// Colour is disabled when NO_COLOR is set (https://no-color.org) or the config
// turns it off. We keep the check here so every caller inherits it for free.
function colorEnabled(cfg) {
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '') return false;
  if (cfg && cfg.colors === false) return false;
  return true;
}

// paint('orange', 'text', enabled) -> ANSI-wrapped text (or plain when disabled).
function paint(name, str, enabled) {
  if (!enabled || CODES[name] === undefined) return String(str);
  return `${ESC}[38;5;${CODES[name]}m${str}${RESET}`;
}

// Bold without a colour change.
function bold(str, enabled) {
  if (!enabled) return String(str);
  return `${ESC}[1m${str}${RESET}`;
}

// Map a 0-100 usage value to a semantic colour using warn/crit thresholds.
// Higher is worse (context fill, rate limits).
function usageColor(pct, warnAt, critAt) {
  if (pct >= critAt) return 'red';
  if (pct >= warnAt) return 'yellow';
  return 'green';
}

// Inverse of usageColor: higher is better (cache hit rate).
function qualityColor(pct, warnAt, critAt) {
  if (pct >= critAt) return 'greenBright';
  if (pct >= warnAt) return 'yellow';
  return 'red';
}

module.exports = { CODES, RESET, colorEnabled, paint, bold, usageColor, qualityColor };
