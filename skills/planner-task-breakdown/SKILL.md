---
name: planner-task-breakdown
description: Task decomposition methodology for planners — task anatomy (files, action, verify, done), task types, sizing rules (15-60 min), specificity standards, TDD detection heuristic, and user setup detection for external services.
type: agent-specific
agents: [planner]
sections: [task-anatomy, task-types, task-sizing, specificity, tdd-detection, user-setup]
---

## Purpose

The planner's core methodology for decomposing phase work into executable tasks. Defines what makes a good task, how to size it, when to use TDD, and how to detect external service setup needs. Every task the planner creates must pass the specificity test: "Could a different agent instance execute this without asking clarifying questions?"

## Placeholders

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{phase}}` | Current phase identifier | `01-foundation` |

## Content

<!-- section: task-anatomy -->
### Task Anatomy

Every task requires four fields:

**`<files>`** — Exact file paths created or modified.
- Good: `src/app/api/auth/login/route.ts`, `prisma/schema.prisma`
- Bad: "the auth files", "relevant components"

**`<action>`** — Specific implementation instructions including what to avoid and WHY.
- Good: "Create POST endpoint accepting {email, password}, validate with bcrypt against User table, return JWT in httpOnly cookie with 15-min expiry. Use jose (not jsonwebtoken — CommonJS issues with Edge runtime)."
- Bad: "Add authentication", "Make login work"

**`<verify>`** — How to prove the task is complete.
- Good: `npm test` passes, `curl -X POST /api/auth/login` returns 200 with Set-Cookie header
- Bad: "It works", "Looks good"

**`<done>`** — Acceptance criteria as measurable state.
- Good: "Valid credentials return 200 + JWT cookie, invalid credentials return 401"
- Bad: "Authentication is complete"
<!-- /section -->

<!-- section: task-types -->
### Task Types

| Type | Use For | Autonomy |
|------|---------|----------|
| `auto` | Everything the agent can do independently | Fully autonomous |
| `checkpoint:human-verify` | Visual/functional verification | Pauses for user |
| `checkpoint:decision` | Implementation choices | Pauses for user |
| `checkpoint:human-action` | Truly unavoidable manual steps (rare) | Pauses for user |

**Automation-first rule:** If the agent CAN do it via CLI/API, the agent MUST do it. Checkpoints verify AFTER automation, not replace it.
<!-- /section -->

<!-- section: task-sizing -->
### Task Sizing

Each task: **15-60 minutes** agent execution time.

| Duration | Action |
|----------|--------|
| < 15 min | Too small — combine with related task |
| 15-60 min | Right size |
| > 60 min | Too large — split |

**Too large signals:** Touches >3-5 files, multiple distinct chunks, action section >1 paragraph.

**Combine signals:** One task sets up for the next, separate tasks touch same file, neither meaningful alone.
<!-- /section -->

<!-- section: specificity -->
### Specificity Standards

| TOO VAGUE | JUST RIGHT |
|-----------|------------|
| "Add authentication" | "Add JWT auth with refresh rotation using jose, httpOnly cookie, 15min access / 7day refresh" |
| "Create the API" | "Create POST /api/projects accepting {name, description}, validate name 3-50 chars, return 201" |
| "Style the dashboard" | "Add Tailwind: grid (3 cols lg, 1 mobile), card shadows, hover states on action buttons" |
| "Handle errors" | "Wrap API calls in try/catch, return {error: string} on 4xx/5xx, show toast via sonner" |
| "Set up the database" | "Add User and Project models to schema.prisma with UUID ids, email unique, timestamps, run prisma db push" |

**Specificity test:** Could a different agent instance execute without asking clarifying questions? If not, add detail.
<!-- /section -->

<!-- section: tdd-detection -->
### TDD Detection

**Heuristic:** Can you write `expect(fn(input)).toBe(output)` before writing `fn`?
- Yes — Create a dedicated TDD plan (`type: tdd`)
- No — Standard task in standard plan

**TDD candidates (dedicated plans):** Business logic with defined I/O, API endpoints with request/response contracts, data transformations, validation rules, algorithms, state machines.

**Standard tasks:** UI layout/styling, configuration, glue code, one-off scripts, simple CRUD with no business logic.

**Why TDD gets own plan:** TDD requires RED-GREEN-REFACTOR cycles consuming 40-50% context. Embedding in multi-task plans degrades quality.
<!-- /section -->

<!-- section: user-setup -->
### User Setup Detection

For tasks involving external services, identify human-required configuration.

**External service indicators:** New SDK (`stripe`, `@sendgrid/mail`, `twilio`, `openai`), webhook handlers, OAuth integration, `process.env.SERVICE_*` patterns.

For each external service, determine:
1. **Env vars needed** — What secrets from dashboards?
2. **Account setup** — Does user need to create an account?
3. **Dashboard config** — What must be configured in external UI?

Record in `user_setup` frontmatter. Only include what the agent literally cannot do. Do NOT surface in planning output — execute-plan handles presentation.
<!-- /section -->

## Cross-references

- <skill:planner-checkpoints /> — Checkpoint task type guidelines
- <skill:planner-scope-estimation /> — Context budget per task

## Examples

See planner agent's `<task_breakdown>` section for the original comprehensive reference.
