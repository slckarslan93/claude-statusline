#!/usr/bin/env node
'use strict';

// Entry point for the Claude Code `statusLine` hook. Claude Code pipes a JSON
// payload on stdin; we render one line to stdout. Every failure is swallowed so
// a broken status line can never take down the Claude Code session.

const { render } = require('../src');

// `--reset-cost`: drop the per-task cost baseline so the next render rebaselines
// to the current session total (task cost -> 0). Used to start a fresh task tab.
if (process.argv.includes('--reset-cost')) {
  try {
    const os = require('os');
    const path = require('path');
    const fs = require('fs');
    const dir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
    fs.unlinkSync(path.join(dir, 'claude-statusline', '.cost-baseline'));
  } catch (_) {}
  process.exit(0);
}

// `--mark-message`: drop a flag so the next render rebaselines the per-message
// cost to the current total (message cost -> 0). Wire this to a UserPromptSubmit
// hook so "message" cost resets at the start of every user message.
if (process.argv.includes('--mark-message')) {
  try {
    const os = require('os');
    const path = require('path');
    const fs = require('fs');
    const dir = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'claude-statusline');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '.cost-msg-reset'), '');
  } catch (_) {}
  process.exit(0);
}

function emit(raw) {
  let data = {};
  try {
    if (raw && raw.trim()) data = JSON.parse(raw);
  } catch (_) {
    data = {};
  }
  let line = '';
  try {
    line = render(data);
  } catch (_) {
    line = '';
  }
  try {
    process.stdout.write(line);
  } catch (_) {
    /* ignore */
  }
}

// No stdin (run directly in a terminal): render an empty payload and exit so we
// never hang waiting for input.
if (process.stdin.isTTY) {
  emit('');
  process.exit(0);
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => {
  buf += d;
});
process.stdin.on('end', () => emit(buf));
process.stdin.on('error', () => emit(buf));
