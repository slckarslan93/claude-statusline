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

// Render the full status line for a parsed Claude Code payload.
function render(data, configOverride) {
  const cfg = configOverride || loadConfig();
  const c = makeHelpers(cfg);
  const out = [];

  for (const name of cfg.segments) {
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

  const div = cfg.divider
    ? colors.paint('grayDim', cfg.divider, c.enabled)
    : '';
  const sep = div ? `${cfg.separator}${div}${cfg.separator}` : cfg.separator;
  return out.join(sep);
}

module.exports = { render, makeHelpers };
