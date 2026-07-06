# claude-statusline

**English** · [Türkçe](README.tr.md)

**A fast, zero-dependency, configurable status line for [Claude Code](https://claude.com/claude-code).**

One line at the bottom of your terminal, always current: which model and reasoning effort you're on, how full the context window is, what the session has cost, how close you are to your rate limits, git branch, lines changed, and more — all driven by the JSON Claude Code hands its status line on every turn.

![claude-statusline in a terminal](docs/statusline.png)

```
my-app │ main │ Opus 4.8 │ max │ ctx 18% 185k/1M │ cache 100% │ $0.42 │ +156/-23 │ 12m │ 5h 2% 3h 7m │ 7d 61% 52h 37m
```

The default **Slate Teal** theme is deliberately quiet: your project and branch
are a single muted teal, every value is soft neutral, labels and dividers recede
into gray — and colour only appears when a threshold fires (context, cache, and
rate limits turning amber or red). No emoji, no rainbow. An optional truecolor
**shimmer** can drift across the model name for a subtle "alive" accent.

- **Zero dependencies** — pure Node.js built-ins, one small process per render.
- **Cross-platform** — Windows, macOS, Linux.
- **Minimal by default, tunable** — one accent, semantic threshold colours, 24-bit truecolor with a 256 fallback.
- **Everything is a segment** — turn any piece on/off and reorder them in one array.
- **Never breaks your session** — every field is optional and every failure is swallowed; a bad status line can't take down Claude Code.
- **Respects `NO_COLOR`** and degrades cleanly to plain text.

---

## Requirements

- Node.js **18+** on your `PATH` (`node --version`)
- Claude Code with the status line feature (any recent version)

> **CLI / terminal only.** The status line is a Claude Code **terminal** feature,
> so this works in the CLI and in any terminal — including VS Code's *integrated
> terminal* running `claude`. It does **not** render in the IDE extensions'
> native panels (VS Code / JetBrains), which don't support `statusLine` yet
> ([open feature request](https://github.com/anthropics/claude-code/issues/55643)).
> In VS Code you can set `"claudeCode.useTerminal": true` to run in terminal mode.

## Install

**One command** — clone and install:

```bash
git clone https://github.com/slckarslan93/claude-statusline.git && cd claude-statusline && node install.js
```

Then **restart Claude Code** and the status line appears at the bottom. That's it.

> Already inside Claude Code? Paste the same line with a leading `!` to run it
> right here: `! git clone …/claude-statusline.git && cd claude-statusline && node install.js`

The installer seeds a config you can edit at `~/.claude/claude-statusline/config.json`, backs up `~/.claude/settings.json` (timestamped), and sets your `statusLine` command to this tool — non-destructively (it aborts rather than touch an unparseable `settings.json`).

> Already have a `statusLine`? The installer prints the old command and keeps it in the backup. To run both, call your previous command from a wrapper, or add its output as a custom segment.

### Manual install

If you'd rather wire it yourself, add this to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"/absolute/path/to/claude-statusline/bin/claude-statusline.js\""
  }
}
```

## Configuration

Copy [`config.example.json`](./config.example.json) to `~/.claude/claude-statusline/config.json` (the installer does this for you) and edit. You can also point at a config anywhere with the `CLAUDE_STATUSLINE_CONFIG` environment variable. The config is **JSONC** — `//` and `/* */` comments are allowed (the shipped example is annotated), so you can note what each option does inline.

The `segments` array is the heart of it — it controls **what shows and in what order**. Drop names you don't want, reorder freely; a segment with no data simply renders nothing.

```json
{
  "segments": ["dir", "git", "model", "fast", "effort", "thinking",
               "context", "cache", "cost", "lines", "rate5h", "pr", "agent"],
  "separator": " ",
  "divider": "│",
  "colors": true,
  "truecolor": true,
  "icons": false,
  "gradient": { "enabled": false, "appliesTo": "model", "periodMs": 5000, "spread": 0.55,
                "stops": ["#F6C46F", "#F38868", "#E56C8A", "#D879BB"] },
  "context": { "bar": true, "barWidth": 10, "showTokens": true, "showSize": true, "warnAt": 50, "critAt": 80, "warn200k": false },
  "cache": { "warnAt": 40, "critAt": 70 },
  "rate": { "warnAt": 50, "critAt": 80, "countdown": true },
  "cost": { "decimals": 2, "showSession": true, "showTask": false, "taskLabel": "task" },
  "duration": { "showApi": false },
  "git": { "enabled": true, "timeoutMs": 250, "showRepo": true },
  "dir": { "useProjectDir": false },
  "caveman": { "enabled": false }
}
```

| Key | Default | Meaning |
|-----|---------|---------|
| `segments` | see above | Which segments to render, in order |
| `separator` | `" "` | Spacing placed around the divider |
| `divider` | `"│"` | Dim character drawn between segments (empty to omit) |
| `colors` | `true` | ANSI colour; `false` or `NO_COLOR` env → plain |
| `truecolor` | `true` | 24-bit colour; `false` → 256-index fallback |
| `icons` | `false` | `true` → emoji glyphs instead of the text theme |
| `gradient.enabled` | `false` | Per-render shimmer on the model name (truecolor only) |
| `gradient.appliesTo` | `"model"` | Where the shimmer lands: `model` or `dir` |
| `gradient.periodMs` | `5000` | Drift speed — lower shifts the ramp faster per render |
| `gradient.spread` | `0.55` | How much of the ramp spans the text |
| `gradient.stops` | amber→magenta | Ordered hex colour stops for the shimmer |
| `context.bar` / `barWidth` | `true` / `10` | Draw a `▓▓░░` usage bar and its width |
| `context.showTokens` / `showSize` | `true` / `true` | Append `185k` and `/1M` |
| `context.warnAt` / `critAt` | `50` / `80` | Percent thresholds → yellow / red |
| `context.warn200k` | `false` | Show a `200k!` marker on `exceeds_200k_tokens` (noise on 1M context) |
| `cache.warnAt` / `critAt` | `40` / `70` | Cache-hit thresholds (higher is better) |
| `rate.warnAt` / `critAt` | `50` / `80` | Rate-limit thresholds → yellow / red |
| `rate.countdown` | `true` | Show time until each window resets |
| `cost.decimals` | `2` | Decimal places for the USD figure |
| `cost.showSession` | `true` | Show the running session total |
| `cost.showMessage` | `false` | Also show a per-message figure (needs the `--mark-message` hook) |
| `cost.showTask` | `false` | Also show a per-task figure from a resettable baseline |
| `cost.messageLabel` | `"msg"` | Label for the per-message figure, e.g. `(msg $0.02)` |
| `cost.taskLabel` | `"task"` | Label for the per-task figure, e.g. `(task $2.10)` |
| `cost.sessionLabel` | `""` | Empty → bare `$549`; set (e.g. `"ses"`) → `(ses $549)` |
| `lines.showTask` | `false` | Lines changed since `--reset-cost` (this conversation) instead of the session total |
| `duration.showApi` | `false` | Also show API-only time |
| `git.enabled` | `true` | Run `git` to read the branch |
| `git.timeoutMs` | `250` | Give up on the git call after this |
| `git.showRepo` | `true` | Append the repo name from the payload |
| `dir.useProjectDir` | `false` | `false` → current dir; `true` → launch dir |
| `caveman.enabled` | `false` | Prepend the [caveman](https://github.com/JuliusBrussee/caveman) plugin's mode badge if active |

### Turning segments on and off

Everything is toggled in one place — the `segments` array. The **default set** is:

```
dir · git · model · fast · effort · thinking · context · cache · cost · lines · rate5h · pr · agent
```

- **Disable** a segment → remove its name from `segments`.
- **Enable** one that's off by default → add its name where you want it to appear.
- **Reorder** → move the names around; order in the array is order on the line.

Available but **off by default** (add the name to switch on):

| Segment | Shows |
|---------|-------|
| `duration` | Wall-clock session time |
| `rate7d` | 7-day rate limit + reset |
| `session` | Custom session name (`--name` / `/rename`) |
| `outputStyle` | Output style when not `default` |
| `vim` | Vim mode |
| `version` | Claude Code version |

A segment with no data for the current session renders nothing, so `pr`, `agent`,
and the `rate*` segments only take up space when they actually apply. Save the
file and the next render picks it up — no restart needed.

### Multiple lines

`segments` can also be an **array of arrays** — each inner array becomes its own
line. This is handy when you want a piece to stand alone with the full terminal
width to itself:

```json
{
  "segments": [
    ["caveman"],
    ["dir", "git", "model", "effort", "context", "cache", "cost", "rate5h", "rate7d"]
  ]
}
```

renders as two rows:

```
[CAVEMAN]
my-app │ main │ Opus 4.8 │ max │ ctx 18% 185k/1M │ cache 100% │ $0.42 │ 5h 2% 3h 7m │ 7d 61% 52h 37m
```

A line that renders empty (e.g. the caveman badge when caveman isn't active) is
dropped, so you never get a stray blank row.

### Wrapping

By default every logical line is **word-wrapped to your terminal width** so no
segment is ever clipped — when a line is too long, the overflow flows onto the
next row instead of being cut off. Width is measured in real terminal cells
(ANSI colour codes are ignored and emoji count as two), and segments are never
split mid-way.

Width is auto-detected. Inside the status line hook stdout isn't a TTY, so if
auto-detection comes up empty it falls back to `wrap.fallbackWidth`. If wrapping
doesn't match your terminal, set an explicit width:

```json
{ "wrap": { "enabled": true, "maxWidth": 120, "fallbackWidth": 100 } }
```

| Key | Default | Meaning |
|-----|---------|---------|
| `wrap.enabled` | `true` | Wrap to width; `false` → one line, terminal truncates |
| `wrap.maxWidth` | `0` | `0` = auto-detect; a number forces that width |
| `wrap.fallbackWidth` | `100` | Used only when auto-detection finds nothing |

### Shimmer

Off by default. When enabled, a truecolor gradient is painted per code point
across one accent element (the model name, or `dir`), and the ramp is offset by
a phase derived from the wall clock so it **drifts a little on every render** —
a quiet, living accent rather than a static block. It isn't frame animation (the
status line only re-renders per turn), just a gentle shift over time.

```json
{ "gradient": { "enabled": true, "appliesTo": "model" } }
```

Requires a truecolor terminal (Windows Terminal, VS Code, iTerm, most modern
emulators). Where truecolor isn't available it falls back to a flat colour, and
under `NO_COLOR` to plain text. Width is unaffected — the colour codes are
stripped when measuring, so wrapping still lines up.

## Segments

| Name | Shows | Source |
|------|-------|--------|
| `dir` | Working directory name | `workspace.current_dir` / `project_dir` |
| `git` | Current branch (+ repo) | `git branch --show-current`, `workspace.repo` |
| `model` | Prettified model, e.g. `Opus 4.8` | `model.id` / `display_name` |
| `fast` | `FAST` when Opus fast mode is on | `fast_mode` |
| `effort` | Reasoning effort `low`…`max` | `effort.level` |
| `thinking` | `think` when extended thinking is on | `thinking.enabled` |
| `context` | Bar + percent + tokens + size | `context_window.*` |
| `cache` | Prompt-cache hit rate | `context_window.current_usage` |
| `cost` | Session cost, and/or a per-task figure | `cost.total_cost_usd` |
| `lines` | Lines added / removed (session, or per-conversation) | `cost.total_lines_*` |
| `duration` | Wall-clock (and API) time | `cost.total_duration_ms` |
| `rate5h` | 5-hour limit + reset countdown | `rate_limits.five_hour` |
| `rate7d` | 7-day limit + reset countdown | `rate_limits.seven_day` |
| `pr` | Open PR number + review state | `pr.*` |
| `agent` | Active subagent name | `agent.name` |
| `outputStyle` | Output style when not default | `output_style.name` |
| `session` | Custom session name | `session_name` |
| `vim` | Vim mode | `vim.mode` |
| `version` | Claude Code version | `version` |
| `caveman` | caveman plugin mode badge | reads `~/.claude/.caveman-active` |

Several fields only appear in some sessions — `rate_limits` needs a Pro/Max subscription and a first API response, `effort` only on models that support it, `pr` only when a PR is open, `agent` only under `--agent`, and `current_usage` is `null` right after `/compact`. Every segment handles absence by rendering nothing.

### Cost: message, task, session

The `cost` segment shows up to three nested figures, smallest to largest, e.g.
`(msg $0.02) (conv $2.10) (ses $525.04)`:

```
session  ⊃  task  ⊃  message
```

| Level | Enable | Covers | Resets |
|-------|--------|--------|--------|
| **message** | `showMessage` | One exchange (this message + its reply) | Automatically, at the start of every user message (needs the hook below) |
| **task** | `showTask` | A group of messages — one task or conversation | Manually with `--reset-cost` — run it when you start something new |
| **session** | `showSession` (default on) | The whole Claude Code run (open → `/clear`) | Only on a new session / `/clear` |

Worked example, after resetting `task` at the start of a job:

| You send | `msg` | `task` |
|----------|-------|--------|
| "make it minimal" | $0.30 | $0.30 |
| "drop the emoji"  | $0.20 | $0.50 |
| "add cost"        | $0.40 | $0.90 |

`msg` is always just the current message; `task` accumulates until you reset it.

Labels are set by `messageLabel` / `taskLabel` / `sessionLabel` (`session` shows
bare `$549` when `sessionLabel` is empty, or `(ses $549)` when you name it). All
three are the same client-side estimate — the equivalent API cost — and each
covers **everything the session bills**: your input, the model's output, tool
calls, and any sub-agents or workflows spawned along the way (not just your
messages).

**Per-message cost needs a hook.** Claude Code doesn't hand the status line a
per-message marker, so message cost is reset by a `UserPromptSubmit` hook that
runs `--mark-message` at the start of each message. Add it to
`~/.claude/settings.json` (merge with any existing hooks):

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [ { "type": "command",
        "command": "node \"/abs/path/claude-statusline/bin/claude-statusline.js\" --mark-message" } ] }
    ]
  }
}
```

Without the hook, `showMessage` just behaves like a session-start baseline.

**Task cost** is a manual per-task / per-conversation figure — run it when you
start something new and it counts from `$0.00`:

```bash
node bin/claude-statusline.js --reset-cost   # or: npm run reset-cost
```

`--reset-cost` also resets the **`lines`** counter, so with `"lines": { "showTask": true }`
the `+156/-23` figure shows only the lines changed **in the current conversation**
(the change you asked for) rather than the whole-session total.

## Notes on the numbers

- **Context %** is Claude Code's own `used_percentage`, computed from input tokens only (input + cache read + cache write), matching what the app shows.
- **Cost** is Claude Code's client-side estimate (`total_cost_usd`) — the same figure the app tracks. It's an estimate of equivalent API pricing and may differ from an actual bill.
- **Cache hit rate** is `cache_read / (input + cache_write + cache_read)` for the most recent turn — a quick read on how well prompt caching is working (higher is better).

## Test it

```bash
node bin/claude-statusline.js < test/sample.json
```

Or with your own mock:

```bash
echo '{"model":{"id":"claude-sonnet-4-6"},"context_window":{"used_percentage":25,"total_input_tokens":50000,"context_window_size":200000}}' | node bin/claude-statusline.js
```

## Uninstall

```bash
node install.js --uninstall
```

Removes only our `statusLine` entry (after a backup) and leaves everything else in `settings.json` untouched. Your config folder is left in place; delete `~/.claude/claude-statusline/` to remove it too.

## How it works

Claude Code runs your `statusLine` command after every turn and pipes a JSON snapshot of the session to it on stdin. This tool parses that JSON, walks your `segments` list, renders each into a small coloured string, and prints the line(s). No network calls; the only thing it ever writes is the optional per-task cost baseline under `~/.claude/claude-statusline/`. See the [status line docs](https://code.claude.com/docs/en/statusline) for the full payload schema.

## License

[MIT](./LICENSE)
