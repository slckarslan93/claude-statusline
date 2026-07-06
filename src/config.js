'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// Default configuration. Every segment listed in `segments` is rendered in
// order; remove or reorder names to customise. Anything not in the list is
// simply not shown, even if the data is present.
const DEFAULTS = {
  // Default set. duration, rate7d and a few others are available but off by
  // default — add their names here to show them.
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
    'rate5h',
    'pr',
    'agent',
  ],
  separator: ' ',         // spacing around the dim divider
  divider: '│',           // thin divider drawn (dimmed) between segments
  colors: true,           // false (or NO_COLOR env) => plain text
  truecolor: true,        // 24-bit colour; false => 256-index fallback
  icons: false,           // true => emoji glyphs instead of the text theme

  // Optional per-render shimmer gradient (default off). Truecolor only; it
  // degrades to a flat colour otherwise. appliesTo: 'model' | 'dir'.
  gradient: {
    enabled: false,
    appliesTo: 'model',
    periodMs: 5000,
    spread: 0.55,
    stops: ['#F6C46F', '#F38868', '#E56C8A', '#D879BB'],
  },

  // Word-wrap each logical line to the terminal width so nothing is clipped.
  // maxWidth 0 => auto-detect (stdout/COLUMNS/stderr); set a number to force it.
  wrap: { enabled: true, maxWidth: 0, fallbackWidth: 100 },

  context: {
    bar: true,            // draw a ▓▓░░ usage bar
    barWidth: 10,
    showTokens: true,     // append the raw token count
    showSize: true,       // append "/200k" window size
    warnAt: 50,           // percent -> yellow
    critAt: 80,           // percent -> red
    warn200k: false,      // show a "200k!" marker on exceeds_200k_tokens (noisy on 1M context)
  },
  cache: { warnAt: 40, critAt: 70 },      // hit-rate thresholds (higher is better)
  rate: { warnAt: 50, critAt: 80, countdown: true },
  // showTask adds a per-task figure measured from a baseline (reset on a new
  // session or via `--reset-cost`), e.g. "$525.04 (task $2.10)".
  cost: { decimals: 2, showSession: true, showTask: false, taskLabel: 'task' },
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
