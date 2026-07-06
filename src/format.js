'use strict';

// Humanize a token count: 950 -> "950", 15500 -> "15.5k", 1000000 -> "1M".
function tokens(n) {
  if (n === null || n === undefined || isNaN(n)) return '';
  n = Number(n);
  if (n < 1000) return String(Math.round(n));
  if (n < 1000000) {
    const k = n / 1000;
    return (k >= 100 ? Math.round(k) : round1(k)) + 'k';
  }
  const m = n / 1000000;
  return (m >= 100 ? Math.round(m) : round1(m)) + 'M';
}

// Compact context-window size label used in the denominator: 200000 -> "200k".
function windowSize(n) {
  if (!n) return '';
  if (n >= 1000000) return round1(n / 1000000).replace(/\.0$/, '') + 'M';
  return Math.round(n / 1000) + 'k';
}

// Milliseconds -> "45s", "12m", "1h 4m".
function duration(ms) {
  if (ms === null || ms === undefined || isNaN(ms)) return '';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

// Countdown from now to a Unix-epoch-seconds timestamp -> "2h 34m", "12m", "<1m".
// Returns '' for missing/past timestamps.
function countdown(unixSec, now) {
  if (!unixSec) return '';
  const target = Number(unixSec) * 1000;
  const cur = now !== undefined ? now : Date.now();
  let diff = Math.floor((target - cur) / 1000);
  if (diff <= 0) return '';
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (h > 0) return m ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return '<1m';
}

// USD with fixed decimals; tiny non-zero costs collapse to "<$0.01".
function money(usd, decimals) {
  if (usd === null || usd === undefined || isNaN(usd)) return '';
  usd = Number(usd);
  const d = decimals === undefined ? 2 : decimals;
  const floor = Math.pow(10, -d);
  if (usd > 0 && usd < floor) return `<$${floor.toFixed(d)}`;
  return `$${usd.toFixed(d)}`;
}

// Round to one decimal, keeping integers clean (12.0 -> "12", 12.3 -> "12.3").
function round1(n) {
  const r = Math.round(n * 10) / 10;
  return String(r);
}

// Whole-number percent as a string with a % suffix.
function pct(n) {
  if (n === null || n === undefined || isNaN(n)) return '';
  return `${Math.round(Number(n))}%`;
}

// Wide BMP symbols we actually emit that most terminals render 2 cells wide.
const WIDE_BMP = new Set([0x23f1, 0x267b, 0x26a1, 0x26a0]); // ⏱ ♻ ⚡ ⚠

function isWide(cp) {
  if (cp > 0xffff) return true; // astral plane: emoji, CJK ext, etc.
  if (WIDE_BMP.has(cp)) return true;
  return (
    (cp >= 0x1100 && cp <= 0x115f) || // Hangul Jamo
    (cp >= 0x2e80 && cp <= 0xa4cf && cp !== 0x303f) || // CJK radicals … Yi
    (cp >= 0xac00 && cp <= 0xd7a3) || // Hangul syllables
    (cp >= 0xf900 && cp <= 0xfaff) || // CJK compatibility ideographs
    (cp >= 0xfe30 && cp <= 0xfe4f) || // CJK compatibility forms
    (cp >= 0xff00 && cp <= 0xff60) || // Fullwidth forms
    (cp >= 0xffe0 && cp <= 0xffe6)
  );
}

// Visible width of a string in terminal cells: strips ANSI SGR sequences,
// ignores zero-width variation selectors, and counts wide glyphs as 2. Good
// enough to lay out this status line without a wcwidth dependency.
function stringWidth(str) {
  if (!str) return 0;
  const s = String(str).replace(/\x1b\[[0-9;]*m/g, '');
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp === 0xfe0f || cp === 0x200d) continue; // VS16, ZWJ → width 0
    if (cp < 0x20) continue; // control chars
    w += isWide(cp) ? 2 : 1;
  }
  return w;
}

module.exports = { tokens, windowSize, duration, countdown, money, round1, pct, stringWidth };
