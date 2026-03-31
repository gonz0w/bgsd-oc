'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WORKFLOW_PATH = path.join(ROOT, 'workflows', 'plan-phase.md');
const VERIFY_WORKFLOW_PATH = path.join(ROOT, 'workflows', 'verify-work.md');
const PLANNER_AGENT_PATH = path.join(ROOT, 'agents', 'bgsd-planner.md');
const CHECKER_AGENT_PATH = path.join(ROOT, 'agents', 'bgsd-plan-checker.md');
const QUESTIONS_PATH = path.join(ROOT, 'src', 'lib', 'questions.js');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

describe('plan-phase high-impact gray area gate', () => {
  test('planner adds a narrow fallback discussion gate for unresolved high-impact ambiguity', () => {
    const workflow = read(WORKFLOW_PATH);
    const questions = read(QUESTIONS_PATH);

    assert.match(workflow, /## 4\.5\. High-Impact Gray Area Gate/, 'workflow should add a dedicated high-impact gray-area gate');
    assert.match(workflow, /If discussion was skipped, CONTEXT\.md is missing, or the context leaves major High gray areas unresolved/i, 'workflow should detect when planner-side questioning is needed');
    assert.match(workflow, /Do not broaden this into a full discuss session\. No angry-user step here\./i, 'planner fallback should stay narrow and skip the angry-user review');
    assert.match(workflow, /Do not ask about Medium or Low gray areas unless a supposedly lower-ranked item has become High because of planning consequences\./i, 'planner fallback should remain focused on major ambiguity only');
    assert.match(workflow, /record the outcome as Locked, Defaulted, Delegated, or Deferred before planning continues/i, 'planner fallback should require explicit disposition before planning');
    assert.match(workflow, /Treat High-impact gray areas in CONTEXT\.md as planning-critical\. Do not guess past unresolved High items/i, 'planner prompt should tell the planner not to guess through unresolved high-impact ambiguity');
    assert.match(questions, /'plan-phase-high-impact-gray-area': \{[\s\S]*question: 'This high-impact gray area will change the plan\. How should we handle it\?'/, 'questions registry should expose the planner-side high-impact gray-area template');
  });
});

describe('plan-phase canonical planning-family wording', () => {
  test('workflow usage and compatibility notes prefer `/bgsd-plan phase`', () => {
    const workflow = read(WORKFLOW_PATH);

    assert.match(workflow, /Usage: \/bgsd-plan phase <phase-number> \[flags\]/, 'workflow should teach the canonical planning-family usage');
    assert.match(workflow, /Example: \/bgsd-plan phase 92/, 'workflow should show the canonical planning-family example');
    assert.match(workflow, /standalone `\/bgsd-plan phase <phase-number>` works normally, and the legacy standalone phase alias remains reference-only compatibility guidance/i, 'workflow should prefer the canonical command while preserving compatibility wording');
  });
});

describe('plan-family roadmap gap and todo parity notes', () => {
  test('workflow keeps expanded planning aliases tied to canonical `/bgsd-plan` branches', () => {
    const workflow = read(WORKFLOW_PATH);

    assert.match(workflow, /Reference-only compatibility note for future parity checks:/, 'workflow should keep an explicit parity note for planning-family aliases');
    assert.match(workflow, /legacy single-purpose planning aliases should remain behaviorally equivalent to their canonical planning-family routes, while roadmap, gaps, and todo work now belongs to sibling `\/bgsd-plan roadmap\|gaps\|todo` branches/i, 'workflow should keep roadmap gap and todo aliases normalized under the canonical planning family');
    assert.match(workflow, /instead of expanding this phase-planning workflow into a general planning catch-all/i, 'workflow should keep parity coverage focused on routing boundaries rather than broad help auditing');
  });
});

describe('plan approval realism gates', () => {
  test('workflow and agent prompts require analyze-plan realism checks before approval', () => {
    const workflow = read(WORKFLOW_PATH);
    const planner = read(PLANNER_AGENT_PATH);
    const checker = read(CHECKER_AGENT_PATH);

    assert.match(workflow, /run `verify:verify analyze-plan` and fix any realism blockers/i, 'workflow should require the analyze-plan realism gate before approval');
    assert.match(workflow, /command drift, stale paths, unavailable validation steps, task-order verify hazards, and overscope risk/i, 'workflow should name the realism failure modes explicitly');
    assert.match(planner, /run `verify:verify analyze-plan` and fix command, path, verification-order, or overscope blockers before approval/i, 'planner prompt should require the analyze-plan approval gate');
    assert.match(checker, /review `verify:verify analyze-plan` findings as approval blockers for stale commands, stale paths, unavailable validation steps, task-order hazards, or overscope risk/i, 'checker prompt should treat analyze-plan realism findings as approval blockers');
  });
});

describe('verify-work surfaced guidance coverage', () => {
  test('verification guidance requires broader surfaced-guidance checks for discoverability truths', () => {
    const workflow = read(VERIFY_WORKFLOW_PATH);

    assert.match(workflow, /when a phase success criterion depends on command-family or discoverability outcomes, expand verification beyond the directly touched regression file/i, 'verify-work should require broader surfaced-guidance coverage for discoverability-driven truths');
    assert.match(workflow, /check the broader surfaced guidance or command-family output that users actually rely on, not just the touched test file/i, 'verify-work should explain why touched-file-only verification is insufficient for surfaced guidance truths');
  });
});
