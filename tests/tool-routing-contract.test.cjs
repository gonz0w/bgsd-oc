/**
 * Tool Routing Contract Test Suite — Phase 139/140
 *
 * Validates that every Chain B decision rule (file-discovery-mode, search-mode)
 * has at least one consumer in the workflows/ or agents/ directories.
 * Zero orphaned Chain B decisions.
 *
 * Requirements covered: TEST-02, PRUNE-02
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const REPO_ROOT = path.join(__dirname, '..');

/**
 * Call decisions:list via CLI and return parsed JSON.
 */
function getDecisionsList() {
  const output = execFileSync(
    process.execPath,
    [path.join(__dirname, '../bin/bgsd-tools.cjs'), 'decisions:list'],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 30000 }
  );
  return JSON.parse(output.trim());
}

/**
 * Read all .md files from a directory (non-recursive, direct children only).
 * Returns array of { file: filename, content: string }.
 */
function readMdFiles(dir) {
  const absDir = path.join(REPO_ROOT, dir);
  let entries;
  try {
    entries = fs.readdirSync(absDir);
  } catch {
    return [];
  }
  return entries
    .filter(f => f.endsWith('.md'))
    .map(f => ({
      file: path.join(dir, f),
      content: fs.readFileSync(path.join(absDir, f), 'utf8'),
    }));
}

/**
 * Check if a file content is a consumer of the given Chain B rule.
 * A file is a consumer if it contains:
 *   - decisions.{rule-id}  (explicit decision reference)
 */
function isConsumer(content, ruleId) {
  const escapedId = ruleId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const decisionPattern = new RegExp('decisions\\.' + escapedId);
  return decisionPattern.test(content);
}

// ─── Scan all workflow and agent .md files ────────────────────────────────────

const workflowFiles = readMdFiles('workflows');
const agentFiles = readMdFiles('agents');
const allConsumerFiles = [...workflowFiles, ...agentFiles];

// ─── CONTRACT TESTS ───────────────────────────────────────────────────────────

describe('Contract: Chain B decision consumer coverage — TEST-02', () => {

  test('Dynamic rule identification: filtering decisions:list by tool_availability yields >= 2 Chain B rules', () => {
    const { rules } = getDecisionsList();
    assert.ok(Array.isArray(rules), 'decisions:list should return { rules: [] }');

    const chainBRules = rules.filter(r =>
      Array.isArray(r.inputs) && r.inputs.includes('tool_availability')
    );

    const ids = chainBRules.map(r => r.id);
    assert.ok(chainBRules.length >= 2,
      `Expected at least 2 Chain B rules with tool_availability in inputs, got ${chainBRules.length}: [${ids.join(', ')}]`);

    // Verify the 2 remaining rules are present
    assert.ok(ids.includes('file-discovery-mode'),
      `Chain B rules should include file-discovery-mode. Found: [${ids.join(', ')}]`);
    assert.ok(ids.includes('search-mode'),
      `Chain B rules should include search-mode. Found: [${ids.join(', ')}]`);
  });

  test('Consumer scan: workflows/ and agents/ directories are readable', () => {
    assert.ok(workflowFiles.length > 0,
      `Expected at least one .md file in workflows/, found ${workflowFiles.length}`);
    assert.ok(agentFiles.length > 0,
      `Expected at least one .md file in agents/, found ${agentFiles.length}`);
  });

  test('Per-rule: file-discovery-mode has at least one consumer in workflows/ or agents/', () => {
    const consumers = allConsumerFiles.filter(f => isConsumer(f.content, 'file-discovery-mode'));
    const consumerNames = consumers.map(f => f.file);
    assert.ok(consumers.length > 0,
      `Chain B rule "file-discovery-mode" has no consumers in workflows/ or agents/. ` +
      `Scanned ${allConsumerFiles.length} files. ` +
      `Expected consumers matching decisions.file-discovery-mode or tool_availability.`);
    // Log which files consume it (for documentation, not assertion failure)
    assert.ok(true, `file-discovery-mode consumers: [${consumerNames.join(', ')}]`);
  });

  test('Per-rule: search-mode has at least one consumer in workflows/ or agents/', () => {
    const consumers = allConsumerFiles.filter(f => isConsumer(f.content, 'search-mode'));
    const consumerNames = consumers.map(f => f.file);
    assert.ok(consumers.length > 0,
      `Chain B rule "search-mode" has no consumers in workflows/ or agents/. ` +
      `Scanned ${allConsumerFiles.length} files. ` +
      `Expected consumers matching decisions.search-mode or tool_availability.`);
    assert.ok(true, `search-mode consumers: [${consumerNames.join(', ')}]`);
  });

  test('Zero orphans: all dynamically identified Chain B rules have at least one consumer', () => {
    const { rules } = getDecisionsList();
    const chainBRules = rules.filter(r =>
      Array.isArray(r.inputs) && r.inputs.includes('tool_availability')
    );

    const orphans = [];
    for (const rule of chainBRules) {
      const consumers = allConsumerFiles.filter(f => isConsumer(f.content, rule.id));
      if (consumers.length === 0) {
        orphans.push(rule.id);
      }
    }

    assert.strictEqual(orphans.length, 0,
      `Found ${orphans.length} orphaned Chain B decision rule(s) with no consumers: [${orphans.join(', ')}]. ` +
      `Every Chain B rule must have at least one consumer in workflows/ or agents/.`);
  });

  test('Consumer location: file-discovery-mode consumed by execute-plan.md (decisions.file-discovery-mode pattern)', () => {
    const executePlan = allConsumerFiles.find(f => f.file.endsWith('execute-plan.md'));
    assert.ok(executePlan, 'workflows/execute-plan.md should exist in consumer file list');

    const hasDecisionRef = /decisions\.file-discovery-mode/.test(executePlan.content);
    assert.ok(hasDecisionRef,
      'workflows/execute-plan.md should reference decisions.file-discovery-mode');
  });

  test('Consumer location: search-mode consumed by execute-plan.md (decisions.search-mode pattern)', () => {
    const executePlan = allConsumerFiles.find(f => f.file.endsWith('execute-plan.md'));
    assert.ok(executePlan, 'workflows/execute-plan.md should exist in consumer file list');

    const hasDecisionRef = /decisions\.search-mode/.test(executePlan.content);
    assert.ok(hasDecisionRef,
      'workflows/execute-plan.md should reference decisions.search-mode');
  });

  test('Consumer location: verification-routing consumed by execute-plan.md (decisions.verification-routing pattern)', () => {
    const executePlan = allConsumerFiles.find(f => f.file.endsWith('execute-plan.md'));
    assert.ok(executePlan, 'workflows/execute-plan.md should exist in consumer file list');

    const hasDecisionRef = /decisions\.verification-routing/.test(executePlan.content);
    assert.ok(hasDecisionRef,
      'workflows/execute-plan.md should reference decisions.verification-routing');
  });

  test('Consumer location: tool_availability consumed by bgsd-executor.md', () => {
    const executor = allConsumerFiles.find(f => f.file.endsWith('bgsd-executor.md'));
    assert.ok(executor, 'agents/bgsd-executor.md should exist in consumer file list');

    const hasToolAvail = /tool_availability/.test(executor.content);
    assert.ok(hasToolAvail,
      'agents/bgsd-executor.md should reference tool_availability');
  });

  test('Consumer location: tool_availability consumed by bgsd-debugger.md', () => {
    const debugger_ = allConsumerFiles.find(f => f.file.endsWith('bgsd-debugger.md'));
    assert.ok(debugger_, 'agents/bgsd-debugger.md should exist in consumer file list');

    const hasToolAvail = /tool_availability/.test(debugger_.content);
    assert.ok(hasToolAvail,
      'agents/bgsd-debugger.md should reference tool_availability');
  });

  test('Consumer location: tool_availability consumed by bgsd-codebase-mapper.md', () => {
    const mapper = allConsumerFiles.find(f => f.file.endsWith('bgsd-codebase-mapper.md'));
    assert.ok(mapper, 'agents/bgsd-codebase-mapper.md should exist in consumer file list');

    const hasToolAvail = /tool_availability/.test(mapper.content);
    assert.ok(hasToolAvail,
      'agents/bgsd-codebase-mapper.md should reference tool_availability');
  });

});
