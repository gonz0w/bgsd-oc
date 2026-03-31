# Roadmap: bGSD Plugin

## Milestones

- ✅ **v17.1 Workflow Reliability & Foundation Hardening** - Phases 163-167 (shipped 2026-03-30)
- 🚧 **v18.0 Adaptive Models & Ambient cmux UX** - Phases 168-172 (active)

## Overview

v18.0 makes bGSD easier to tune and easier to trust at a glance. The milestone first replaces provider-shaped model assumptions with a settings-driven contract built around shared `quality` / `balanced` / `budget` profiles, one selected global profile, and sparse direct agent overrides, then makes every workflow spawn resolve through one canonical model path with visible configured-versus-resolved state. With that settings foundation in place, the milestone adds a workspace-scoped `cmux` adapter that only speaks when targeting is safe, then layers on trustworthy sidebar status and progress, and finishes with concise logs, attention notifications, and aggressive noise control so ambient UX stays useful instead of chatty.

## Phases

- [x] **Phase 168: Adaptive Model Settings Contract** (completed 2026-03-31) - Give users one provider-agnostic settings surface for built-in profiles, one global default, and sparse direct overrides.
- [ ] **Phase 169: Canonical Model Resolution & Visibility** - Resolve every workflow spawn through one canonical model path and expose configured versus concrete model state.
- [ ] **Phase 170: cmux Workspace Detection & Safe Targeting** - Detect reachable `cmux` workspaces, scope updates correctly, and stay silent when targeting is unsafe or unavailable.
- [ ] **Phase 171: Ambient Workspace Status & Progress** - Surface trustworthy workspace state, context, and progress only when plugin signal quality is strong enough.
- [ ] **Phase 172: Ambient Attention UX & Noise Control** - Show concise logs and notifications for meaningful moments without repetitive sidebar churn.

## Phase Details

### Phase 168: Adaptive Model Settings Contract
**Goal**: Users can configure bGSD model behavior through one provider-agnostic settings contract built around shared profiles, one selected global default, and sparse direct overrides instead of provider-specific workflow assumptions
**Depends on**: Phase 167
**Requirements**: MODEL-01, MODEL-02, MODEL-03, MODEL-06, MODEL-07
**Success Criteria** (what must be TRUE):
  1. Users can define the concrete models behind built-in `quality`, `balanced`, and `budget` profiles and choose one project-wide active profile in settings without editing workflow prompts.
  2. Users can leave agent overrides empty by default and add sparse direct overrides only for exceptions such as routing one agent to a different concrete model.
  3. Settings and guidance describe the contract in provider-agnostic capability language, and Phase 168 does not preserve legacy `opus`, `sonnet`, or `haiku` naming as part of the public contract.
**Plans**: 4/4 plans complete

### Phase 169: Canonical Model Resolution & Visibility
**Goal**: Users can change settings once and trust every workflow path to resolve, route, and display model state consistently
**Depends on**: Phase 168
**Requirements**: MODEL-04, MODEL-05, MODEL-08
**Success Criteria** (what must be TRUE):
  1. Changing model settings changes actual workflow and init model selection everywhere bGSD spawns agents, without prompt edits or path-specific exceptions.
  2. Wherever bGSD shows model state, users can see both the configured selected profile or direct override and the resolved concrete model that will actually run.
  3. Agent routing behavior stays consistent even when the concrete provider model behind a profile changes, because routing no longer depends on Anthropic tier names.
**Plans**: TBD

### Phase 170: cmux Workspace Detection & Safe Targeting
**Goal**: Users get `cmux` integration only when bGSD can safely identify and target the correct workspace, while non-`cmux` usage stays unchanged
**Depends on**: Phase 167
**Requirements**: CMUX-01, CMUX-07, CMUX-08
**Success Criteria** (what must be TRUE):
  1. Users running inside or alongside `cmux` only see ambient integration when the active workspace can be targeted safely.
  2. Users with multiple active `cmux` workspaces see workspace-scoped updates that do not leak into or overwrite another workspace.
  3. Users outside `cmux`, or in unreachable `cmux` environments, experience unchanged plugin behavior with quiet fail-open fallback.
**Plans**: TBD

### Phase 171: Ambient Workspace Status & Progress
**Goal**: Users can glance at `cmux` and trust the workspace status, compact context, and progress signals it shows
**Depends on**: Phase 170
**Requirements**: CMUX-02, CMUX-03, CMUX-04
**Success Criteria** (what must be TRUE):
  1. Users see stable workspace states such as `Working`, `Input needed`, `Blocked`, `Idle`, `Warning`, and `Complete` that match real plugin lifecycle state.
  2. Users see a compact sidebar status pill with phase, plan, task, or workflow context whenever that context is reliable enough to trust.
  3. Users see sidebar progress when phase, plan, task, or workflow progress is trustworthy, and the plugin hides progress instead of guessing when signal quality is weak.
**Plans**: TBD

### Phase 172: Ambient Attention UX & Noise Control
**Goal**: Users get actionable ambient logs and notifications from `cmux` without spam or distracting churn
**Depends on**: Phase 171
**Requirements**: CMUX-05, CMUX-06, CMUX-09
**Success Criteria** (what must be TRUE):
  1. Users see concise sidebar log entries for major lifecycle moments like workflow start, task completion, waiting for input, blocker detection, and state warnings.
  2. Users receive `cmux` notifications for attention-worthy events such as checkpoints, blockers, warnings, and completion moments.
  3. Users do not get noisy or repetitive sidebar churn because non-essential updates are deduped and rate-limited.
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 168. Adaptive Model Settings Contract | 4/4 | Complete    | 2026-03-31 |
| 169. Canonical Model Resolution & Visibility | 0/TBD | Not started | - |
| 170. cmux Workspace Detection & Safe Targeting | 0/TBD | Not started | - |
| 171. Ambient Workspace Status & Progress | 0/TBD | Not started | - |
| 172. Ambient Attention UX & Noise Control | 0/TBD | Not started | - |

---

*Last updated: 2026-03-31*
