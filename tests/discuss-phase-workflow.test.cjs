'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WORKFLOW_PATH = path.join(ROOT, 'workflows', 'discuss-phase.md');
const QUESTIONS_PATH = path.join(ROOT, 'src', 'lib', 'questions.js');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

describe('discuss-phase stress test contract', () => {
  test('workflow ranks gray areas and forces explicit handling of high-impact ambiguity', () => {
    const workflow = read(WORKFLOW_PATH);
    const questions = read(QUESTIONS_PATH);

    assert.match(workflow, /Rank every gray area before discussion:/, 'workflow should require gray-area ranking before discussion');
    assert.match(workflow, /High = big implementation impact, user-visible consequences, or major planning risk if guessed wrong/i, 'workflow should define the High rank in planning-relevant terms');
    assert.match(workflow, /I'll rank the gray areas by impact so we resolve the biggest unknowns first\./i, 'workflow should present ranked handling to the user');
    assert.match(workflow, /Every High gray area must end with an explicit disposition: Locked, Defaulted, Delegated, or Deferred\./i, 'workflow should require explicit disposition of all High items');
    assert.match(workflow, /Do not force literal completion of every Low gray area\./i, 'workflow should avoid over-forcing Low gray areas');
    assert.match(workflow, /Do force explicit disposition of every High gray area: resolved, defaulted intentionally, delegated intentionally, or deferred intentionally\./i, 'workflow should enforce the recommended design choice');
    assert.match(questions, /'discuss-gray-areas': \{[\s\S]*question: 'How should we handle these ranked gray areas\?'/, 'questions registry should expose the ranked discuss prompt');
  });

  test('default workflow accelerates low-risk clarification without creating split semantics', () => {
    const workflow = read(WORKFLOW_PATH);
    const questions = read(QUESTIONS_PATH);

    assert.match(workflow, /look for 1-3 low-risk gray areas/i, 'workflow should identify low-risk defaults before the full discussion loop');
    assert.match(workflow, /This fast path only compresses low-risk clarification\./, 'workflow should frame fast behavior as scoped acceleration only');
    assert.match(workflow, /must not bypass locked decisions, deferred ideas, or agent-discretion capture later in the workflow\./i, 'workflow should preserve decision fidelity guardrails');
    assert.match(workflow, /If every gray area was safely defaulted or already locked, say so plainly and proceed directly to `customer_stress_test`/i, 'workflow should allow direct progression when no extra discussion is needed');
    assert.match(workflow, /Preserve whether an outcome was explicitly locked, accepted as a default, delegated to agent discretion, or deferred\./i, 'workflow should distinguish decision states');
    assert.match(questions, /'discuss-low-risk-path': \{[\s\S]*question: 'How should we handle these low-risk defaults\?'/, 'questions registry should expose the low-risk default template');
  });

  test('stress test step enforces one challenge at a time', () => {
    const workflow = read(WORKFLOW_PATH);

    assert.match(workflow, /Aim the sharpest challenges at High-ranked decisions and any user-visible changes with major downstream impact\./i, 'stress test should focus on the riskiest decisions first');
    assert.match(workflow, /This step is interactive Q&A, not a questionnaire dump\./, 'stress test should be framed as interactive Q&A');
    assert.match(workflow, /State exactly one complaint in-character.*stop and wait for the user's response.*accept or push back once more\./s, 'stress test should require one challenge then wait');
    assert.match(workflow, /Issue exactly one challenge per assistant turn\./, 'stress test should require one challenge per turn');
    assert.match(workflow, /Do not list upcoming challenges\./, 'stress test should forbid prelisting challenges');
    assert.match(workflow, /Do not ask 3-5 questions in a single message\./, 'stress test should forbid batching multiple questions');
    assert.match(workflow, /Do not summarize all challenges before the user replies\./, 'stress test should forbid dumping the full set before reply');
  });

  test('stress test still ends with the structured response template', () => {
    const workflow = read(WORKFLOW_PATH);
    const questions = read(QUESTIONS_PATH);

    assert.match(workflow, /questionTemplate\('discuss-stress-test-response', 'SINGLE_CHOICE'\)/, 'workflow should keep the post-stress-test response template');
    assert.match(workflow, /If nothing changes: proceed to write_context\./, 'workflow should still allow direct write-up when no decisions changed');
    assert.match(workflow, /If a decision changes: proceed to `reassess_after_stress_test`\./, 'workflow should still branch into reassessment when needed');
    assert.match(questions, /'discuss-stress-test-response': \{[\s\S]*question: 'Any of those points change your thinking\?'/, 'question template should still exist for stress-test follow-up');
    assert.match(workflow, /immediately do 1 bounded knock-on revalidation pass/i, 'changed decisions should go straight into knock-on revalidation');
    assert.match(workflow, /do not reopen unrelated gray areas/i, 'knock-on revalidation should stay narrow');
    assert.doesNotMatch(workflow, /questionTemplate\('discuss-stress-test-reassess', 'SINGLE_CHOICE'\)/, 'workflow should not ask a separate knock-on reassess question');
    assert.doesNotMatch(questions, /'discuss-stress-test-reassess': \{/, 'questions registry should not keep the removed reassess template');
  });
});

describe('discuss-phase fresh-context chaining contract', () => {
  test('clean start remains discuss-only and additive', () => {
    const workflow = read(WORKFLOW_PATH);

    assert.match(workflow, /`discuss` is the only workflow step allowed to start cleanly with no prior chain state\./i, 'discuss should remain the only clean-start exception');
    assert.match(workflow, /That clean-start path stays additive: it does not invent a second orchestration mode or change standalone `\/bgsd-discuss-phase` behavior\./i, 'clean start should stay additive');
    assert.match(workflow, /replace the previous same-phase handoff set only after the new discuss handoff artifacts are durable and fresh for the current planning inputs\./i, 'clean start should wait for durable fresh artifacts before replacement');
  });

  test('resume summary stays explicit for discuss re-entry', () => {
    const workflow = read(WORKFLOW_PATH);

    assert.match(workflow, /Use `resume_summary` as the chain-aware re-entry contract when prior handoff artifacts exist\./, 'discuss should acknowledge resume summary as the re-entry contract');
    assert.match(workflow, /show the explicit resume summary first and preserve the exact `resume` \/ `inspect` \/ `restart` contract instead of silently resuming\./i, 'discuss should preserve the explicit resume summary contract');
    assert.match(workflow, /do not guess from `STATE\.md` or partial markdown artifacts\./i, 'discuss should fail closed for invalid chained state');
    assert.match(workflow, /`--auto`\/yolo may chain into the next workflow after the workflow itself writes durable discuss handoff artifacts for the current planning inputs, but it does not replace the explicit resume-summary branch/i, 'auto mode should stay additive to explicit resume handling');
  });
});
