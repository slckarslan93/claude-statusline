'use strict';

const colors = require('./colors');
const fmt = require('./format');
const { loadConfig } = require('./config');
const { SEGMENTS, ICONS } = require('./segments');

// Build the per-render helper bundle passed to every segment. Colour enabled
// state and icon mode are resolved once here so segments stay declarative.
function makeHelpers(cfg) {
  const enabled = colors.colorEnabled(cfg);
  const truecolor = colors.truecolorEnabled(cfg);
  return {
    cfg,
    fmt,
    enabled,
    truecolor,
    paint: (name, str) => colors.paint(name, str, enabled, truecolor),
    label: (str) => colors.paint('dim', str, enabled, truecolor),
    bold: (str) => colors.bold(str, enabled),
    icon: (name) => (cfg.icons && ICONS[name] ? ICONS[name] + ' ' : ''),
    usageColor: colors.usageColor,
    qualityColor: colors.qualityColor,
    // Per-render gradient for a given target (e.g. 'model'); null when the
    // gradient is off/unavailable so the segment falls back to a flat colour.
    gradient: (str, target) => {
      const g = cfg.gradient;
      if (!g || !g.enabled || !enabled) return null;
      if (target && g.appliesTo && g.appliesTo !== target) return null;
      const stops = (g.stops || []).map(colors.hexToRgb);
      const phase = ((Date.now() / (g.periodMs || 5000)) % 1 + 1) % 1;
      return colors.gradientText(str, stops, { enabled: true, truecolor, phase, spread: g.spread });
    },
  };
}

// Render a list of segment names into an array of non-empty coloured strings.
function renderPieces(names, data, cfg, c) {
  const out = [];
  for (const name of names) {
    const fn = SEGMENTS[name];
    if (!fn) continue;
    let piece = '';
    try {
      piece = fn(data || {}, cfg, c);
    } catch (_) {
      piece = ''; // a single bad segment must never break the line
    }
    if (piece && String(piece).length) out.push(piece);
  }
  return out;
}

// Resolve the usable terminal width. An explicit wrap.maxWidth wins; otherwise
// we try every place a width might surface (stdout is piped inside the hook, so
// it's usually undefined there) and fall back to a configured default.
function terminalWidth(cfg) {
  const w = cfg.wrap && cfg.wrap.maxWidth;
  if (w && w > 0) return w;
  const envCols = parseInt(process.env.COLUMNS, 10);
  const cand =
    (process.stdout && process.stdout.columns) ||
    (Number.isFinite(envCols) && envCols) ||
    (process.stderr && process.stderr.columns);
  if (cand && cand > 0) return cand;
  return (cfg.wrap && cfg.wrap.fallbackWidth) || 100;
}

// Greedily pack pieces into physical lines no wider than maxW. A piece is never
// split; one wider than maxW simply gets its own line.
function wrapPieces(pieces, sep, sepW, maxW) {
  const lines = [];
  let cur = [];
  let curW = 0;
  for (const p of pieces) {
    const pw = fmt.stringWidth(p);
    const add = (cur.length ? sepW : 0) + pw;
    if (cur.length && curW + add > maxW) {
      lines.push(cur.join(sep));
      cur = [p];
      curW = pw;
    } else {
      cur.push(p);
      curW += add;
    }
  }
  if (cur.length) lines.push(cur.join(sep));
  return lines;
}

// Render the full status line for a parsed Claude Code payload.
//
// `segments` may be a flat array of names (one logical line) or an array of
// arrays (each inner array is its own logical line). Each logical line is then
// word-wrapped to the terminal width so nothing is ever clipped — set
// `wrap.enabled: false` to keep a single line and let the terminal truncate.
function render(data, configOverride) {
  const cfg = configOverride || loadConfig();
  const c = makeHelpers(cfg);
  const segs = cfg.segments || [];
  const multiline = segs.some((s) => Array.isArray(s));
  const lineDefs = multiline ? segs.map((s) => (Array.isArray(s) ? s : [s])) : [segs];

  const div = cfg.divider ? colors.paint('grayDim', cfg.divider, c.enabled) : '';
  const sep = div ? `${cfg.separator}${div}${cfg.separator}` : cfg.separator;
  const sepW = fmt.stringWidth(sep);

  const wrap = !(cfg.wrap && cfg.wrap.enabled === false);
  const maxW = Math.max(8, terminalWidth(cfg) - 1); // -1 safety margin

  const out = [];
  for (const def of lineDefs) {
    const pieces = renderPieces(def, data, cfg, c);
    if (!pieces.length) continue;
    if (wrap) {
      for (const line of wrapPieces(pieces, sep, sepW, maxW)) out.push(line);
    } else {
      out.push(pieces.join(sep));
    }
  }
  return out.join('\n');
}

module.exports = { render, renderPieces, wrapPieces, terminalWidth, makeHelpers };
