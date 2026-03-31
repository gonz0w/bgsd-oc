<purpose>
TDD execution workflow text aligned to the canonical `skills/tdd-execution/SKILL.md` contract.
Followed by the executor when executing `type: tdd` plans.
</purpose>

> Canonical contract source: `skills/tdd-execution/SKILL.md`
>
> This workflow reuses that skill's RED / GREEN / REFACTOR terminology, `execute:tdd` command names, exact-command targeting, and structured proof contract. Phase 150 hardens execution semantics only; it does not reopen Phase 149 selection or severity rules.

<state_machine>
```
INIT → RED → [validate-red gate] → GREEN → [validate-green gate] → REFACTOR → [validate-refactor gate] → DONE
```

Each transition uses the canonical `execute:tdd` validation commands. No phase may be skipped.
Each phase produces the expected commit artifact with `Agent-Type` and `GSD-Phase` trailers.
</state_machine>

<step name="parse_tdd_plan" phase="INIT">
## Step 1: Parse TDD Plan

Read the PLAN.md `<feature>` element. Extract:
- **Feature name:** from `<name>` element
- **Source file:** from `<files>` (implementation file)
- **Test file:** from `<files>` (test file)
- **Behavior cases:** from `<behavior>` — input/output expectations
- **Implementation hints:** from `<implementation>` (used in GREEN only)

Read exact per-stage target commands from the plan's TDD target section.
- **RED target command:** exact command expected to fail for the missing behavior
- **GREEN target command:** exact command expected to pass after implementation
- **REFACTOR target command:** exact command expected to keep passing after cleanup

Default contract: GREEN and REFACTOR stay targeted-only by default. Reuse the RED selector unless the plan explicitly widens scope.

If you need a non-blocking inspection run before a gate, use `execute:tdd auto-test` with the same exact target command and treat its proof payload as advisory only.

```bash
RED_TEST_CMD="<exact red target command from plan>"
GREEN_TEST_CMD="<exact green target command from plan>"
REFACTOR_TEST_CMD="<exact refactor target command from plan>"
```
</step>

<step name="red_phase" phase="RED">
## Step 2: RED Phase — Write Failing Test

**Goal:** Define behavior with a test that fails because the implementation doesn't exist yet.

1. Create or modify the test file with failing tests based on `<behavior>` cases.
   - Test expected inputs → outputs from the behavior specification.
   - Use project conventions for test structure (describe/it, test, etc.).
   - Do NOT create or modify implementation files.

2. Run anti-pattern check:
   ```bash
    node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:tdd detect-antipattern --phase red --files <modified_files>
   ```
   - If warnings about **pre-test code** (non-test files modified): **STOP**.
     Remove non-test changes before proceeding. This is the Iron Law of TDD.
   - If clean: proceed.

3. Run validation gate:
     ```bash
      node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:tdd validate-red --test-cmd "$RED_TEST_CMD"
     ```
    - If `valid: false` (target passed when it should fail, or the target command is missing):
      Fix the target command or test. RED only passes when the exact declared target fails for real.
      Common causes: testing existing functionality, wrong assertion, missing import.
     - If `valid: true` (exact target fails as expected): Proceed to commit.
     - Record the returned structured proof (`target_command`, `exit_code`, matched evidence snippet) as the RED audit trail.

4. Persist the RED proof to the canonical audit sidecar before downstream summary work:
   ```bash
   RED_PROOF=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:tdd validate-red --test-cmd "$RED_TEST_CMD" --raw)
   node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:tdd write-audit --phase "{phase}" --plan "{plan}" --stage red --proof "$RED_PROOF"
   ```
   The canonical sidecar becomes the durable proof source reused by fresh-context handoffs, resume inspection, and summary generation.

5. Commit the failing test:
   ```bash
    node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:commit "test({phase}-{plan}): add failing test for {feature}" \
      --files <test_file> \
      --agent bgsd-executor \
      --tdd-phase red
   ```

**Expected RED artifact:** failing test plus `test({phase}-{plan})` commit. NEVER write implementation code before the RED gate passes.
</step>

<step name="green_phase" phase="GREEN">
## Step 3: GREEN Phase — Minimal Implementation

**Goal:** Write the minimum code to make the failing test pass. Nothing more.

1. Write minimal implementation to pass the test.
   - No extra code, no optimization, no edge cases beyond what's tested.
   - No cleverness — just make the test green.
   - Do NOT modify test files (exception: genuine test bug — document as deviation).

2. Run anti-pattern check:
   ```bash
    node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:tdd detect-antipattern --phase green --files <modified_files>
   ```
   - If warnings about **test modification**: investigate. Tests should be stable in GREEN.
     Exception: fixing a genuine test bug (typo, wrong assertion). Document as deviation.
   - If warnings about **YAGNI** (implementation far exceeds test requirements): review.
     Strip code that isn't exercised by a test.

3. Run validation gate:
     ```bash
      node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:tdd validate-green --test-cmd "$GREEN_TEST_CMD"
     ```
    - If `valid: false` (the exact declared target still fails): Debug the implementation. Iterate until green.
     - If `valid: true` (the exact declared target passes): Proceed to commit.
     - Preserve the returned structured proof (`target_command`, `exit_code`, matched evidence snippet) for the GREEN audit trail.

4. Persist the GREEN proof into the same canonical audit sidecar:
   ```bash
   GREEN_PROOF=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:tdd validate-green --test-cmd "$GREEN_TEST_CMD" --raw)
   node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:tdd write-audit --phase "{phase}" --plan "{plan}" --stage green --proof "$GREEN_PROOF"
   ```
   Keep this sidecar current so later execute → verify handoff refreshes preserve one deterministic proof package.

5. Commit the implementation:
   ```bash
    node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:commit "feat({phase}-{plan}): implement {feature}" \
      --files <source_file> \
      --agent bgsd-executor \
      --tdd-phase green
   ```
</step>

<step name="refactor_phase" phase="REFACTOR">
## Step 4: REFACTOR Phase (Conditional)

**Goal:** Clean up the implementation without changing behavior. Skip if nothing to improve.

1. Review implementation for obvious cleanup opportunities:
   - Rename unclear variables or functions
   - Extract repeated logic into helpers
   - Simplify complex conditionals
   - Remove dead code
   - **No new behavior.** If you want new behavior, start a new RED phase.

2. If nothing to improve: skip directly to Step 5 (DONE).

3. If refactoring, run validation gate after changes:
     ```bash
      node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:tdd validate-refactor --test-cmd "$REFACTOR_TEST_CMD"
     ```
    - If `valid: false` (the declared refactor target regressed): **Undo the refactor.**
      Either refactor in smaller steps or skip the refactor entirely.
     - If `valid: true` (the exact target still passes): Proceed to commit.
     - Preserve the returned structured proof (`target_command`, `exit_code`, matched evidence snippet) for the REFACTOR audit trail.

4. Persist the REFACTOR proof into the same canonical audit sidecar:
   ```bash
   REFACTOR_PROOF=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:tdd validate-refactor --test-cmd "$REFACTOR_TEST_CMD" --raw)
   node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:tdd write-audit --phase "{phase}" --plan "{plan}" --stage refactor --proof "$REFACTOR_PROOF"
   ```
   This final sidecar state is what resumable fresh-context chains and downstream summaries should continue to re-render.

5. Commit the refactored code:
   ```bash
    node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:commit "refactor({phase}-{plan}): clean up {feature}" \
      --files <modified_files> \
      --agent bgsd-executor \
      --tdd-phase refactor
   ```
</step>

<step name="done" phase="DONE">
## Step 5: Done

TDD cycle complete. Return to the execute-plan workflow for SUMMARY creation.

**Expected commits produced:** 2-3
- RED: `test({phase}-{plan}): add failing test for {feature}` — with `GSD-Phase: red` trailer
- GREEN: `feat({phase}-{plan}): implement {feature}` — with `GSD-Phase: green` trailer
- REFACTOR (if changes made): `refactor({phase}-{plan}): clean up {feature}` — with `GSD-Phase: refactor` trailer
</step>

<enforcement_rules>
## Key Enforcement Rules

1. **NEVER write implementation code before the RED gate passes.**
   This is the Iron Law of TDD. The test defines the contract; implementation fulfills it.

2. **NEVER skip a validation gate.**
   If a gate fails, fix the issue — don't bypass the gate and proceed.

3. **NEVER modify tests during GREEN phase** unless the test itself has a genuine bug.
   If a test needs fixing in GREEN, document it as a deviation (Rule 1 - Bug).

4. **Each phase produces exactly one commit** with both `Agent-Type` and `GSD-Phase` trailers.
   No phase may produce zero commits. No phase may produce multiple commits.

5. **Minimal GREEN implementation.**
   Code in GREEN should be just enough to pass the test. Extra code is untested code.

6. **Contract authority lives in the shared skill.**
   If wording here drifts from `skills/tdd-execution/SKILL.md`, update this workflow to match the skill.

7. **Each gate validates the exact declared target command.**
   RED rejects missing targets; GREEN and REFACTOR stay targeted-only unless the plan explicitly broadens scope.
</enforcement_rules>

<stuck_loop_detection>
## Stuck/Loop Detection

Track consecutive gate failures per phase. If the same gate fails **3 times consecutively**:

1. **Log** the repeated failure pattern:
   ```
   ⚠ TDD gate failed 3 times: {gate_name}
   Error pattern: {recurring error or output snippet}
   ```

2. **Present options:**
   - **(a) Investigate root cause:** Deep-dive into why the gate keeps failing. One more attempt after investigation.
   - **(b) Abandon TDD:** Switch this feature to standard execution (`type: auto`). Document as deviation.
   - **(c) Stop:** Halt execution and return checkpoint for human review.

3. **In yolo mode:** Auto-select option (a) with one more attempt. If still failing after the 4th attempt, auto-select option (b) — abandon TDD and switch to standard execution with a deviation note.

4. **In interactive mode:** Present the 3 options and wait for user selection.

**Reset:** Counter resets after a successful gate pass or after switching to a different phase.
</stuck_loop_detection>
