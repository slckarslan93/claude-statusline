'use strict';

// Semantic palette (Slate Teal). Each colour carries a 24-bit RGB and a
// 256-index fallback. Segments only ever name semantic roles — never raw codes —
// so the whole look is retuned here in one place.
const PALETTE = {
  accent: { rgb: [0x5f, 0xb3, 0xb3], c256: 73 }, // muted teal — identity
  accent2: { rgb: [0x8c, 0xd1, 0xd1], c256: 116 },
  text: { rgb: [0xd0, 0xd5, 0xde], c256: 252 }, // neutral values
  dim: { rgb: [0x76, 0x7f, 0x91], c256: 245 }, // labels, units, separators
  good: { rgb: [0xa3, 0xbe, 0x8c], c256: 108 },
  warn: { rgb: [0xeb, 0xcb, 0x8b], c256: 222 },
  crit: { rgb: [0xcb, 0x6b, 0x72], c256: 167 },
  orange: { rgb: [0xe0, 0x9a, 0x5f], c256: 173 }, // caveman badge brand
  money: { rgb: [0xe5, 0xb8, 0x5c], c256: 179 }, // warm gold — cost figures
};

// Back-compat aliases so any older colour name still resolves after the de-hue.
const ALIAS = {
  white: 'text',
  gray: 'dim',
  grayDim: 'dim',
  green: 'good',
  greenBright: 'good',
  yellow: 'warn',
  red: 'crit',
  blue: 'accent',
  cyan: 'accent',
  magenta: 'accent',
  purple: 'accent',
};

const ESC = '\x1b';
const RESET = `${ESC}[0m`;

// Colour off when NO_COLOR is set (https://no-color.org) or config disables it.
function colorEnabled(cfg) {
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '') return false;
  if (cfg && cfg.colors === false) return false;
  return true;
}

// Truecolor on unless explicitly disabled. Modern terminals (Windows Terminal,
// VS Code, iTerm) advertise COLORTERM=truecolor; when it's absent we still
// default on because the only cost of being wrong is a slightly different shade
// (the sequence degrades visually, not functionally). Force 256 with
// truecolor:false.
function truecolorEnabled(cfg) {
  if (cfg && cfg.truecolor === false) return false;
  return true;
}

function resolve(name) {
  if (PALETTE[name]) return PALETTE[name];
  const a = ALIAS[name];
  return a ? PALETTE[a] : null;
}

// paint('accent', 'text', enabled, truecolor) -> ANSI-wrapped (or plain).
function paint(name, str, enabled, truecolor) {
  if (!enabled) return String(str);
  const p = resolve(name);
  if (!p) return String(str);
  const open = truecolor
    ? `${ESC}[38;2;${p.rgb[0]};${p.rgb[1]};${p.rgb[2]}m`
    : `${ESC}[38;5;${p.c256}m`;
  return `${open}${str}${RESET}`;
}

function bold(str, enabled) {
  if (!enabled) return String(str);
  return `${ESC}[1m${str}${RESET}`;
}

// Usage 0-100 -> semantic colour (higher is worse: context fill, rate limits).
function usageColor(pct, warnAt, critAt) {
  if (pct >= critAt) return 'crit';
  if (pct >= warnAt) return 'warn';
  return 'good';
}

// Inverse (higher is better: cache hit rate).
function qualityColor(pct, warnAt, critAt) {
  if (pct >= critAt) return 'good';
  if (pct >= warnAt) return 'warn';
  return 'crit';
}

function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// Sample an ordered list of [r,g,b] stops at t in [0,1] with linear interpolation.
function sampleStops(stops, t) {
  const n = stops.length - 1;
  const x = Math.max(0, Math.min(1, t)) * n;
  const i = Math.min(Math.floor(x), n - 1);
  const f = x - i;
  const a = stops[i];
  const b = stops[i + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

// Colour each code point of `str` along a gradient, offset by `phase` so the
// ramp drifts a little every render — a subtle per-turn shimmer, not real
// animation. Truecolor only; returns null when it can't apply so the caller can
// fall back to a flat colour. A trailing reset stops colour bleeding into the
// following separator.
function gradientText(str, stops, opts) {
  const o = opts || {};
  if (!o.enabled || !o.truecolor || !stops || stops.length < 2) return null;
  const chars = Array.from(String(str));
  const L = Math.max(chars.length - 1, 1);
  const spread = o.spread === undefined ? 0.55 : o.spread;
  const phase = o.phase || 0;
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const t = ((((i / L) * spread + phase) % 1) + 1) % 1;
    const c = sampleStops(stops, t);
    out += `${ESC}[38;2;${c[0]};${c[1]};${c[2]}m${chars[i]}`;
  }
  return out + RESET;
}

module.exports = {
  PALETTE,
  RESET,
  colorEnabled,
  truecolorEnabled,
  paint,
  bold,
  usageColor,
  qualityColor,
  hexToRgb,
  sampleStops,
  gradientText,
};
