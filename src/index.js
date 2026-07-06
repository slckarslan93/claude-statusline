'use strict';

const colors = require('./colors');
const fmt = require('./format');
const { loadConfig } = require('./config');
const { SEGMENTS, ICONS } = require('./segments');

// Build the per-render helper bundle passed to every segment. Colour enabled
// state and icon mode are resolved once here so segments stay declarative.
function makeHelpers(cfg) {
  const enabled = colors.colorEnabled(cfg);
  return {
    cfg,
    fmt,
    enabled,
    paint: (name, str) => colors.paint(name, str, enabled),
    bold: (str) => colors.bold(str, enabled),
    icon: (name) => (cfg.icons && ICONS[name] ? ICONS[name] + ' ' : ''),
    usageColor: colors.usageColor,
    qualityColor: colors.qualityColor,
  };
}

// Render a single line from a list of segment names.
function renderLine(names, data, cfg, c) {
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
  const div = cfg.divider ? colors.paint('grayDim', cfg.divider, c.enabled) : '';
  const sep = div ? `${cfg.separator}${div}${cfg.separator}` : cfg.separator;
  return out.join(sep);
}

// Render the full status line for a parsed Claude Code payload.
//
// `segments` may be a flat array of names (one line) or an array of arrays
// (each inner array is its own line — e.g. [["caveman"], ["model","context"]]
// puts the caveman badge on its own row so the stats line gets full width).
// Lines that render empty are dropped, so an inactive first line never leaves a
// blank row.
function render(data, configOverride) {
  const cfg = configOverride || loadConfig();
  const c = makeHelpers(cfg);
  const segs = cfg.segments || [];
  const multiline = segs.some((s) => Array.isArray(s));
  const lineDefs = multiline ? segs.map((s) => (Array.isArray(s) ? s : [s])) : [segs];

  const lines = lineDefs
    .map((def) => renderLine(def, data, cfg, c))
    .filter((line) => line && line.length);

  return lines.join('\n');
}

module.exports = { render, renderLine, makeHelpers };
