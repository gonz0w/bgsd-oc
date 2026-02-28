# TDD Execution Patterns for Agentic Coding Systems

**Researched:** 2026-02-27
**Mode:** Ecosystem + Implementation Patterns
**Overall Confidence:** HIGH (multiple production systems analyzed, primary sources verified)

---

## Systems Analysis

### 1. Superpowers (obra/superpowers) — The Gold Standard

**Source:** [GitHub SKILL.md](https://github.com/obra/superpowers/blob/main/skills/test-driven-development/SKILL.md) (PRIMARY — raw source verified)
**Confidence:** HIGH (64.5k+ stars, Anthropic marketplace, source code read directly)

Superpowers' TDD skill is the most disciplined, battle-tested agentic TDD implementation in the wild. Key design decisions:

#### The Iron Law
```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
Write code before the test? Delete it. Start over.
No exceptions: Don't keep as "reference." Don't "adapt" it. Delete means delete.
```

This is enforced through **skill activation** — when the AI detects implementation requests, the TDD skill triggers automatically. If the agent writes code before tests, the skill instructs it to delete the code and restart.

#### Red-Green-Refactor with Verification Gates

Each phase has an explicit **MANDATORY verification step**:

1. **RED** — Write one minimal test. Run it. Confirm it **fails correctly** (not errors, not wrong failure — the specific failure expected because the feature is missing).
2. **Verify RED** — `npm test path/to/test.test.ts`. Confirm: fails (not errors), failure message matches expectations, fails because feature is missing (not typos).
3. **GREEN** — Write simplest code to pass. Nothing more.
4. **Verify GREEN** — Run tests. Confirm: test passes, ALL other tests still pass, output is pristine.
5. **REFACTOR** — Clean up only. Remove duplication, improve names, extract helpers. Keep tests green. Don't add behavior.
6. **Verify after REFACTOR** — Run tests again. Still green.

#### Anti-Pattern Enforcement
Superpowers ships a companion `testing-anti-patterns.md` that covers:
- Testing mock behavior instead of real behavior
- Adding test-only methods to production classes
- Mocking without understanding dependencies
- Incomplete mocks (partial structure)
- Integration tests as afterthought

#### Key Insight — Rationalization Detection
Superpowers explicitly lists and counters common rationalizations:

| Excuse | Superpowers Response |
|--------|---------------------|
| "Too simple to test" | Simple code breaks. Test takes 30 seconds. |
| "I'll test after" | Tests passing immediately prove nothing. |
| "Need to explore first" | Fine. Throw away exploration, start with TDD. |
| "TDD will slow me down" | TDD faster than debugging. |
| "Already spent X hours" | Sunk cost fallacy. Keeping unverified code is debt. |

**What bGSD should adopt:** The verification gates, the Iron Law, the rationalization counters, and the `<Good>` / `<Bad>` example pattern for prompt guidance.

---

### 2. Multi-Agent TDD (alexop.dev pattern) — Context Isolation

**Source:** [alexop.dev](https://alexop.dev/posts/custom-tdd-workflow-ai-code-vue/) (PRIMARY — detailed implementation walkthrough)
**Confidence:** HIGH (complete code examples, real-world usage documented)

Alexander Opalic identified and solved a critical problem: **context pollution** in single-context TDD.

#### The Core Problem
> "When everything runs in one context window, the LLM cannot truly follow TDD. The test writer's detailed analysis bleeds into the implementer's thinking."

The LLM subconsciously designs tests around the implementation it's already planning. It "cheats" without meaning to.

#### The Solution: Three Isolated Subagents

```
.ai-config/skills/tdd-integration/skill.md  (orchestrator)
.ai-config/agents/tdd-test-writer.md       (RED phase — limited tools)
.ai-config/agents/tdd-implementer.md       (GREEN phase — sees only failing test)
.ai-config/agents/tdd-refactorer.md        (REFACTOR phase — fresh context)
```

**Critical design decisions:**
- **Test writer** has NO access to implementation files — only test directories
- **Implementer** sees only the failing test file path and feature requirement — no test-writing context
- **Refactorer** starts fresh with clean context — evaluates without implementation baggage
- Each agent has **explicit return format** for clean handoffs between phases

#### Phase Violation Prevention
```markdown
Never:
- Write implementation before the test
- Proceed to Green without seeing Red fail
- Skip Refactor evaluation
- Start a new feature before completing the current cycle
```

#### Skill Activation via Hooks
Even with well-written skills, the AI only activated them ~20% of the time. Solution: `UserPromptSubmit` hook that injects a "MANDATORY SKILL ACTIVATION SEQUENCE" before every prompt. This raised activation from ~20% to ~84%.

**What bGSD should adopt:** The subagent isolation pattern (test-writer / implementer / refactorer as separate context windows), the explicit "Do NOT proceed until..." gates, and the hook-based enforcement.

---

### 3. Jaksa's TDD Coding Agent — Bash Orchestration

**Source:** [jaksa.wordpress.com](https://jaksa.wordpress.com/2025/08/04/building-a-tdd-coding-agent/) (PRIMARY)
**Confidence:** MEDIUM (proof of concept, not production-hardened)

Built as a weekend project in collaboration with Kent Beck and Steve Freeman's advice. Key insight:

#### Bash as Orchestrator, LLM as Executor
```bash
ai_output=$(ai-tool -p "$step-instructions")
```

Clean separation: Bash manages the TDD cycle, the AI handles actual coding. The orchestrator is deterministic; only the code generation is non-deterministic.

**Discovered problems:**
- Agent gets trapped in loops generating long if-then-else chains that satisfy tests technically but miss design intent
- Prompt refinement needed multiple iterations to get proper TDD discipline

**What bGSD should adopt:** The bash-orchestrator pattern maps directly to gsd-tools.cjs as the deterministic orchestrator calling agent subprocesses. The separation of workflow control (deterministic) from code generation (non-deterministic) is exactly our architecture.

---

### 4. Agentic Coding Handbook (Tweag) — TDD Workflow

**Source:** [tweag.github.io/agentic-coding-handbook](https://tweag.github.io/agentic-coding-handbook/WORKFLOW_TDD/) (PRIMARY)
**Confidence:** MEDIUM (community handbook, well-structured but less battle-tested than Superpowers)

Key contributions:
- **Tests as prompts:** "A test becomes a natural language spec that guides the AI toward exactly the behavior you expect."
- **Auto-validations workflow:** AI writes code → runs validation → analyzes feedback → self-corrects → repeats until all pass → commits. This loop applies to linters, formatters, unit tests, complexity analyzers, and static analysis.
- **Pre-commit hook integration:** "No invalid code ever gets committed" — agent runs pre-commit hooks, captures output, fixes issues, repeats.

**What bGSD should adopt:** The auto-validation loop pattern where test execution is part of the agent's iteration cycle, not a post-hoc check.

---

### 5. TDAID (Test-Driven AI Development) — The Methodology

**Source:** [awesome-testing.com](https://www.awesome-testing.com/2025/10/test-driven-ai-development-tdaid) (PRIMARY)
**Confidence:** HIGH (industry methodology with academic backing, Kent Beck endorsement)

TDAID extends classic TDD with two additional phases:

```
Plan → RED → GREEN → REFACTOR → Validate
```

Key insights:
- **Plan phase:** Ask a thinking model to generate a phased plan in TDD format with Red/Green/Refactor checkpoints baked in
- **Validate phase:** Human-in-the-loop verification after agent session. Tests may be green, but humans confirm the implementation matches the plan
- **Phase discipline:** "When I spot an agent churning too much code in one burst, I revert the whole change and restart"
- **LLM cheating detection:** the LLM may "cheat" by removing tests, leaving assertions empty, ignoring tests, or generating code that passes tests instead of fixing the code

**Prevention strategies:**
- Make local commits after each TDD phase
- Manually verify test intent and implementation
- Ensure agent runs tests after each phase
- Mark completed phases with ✅ in the plan for resumability

---

### 6. Cursor, Windsurf, Continue.dev — IDE Agents

**Confidence:** MEDIUM (secondary sources, no built-in TDD enforcement verified)

#### Cursor
- Has Plan Mode that breaks work into steps, but **no built-in TDD enforcement**
- Background agents can run tests but don't enforce test-first discipline
- TDD enforcement requires `.cursorrules` files with explicit instructions
- Checkpoints allow reverting to previous state (useful for TDD resets)

#### Windsurf
- Has "Flow-Based Automation" and memory system
- Phase-specific guardrails can enforce "no implementation during test phase"
- Agentic TDD documented as community workflow (not built-in feature)
- Supports `flow.yaml` for defining workflow sequences with validation gates

#### Continue.dev
- No built-in TDD mode found
- Custom commands can be configured to enforce workflows
- MCP servers could provide TDD tooling

**Key finding:** No mainstream IDE-based agent has **built-in** TDD enforcement. All require custom configuration (rules files, skills, hooks, or workflows). This is a genuine gap in the market and an opportunity for bGSD.

---

### 7. Steve Kinney's AI coding assistant TDD Pattern

**Source:** [stevekinney.com](https://stevekinney.com/courses/ai-development/test-driven-development-with-claude) (PRIMARY)
**Confidence:** HIGH (detailed course material, practical workflow)

Five-step TDD cycle with AI coding assistant:

1. **Write Tests First** — Explicitly state you're doing TDD to prevent the AI from creating mock implementations
2. **Confirm Tests Fail** — the AI runs tests via Bash tool, confirms expected failure
3. **Commit Failing Tests** — Creates verifiable definition of "done"
4. **Write Code to Pass Tests** — the AI enters autonomous loop: write → run → analyze failure → adjust → repeat
5. **Commit Passing Code** — the AI drafts commit message, completes cycle

Advanced patterns:
- **Sub-agents for overfitting prevention:** Separate agent independently verifies implementation beyond test coverage
- **PostToolUse hooks:** Automatically run linters and test suites after any file edit
- **CONVENTIONS.md conventions:** Project-wide testing guidelines enforced without repeated instructions

---

### 8. Academic Research — TDD-Bench

**Source:** [arxiv.org/abs/2412.02883](https://arxiv.org/abs/2412.02883) and [arxiv.org/abs/2505.09027](https://arxiv.org/abs/2505.09027)
**Confidence:** HIGH (peer-reviewed research)

- **TDD-Bench Verified:** Benchmarks LLMs' ability to generate tests for issues BEFORE resolution. Key finding: LLMs can generate meaningful failing tests, but performance varies significantly by model and issue complexity.
- **Tests as Prompt:** Explores tests as both prompt and verification. Reasoning models (OpenAI o1/o3) achieve SOTA on TDD tasks. Key bottleneck: instruction loss in long prompts — models "forget" TDD discipline as context grows.

---

## Proven Patterns

### Pattern 1: Deterministic Orchestrator + Non-Deterministic Executor

**Every successful system separates workflow control from code generation.**

```
┌──────────────────────────┐
│  ORCHESTRATOR (bGSD CLI) │  ← Deterministic. Controls flow.
│  - State machine         │
│  - Gate verification     │
│  - Commit discipline     │
│  - Phase transitions     │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│  EXECUTOR (AI agent) │  ← Non-deterministic. Generates code.
│  - Writes tests          │
│  - Writes implementation │
│  - Refactors             │
│  - Explains decisions    │
└──────────────────────────┘
```

The orchestrator NEVER trusts the executor to self-enforce TDD. It verifies at every gate.

### Pattern 2: Context Isolation Between Phases

**The most critical pattern across all systems.** Context pollution is the #1 cause of TDD failure in LLMs.

| Phase | Context Allowed | Context Forbidden |
|-------|----------------|-------------------|
| RED (test writing) | Requirements, test patterns, existing test examples | Implementation plans, existing source code |
| GREEN (implementation) | Failing test file, error output, existing source | Test-writing rationale, future plans |
| REFACTOR | Implementation code, test file, all tests passing | Previous phase reasoning, exploration notes |

**Implementation options:**
1. **Subagent per phase** (strongest isolation, highest cost) — alexop.dev pattern
2. **Context compaction between phases** (moderate isolation, lower cost) — discard previous phase context
3. **Explicit instructions per phase** (weakest isolation, lowest cost) — Superpowers/CONVENTIONS.md pattern

For bGSD: Option 2 (context compaction) is the right balance. We already have conversation compaction (CTX-03). Between TDD phases, compact and inject only phase-relevant context.

### Pattern 3: Verification Gates with Exit Criteria

Every phase transition requires machine-verifiable proof:

```
RED → GREEN requires:
  ✓ Test file exists
  ✓ Test was executed  
  ✓ Test FAILED (exit code ≠ 0)
  ✓ Failure message matches expected pattern (not a syntax error)
  ✓ No production code was modified

GREEN → REFACTOR requires:
  ✓ Implementation file(s) modified
  ✓ Test was executed
  ✓ Test PASSED (exit code = 0)
  ✓ ALL other tests still pass
  ✓ Test file was NOT modified during GREEN phase

REFACTOR → DONE requires:
  ✓ All tests still pass (exit code = 0)
  ✓ No new behavior added (test count unchanged)
  ✓ Output pristine (no warnings, no errors)
```

### Pattern 4: RGRC — Red Green Refactor Commit

**Source:** [Ardalis (Steve Smith)](https://ardalis.com/rgrc-is-the-new-red-green-refactor-for-test-first-development/) (2014, still relevant)

Commit at each phase boundary for maximum safety:

```
RED:      git commit -m "test(feature): add failing test for X"
GREEN:    git commit -m "feat(feature): implement X to pass tests"  
REFACTOR: git commit -m "refactor(feature): clean up X implementation"
```

**Benefits for agentic TDD:**
- Each commit is a safe rollback point
- If GREEN phase goes off the rails → revert to RED commit
- If REFACTOR breaks something → revert to GREEN commit
- Commit history documents the TDD discipline
- Agent attribution in commit metadata (gsd-executor, phase: red/green/refactor)

**Enhanced variant for agents:** Commit BEFORE refactor too (Red → Commit → Green → Commit → Refactor → Commit):
> "If you end up going down a rabbit hole in refactoring, you can always revert back to your pre-refactoring commit"

### Pattern 5: Test Quality Gates (Anti-Cheating)

LLMs cheat at TDD in predictable ways. Each requires a specific countermeasure:

| Cheat | Detection | Prevention |
|-------|-----------|------------|
| Test always passes | Run test BEFORE implementation. If it passes, reject. | Mandatory RED verification gate |
| Empty assertions | Parse test for `expect()` / `assert` calls. Count > 0. | Static analysis of test file |
| Testing the mock | Check for assertions on mock objects vs real behavior | Anti-patterns reference in agent instructions |
| Removing/weakening tests during GREEN | Diff test file between RED and GREEN commits | Pre-GREEN snapshot + post-GREEN diff check |
| Implementation before test | Check git diff: no src/ changes before test/ changes | File modification ordering check |
| Overly broad assertions | `expect(true).toBe(true)` or `expect(result).toBeDefined()` | Assert quality heuristics (flag toBeDefined/toBeTruthy without specifics) |

---

## Workflow Design

### Concrete TDD Execution Loop for bGSD

```
┌─────────────────────────────────────────────────┐
│               TDD PLAN EXECUTION                │
│                                                 │
│  For each task in plan:                         │
│                                                 │
│  ┌──────────────────────────────────────────┐   │
│  │  1. SETUP                                │   │
│  │     • Identify test file path            │   │
│  │     • Identify implementation file path  │   │
│  │     • Snapshot current test state        │   │
│  │     • Run existing tests (baseline)      │   │
│  └──────────────┬───────────────────────────┘   │
│                 │                                │
│  ┌──────────────▼───────────────────────────┐   │
│  │  2. RED PHASE                            │   │
│  │     • Agent writes test ONLY             │   │
│  │     • Allowed files: *.test.*, *.spec.*  │   │
│  │     • Forbidden: src/, lib/ modifications│   │
│  │                                          │   │
│  │  GATE: Verify RED                        │   │
│  │     □ Test file changed?                 │   │
│  │     □ No src files changed?              │   │
│  │     □ Tests run?                         │   │
│  │     □ New test FAILED?                   │   │
│  │     □ Failure is correct type?           │   │
│  │     □ Has real assertions?               │   │
│  │                                          │   │
│  │  → git commit "test: [task] (RED)"       │   │
│  └──────────────┬───────────────────────────┘   │
│                 │                                │
│  ┌──────────────▼───────────────────────────┐   │
│  │  3. GREEN PHASE                          │   │
│  │     • Agent writes implementation ONLY   │   │
│  │     • Allowed files: src/, lib/          │   │
│  │     • Forbidden: test file modifications │   │
│  │                                          │   │
│  │  GATE: Verify GREEN                      │   │
│  │     □ Implementation file(s) changed?    │   │
│  │     □ Test file NOT changed?             │   │
│  │     □ New test PASSES?                   │   │
│  │     □ ALL existing tests still pass?     │   │
│  │     □ No test output warnings?           │   │
│  │                                          │   │
│  │  → git commit "feat: [task] (GREEN)"     │   │
│  └──────────────┬───────────────────────────┘   │
│                 │                                │
│  ┌──────────────▼───────────────────────────┐   │
│  │  4. REFACTOR PHASE                       │   │
│  │     • Agent improves code quality        │   │
│  │     • Allowed: any file                  │   │
│  │     • Forbidden: new behavior, new tests │   │
│  │                                          │   │
│  │  GATE: Verify REFACTOR                   │   │
│  │     □ ALL tests still pass?              │   │
│  │     □ Test count unchanged?              │   │
│  │     □ No new assertions added?           │   │
│  │                                          │   │
│  │  → git commit "refactor: [task] (REFACTOR)"│ │
│  └──────────────┬───────────────────────────┘   │
│                 │                                │
│  ┌──────────────▼───────────────────────────┐   │
│  │  5. VALIDATE                             │   │
│  │     • Run full test suite                │   │
│  │     • Check coverage delta               │   │
│  │     • Mark task complete in plan         │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
│  → Next task                                    │
└─────────────────────────────────────────────────┘
```

### Implementation in bGSD Architecture

The TDD execution loop integrates with existing bGSD components:

```
Plan (type: tdd)
  └─ Tasks with RED/GREEN/REFACTOR structure
      │
      ├─ gsd-tools.cjs (orchestrator)
      │   ├─ Parses plan tasks
      │   ├─ Manages phase state machine: RED → GREEN → REFACTOR → DONE
      │   ├─ Runs test commands and captures exit codes
      │   ├─ Computes file diffs between phases
      │   ├─ Enforces file modification rules per phase
      │   ├─ Creates phase-tagged commits
      │   └─ Reports gate pass/fail to executor
      │
      └─ gsd-executor (agent)
          ├─ Receives phase-specific instructions
          ├─ Writes code within allowed scope
          ├─ Reports back to orchestrator
          └─ Receives gate results, iterates if failed
```

### TDD Plan Structure

```yaml
type: tdd
tasks:
  - id: task-1
    description: "Add retry logic to API client"
    test_file: "src/__tests__/api-client.test.ts"
    impl_files: ["src/api-client.ts"]
    steps:
      - phase: RED
        instruction: "Write a test that verifies retryOperation retries 3 times on failure"
        expected_failure: "retryOperation is not defined"
      - phase: GREEN  
        instruction: "Implement retryOperation with minimal retry loop"
        test_command: "npm test src/__tests__/api-client.test.ts"
      - phase: REFACTOR
        instruction: "Extract retry logic into reusable utility if needed"
```

### Gate Implementation (gsd-tools.cjs)

These gates can be implemented as pure functions in the CLI — zero dependencies:

```javascript
// Pseudo-code for gate verification
function verifyRedGate(preSnapshot, postSnapshot, testResult) {
  const checks = {
    testFileChanged: hasTestFileChanges(preSnapshot, postSnapshot),
    noSrcChanges: !hasSrcFileChanges(preSnapshot, postSnapshot),
    testsRan: testResult.ran === true,
    testFailed: testResult.exitCode !== 0,
    hasAssertions: countAssertions(postSnapshot.testFile) > 0,
    correctFailure: !testResult.output.includes('SyntaxError')
                 && !testResult.output.includes('Cannot find module'),
  };
  
  return {
    passed: Object.values(checks).every(v => v),
    checks,
    failures: Object.entries(checks)
      .filter(([, v]) => !v)
      .map(([k]) => k),
  };
}
```

### Commit Discipline

```
Phase    | Commit Message Pattern                    | Git Trailer
---------|-------------------------------------------|---------------------------
RED      | test(scope): add failing test for X       | GSD-Phase: red
GREEN    | feat(scope): implement X                  | GSD-Phase: green  
REFACTOR | refactor(scope): clean up X               | GSD-Phase: refactor
```

Each commit includes agent attribution (from QUAL-02):
```
git commit -m "test(api-client): add failing test for retry logic" \
  --trailer "GSD-Agent: gsd-executor" \
  --trailer "GSD-Phase: red" \
  --trailer "GSD-Plan: 37-01" \
  --trailer "GSD-Task: task-1"
```

---

## Anti-Patterns

### Critical Anti-Patterns (Cause Rewrites)

#### 1. Tests That Always Pass
**What happens:** Agent writes a test that passes immediately — either because it tests existing behavior, has no real assertions, or tests a mock.
**Why it happens:** LLM has implementation knowledge in context and unconsciously writes tests that match existing code.
**Detection:** Run tests BEFORE any implementation. If they pass → reject.
**Prevention:**
- RED gate requires `exitCode !== 0`
- Assert count check (`expect()` calls > 0)
- No `toBeDefined()` or `toBeTruthy()` as sole assertions (too weak)

#### 2. Implementation Before Tests (Test Backfilling)
**What happens:** Agent writes implementation first, then writes tests that pass. Tests verify what was built, not what was required.
**Why it happens:** LLMs default to implementation-first. It's their training distribution.
**Detection:** File modification timestamps — if src/ changes before test/ changes → violation.
**Prevention:**
- Phase state machine prevents GREEN before RED
- Git diff between phases catches violations
- Superpowers' Iron Law: "Delete it. Start over."

#### 3. Context Pollution / Test-Implementation Bleeding
**What happens:** When test and implementation are written in the same context, the LLM designs tests around the implementation it's already planning.
**Why it happens:** LLM attention mechanism connects test requirements to implementation patterns in the same context window.
**Detection:** Tests that are suspiciously well-matched to implementation structure (testing private methods, internal data structures).
**Prevention:**
- Context isolation between phases (subagents or compaction)
- Test writer has no access to implementation files
- Separate "what to test" (from requirements) vs "how to implement" (from architecture)

#### 4. Over-Mocking / Testing Implementation Details
**What happens:** Agent mocks everything, tests verify mock calls rather than real behavior. Tests pass but prove nothing about actual system behavior.
**Why it happens:** Mocking is easier than setting up real dependencies. LLMs follow patterns they've seen in training data (lots of mocked tests on GitHub).
**Detection:** Mock count vs assertion count ratio. If mocks > assertions → flag.
**Prevention:**
- Anti-patterns reference loaded into agent context
- Prefer integration-style tests (real components, minimal mocks)
- Gate check: assertions must reference real values, not mock return values

#### 5. Gold-Plating in GREEN Phase
**What happens:** Agent adds extra features, configurability, or abstractions beyond what the test requires.
**Why it happens:** LLMs are trained on "good code" which often includes configurability and abstraction. They over-engineer by default.
**Detection:** Diff size relative to test scope. If implementation adds exported functions not exercised by tests → flag.
**Prevention:**
- GREEN phase instruction: "Write ONLY what the test requires. No extras."
- Post-GREEN check: every new export must be exercised by a test
- Superpowers' example: hardcoded `3` retries vs configurable `maxRetries` option

### Moderate Anti-Patterns

#### 6. Refactor That Changes Behavior
**What happens:** During REFACTOR, agent introduces new behavior or changes existing behavior. Tests may still pass if they're too loose.
**Why it happens:** LLM sees an "obvious improvement" and adds it during refactoring.
**Detection:** Test count changes, new assertions added, or coverage report shows new code paths.
**Prevention:**
- REFACTOR gate checks test count before/after
- No new test files, no new test cases, no new assertions
- Only structural changes allowed

#### 7. Test Removal or Weakening During GREEN
**What happens:** Agent modifies the test file during GREEN to make it easier to pass.
**Why it happens:** When tests are "too hard" to implement against, the LLM path-of-least-resistance is to weaken the test.
**Detection:** Diff the test file between RED and GREEN commits.
**Prevention:**
- GREEN gate explicitly checks: test file NOT modified
- Pre-GREEN snapshot of test file, post-GREEN comparison

#### 8. Assertion-Free Tests
**What happens:** Test runs but has no meaningful assertions. `expect(result).toBeDefined()` or just calling the function without checking results.
**Why it happens:** LLM generates "tests" that are really just smoke tests or function calls.
**Detection:** Parse test file for assertion count and assertion quality.
**Prevention:**
- RED gate counts `expect()` calls (minimum 1 per test)
- Flag weak assertions: `toBeDefined`, `toBeTruthy`, `not.toThrow` as sole assertions

### Minor Anti-Patterns

#### 9. Test Setup Duplication
**What happens:** Agent copies test setup code into every test instead of using `beforeEach` or test helpers.
**Prevention:** REFACTOR phase specifically addresses this. Flag in review.

#### 10. Testing Private Implementation
**What happens:** Tests reach into internal state or private methods instead of testing public API.
**Prevention:** Anti-patterns reference. Tests should use the same interface as production callers.

---

## Recommendations

### For bGSD TDD Execution Engine

#### 1. Add TDD State Machine to gsd-tools.cjs (Phase 37-41 scope)

Add a `tdd-cycle` module that manages the RED → GREEN → REFACTOR state machine:

```
New CLI commands:
  gsd-tools.cjs tdd-gate red <test-file>    # Verify RED phase
  gsd-tools.cjs tdd-gate green <test-file>  # Verify GREEN phase  
  gsd-tools.cjs tdd-gate refactor           # Verify REFACTOR phase
  gsd-tools.cjs tdd-state <plan-id>         # Get current TDD phase for task
```

Each gate command:
1. Runs the test command
2. Captures exit code and output
3. Checks file modifications against allowed patterns
4. Returns structured JSON: `{ passed: bool, checks: {...}, failures: [...] }`

**Estimated complexity:** Low-Medium. Pure functions, no dependencies. File diff via `git diff`, test execution via `child_process.execSync`.

#### 2. Create TDD Executor Workflow

A new workflow (or mode of the existing executor workflow) that:
1. Reads plan tasks with TDD structure
2. For each task:
   - Sends RED phase instructions to agent (test-only scope)
   - Calls `tdd-gate red` after agent completes
   - If gate fails → feed failure back to agent for retry (max 3)
   - On pass → commits with RED trailer
   - Sends GREEN phase instructions (implementation-only scope)
   - Calls `tdd-gate green`
   - If gate fails → retry or abort
   - On pass → commits with GREEN trailer
   - Sends REFACTOR phase instructions
   - Calls `tdd-gate refactor`
   - On pass → commits with REFACTOR trailer
3. Reports task completion with all gate results

#### 3. Phase-Specific Context Injection

Leverage existing context scoping (CTX-01, CTX-04):

| Phase | Inject | Exclude |
|-------|--------|---------|
| RED | Requirements, test patterns, existing tests, test helpers | Implementation files, architecture notes |
| GREEN | Failing test file, test output, relevant source files | Test-writing context, exploration notes |
| REFACTOR | All implementation files, all tests, conventions | Previous phase reasoning |

#### 4. Commit Attribution for TDD Phases

Extend existing QUAL-02 commit attribution with TDD phase tags:

```
GSD-Phase: red|green|refactor
```

This enables:
- `git log --grep="GSD-Phase: red"` to see all test-first commits
- Verification that RED always precedes GREEN in commit history
- TDD compliance auditing

#### 5. Do NOT Build Subagent Isolation Initially

The subagent pattern (alexop.dev) provides the strongest TDD guarantees but:
- Requires spawning multiple AI processes (expensive, complex)
- Our context compaction (CTX-03) can achieve "soft isolation" by compacting between phases
- Phase-specific file restrictions achieve most of the isolation benefit

**Recommendation:** Start with context compaction + file restriction gates. Add subagent isolation only if context pollution proves to be a real problem in practice.

#### 6. Anti-Patterns Reference File

Create a `references/tdd-anti-patterns.md` loaded into executor context when running TDD plans. Based on Superpowers' testing-anti-patterns.md but adapted for bGSD's zero-dependency constraint.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| TDD workflow structure | HIGH | Multiple production systems converge on same pattern |
| Verification gates | HIGH | Superpowers, alexop.dev, Steve Kinney all use explicit gates |
| Context isolation need | HIGH | Identified independently by multiple practitioners |
| Commit discipline | HIGH | RGRC pattern well-established since 2014, reinforced by agentic TDD |
| Anti-patterns | HIGH | Documented across 5+ sources, academically verified |
| Implementation feasibility | HIGH | All gates implementable as pure functions in Node.js |
| Subagent vs compaction tradeoff | MEDIUM | Subagents proven effective but expensive; compaction untested for TDD |
| Assertion quality heuristics | MEDIUM | Parsing approach clear, threshold tuning needs experimentation |

## Sources

| Source | Type | Used For |
|--------|------|----------|
| [Superpowers SKILL.md](https://github.com/obra/superpowers/blob/main/skills/test-driven-development/SKILL.md) | Primary (raw source) | Iron Law, verification gates, rationalizations |
| [Superpowers testing-anti-patterns.md](https://github.com/obra/superpowers/blob/main/skills/test-driven-development/testing-anti-patterns.md) | Primary (raw source) | Anti-patterns taxonomy |
| [alexop.dev TDD workflow](https://alexop.dev/posts/custom-tdd-workflow-ai-code-vue/) | Primary (detailed walkthrough) | Context isolation, subagent pattern |
| [Simon Willison — Red/green TDD](https://simonwillison.net/guides/agentic-engineering-patterns/red-green-tdd/) | Primary (authoritative blog) | Core TDD-as-prompting insight |
| [Steve Kinney — TDD with AI coding assistant](https://stevekinney.com/courses/ai-development/test-driven-development-with-claude) | Primary (course material) | 5-step AI TDD cycle, hooks |
| [TDAID — Awesome Testing](https://www.awesome-testing.com/2025/10/test-driven-ai-development-tdaid) | Primary (methodology article) | Plan → Red → Green → Refactor → Validate |
| [Jaksa — Building a TDD Coding Agent](https://jaksa.wordpress.com/2025/08/04/building-a-tdd-coding-agent/) | Primary (blog) | Bash orchestration pattern |
| [Ardalis — RGRC](https://ardalis.com/rgrc-is-the-new-red-green-refactor-for-test-first-development/) | Primary (blog) | Commit discipline pattern |
| [Agentic Coding Handbook — TDD](https://tweag.github.io/agentic-coding-handbook/WORKFLOW_TDD/) | Primary (handbook) | Tests-as-prompts, auto-validations |
| [Windsurf Agentic TDD](https://medium.com/@hranjansingh/agentic-tdd-with-windsurf-efficient-test-driven-development-for-enterprise-teams-0dd7bf270383) | Secondary (Medium) | flow.yaml workflow structure |
| [TDD-Bench Verified](https://arxiv.org/abs/2412.02883) | Academic | LLM TDD capability benchmarks |
| [Tests as Prompt](https://arxiv.org/abs/2505.09027) | Academic | TDD benchmark, instruction loss finding |
| [byteiota — Superpowers overview](https://byteiota.com/superpowers-agentic-framework-27k-github-stars/) | Secondary | Superpowers ecosystem context |
| [The Neuron — TDD Guide](https://www.theneuron.ai/explainer-articles/test-driven-development-ai-coding-guide/) | Secondary | Superpowers adoption metrics |

---

## Gaps to Address

1. **Test command discovery:** How does the orchestrator know what test command to run? Needs project-level configuration (`npm test`, `pytest`, `go test`, etc.) — may already exist in bGSD project config.

2. **Partial test failures:** What if the RED gate finds the test fails but for the wrong reason (import error, not missing feature)? Need to distinguish "correct failure" from "broken test." Superpowers addresses this with the "fails because feature missing, not typos" check but doesn't give a programmatic solution.

3. **Multi-file tests:** When a test spans multiple files or requires test utilities/fixtures, the RED phase file restriction needs to allow test helper files, not just the primary test file.

4. **Refactor scope boundaries:** Defining "no new behavior" programmatically is hard. Test count is a proxy but not perfect (a refactor could merge two tests into one). May need heuristic: "test count unchanged OR decreased, no new test names."

5. **Context compaction effectiveness for TDD:** We assume context compaction between phases provides sufficient isolation. This needs validation — if the compacted summary retains implementation hints, the test writer may still be "polluted."

6. **Cost implications:** Running tests 3 times per task (RED, GREEN, REFACTOR) plus potential retries. For projects with slow test suites, this could be a bottleneck. Need to support running only the relevant test file, not the full suite, during gates — with full suite check only at VALIDATE.
