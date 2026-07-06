'use strict';

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Emoji shown when cfg.icons is true. With icons off, segments fall back to
// short text labels so the line still reads on a plain terminal.
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

const EFFORT_COLOR = {
  max: 'magenta',
  xhigh: 'red',
  high: 'yellow',
  medium: 'cyan',
  low: 'gray',
};

function bar(pct, width, c) {
  const p = Math.max(0, Math.min(100, pct));
  const filled = Math.round((p / 100) * width);
  return '▓'.repeat(filled) + '░'.repeat(Math.max(0, width - filled));
}

// Each segment is (data, cfg, c) => string. Returning '' omits the segment.
// `c` bundles the render helpers built in index.js.
const SEGMENTS = {
  // Project / working directory basename.
  dir(d, cfg, c) {
    const ws = d.workspace || {};
    const dir = (cfg.dir.useProjectDir && ws.project_dir) || ws.current_dir || d.cwd;
    if (!dir) return '';
    const name = path.basename(dir.replace(/[\\/]+$/, ''));
    if (!name) return '';
    return c.icon('dir') + c.paint('white', name);
  },

  // Current git branch (spawns git) plus optional repo name from the payload.
  git(d, cfg, c) {
    if (!cfg.git.enabled) return '';
    const ws = d.workspace || {};
    const cwd = ws.current_dir || d.cwd;
    let branch = '';
    // Worktree sessions expose the branch directly — no spawn needed.
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
    let out = c.icon('git') + c.paint('purple', branch);
    if (cfg.git.showRepo && ws.repo && ws.repo.name) {
      out += c.paint('grayDim', ` (${ws.repo.name})`);
    }
    return out;
  },

  // Active model, prettified.
  model(d, cfg, c) {
    const name = prettyModel(d.model);
    if (!name) return '';
    return c.icon('model') + c.paint('blue', name);
  },

  // Reasoning effort (low/medium/high/xhigh/max). Absent for models without it.
  effort(d, cfg, c) {
    const level = d.effort && d.effort.level;
    if (!level) return '';
    const color = EFFORT_COLOR[level] || 'white';
    return c.icon('effort') + c.paint(color, level);
  },

  // Opus fast-mode indicator (/fast); only shown when active.
  fast(d, cfg, c) {
    if (!d.fast_mode) return '';
    return c.icon('fast') + c.paint('orange', 'FAST');
  },

  // Extended-thinking indicator; only shown when enabled.
  thinking(d, cfg, c) {
    if (!d.thinking || !d.thinking.enabled) return '';
    return c.cfg.icons ? c.icon('think').trim() : c.paint('cyan', 'think');
  },

  // Context-window fill: bar + percent + token count + window size.
  context(d, cfg, c) {
    const cw = d.context_window;
    if (!cw) return '';
    let usedPct = cw.used_percentage;
    if (usedPct === null || usedPct === undefined) return '';
    usedPct = Number(usedPct);
    const color = c.usageColor(usedPct, cfg.context.warnAt, cfg.context.critAt);
    let out = '';
    if (cfg.context.bar) out += c.paint(color, `[${bar(usedPct, cfg.context.barWidth)}]`) + ' ';
    out += c.paint(color, c.fmt.pct(usedPct));
    if (cfg.context.showTokens && cw.total_input_tokens !== undefined) {
      let tok = c.fmt.tokens(cw.total_input_tokens);
      if (cfg.context.showSize && cw.context_window_size) {
        tok += '/' + c.fmt.windowSize(cw.context_window_size);
      }
      out += ' ' + c.paint('grayDim', tok);
    }
    if (d.exceeds_200k_tokens) out += ' ' + c.paint('red', c.icon('warn') + '200k');
    return out;
  },

  // Prompt-cache hit rate from current_usage (higher is better).
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
    return c.icon('cache') + c.paint(color, 'cache ' + c.fmt.pct(hit));
  },

  // Session cost in USD (client-side estimate from Claude Code).
  cost(d, cfg, c) {
    const cost = d.cost && d.cost.total_cost_usd;
    if (cost === null || cost === undefined) return '';
    const s = c.fmt.money(cost, cfg.cost.decimals);
    if (!s) return '';
    return c.icon('cost') + c.paint('yellow', s);
  },

  // Lines added/removed this session.
  lines(d, cfg, c) {
    const cost = d.cost || {};
    const add = cost.total_lines_added;
    const rem = cost.total_lines_removed;
    if (!add && !rem) return '';
    const a = c.paint('green', `+${add || 0}`);
    const r = c.paint('red', `-${rem || 0}`);
    return a + c.paint('grayDim', '/') + r;
  },

  // Wall-clock session duration (and optional API-only time).
  duration(d, cfg, c) {
    const cost = d.cost || {};
    if (cost.total_duration_ms === undefined || cost.total_duration_ms === null) return '';
    let out = c.icon('duration') + c.paint('gray', c.fmt.duration(cost.total_duration_ms));
    if (cfg.duration.showApi && cost.total_api_duration_ms !== undefined) {
      out += c.paint('grayDim', ` (api ${c.fmt.duration(cost.total_api_duration_ms)})`);
    }
    return out;
  },

  // 5-hour rolling rate-limit usage + reset countdown (Pro/Max only).
  rate5h(d, cfg, c) {
    return renderRate(d, cfg, c, 'five_hour', '5h');
  },

  // 7-day rate-limit usage + reset countdown (Pro/Max only).
  rate7d(d, cfg, c) {
    return renderRate(d, cfg, c, 'seven_day', '7d');
  },

  // Open PR for the current branch, with review state when available.
  pr(d, cfg, c) {
    if (!d.pr || !d.pr.number) return '';
    let out = c.icon('pr') + c.paint('blue', `PR#${d.pr.number}`);
    if (d.pr.review_state) {
      const st = d.pr.review_state;
      const col = st === 'approved' ? 'green' : st === 'changes_requested' ? 'red' : 'yellow';
      out += ' ' + c.paint(col, st);
    }
    return out;
  },

  // Active subagent name (when running under an agent).
  agent(d, cfg, c) {
    if (!d.agent || !d.agent.name) return '';
    return c.icon('agent') + c.paint('magenta', d.agent.name);
  },

  // Output style, shown only when not the default.
  outputStyle(d, cfg, c) {
    const name = d.output_style && d.output_style.name;
    if (!name || name === 'default') return '';
    return c.paint('cyan', name);
  },

  // Custom session name (from --name / /rename).
  session(d, cfg, c) {
    if (!d.session_name) return '';
    return c.paint('white', d.session_name);
  },

  // Vim mode indicator.
  vim(d, cfg, c) {
    const mode = d.vim && d.vim.mode;
    if (!mode) return '';
    return c.paint('grayDim', mode);
  },

  // Claude Code version.
  version(d, cfg, c) {
    if (!d.version) return '';
    return c.paint('grayDim', 'v' + d.version);
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

function renderRate(d, cfg, c, key, label) {
  const rl = d.rate_limits && d.rate_limits[key];
  if (!rl || rl.used_percentage === undefined || rl.used_percentage === null) return '';
  const p = Number(rl.used_percentage);
  const color = c.usageColor(p, cfg.rate.warnAt, cfg.rate.critAt);
  let out = c.paint('grayDim', label + ':') + c.paint(color, c.fmt.pct(p));
  if (cfg.rate.countdown && rl.resets_at) {
    const left = c.fmt.countdown(rl.resets_at);
    if (left) out += c.paint('grayDim', ` ${left}`);
  }
  return out;
}

module.exports = { SEGMENTS, ICONS, prettyModel };
