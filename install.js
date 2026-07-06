#!/usr/bin/env node
'use strict';

// Non-destructive installer: wires this status line into Claude Code by setting
// the top-level `statusLine` command in ~/.claude/settings.json (a timestamped
// backup is written first) and seeds a user config from config.example.json.
//
//   node install.js              install / update
//   node install.js --uninstall  remove our statusLine entry
//   node install.js --print      print the command without writing anything

const fs = require('fs');
const path = require('path');
const os = require('os');

const uninstall = process.argv.includes('--uninstall');
const printOnly = process.argv.includes('--print');

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const settingsPath = path.join(claudeDir, 'settings.json');
const binPath = path.join(__dirname, 'bin', 'claude-statusline.js');
const cfgDir = path.join(claudeDir, 'claude-statusline');
const cfgPath = path.join(cfgDir, 'config.json');
const examplePath = path.join(__dirname, 'config.example.json');

// `node "<abs path>"` works on every platform as long as node is on PATH.
const command = `node "${binPath}"`;

function log(msg) { process.stdout.write(msg + '\n'); }

// Returns {} when settings.json is absent or empty. Throws on a non-empty but
// invalid file so the caller can ABORT instead of overwriting a real config.
function readSettings() {
  if (!fs.existsSync(settingsPath)) return {};
  let raw = fs.readFileSync(settingsPath, 'utf8');
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1); // strip BOM (Notepad etc.)
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

// Read, or abort the whole run if settings.json is invalid — never fall through
// to {} and clobber the user's permissions/hooks/env.
function readSettingsOrAbort() {
  try {
    return readSettings();
  } catch (e) {
    log('  ! ~/.claude/settings.json is not valid JSON — aborting, nothing changed.');
    log('    ' + e.message);
    process.exit(1);
  }
}

function backup() {
  if (!fs.existsSync(settingsPath)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const bak = `${settingsPath}.bak-${stamp}`;
  fs.copyFileSync(settingsPath, bak);
  log(`  backed up settings.json -> ${path.basename(bak)}`);
}

function save(obj) {
  const json = JSON.stringify(obj, null, 2);
  JSON.parse(json); // validate before overwriting
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  // Write atomically: a crash mid-write can't leave a truncated settings.json.
  const tmp = `${settingsPath}.tmp`;
  fs.writeFileSync(tmp, json, 'utf8');
  fs.renameSync(tmp, settingsPath);
}

function isOurs(sl) {
  return sl && typeof sl.command === 'string' && sl.command.indexOf('claude-statusline') !== -1;
}

if (printOnly) {
  log(command);
  process.exit(0);
}

if (uninstall) {
  log('Uninstalling claude-statusline');
  const s = readSettingsOrAbort();
  if (isOurs(s.statusLine)) {
    backup();
    delete s.statusLine;
    save(s);
    log('  removed our statusLine entry (nothing else touched)');
  } else {
    log('  statusLine is not ours (or absent); left untouched');
  }
  log('Done. Restart Claude Code (or open /statusline) to unload.');
  process.exit(0);
}

log('Installing claude-statusline');

// 1) seed a user config the first time so it is easy to customise
if (!fs.existsSync(cfgPath)) {
  try {
    fs.mkdirSync(cfgDir, { recursive: true });
    fs.copyFileSync(examplePath, cfgPath);
    log(`  seeded config -> ${cfgPath}`);
  } catch (e) {
    log(`  ! could not seed config: ${e.message}`);
  }
} else {
  log(`  config already exists -> ${cfgPath} (left as-is)`);
}

// 2) merge the statusLine command into settings.json
const s = readSettingsOrAbort();
const prev = s.statusLine;
if (prev && !isOurs(prev)) {
  log('  ! replacing an existing statusLine command:');
  log('      ' + (prev.command || JSON.stringify(prev)));
  log('    (saved in the backup below; see README to run both)');
}
backup();
s.statusLine = { type: 'command', command };
save(s);
log('  set statusLine -> ' + command);

log('');
log('Installed. Restart Claude Code (or run /statusline) so it reloads.');
log(`Edit ${cfgPath} to customise segments, colours, and thresholds.`);
