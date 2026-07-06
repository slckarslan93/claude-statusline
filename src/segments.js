'use strict';

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Optional emoji, only used when cfg.icons is true. The default theme is
// emoji-free and uses dim text labels instead (see below).
const ICONS = {
  dir: '📁',
  git: '⎇',
  model: '🤖',
  effort: '⚡',
  fast: '🚀',
  think: '🧠',
  cache: '♻',
  cost: '💰',
  duration: '⏱',
  agent: '🕵',
  pr: '⇄',
  warn: '⚠',
};

// Turn a model id like "claude-opus-4-8" into "Opus 4.8". Falls back to the
// display_name (e.g. "Opus") when the id is unfamiliar.
function prettyModel(model) {
  const id = model && model.id;
  const disp = model && model.display_name;
  if (id) {
    const m = /^claude-(opus|sonnet|haiku)-(\d+)-(\d+)/.exec(id);
    if (m) {
      const fam = m[1].charAt(0).toUpperCase() + m[1].slice(1);
      return `${fam} ${m[2]}.${m[3]}`;
    }
  }
  return disp || id || '';
}

function bar(pct, width) {
  const p = Math.max(0, Math.min(100, pct));
  const filled = Math.round((p / 100) * width);
  return '▓'.repeat(filled) + '░'.repeat(Math.max(0, width - filled));
}

// Prefix an icon (icons mode) or nothing. The default theme relies on labels,
// not icons, so this is empty unless the user opts back into icons.
function ico(name, cfg) {
  return cfg.icons && ICONS[name] ? ICONS[name] + ' ' : '';
}

// Each segment is (data, cfg, c) => string. Returning '' omits the segment.
// Colour discipline (Slate Teal): identity is accent teal; values are neutral
// text; labels/units/prefixes are dim; hue (good/warn/crit) appears only on
// threshold metrics — context, cache, rate — plus the conventional +/- on
// lines and PR review state.
const SEGMENTS = {
  // Project / working directory basename — the identity anchor, in accent.
  dir(d, cfg, c) {
    const ws = d.workspace || {};
    const dir = (cfg.dir.useProjectDir && ws.project_dir) || ws.current_dir || d.cwd;
    if (!dir) return '';
    const name = path.basename(dir.replace(/[\\/]+$/, ''));
    if (!name) return '';
    const g = c.gradient(name, 'dir');
    return ico('dir', cfg) + (g || c.paint('accent', name));
  },

  // Current git branch (accent) plus optional repo name (dim).
  git(d, cfg, c) {
    if (!cfg.git.enabled) return '';
    const ws = d.workspace || {};
    const cwd = ws.current_dir || d.cwd;
    let branch = '';
    if (d.worktree && d.worktree.branch) branch = d.worktree.branch;
    else if (ws.git_worktree) branch = ws.git_worktree;
    if (!branch && cwd) {
      try {
        branch = execFileSync('git', ['branch', '--show-current'], {
          cwd,
          timeout: cfg.git.timeoutMs,
          stdio: ['ignore', 'pipe', 'ignore'],
          encoding: 'utf8',
        }).trim();
      } catch (_) {
        branch = '';
      }
    }
    if (!branch) return '';
    let out = ico('git', cfg) + c.paint('accent', branch);
    if (cfg.git.showRepo && ws.repo && ws.repo.name) {
      out += c.label(` (${ws.repo.name})`);
    }
    return out;
  },

  // Active model, prettified. Carries the optional shimmer gradient.
  model(d, cfg, c) {
    const name = prettyModel(d.model);
    if (!name) return '';
    const g = c.gradient(name, 'model');
    return ico('model', cfg) + (g || c.paint('text', name));
  },

  // Opus fast-mode indicator (/fast); only shown when active.
  fast(d, cfg, c) {
    if (!d.fast_mode) return '';
    return ico('fast', cfg) + c.paint('accent', 'fast');
  },

  // Reasoning effort (low…max). Neutral by design — no per-level rainbow.
  effort(d, cfg, c) {
    const level = d.effort && d.effort.level;
    if (!level) return '';
    return ico('effort', cfg) + c.paint('text', level);
  },

  // Extended-thinking indicator; dim, only when enabled.
  thinking(d, cfg, c) {
    if (!d.thinking || !d.thinking.enabled) return '';
    return c.label('think');
  },

  // Context-window fill: dim label + bar/percent (threshold hue) + dim tokens.
  context(d, cfg, c) {
    const cw = d.context_window;
    if (!cw) return '';
    let usedPct = cw.used_percentage;
    if (usedPct === null || usedPct === undefined) return '';
    usedPct = Number(usedPct);
    const color = c.usageColor(usedPct, cfg.context.warnAt, cfg.context.critAt);
    let out = c.label('ctx ');
    if (cfg.context.bar) out += c.paint(color, bar(usedPct, cfg.context.barWidth)) + ' ';
    out += c.paint(color, c.fmt.pct(usedPct));
    if (cfg.context.showTokens && cw.total_input_tokens !== undefined) {
      let tok = c.fmt.tokens(cw.total_input_tokens);
      if (cfg.context.showSize && cw.context_window_size) {
        tok += '/' + c.fmt.windowSize(cw.context_window_size);
      }
      out += ' ' + c.label(tok);
    }
    if (d.exceeds_200k_tokens) out += ' ' + c.paint('crit', '200k!');
    return out;
  },

  // Prompt-cache hit rate (threshold hue, higher is better).
  cache(d, cfg, c) {
    const u = d.context_window && d.context_window.current_usage;
    if (!u) return '';
    const read = Number(u.cache_read_input_tokens || 0);
    const input = Number(u.input_tokens || 0);
    const create = Number(u.cache_creation_input_tokens || 0);
    const denom = read + input + create;
    if (denom <= 0) return '';
    const hit = (read / denom) * 100;
    const color = c.qualityColor(hit, cfg.cache.warnAt, cfg.cache.critAt);
    return c.label('cache ') + c.paint(color, c.fmt.pct(hit));
  },

  // Cost in USD. Session total (neutral, the $ self-labels) and/or a per-task
  // figure measured from a baseline that resets on a new session or on demand
  // (`--reset-cost`). E.g. "$525.04 (task $2.10)".
  cost(d, cfg, c) {
    const total = d.cost && d.cost.total_cost_usd;
    if (total === null || total === undefined) return '';
    const cc = cfg.cost || {};
    const dec = cc.decimals === undefined ? 2 : cc.decimals;
    const out = [];
    if (cc.showSession !== false) {
      const s = c.fmt.money(total, dec);
      if (s) out.push(ico('cost', cfg) + c.paint('text', s));
    }
    if (cc.showTask === true) {
      const task = costSinceBaseline(d.session_id, Number(total));
      if (task !== null) {
        out.push(c.label(`(${cc.taskLabel || 'task'} `) + c.paint('accent', c.fmt.money(task, dec)) + c.label(')'));
      }
    }
    return out.join(' ');
  },

  // Lines added/removed — conventional muted green/red, self-marked by +/-.
  lines(d, cfg, c) {
    const cost = d.cost || {};
    const add = cost.total_lines_added;
    const rem = cost.total_lines_removed;
    if (!add && !rem) return '';
    return c.paint('good', `+${add || 0}`) + c.label('/') + c.paint('crit', `-${rem || 0}`);
  },

  // Wall-clock session duration (dim, secondary). Optional API-only time.
  duration(d, cfg, c) {
    const cost = d.cost || {};
    if (cost.total_duration_ms === undefined || cost.total_duration_ms === null) return '';
    let out = ico('duration', cfg) + c.paint('text', c.fmt.duration(cost.total_duration_ms));
    if (cfg.duration.showApi && cost.total_api_duration_ms !== undefined) {
      out += c.label(` (api ${c.fmt.duration(cost.total_api_duration_ms)})`);
    }
    return out;
  },

  // 5-hour / 7-day rate-limit usage + reset countdown (Pro/Max only).
  rate5h(d, cfg, c) {
    return renderRate(d, cfg, c, 'five_hour', '5h');
  },
  rate7d(d, cfg, c) {
    return renderRate(d, cfg, c, 'seven_day', '7d');
  },

  // Open PR for the current branch — dim PR# prefix, review state keeps hue.
  pr(d, cfg, c) {
    if (!d.pr || !d.pr.number) return '';
    let out = c.label('PR#') + c.paint('text', String(d.pr.number));
    if (d.pr.review_state) {
      const st = d.pr.review_state;
      const col = st === 'approved' ? 'good' : st === 'changes_requested' ? 'crit' : 'warn';
      out += ' ' + c.paint(col, st);
    }
    return out;
  },

  // Active subagent name — dim @ prefix, neutral name.
  agent(d, cfg, c) {
    if (!d.agent || !d.agent.name) return '';
    return c.label('@') + c.paint('text', d.agent.name);
  },

  // Output style, shown only when not the default.
  outputStyle(d, cfg, c) {
    const name = d.output_style && d.output_style.name;
    if (!name || name === 'default') return '';
    return c.paint('accent', name);
  },

  // Custom session name (from --name / /rename).
  session(d, cfg, c) {
    if (!d.session_name) return '';
    return c.paint('text', d.session_name);
  },

  // Vim mode indicator.
  vim(d, cfg, c) {
    const mode = d.vim && d.vim.mode;
    if (!mode) return '';
    return c.label(mode);
  },

  // Claude Code version.
  version(d, cfg, c) {
    if (!d.version) return '';
    return c.label('v' + d.version);
  },

  // Optional caveman-plugin badge (off by default; keeps this project neutral).
  caveman(d, cfg, c) {
    if (!cfg.caveman || !cfg.caveman.enabled) return '';
    try {
      const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
      const flag = path.join(claudeDir, '.caveman-active');
      const st = fs.statSync(flag);
      if (st.size > 64) return '';
      let mode = fs.readFileSync(flag, 'utf8').split(/\r?\n/)[0].trim().toLowerCase();
      mode = mode.replace(/[^a-z0-9-]/g, '');
      const valid = ['off', 'lite', 'full', 'ultra', 'wenyan-lite', 'wenyan', 'wenyan-full', 'wenyan-ultra', 'commit', 'review', 'compress'];
      if (valid.indexOf(mode) === -1) return '';
      const label = !mode || mode === 'full' ? 'CAVEMAN' : `CAVEMAN:${mode.toUpperCase()}`;
      return c.paint('orange', `[${label}]`);
    } catch (_) {
      return '';
    }
  },
};

// Cost accrued since a stored baseline. The baseline auto-resets when the
// session id changes (new session), when the file is missing, or when the total
// drops below it; `--reset-cost` deletes the file so the next render rebaselines
// to the current total (task cost -> 0). Returns null on any failure.
function costSinceBaseline(sessionId, total) {
  if (total === null || total === undefined || isNaN(total)) return null;
  const skey = sessionId || 'default';
  try {
    const dir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
    const file = path.join(dir, 'claude-statusline', '.cost-baseline');
    let base = null;
    let sid = null;
    try {
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      base = typeof j.baseline === 'number' ? j.baseline : null;
      sid = j.session_id;
    } catch (_) {}
    if (base === null || sid !== skey || base > total) {
      base = total;
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify({ baseline: base, session_id: skey }));
      } catch (_) {}
    }
    return Math.max(0, total - base);
  } catch (_) {
    return null;
  }
}

function renderRate(d, cfg, c, key, label) {
  const rl = d.rate_limits && d.rate_limits[key];
  if (!rl || rl.used_percentage === undefined || rl.used_percentage === null) return '';
  const p = Number(rl.used_percentage);
  const color = c.usageColor(p, cfg.rate.warnAt, cfg.rate.critAt);
  let out = c.label(label + ' ') + c.paint(color, c.fmt.pct(p));
  if (cfg.rate.countdown && rl.resets_at) {
    const left = c.fmt.countdown(rl.resets_at);
    if (left) out += c.label(` ${left}`);
  }
  return out;
}

module.exports = { SEGMENTS, ICONS, prettyModel };
