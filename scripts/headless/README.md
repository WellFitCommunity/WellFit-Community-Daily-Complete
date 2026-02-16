# Headless Mode Scripts

These scripts run Claude Code non-interactively for batch operations.
No terminal babysitting required — run them and come back to results.

## How It Works

`claude -p "prompt"` sends a one-shot task to Claude Code. It reads your
CLAUDE.md rules, does the work, and prints output when done.

## Available Scripts

| Script | What It Does | Time | Writes Code? |
|--------|-------------|------|-------------|
| `doc-sync.sh` | Checks if docs match current code state (test counts, skills, routes, trackers) | ~5 min | No (read-only) |
| `generate-feature-list.sh` | Generates a comprehensive feature list from routes, components, AI skills, edge functions | ~10-15 min | No (read-only) |
| `generate-manual.sh` | Generates a user manual organized by role (senior, nurse, doctor, admin) | ~15-20 min | No (read-only) |

## Usage

```bash
# Doc sync check (output to terminal):
bash scripts/headless/doc-sync.sh

# Generate feature list (save to file):
bash scripts/headless/generate-feature-list.sh > docs/FEATURE_LIST.md

# Generate user manual (save to file):
bash scripts/headless/generate-manual.sh > docs/USER_MANUAL.md
```

## Adding New Headless Scripts

Use this template:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

claude -p "
Read CLAUDE.md first. [Your task here].
" --allowedTools "Read,Grep,Glob"  # Read-only by default
```

## Safety

- Read-only scripts use `--allowedTools "Read,Grep,Glob"` — Claude cannot modify files
- To allow writes, add `Edit,Write,Bash` to the allowedTools list
- All scripts enforce CLAUDE.md rules automatically
- Always start read-only, review output, then grant write access if needed
