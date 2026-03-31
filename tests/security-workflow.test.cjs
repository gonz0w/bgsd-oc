const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { cleanup } = require('./helpers.cjs');
const { buildSecurityInitResult } = require('../src/commands/init');

const ROOT = path.join(__dirname, '..');
const COMMAND_PATH = path.join(ROOT, 'commands', 'bgsd-security.md');
const WORKFLOW_PATH = path.join(ROOT, 'workflows', 'security.md');
const ROUTER_PATH = path.join(ROOT, 'src', 'router.js');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

function createSecurityWorkflowProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-security-workflow-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '147-security-audit-workflow'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({}, null, 2));
  fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n');
  fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State

## Current Position

**Phase:** 147 — 4 of 4 (Security Audit Workflow)
**Current Plan:** 4
**Status:** Ready to execute
`);
  fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '147-security-audit-workflow', '147-04-PLAN.md'), '# Plan\n');
  return tmpDir;
}

describe('security workflow contract', () => {
  test('command wrapper points to workflows/security.md using wrapper format', () => {
    const command = read(COMMAND_PATH);
    assert.match(command, /^---[\s\S]*description:/, 'wrapper should start with frontmatter');
    assert.match(command, /<execution_context>\s*@__OPENCODE_CONFIG__\/bgsd-oc\/workflows\/security\.md\s*<\/execution_context>/, 'wrapper should point at workflows/security.md');
    assert.match(command, /<process>[\s\S]*Execute the security workflow/, 'wrapper should be a thin workflow launcher');
  });

  test('workflow bootstraps via init:security instead of hard-coded model assumptions', () => {
    const workflow = read(WORKFLOW_PATH);
    const router = read(ROUTER_PATH);

    assert.match(workflow, /init:security/, 'workflow should reference init:security bootstrap');
    assert.match(router, /case 'security':[\s\S]*cmdInitSecurity/, 'router should expose init:security');
    assert.doesNotMatch(workflow, /gpt-|claude-|sonnet|opus/i, 'workflow should not hard-code model names');
  });

  test('security:scan is the first deterministic step before verifier assessment', () => {
    const workflow = read(WORKFLOW_PATH);
    const scanIndex = workflow.indexOf('security:scan');
    const verifyIndex = workflow.indexOf('independent assessment');
    const finalIndex = workflow.indexOf('severity-led');

    assert.ok(scanIndex !== -1, 'workflow should reference security:scan');
    assert.ok(verifyIndex !== -1, 'workflow should describe verifier assessment');
    assert.ok(finalIndex !== -1, 'workflow should describe severity-led reporting');
    assert.ok(scanIndex < verifyIndex, 'scan should precede verifier assessment');
    assert.ok(verifyIndex < finalIndex, 'verification should precede final reporting');
  });

  test('workflow keeps medium-confidence findings explicit and exclusions narrow', () => {
    const workflow = read(WORKFLOW_PATH);

    assert.match(workflow, /medium-confidence/i, 'workflow should mention medium-confidence findings');
    assert.match(workflow, /explicitly labeled as medium-confidence/i, 'workflow should keep medium-confidence labeling explicit');
    assert.match(workflow, /finding-level exclusions/i, 'workflow should keep exclusions finding-specific');
    assert.match(workflow, /Do not recommend broad rule-wide or project-wide suppressions/i, 'workflow should reject broad suppressions');
  });

  test('workflow concludes with severity-led structured output for downstream readiness', () => {
    const workflow = read(WORKFLOW_PATH);

    assert.match(workflow, /ordered by severity first/i, 'final report should be severity-led');
    assert.match(workflow, /quiet/i, 'workflow should stay quiet on clean output');
    assert.match(workflow, /explicit confidence labeling/i, 'workflow should preserve confidence labels');
    assert.match(workflow, /readiness\/reporting workflows can consume the result/i, 'workflow should target downstream readiness/reporting reuse');
  });

  test('buildSecurityInitResult returns security bootstrap metadata for current phase and plan', () => {
    const tmpDir = createSecurityWorkflowProject();
    try {
      const result = buildSecurityInitResult(tmpDir);
      assert.strictEqual(result.phase_number, '147');
      assert.strictEqual(result.current_plan, '04');
      assert.strictEqual(result.plan_path, '.planning/phases/147-security-audit-workflow/147-04-PLAN.md');
      assert.strictEqual(result.workflow_path, 'workflows/security.md');
      assert.strictEqual(result.security_command, 'security:scan');
      assert.strictEqual(result.report_path, '.planning/phases/147-security-audit-workflow/security-report.json');
      assert.ok(result.workflow_model, 'workflow_model should be resolved');
      assert.ok(result.verifier_model, 'verifier_model should be resolved');
    } finally {
      cleanup(tmpDir);
    }
  });
});
