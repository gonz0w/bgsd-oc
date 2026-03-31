# Phase 148 Research - Review Readiness & Release Pipeline

## Planning Takeaways

- Phase 148 should extend the established v16.0 CLI-first pattern from Phases 146-147: deterministic CLI commands produce structured JSON first, then thin slash-command/workflow layers consume that data. Reusing that architecture will keep readiness advisory-only and make release orchestration testable without prompt-space guesswork.
- The highest-leverage existing code areas are `src/commands/review.js`, `src/commands/security.js`, `src/commands/init.js`, `src/router.js`, `src/lib/git.js`, `src/lib/output.js`, `src/lib/cli-tools/gh.js`, plus workflow/contract tests in `tests/review*.cjs` and `tests/security*.cjs`. The review/security phases already define the expected shape for routing, help text, init bootstrap, structured JSON output, quiet clean-path formatting, and workflow contract tests.
- Readiness should likely be a pure CLI slice first (`review:readiness`) with no blocking behavior anywhere. The command should emit per-check entries for tests, lint, review findings resolved, security findings resolved, TODOs in diff, and changelog updated; each entry should carry `pass`/`fail`/`skip` plus human-readable reason metadata so missing tooling or unavailable context becomes explicit `skip`, not implicit failure. This matches the context decision that unavailable checks are always shown honestly as skip.
- Advisory-only behavior is an implementation constraint, not just copywriting. Planner should avoid any design where readiness output drives command exit codes, stops `/bgsd-release`, or becomes a hidden gate in workflows. Prefer structured status + formatted board output, with labels like "advisory" or "pre-ship notes", and keep downstream release flow independent.
- Release work should be sequenced as analysis-first, mutation-second. A good plan split is: (1) release metadata/detection helpers, (2) semver bump + changelog draft generation in dry-run mode, (3) git tag/PR mutations behind one confirmation gate, (4) slash-command/workflow integration plus recovery/resume messaging. This follows the phase context decision that the workflow is dry-run by default and only crosses into git mutations after a single explicit confirmation.

## Requirement-to-Implementation Implications

### READY-01 / READY-02

- `review:readiness` needs a deterministic JSON contract similar to `review:scan` and `security:scan`, because later workflows may consume it. The command should separate check results from overall summary so TTY mode can render a terse board while JSON mode stays stable for piping.
- The planner should decide early whether readiness evaluates current repo state only or optionally accepts explicit artifacts/paths. Reusing review/security output is attractive, but if the command depends on prior workflow reports that may not exist, the absence case must degrade to `skip` with a reason instead of inventing failures.
- TODO-in-diff and changelog-updated checks likely depend on git diff helpers from Phase 146 patterns and on repo file inspection; they should be scoped narrowly enough to stay deterministic in tests.

### REL-01 / REL-02

- `release:bump` should reuse `src/lib/git.js` `structuredLog()` to analyze commits since the last tag. Existing conventional commit parsing is already present there, so the new logic can classify commits into major/minor/patch instead of reparsing log output from scratch.
- Ambiguous history needs a conservative patch fallback with manual override support. Planner should explicitly capture what counts as ambiguous: no prior tag, mostly uncategorized commits, conflicting signals, or no conventional commits. That behavior should surface as advisory metadata in dry-run output rather than silently guessing.
- `release:changelog` should combine conventional commits with plan summaries when available, because the requirement and intent call out plan summaries as a source. The existing milestone docs code in `src/commands/phase.js` shows a crude git-log changelog pattern, but this phase should likely introduce a more structured changelog generator instead of copying the raw log approach.

### REL-03 / REL-04

- Tag and PR automation should build on existing git + gh infrastructure rather than new wrappers: `execGit()`, `branchInfo()`, `cmdGhPreflight`, and `src/lib/cli-tools/gh.js` provide the main reusable pieces.
- Safe recovery matters most once mutations begin. The context decision rules out magical rollback; planner should treat each step as resumable: version/changelog files written, tag created locally, branch pushed, PR opened. For each step, define what cleanup is obviously safe and what should instead produce resume instructions. Example: deleting an unpushed local tag may be safe; rewriting a manually edited changelog is not.
- Release resume state may need a small persisted artifact in `.planning/` or an idempotent recomputation strategy. Without that, resuming after "version bumped, tag failed" or "tag created, PR failed" will be error-prone.

## Sequencing Risks And Dependencies

- There is a likely integration dependency on router/help/init/wrapper registration similar to Phases 146-147: new commands must be wired through `src/router.js`, usage text in `src/lib/constants.js`, command grouping in `src/lib/command-help.js`, slash wrappers in `commands/`, and workflow docs in `workflows/`.
- Release PR creation depends on `gh` availability and auth. The existing `detect gh-preflight` path is a natural dependency; planner should avoid discovering missing GitHub auth only after local mutations are done.
- Version bump touches at least `package.json`, probably `package-lock.json`, and maybe `VERSION` if the workflow wants alignment with published artifacts. Planner should verify which files are canonical before task breakdown.
- No `CHANGELOG.md` currently exists in the repo, so the planner must decide whether Phase 148 creates it from scratch and what heading/update format becomes the backward-compatible baseline.

## Verification Strategy For Execution

- Follow the Phase 146/147 verification style: command unit tests for JSON contracts and edge cases, plus separate workflow contract tests for wrapper/bootstrap/order-of-operations guarantees.
- Useful readiness tests: clean advisory output, skip-with-reason when tools/artifacts are unavailable, TODO detection limited to diff scope, changelog presence/update detection, JSON vs pretty output shape, and proof that non-ready status still returns advisory output instead of blocking.
- Useful release tests: semver classification from commit fixtures, conservative fallback on ambiguous history, manual override precedence, changelog grouping by conventional type, dry-run preview shape, confirmation gate before git mutations, and resume/safe-cleanup behavior for partial-failure scenarios.
- A fixture-heavy approach seems best: temporary git repos with seeded commits/tags can exercise bump/changelog/tag logic deterministically, just like existing review/security tests spin up temporary projects and inspect JSON output.

## TDD Advice

- TDD looks strongly advisable for the release helper layer and command contracts because the risky behavior is deterministic and stateful: semver inference, changelog grouping, dry-run previews, and partial-failure recovery all benefit from red/green coverage before wiring workflow UX.
- For readiness, TDD is useful for the JSON contract and edge-case classification (`pass` vs `fail` vs `skip`), especially because advisory-only semantics are easy to accidentally regress via exit codes or hidden gating.
- Workflow markdown/wrapper slices can follow the lighter Phase 146/147 contract-test pattern instead of deep TDD, since those changes are mostly structural and ordering-focused.

## Suggested Planning Shape

1. Readiness command + output contract + tests.
2. Release analysis helpers (`last tag`, semver inference, changelog generation) + tests.
3. Release mutation steps (version file updates, tag, PR, gh preflight, resume/safe cleanup) + tests.
4. `/bgsd-release` bootstrap/workflow/wrapper/help wiring + workflow contract tests.

## Blockers

- No hard blockers found during research.
- Planner should resolve two implementation choices before execution detail is finalized: the canonical version file set (`package.json` only vs `package.json` + `package-lock.json` + `VERSION`) and the persisted resume mechanism for partial release failures.
