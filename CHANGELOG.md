# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and this project adheres to
[Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-07-06

Initial public release.

### Added
- **Slate Teal theme** — emoji-free, a single teal accent for identity, soft
  neutral values, and colour only on threshold metrics. 24-bit truecolor with a
  256-colour fallback and a plain-text `NO_COLOR` degrade.
- **Segments**, each toggled and reordered in one `segments` array: `dir`,
  `git`, `model`, `fast`, `effort`, `thinking`, `context` (bar + percent +
  tokens), `cache` hit rate, `cost`, `lines`, `duration`, `rate5h`, `rate7d`,
  `pr`, `agent`, `outputStyle`, `session`, `vim`, `version`, `caveman`.
- **Multi-line layouts** (`segments` as an array of arrays) and automatic,
  width-aware **wrapping** so nothing is ever clipped.
- **Shimmer** — an optional per-render truecolor gradient across the model name
  or `dir`.
- **Cost in three levels** — session, task (`--reset-cost`), and message (a
  `--mark-message` `UserPromptSubmit` hook) — plus a per-conversation `lines`
  counter.
- **JSONC config** (comments allowed) with an annotated `config.example.json`, a
  non-destructive `install.js`, and `--uninstall`.
- **Tests** (`node:test`) and **CI** across Node 18/20/22 on Ubuntu and Windows.

[0.1.0]: https://github.com/slckarslan93/claude-statusline/releases/tag/v0.1.0
