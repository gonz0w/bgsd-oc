---
name: continuation-format
description: Standard format for presenting next steps after command/workflow completion — Next Up block structure, format rules, variants for different completion scenarios (next plan, phase complete, milestone complete), context-pulling patterns, and anti-patterns.
type: shared
agents: [executor]
sections: [core-format, format-rules, variants, pulling-context, anti-patterns]
---

## Purpose

Standardizes how agents present "what's next" after completing work. The continuation format ensures users always know what was completed, what comes next, and what command to run — with enough context to understand without re-reading plans.

## Placeholders

| Placeholder | Description | Example |
|-------------|-------------|---------|
| (none) | This skill uses no placeholders | — |

## Content

<!-- section: core-format -->
### Core Structure

```
---

## ▶ Next Up

**{identifier}: {name}** — {one-line description}

`{command to copy-paste}`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `{alternative option 1}` — description
- `{alternative option 2}` — description

---
```
<!-- /section -->

<!-- section: format-rules -->
### Format Rules

1. **Always show what it is** — name + description, never just a command path
2. **Pull context from source** — ROADMAP.md for phases, PLAN.md `<objective>` for plans
3. **Command in inline code** — backticks, easy to copy-paste
4. **`/clear` explanation** — always include, keeps it concise
5. **"Also available" not "Other options"** — sounds more app-like
6. **Visual separators** — `---` above and below to make it stand out
<!-- /section -->

<!-- section: variants -->
### Variants

**Execute Next Plan:**
```
## ▶ Next Up
**02-03: Refresh Token Rotation** — Add /api/auth/refresh with sliding expiry
`/bgsd-execute-phase 2`
```

**Final Plan in Phase** — Add note about what comes after:
```
## ▶ Next Up
**02-03: Refresh Token Rotation** — Final plan in Phase 2
`/bgsd-execute-phase 2`

**After this completes:** Phase 2 → Phase 3 transition
```

**Phase Complete:**
```
## ✓ Phase 2 Complete
3/3 plans executed

## ▶ Next Up
**Phase 3: Core Features** — User dashboard, settings, data export
`/bgsd-plan phase 3`
```

**Milestone Complete:**
```
## 🎉 Milestone v1.0 Complete
All 4 phases shipped

## ▶ Next Up
**Start v1.1** — questioning → research → requirements → roadmap
`/bgsd-new-milestone`
```
<!-- /section -->

<!-- section: pulling-context -->
### Pulling Context

**For phases (from ROADMAP.md):**
Extract: `**Phase 2: Authentication** — JWT login flow with refresh tokens`

**For plans (from PLAN.md `<objective>`):**
Extract: `**02-03: Refresh Token Rotation** — Add /api/auth/refresh with sliding expiry`
<!-- /section -->

<!-- section: anti-patterns -->
### Anti-Patterns

- **Command-only (no context):** User has no idea what the command does
- **Missing /clear explanation:** User might skip it
- **Fenced code blocks for commands:** Create nesting ambiguity — use inline backticks
- **"Other options" language:** Sounds like afterthought — use "Also available:"
<!-- /section -->

## Cross-references

- <skill:executor-continuation /> — Context window continuation protocol (different concept)

## Examples

See `references/continuation-format.md` for the original 254-line reference with all variant examples.
