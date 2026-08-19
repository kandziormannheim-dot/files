# CLAUDE.md

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (`kandziormannheim-dot/files`), reached
via the `gh` CLI locally or the `mcp__github__*` tools on Claude Code for the web.
See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, each label string equal to its name — `needs-triage`,
`needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`.
See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` plus `docs/adr/` at the repo root. Neither
exists yet; they are created lazily when terms or decisions actually get
resolved. See `docs/agents/domain.md`.
