const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { cleanup } = require('./helpers.cjs');
const { buildReviewInitResult } = require('../src/commands/init');

const ROOT = path.join(__dirname, '..');
const COMMAND_PATH = path.join(ROOT, 'commands', 'bgsd-review.md');
const WORKFLOW_PATH = path.join(ROOT, 'workflows', 'review.md');
const ROUTER_PATH = path.join(ROOT, 'src', 'router.js');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

function createReviewWorkflowProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-review-workflow-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '146-code-review-workflow'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({}, null, 2));
  fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n');
  fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State

## Current Position

**Phase:** 146 — 2 of 3 (Code Review Workflow)
**Current Plan:** 3
**Status:** Ready to execute
`);
  fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '146-code-review-workflow', '146-03-PLAN.md'), '# Plan\n');
  return tmpDir;
}

describe('review workflow contract', () => {
  test('command wrapper points to workflows/review.md using wrapper format', () => {
    const command = read(COMMAND_PATH);
    assert.match(command, /^---[\s\S]*description:/, 'wrapper should start with frontmatter');
    assert.match(command, /<execution_context>\s*@__OPENCODE_CONFIG__\/bgsd-oc\/workflows\/review\.md\s*<\/execution_context>/, 'wrapper should point at workflows/review.md');
    assert.match(command, /<process>[\s\S]*Execute the review workflow/, 'wrapper should be a thin workflow launcher');
  });

  test('workflow bootstraps via init:review instead of hard-coded model assumptions', () => {
    const workflow = read(WORKFLOW_PATH);
    const router = read(ROUTER_PATH);

    assert.match(workflow, /init:review/, 'workflow should reference init:review bootstrap');
    assert.match(router, /case 'review':[\s\S]*cmdInitReview/, 'router should expose init:review');
    assert.doesNotMatch(workflow, /gpt-|claude-|sonnet|opus/i, 'workflow should not hard-code model names');
  });

  test('review:scan is the first deterministic step before ask batching or agent judgment', () => {
    const workflow = read(WORKFLOW_PATH);
    const scanIndex = workflow.indexOf('review:scan');
    const askIndex = workflow.indexOf('ask_groups');
    const structuralIndex = workflow.indexOf('structural audit');
    const qualityIndex = workflow.indexOf('quality assessment');

    assert.ok(scanIndex !== -1, 'workflow should reference review:scan');
    assert.ok(askIndex !== -1, 'workflow should reference ask_groups batching');
    assert.ok(structuralIndex !== -1, 'workflow should describe structural audit stage');
    assert.ok(qualityIndex !== -1, 'workflow should describe quality assessment stage');
    assert.ok(scanIndex < askIndex, 'scan should precede ASK batching');
    assert.ok(scanIndex < structuralIndex, 'scan should precede structural audit');
    assert.ok(structuralIndex < qualityIndex, 'structural audit should precede quality assessment');
  });

  test('workflow preserves themed ASK batches, per-finding decisions, and unresolved items', () => {
    const workflow = read(WORKFLOW_PATH);

    assert.match(workflow, /batch ASK findings by theme/i, 'workflow should batch ASK findings by theme');
    assert.match(workflow, /collect a per-finding decision/i, 'workflow should keep per-finding decisions');
    assert.match(workflow, /status `unresolved`/i, 'workflow should preserve unresolved ASK items');
    assert.match(workflow, /do not block workflow completion/i, 'unresolved ASK items should be non-blocking');
  });

  test('workflow concludes with severity-led structured output for downstream readiness', () => {
    const workflow = read(WORKFLOW_PATH);

    assert.match(workflow, /severity buckets first/i, 'final report should be severity-led');
    assert.match(workflow, /quiet/i, 'workflow should stay quiet on clean output');
    assert.match(workflow, /structured data/i, 'workflow should preserve structured data');
    assert.match(workflow, /readiness\/reporting workflows can consume the result/i, 'workflow should target downstream readiness/reporting reuse');
  });

  test('buildReviewInitResult returns review bootstrap metadata for current phase and plan', () => {
    const tmpDir = createReviewWorkflowProject();
    try {
      const result = buildReviewInitResult(tmpDir);
      assert.strictEqual(result.phase_number, '146');
      assert.strictEqual(result.current_plan, '03');
      assert.strictEqual(result.plan_path, '.planning/phases/146-code-review-workflow/146-03-PLAN.md');
      assert.strictEqual(result.review_command, 'review:scan');
      assert.strictEqual(result.workflow_path, 'workflows/review.md');
      assert.ok(result.review_model, 'review_model should be resolved');
      assert.ok(result.verifier_model, 'verifier_model should be resolved');
    } finally {
      cleanup(tmpDir);
    }
  });
});
