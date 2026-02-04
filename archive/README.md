# Archive

This directory contains historical documentation that was moved from the repository root and `docs/` folder on 2026-02-04. Files were **moved, not deleted**, to preserve git history.

## Structure

| Directory | Contents |
|-----------|----------|
| `architecture/` | Scalability audits, system analysis, capacity planning, architecture summaries |
| `assessments/` | Code quality audits, alignment audits, remediation trackers, test coverage inventories |
| `billing/` | Old billing exploration docs, cost forecasting |
| `database/` | Migration guides, schema status reports, migration cleanup summaries |
| `deployment/` | Old deployment summaries, status reports, setup guides, offline mode docs |
| `fixes/` | Historical bug fix summaries |
| `handoffs/` | Session handoff documents |
| `monitoring/` | Guardian setup, uptime monitoring reports |
| `performance/` | Bundle optimization, load testing, performance fix summaries |
| `registration/` | OTP fixes, registration fixes, nurse registration, phone validation |
| `security/` | Old security scans, fix summaries, hardening reports, compliance docs |
| `sessions/` | Session summaries, implementation summaries, feature completion reports, misc |
| `tenant/` | Old tenant isolation, branding completion reports |
| `tooling/` | ESLint fixes, Jest config, CI/CD pipeline docs, webpack fixes |
| `ux/` | UX evaluations, transformation docs |

## Finding a Document

Use `git log --all --follow -- <filename>` to trace a file's history across moves.

## Current Documentation

For current, authoritative documentation, see [docs/README.md](../docs/README.md).
