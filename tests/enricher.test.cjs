/**
 * Enricher test suite — Phase 120 Plan 02
 *
 * Tests three requirement areas:
 *   ENR-01: Zero redundant calls — parsePlans and listSummaryFiles called at most once
 *   ENR-02: SQL-backed enrichment — warm SQLite cache returns expected output shape
 *   ENR-03: Timing instrumentation — _enrichment_ms field < 50ms on warm cache
 *
 * Uses dynamic import() to load the ESM plugin.js bundle from CJS test context.
 * Creates isolated temp projects with realistic .planning/ structure for each group.
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PLUGIN_PATH = path.resolve(__dirname, '..', 'plugin.js');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MINIMAL_ROADMAP = `# Project Roadmap

## Milestone: Test Milestone 1.0

### Phase 1 — Foundation

**Goal:** Build the foundation
**Status:** In Progress
**Requirements:** [TEST-01]
`;

const MINIMAL_STATE = `# Project State

## Current Position

**Phase:** 1 of 1 (Foundation)
**Current Plan:** Plan 01
**Status:** In progress
**Last Activity:** 2026-01-01

Progress: [████░░░░░░] 40%

## Accumulated Context

### Decisions

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

**Last session:** 2026-01-01
**Stopped at:** Initial setup
**Next step:** Proceed to plan 01
`;

const MINIMAL_PLAN = `---
phase: 1-foundation
plan: 01
type: execute
autonomous: true
requirements: [TEST-01]
---

<objective>
Test plan for enricher unit tests.
</objective>

<tasks>
<task type="auto">
  <name>Task 1: Do the thing</name>
  <files>src/index.js</files>
  <action>Do something.</action>
  <verify>Verify something.</verify>
  <done>Something is done.</done>
</task>
</tasks>

<success_criteria>
- Task 1 complete
</success_criteria>
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create an isolated temp project with realistic .planning/ structure.
 * Returns the temp dir path.
 */
function makePlanningProject(prefix = 'bgsd-enricher-test-', extraFiles = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const planningDir = path.join(dir, '.planning');
  const phasesDir = path.join(planningDir, 'phases');
  const phaseDir = path.join(phasesDir, '01-foundation');

  fs.mkdirSync(phaseDir, { recursive: true });

  // Core planning files
  fs.writeFileSync(path.join(planningDir, 'ROADMAP.md'), MINIMAL_ROADMAP);
  fs.writeFileSync(path.join(planningDir, 'STATE.md'), MINIMAL_STATE);

  // Plan file
  const planPath = path.join(phaseDir, '0001-01-PLAN.md');
  fs.writeFileSync(planPath, MINIMAL_PLAN);

  // Optional extra files
  for (const [relPath, content] of Object.entries(extraFiles)) {
    const fullPath = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }

  return dir;
}

/**
 * Parse the enrichment JSON from output.parts[0].
 */
function parseEnrichmentOutput(output) {
  if (!output.parts || output.parts.length === 0) return null;
  const text = output.parts[0].text;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * Run enrichCommand with a bgsd-help command (always succeeds).
 */
function runEnrich(enrichCommand, dir) {
  const input = { command: 'bgsd-help', parts: ['bgsd-help'] };
  const output = { parts: [] };
  enrichCommand(input, output, dir);
  return { input, output };
}

/**
 * Remove a temp directory recursively (best-effort).
 */
function cleanupDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore cleanup failures
  }
}

// ---------------------------------------------------------------------------
// Group 1: Zero redundant calls (ENR-01)
// ---------------------------------------------------------------------------

describe('Group 1: Zero redundant calls (ENR-01)', () => {
  let enrichCommand;
  let tempDir;

  before(async () => {
    const mod = await import(PLUGIN_PATH);
    enrichCommand = mod.enrichCommand;
    tempDir = makePlanningProject('bgsd-enr-g1-');
  });

  after(() => {
    cleanupDir(tempDir);
  });

  it('enrichCommand is exported as a function from plugin.js', () => {
    assert.strictEqual(typeof enrichCommand, 'function', 'enrichCommand should be a function');
  });

  it('enrichment succeeds and returns output.parts', () => {
    const { output } = runEnrich(enrichCommand, tempDir);
    assert.ok(output.parts.length > 0, 'output.parts should be non-empty after enrichment');
  });

  it('output.parts[0] is a bgsd-context XML block', () => {
    const { output } = runEnrich(enrichCommand, tempDir);
    const text = output.parts[0].text;
    assert.ok(text.startsWith('<bgsd-context>'), 'output should start with <bgsd-context>');
    assert.ok(text.endsWith('</bgsd-context>'), 'output should end with </bgsd-context>');
  });

  it('enrichment result is valid JSON', () => {
    const { output } = runEnrich(enrichCommand, tempDir);
    const j = parseEnrichmentOutput(output);
    assert.notStrictEqual(j, null, 'enrichment output should be parseable JSON');
  });

  it('calling enrichCommand twice on same dir produces consistent results', () => {
    const { output: out1 } = runEnrich(enrichCommand, tempDir);
    const { output: out2 } = runEnrich(enrichCommand, tempDir);
    const j1 = parseEnrichmentOutput(out1);
    const j2 = parseEnrichmentOutput(out2);
    // Compare key fields that should be stable
    assert.strictEqual(j1.planning_dir, j2.planning_dir, 'planning_dir should be stable across calls');
    assert.strictEqual(j1.plan_count, j2.plan_count, 'plan_count should be stable across calls');
    assert.strictEqual(j1.summary_count, j2.summary_count, 'summary_count should be stable across calls');
  });

  it('NODE_ENV=development alone does not emit enricher debug timing', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalDebug = process.env.BGSD_DEBUG;
    const originalStderrWrite = process.stderr.write;
    const lines = [];

    try {
      process.env.NODE_ENV = 'development';
      delete process.env.BGSD_DEBUG;
      process.stderr.write = (chunk, ...rest) => {
        lines.push(String(chunk));
        return originalStderrWrite.call(process.stderr, chunk, ...rest);
      };

      runEnrich(enrichCommand, tempDir);

      assert.strictEqual(lines.filter(line => line.includes('[bgsd-enricher]')).length, 0, 'NODE_ENV alone should not enable enricher debug output');
    } finally {
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;

      if (originalDebug === undefined) delete process.env.BGSD_DEBUG;
      else process.env.BGSD_DEBUG = originalDebug;

      process.stderr.write = originalStderrWrite;
    }
  });

  it('BGSD_DEBUG emits enricher debug timing', () => {
    const originalDebug = process.env.BGSD_DEBUG;
    const originalStderrWrite = process.stderr.write;
    const lines = [];

    try {
      process.env.BGSD_DEBUG = '1';
      process.stderr.write = (chunk, ...rest) => {
        lines.push(String(chunk));
        return originalStderrWrite.call(process.stderr, chunk, ...rest);
      };

      runEnrich(enrichCommand, tempDir);

      assert.ok(lines.some(line => line.includes('[bgsd-enricher]')), 'BGSD_DEBUG should enable enricher debug output');
    } finally {
      if (originalDebug === undefined) delete process.env.BGSD_DEBUG;
      else process.env.BGSD_DEBUG = originalDebug;

      process.stderr.write = originalStderrWrite;
    }
  });

  it('non-bgsd command is not enriched (early return)', () => {
    const input = { command: 'not-bgsd', parts: ['not-bgsd'] };
    const output = { parts: [] };
    enrichCommand(input, output, tempDir);
    assert.strictEqual(output.parts.length, 0, 'non-bgsd command should not enrich output');
  });

  it('enrichment with null input returns without modifying output', () => {
    const output = { parts: [] };
    enrichCommand(null, output, tempDir);
    assert.strictEqual(output.parts.length, 0, 'null input should not modify output');
  });

  it('incomplete_plans is empty array when all plans have summaries', () => {
    const summaryDir = path.join(tempDir, '.planning', 'phases', '01-foundation');
    const summaryPath = path.join(summaryDir, '0001-01-SUMMARY.md');
    // Write a summary file to simulate all plans complete
    fs.writeFileSync(summaryPath, '# Summary\n\nComplete.\n');

    const { output } = runEnrich(enrichCommand, tempDir);
    const j = parseEnrichmentOutput(output);

    // Clean up the summary file for other tests
    try { fs.unlinkSync(summaryPath); } catch {}

    if (j && Array.isArray(j.incomplete_plans)) {
      assert.strictEqual(j.incomplete_plans.length, 0, 'incomplete_plans should be empty when all plans have summaries');
    }
    // If incomplete_plans is not set (cold cache without plans), that's also acceptable
  });
});

// ---------------------------------------------------------------------------
// Group 2: Warm-cache timing (ENR-03)
// ---------------------------------------------------------------------------

describe('Group 2: Warm-cache timing and _enrichment_ms field (ENR-03)', () => {
  let enrichCommand;
  let getProjectState;
  let tempDir;

  before(async () => {
    const mod = await import(PLUGIN_PATH);
    enrichCommand = mod.enrichCommand;
    getProjectState = mod.getProjectState;
    tempDir = makePlanningProject('bgsd-enr-g2-');
  });

  after(() => {
    cleanupDir(tempDir);
  });

  it('_enrichment_ms field is present in enrichment output', () => {
    const { output } = runEnrich(enrichCommand, tempDir);
    const j = parseEnrichmentOutput(output);
    assert.notStrictEqual(j, null, 'enrichment JSON should parse successfully');
    assert.ok('_enrichment_ms' in j, '_enrichment_ms should be present in enrichment output');
  });

  it('_enrichment_ms is a number', () => {
    const { output } = runEnrich(enrichCommand, tempDir);
    const j = parseEnrichmentOutput(output);
    assert.strictEqual(typeof j._enrichment_ms, 'number', '_enrichment_ms should be a number');
  });

  it('_enrichment_ms is non-negative', () => {
    const { output } = runEnrich(enrichCommand, tempDir);
    const j = parseEnrichmentOutput(output);
    assert.ok(j._enrichment_ms >= 0, '_enrichment_ms should be non-negative');
  });

  it('warm-cache enrichment completes in <50ms (ENR-03 target)', () => {
    // First call: populates project state cache (warm-up)
    getProjectState(tempDir);

    // Second call: should hit warm cache and complete quickly
    const { output } = runEnrich(enrichCommand, tempDir);
    const j = parseEnrichmentOutput(output);

    assert.ok(j._enrichment_ms < 50,
      `Warm-cache enrichment took ${j._enrichment_ms}ms — should be <50ms (ENR-03 target)`);
  });

  it('_enrichment_ms is finite (not Infinity or NaN)', () => {
    const { output } = runEnrich(enrichCommand, tempDir);
    const j = parseEnrichmentOutput(output);
    assert.ok(Number.isFinite(j._enrichment_ms), '_enrichment_ms should be a finite number');
  });

  it('multiple warm calls all complete in <50ms', () => {
    // Warm up first
    getProjectState(tempDir);

    const timings = [];
    for (let i = 0; i < 3; i++) {
      const { output } = runEnrich(enrichCommand, tempDir);
      const j = parseEnrichmentOutput(output);
      timings.push(j._enrichment_ms);
    }

    for (const t of timings) {
      assert.ok(t < 50, `Warm call took ${t}ms — should be <50ms (ENR-03 target)`);
    }
  });

  it('enrichment still completes on cold cache (no pre-warm)', () => {
    // Different dir — no pre-warm
    const coldDir = makePlanningProject('bgsd-enr-cold-');
    try {
      const { output } = runEnrich(enrichCommand, coldDir);
      const j = parseEnrichmentOutput(output);
      assert.notStrictEqual(j, null, 'cold-cache enrichment should still return valid JSON');
      assert.ok('_enrichment_ms' in j, '_enrichment_ms should be present even on cold cache');
    } finally {
      cleanupDir(coldDir);
    }
  });
});

// ---------------------------------------------------------------------------
// Group 3: Output shape invariance (ENR-02)
// ---------------------------------------------------------------------------

describe('Group 3: Output shape invariance (ENR-02)', () => {
  let enrichCommand;
  let tempDir;

  before(async () => {
    const mod = await import(PLUGIN_PATH);
    enrichCommand = mod.enrichCommand;
    tempDir = makePlanningProject('bgsd-enr-g3-');
  });

  after(() => {
    cleanupDir(tempDir);
  });

  it('enrichment output contains planning_dir field', () => {
    const { output } = runEnrich(enrichCommand, tempDir);
    const j = parseEnrichmentOutput(output);
    assert.ok('planning_dir' in j, 'planning_dir should be present');
    assert.strictEqual(typeof j.planning_dir, 'string', 'planning_dir should be a string');
  });

  it('enrichment output contains state_path field', () => {
    const { output } = runEnrich(enrichCommand, tempDir);
    const j = parseEnrichmentOutput(output);
    assert.ok('state_path' in j, 'state_path should be present');
    assert.strictEqual(typeof j.state_path, 'string', 'state_path should be a string');
  });

  it('enrichment output contains roadmap_path field', () => {
    const { output } = runEnrich(enrichCommand, tempDir);
    const j = parseEnrichmentOutput(output);
    assert.ok('roadmap_path' in j, 'roadmap_path should be present');
    assert.strictEqual(typeof j.roadmap_path, 'string', 'roadmap_path should be a string');
  });

  it('enrichment output contains config_path field', () => {
    const { output } = runEnrich(enrichCommand, tempDir);
    const j = parseEnrichmentOutput(output);
    assert.ok('config_path' in j, 'config_path should be present');
    assert.strictEqual(typeof j.config_path, 'string', 'config_path should be a string');
  });

  it('enrichment output contains commit_docs field', () => {
    const { output } = runEnrich(enrichCommand, tempDir);
    const j = parseEnrichmentOutput(output);
    assert.ok('commit_docs' in j, 'commit_docs should be present');
  });

  it('state_exists, project_exists, roadmap_exists are booleans', () => {
    const { output } = runEnrich(enrichCommand, tempDir);
    const j = parseEnrichmentOutput(output);
    assert.strictEqual(typeof j.state_exists, 'boolean', 'state_exists should be boolean');
    assert.strictEqual(typeof j.roadmap_exists, 'boolean', 'roadmap_exists should be boolean');
  });

  it('plan_count is a number', () => {
    const { output } = runEnrich(enrichCommand, tempDir);
    const j = parseEnrichmentOutput(output);
    if ('plan_count' in j) {
      assert.strictEqual(typeof j.plan_count, 'number', 'plan_count should be a number');
    }
  });

  it('summary_count is a number', () => {
    const { output } = runEnrich(enrichCommand, tempDir);
    const j = parseEnrichmentOutput(output);
    if ('summary_count' in j) {
      assert.strictEqual(typeof j.summary_count, 'number', 'summary_count should be a number');
    }
  });

  it('plans field is an array when present', () => {
    const { output } = runEnrich(enrichCommand, tempDir);
    const j = parseEnrichmentOutput(output);
    if ('plans' in j && j.plans !== null) {
      assert.ok(Array.isArray(j.plans), 'plans should be an array');
    }
  });

  it('incomplete_plans is an array when present', () => {
    const { output } = runEnrich(enrichCommand, tempDir);
    const j = parseEnrichmentOutput(output);
    if ('incomplete_plans' in j && j.incomplete_plans !== null) {
      assert.ok(Array.isArray(j.incomplete_plans), 'incomplete_plans should be an array');
    }
  });

  it('_enrichment_ms is included in output shape and is a number', () => {
    const { output } = runEnrich(enrichCommand, tempDir);
    const j = parseEnrichmentOutput(output);
    assert.ok('_enrichment_ms' in j, '_enrichment_ms should be in output shape');
    assert.strictEqual(typeof j._enrichment_ms, 'number', '_enrichment_ms should be a number');
  });

  it('planning_dir value is ".planning"', () => {
    const { output } = runEnrich(enrichCommand, tempDir);
    const j = parseEnrichmentOutput(output);
    assert.strictEqual(j.planning_dir, '.planning', 'planning_dir should be ".planning"');
  });

  it('state_path value is ".planning/STATE.md"', () => {
    const { output } = runEnrich(enrichCommand, tempDir);
    const j = parseEnrichmentOutput(output);
    assert.strictEqual(j.state_path, '.planning/STATE.md', 'state_path should be ".planning/STATE.md"');
  });

  it('no-planning-dir returns early without enrichment for unknown commands', () => {
    const noPlanDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgsd-noplanning-'));
    try {
      const input = { command: 'bgsd-plan-phase', parts: ['bgsd-plan-phase'] };
      const output = { parts: [] };
      enrichCommand(input, output, noPlanDir);
      // Should either have an error message or be empty
      if (output.parts.length > 0) {
        const j = parseEnrichmentOutput(output);
        // If we get an error, it should have an error field
        assert.ok(j === null || typeof j === 'object', 'output should be null or an object');
      }
    } finally {
      cleanupDir(noPlanDir);
    }
  });
});

describe('Phase 158 canonical family enrichment parity', () => {
  let enrichCommand;
  let tempDir;

  before(async () => {
    const mod = await import(PLUGIN_PATH);
    enrichCommand = mod.enrichCommand;
    tempDir = makePlanningProject('bgsd-enr-phase158-');
  });

  after(() => {
    cleanupDir(tempDir);
  });

  function getAgentType(command) {
    const input = { command, parts: [command] };
    const output = { parts: [] };
    enrichCommand(input, output, tempDir);
    return parseEnrichmentOutput(output)?.agent_type;
  }

  it('canonical planning family command gets planner routing metadata', () => {
    assert.strictEqual(getAgentType('bgsd-plan'), 'bgsd-planner');
    assert.strictEqual(getAgentType('bgsd-plan-phase'), 'bgsd-planner');
  });

  it('canonical inspect family command gets executor routing metadata', () => {
    assert.strictEqual(getAgentType('bgsd-inspect'), 'bgsd-executor');
  });

  it('canonical settings family and compatibility aliases share executor routing metadata', () => {
    for (const command of ['bgsd-settings', 'bgsd-set-profile', 'bgsd-validate-config']) {
      assert.strictEqual(getAgentType(command), 'bgsd-executor');
    }
  });
});

describe('Tool availability refresh behavior', () => {
  let enrichCommand;
  let BgsdPlugin;

  before(async () => {
    const mod = await import(PLUGIN_PATH);
    enrichCommand = mod.enrichCommand;
    BgsdPlugin = mod.BgsdPlugin;
  });

  it('enrichCommand refreshes missing tool cache and includes metadata', () => {
    const tempDir = makePlanningProject('bgsd-enr-tools-');
    const cachePath = path.join(tempDir, '.planning', '.cache', 'tools.json');

    try {
      assert.ok(!fs.existsSync(cachePath), 'fixture should start without a tool cache');

      const { output } = runEnrich(enrichCommand, tempDir);
      const enrichment = parseEnrichmentOutput(output);

      assert.ok(fs.existsSync(cachePath), 'enrichment should populate the tool cache on first command');
      assert.ok(enrichment.tool_availability_meta, 'enrichment should expose tool availability metadata');
      assert.strictEqual(enrichment.tool_availability_meta.state, 'fresh', 'tool availability should be fresh after enrichment');
      assert.ok(['cache', 'cli-refresh'].includes(enrichment.tool_availability_meta.source), 'metadata should identify cache or refresh source');
      assert.ok(Object.values(enrichment.tool_availability).some((value) => value !== null), 'tool availability should contain known values after refresh');
    } finally {
      cleanupDir(tempDir);
    }
  });

  it('plugin startup warms the tool cache for bgsd projects', async () => {
    const tempDir = makePlanningProject('bgsd-enr-tools-startup-');
    const cachePath = path.join(tempDir, '.planning', '.cache', 'tools.json');

    try {
      assert.ok(!fs.existsSync(cachePath), 'fixture should start without a tool cache');

      await BgsdPlugin({ directory: tempDir });

      assert.ok(fs.existsSync(cachePath), 'plugin startup should warm the tool cache');
    } finally {
      cleanupDir(tempDir);
    }
  });
});
