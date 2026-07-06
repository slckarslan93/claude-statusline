'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// Default configuration. Every segment listed in `segments` is rendered in
// order; remove or reorder names to customise. Anything not in the list is
// simply not shown, even if the data is present.
const DEFAULTS = {
  segments: [
    'dir',
    'git',
    'model',
    'fast',
    'effort',
    'thinking',
    'context',
    'cache',
    'cost',
    'lines',
    'duration',
    'rate5h',
    'rate7d',
    'pr',
    'agent',
  ],
  separator: '  ',        // rendered between segments (a dim divider is added)
  divider: '·',           // the character drawn (dimmed) between segments
  colors: true,           // false (or NO_COLOR env) => plain text
  icons: true,            // false => text labels instead of emoji/glyphs

  context: {
    bar: true,            // draw a ▓▓░░ usage bar
    barWidth: 10,
    showTokens: true,     // append the raw token count
    showSize: true,       // append "/200k" window size
    warnAt: 50,           // percent -> yellow
    critAt: 80,           // percent -> red
  },
  cache: { warnAt: 40, critAt: 70 },      // hit-rate thresholds (higher is better)
  rate: { warnAt: 50, critAt: 80, countdown: true },
  cost: { decimals: 2 },
  duration: { showApi: false },           // also show API-only time
  git: { enabled: true, timeoutMs: 250, showRepo: true },
  dir: { useProjectDir: false },          // false => current dir basename; true => project (launch) dir

  // Optional integration: show the caveman plugin's active mode badge if its
  // flag file exists. Off by default so the project stays caveman-agnostic.
  caveman: { enabled: false },
};

// Where a user config may live (first hit wins).
function configPaths() {
  const paths = [];
  if (process.env.CLAUDE_STATUSLINE_CONFIG) paths.push(process.env.CLAUDE_STATUSLINE_CONFIG);
  const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  paths.push(path.join(claudeDir, 'claude-statusline', 'config.json'));
  paths.push(path.join(__dirname, '..', 'config.json'));
  return paths;
}

// One-level-deep merge: nested objects are merged key-by-key, everything else
// is overwritten. Enough for this flat-ish config and avoids surprises.
function merge(base, over) {
  const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
  if (!over || typeof over !== 'object') return out;
  for (const k of Object.keys(over)) {
    const bv = base ? base[k] : undefined;
    const ov = over[k];
    if (ov && typeof ov === 'object' && !Array.isArray(ov) && bv && typeof bv === 'object' && !Array.isArray(bv)) {
      out[k] = merge(bv, ov);
    } else {
      out[k] = ov;
    }
  }
  return out;
}

function loadConfig() {
  for (const p of configPaths()) {
    try {
      if (p && fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        const user = JSON.parse(raw);
        return merge(DEFAULTS, user);
      }
    } catch (_) {
      // Ignore a broken config file and fall through to defaults — a status
      // line must never fail hard.
    }
  }
  return merge(DEFAULTS, {});
}

module.exports = { DEFAULTS, loadConfig, merge, configPaths };
