const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { cleanup } = require('./helpers.cjs');
const { buildReleaseInitResult } = require('../src/commands/init');

const ROOT = path.join(__dirname, '..');
const COMMAND_PATH = path.join(ROOT, 'commands', 'bgsd-release.md');
const WORKFLOW_PATH = path.join(ROOT, 'workflows', 'release.md');
const ROUTER_PATH = path.join(ROOT, 'src', 'router.js');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

function createReleaseWorkflowProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-release-workflow-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '148-review-readiness-release-pipeline'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({}, null, 2));
  fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n');
  fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State

## Current Position

**Phase:** 148 — Review Readiness & Release Pipeline
**Current Plan:** 4
**Status:** Ready to execute
`);
  fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '148-review-readiness-release-pipeline', '148-04-PLAN.md'), '# Plan\n');
  return tmpDir;
}

describe('release workflow contract', () => {
  test('command wrapper points to workflows/release.md using wrapper format', () => {
    const command = read(COMMAND_PATH);

    assert.match(command, /^---[\s\S]*description:/, 'wrapper should start with frontmatter');
    assert.match(command, /<execution_context>\s*@__OPENCODE_CONFIG__\/bgsd-oc\/workflows\/release\.md\s*<\/execution_context>/, 'wrapper should point at workflows/release.md');
    assert.match(command, /<process>[\s\S]*Execute the release workflow/, 'wrapper should be a thin workflow launcher');
  });

  test('workflow bootstraps via init:release instead of hard-coded model assumptions', () => {
    const workflow = read(WORKFLOW_PATH);
    const router = read(ROUTER_PATH);

    assert.match(workflow, /init:release/, 'workflow should reference init:release bootstrap');
    assert.match(router, /case 'release':[\s\S]*cmdInitRelease/, 'router should expose init:release');
    assert.doesNotMatch(workflow, /gpt-|claude-|sonnet|opus/i, 'workflow should not hard-code model names');
  });

  test('release analysis runs before the single confirmation gate and mutation steps', () => {
    const workflow = read(WORKFLOW_PATH);
    const bumpIndex = workflow.indexOf('release:bump');
    const changelogIndex = workflow.indexOf('release:changelog');
    const confirmationIndex = workflow.indexOf('single explicit confirmation gate');
    const tagIndex = workflow.indexOf('release:tag');
    const prIndex = workflow.indexOf('release:pr');

    assert.ok(bumpIndex !== -1, 'workflow should reference release:bump');
    assert.ok(changelogIndex !== -1, 'workflow should reference release:changelog');
    assert.ok(confirmationIndex !== -1, 'workflow should describe the confirmation gate');
    assert.ok(tagIndex !== -1, 'workflow should reference release:tag');
    assert.ok(prIndex !== -1, 'workflow should reference release:pr');
    assert.ok(bumpIndex < confirmationIndex, 'release:bump should precede confirmation');
    assert.ok(changelogIndex < confirmationIndex, 'release:changelog should precede confirmation');
    assert.ok(confirmationIndex < tagIndex, 'confirmation should precede release:tag');
    assert.ok(confirmationIndex < prIndex, 'confirmation should precede release:pr');
  });

  test('preview stays limited to locked essentials and only one explicit confirmation gate appears', () => {
    const workflow = read(WORKFLOW_PATH);
    const gateMatches = workflow.match(/single explicit confirmation gate/gi) || [];

    assert.match(workflow, /proposed version bump/i, 'preview should include the version bump');
    assert.match(workflow, /changelog summary/i, 'preview should include changelog summary');
    assert.match(workflow, /tag name/i, 'preview should include tag name');
    assert.match(workflow, /target PR details/i, 'preview should include PR details');
    assert.match(workflow, /Do not add hidden readiness gates, extra checklists, or unrelated operational detail/i, 'preview should stay narrowly scoped');
    assert.strictEqual(gateMatches.length, 1, 'workflow should describe exactly one explicit confirmation gate');
  });

  test('successful PR completion points to github-ci and resume guidance uses persisted release state', () => {
    const workflow = read(WORKFLOW_PATH);

    assert.match(workflow, /\/bgsd-github-ci/, 'workflow should hand off to /bgsd-github-ci');
    assert.match(workflow, /Do not create a separate post-PR release automation path/i, 'workflow should reject a bespoke post-PR flow');
    assert.match(workflow, /\.planning\/release-state\.json/, 'workflow should reference persisted release state');
    assert.match(workflow, /next safe step/i, 'workflow should mention next safe step guidance');
    assert.match(workflow, /next safe command/i, 'workflow should mention next safe command guidance');
  });

  test('buildReleaseInitResult returns release bootstrap metadata for current phase and plan', () => {
    const tmpDir = createReleaseWorkflowProject();
    try {
      const result = buildReleaseInitResult(tmpDir);

      assert.strictEqual(result.phase_number, '148');
      assert.strictEqual(result.current_plan, '04');
      assert.strictEqual(result.plan_path, '.planning/phases/148-review-readiness-release-pipeline/148-04-PLAN.md');
      assert.strictEqual(result.workflow_path, 'workflows/release.md');
      assert.strictEqual(result.release_state_path, '.planning/release-state.json');
      assert.deepStrictEqual(result.release_commands, {
        bump: 'release:bump',
        changelog: 'release:changelog',
        tag: 'release:tag',
        pr: 'release:pr',
      });
      assert.ok(result.workflow_model, 'workflow_model should be resolved');
      assert.ok(result.verifier_model, 'verifier_model should be resolved');
    } finally {
      cleanup(tmpDir);
    }
  });
});
