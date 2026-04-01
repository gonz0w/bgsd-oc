# v19.0 Milestone Stack Needs

## Recommendation

**Do not add new npm dependencies for this milestone.** v19.0 should stay on the existing Node.js/OpenCode plugin stack and harden around **installed CLIs + Node stdlib orchestration**:

- **JJ CLI** for workspace creation, root resolution, stale-workspace recovery, and final reconcile/finalize entrypoints
- **cmux CLI** (with optional socket awareness later) for workspace-scoped status/progress/log/notification updates
- **existing Node stdlib** (`child_process`, timers, fs/path, optionally `net` if socket mode is later justified)
- **existing Node test runner + repo scripts** for risk-based verification (`node --test`, `npm test`, `npm run test:file -- ...`)

This milestone is primarily **runtime-contract and policy work**, not a dependency-expansion milestone.

## Required Runtime / Tooling Assumptions

### 1. JJ is a hard runtime dependency for workspace execution

Rely on current JJ workspace primitives, not custom workspace bookkeeping:

- `jj workspace add <destination>` creates the isolated workspace
- `jj workspace root --name <workspace>` resolves the actual pinned root
- `jj workspace forget <name>` removes repo tracking when cleanup finishes
- `jj workspace update-stale` is the official recovery path when one workspace rewrites another workspace's checked-out commit

Official docs confirm that multiple working copies share one repo, each workspace has its own checkout, and stale working copies are a normal cross-workspace condition that must be refreshed explicitly. For v19.0, that means the executor/orchestrator contract should treat **stale detection + update** as first-class, not exceptional.

**Practical assumption:** execution hosts need `jj` on PATH at a known-good current version; local env currently has `jj 0.39.0`, which already exposes the needed workspace commands.

### 2. cmux is an optional-but-real environment dependency for observability

For the cmux-backed coordination/observability slice, rely on current official cmux CLI/API surface:

- health and targeting: `ping`, `capabilities`, `identify`, `list-workspaces`
- sidebar metadata: `set-status`, `clear-status`, `set-progress`, `clear-progress`, `log`, `sidebar-state`
- attention UX: `notify`

Official docs also define the relevant environment assumptions:

- `CMUX_WORKSPACE_ID`
- `CMUX_SURFACE_ID`
- `CMUX_SOCKET_PATH`
- `CMUX_SOCKET_MODE`

That matches the existing plugin integration shape in `src/plugin/cmux-cli.js`, `src/plugin/cmux-targeting.js`, and `src/plugin/index.js`.

**Practical assumption:** live cmux observability is only available in macOS + cmux-managed terminal sessions. The milestone must preserve today's fail-open behavior when cmux is missing, unreachable, or not attached.

### 3. Testing stays on existing repo tooling

Use the current repo testing surface; do not introduce a new policy engine or test framework:

- focused proof: `node --test ...`, `npm run test:file -- ...`, direct CLI smoke commands
- broad proof when risk requires it: `npm test`
- milestone policy source of truth: `.planning/resources/RISK-BASED-TESTING-PRD.md` and `.planning/resources/RISK-BASED-TESTING-POLICY.md`

For v19.0 specifically, default to:

- **`full`** for shared JJ execution semantics, reconcile/finalize logic, plugin runtime coordination, or bundle-impacting changes
- **`light`** for narrow helpers around workspace targeting or cmux event batching
- **no new harness** beyond the existing Node test runner and integration coverage already used in this repo

## Concrete Integration Choices

### Keep JJ integration shell-based

Use the JJ CLI directly from Node. Do **not** add a JS JJ SDK layer. The official commands already cover workspace lifecycle and stale recovery, and the backlog explicitly needs runtime-enforced workspace pinning plus single-writer finalize semantics, not a new abstraction library.

### Keep cmux integration CLI-first for this milestone

cmux officially supports both CLI and Unix socket RPC. For v19.0, **CLI-first is sufficient** because the repo already has working child-process wrappers and write-probe targeting logic. If process pressure remains a bottleneck after debouncing/batching, later work can add socket transport behind the same adapter boundary.

### Implement coordination in-repo, not via packages

The cmux event-coordinator EDD already points to the right shape: debounce, batch, and semaphore in project code. That is enough; no queue/semaphore package is justified.

## What NOT to Add

- **No new npm packages** for queues, semaphores, RPC, observability, or JJ wrappers
- **No Go `cmux` library dependency** (`github.com/soheilhy/cmux` is unrelated to this terminal/workspace tool)
- **No database/service dependency** for reconcile state; keep single-writer finalize derived from repo truth
- **No alternate test framework**; keep Node's built-in runner and current npm scripts
- **No requirement that cmux be installed for normal plugin operation**; cmux remains enhancement-only
- **No custom workspace metadata format** that duplicates JJ's workspace model

## Net Stack Impact

**Additions required:**

- operational dependency on a current **JJ CLI** install where workspace execution is used
- operational dependency on **cmux** only for the observability slice / live UX validation

**New npm dependencies required:**

- **None**

## Confidence

**HIGH** for: no-new-npm-deps recommendation, JJ workspace command surface, cmux CLI/API surface, existing repo alignment.

**MEDIUM** for: staying CLI-first for cmux long-term; official socket API exists, but this milestone does not appear to need it if batching is implemented well.

## Sources

### Official

- Jujutsu working copy + workspaces: https://docs.jj-vcs.dev/latest/working-copy/
- Jujutsu CLI reference: https://docs.jj-vcs.dev/latest/cli-reference/
- Local verified JJ help output: `jj --version`, `jj help workspace add`, `jj help workspace root`, `jj help workspace update-stale`
- cmux API reference: https://www.cmux.dev/docs/api
- cmux README / platform notes: https://github.com/manaflow-ai/cmux/blob/main/README.md
- OpenCode plugin docs: https://opencode.ai/docs/plugins/

### Local project inputs

- `.planning/PROJECT.md`
- `.planning/research/JJ-WORKSPACE-PARALLEL-EXECUTION-BACKLOG.md`
- `.planning/research/CMUX-EVENT-COORDINATOR-EDD.md`
- `.planning/research/CMUX-FIRST-UX-PRD.md`
- `.planning/resources/RISK-BASED-TESTING-PRD.md`
- `.planning/resources/RISK-BASED-TESTING-POLICY.md`
- `src/plugin/cmux-cli.js`
- `src/plugin/cmux-targeting.js`
- `src/plugin/index.js`
- `package.json`
