'use strict';

const fs = require('fs');
const path = require('path');
const { output, error, debugLog } = require('../lib/output');

// Lazy-load measureAllWorkflows from features.js to avoid circular deps
function getMeasureAllWorkflows() {
  return require('./features').measureAllWorkflows;
}

// ─── Structural Fingerprint Extraction ───────────────────────────────────────

/**
 * Extract structural fingerprint from workflow content.
 * Counts Task() calls, CLI commands (bgsd-tools invocations), section markers,
 * question blocks, and key XML tags.
 *
 * @param {string} content - Workflow file content
 * @returns {object} structure fingerprint
 */
function extractStructuralFingerprint(content) {
  // Task() calls — e.g. Task(1), Task("foo"), task() — case-insensitive
  const taskCallMatches = [];
  const taskCallRe = /\bTask\s*\(([^)]*)\)/gi;
  let m;
  while ((m = taskCallRe.exec(content)) !== null) {
    taskCallMatches.push(m[0].trim());
  }

  // CLI commands: lines in code blocks containing bgsd-tools invocations
  const cliCommandMatches = [];
  const cliRe = /`[^`]*bgsd-tools[^`]*`|```[\s\S]*?```/g;
  // Simpler: extract all bgsd-tools command invocations from code blocks
  const codeBlockRe = /```[^\n]*\n([\s\S]*?)```/g;
  let cbm;
  while ((cbm = codeBlockRe.exec(content)) !== null) {
    const blockContent = cbm[1];
    const lines = blockContent.split('\n');
    for (const line of lines) {
      if (/bgsd-tools/.test(line)) {
        cliCommandMatches.push(line.trim());
      }
    }
  }
  // Also inline backtick mentions
  const inlineRe = /`([^`]*bgsd-tools[^`]*)`/g;
  let im;
  while ((im = inlineRe.exec(content)) !== null) {
    cliCommandMatches.push(im[1].trim());
  }

  // Section markers: <!-- section: ... --> (with optional if="condition" attribute)
  // Extract section name only — strip if= conditions to allow baseline comparison
  // after adding conditional annotations (section names are stable, conditions are not).
  const sectionMarkerMatches = [];
  const sectionRe = /<!--\s*section:\s*(.+?)\s*-->/gi;
  let sm;
  while ((sm = sectionRe.exec(content)) !== null) {
    // Strip trailing if="..." attribute to normalize section name
    const rawName = sm[1].trim();
    const normalizedName = rawName.replace(/\s+if="[^"]*"$/, '').trim();
    sectionMarkerMatches.push(normalizedName);
  }

  // Question blocks: <question> ... </question>
  const questionBlockMatches = [];
  const questionRe = /<question[^>]*>([\s\S]*?)<\/question>/gi;
  let qm;
  while ((qm = questionRe.exec(content)) !== null) {
    questionBlockMatches.push(qm[0].slice(0, 80).trim());
  }

  // Key XML tags: <step>, <process>, <purpose>
  const xmlTagMatches = [];
  const xmlTagRe = /<(step|process|purpose)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi;
  let xm;
  while ((xm = xmlTagRe.exec(content)) !== null) {
    const tagMatch = xm[0].match(/^<(\w+)/);
    if (tagMatch) xmlTagMatches.push(tagMatch[1]);
  }

  return {
    task_calls: taskCallMatches,
    cli_commands: cliCommandMatches,
    section_markers: sectionMarkerMatches,
    question_blocks: questionBlockMatches,
    xml_tags: xmlTagMatches,
  };
}

// ─── workflow:baseline ────────────────────────────────────────────────────────

const ACCEL_BASELINE_PATH = '.planning/research/ACCEL-BASELINE.json';

/**
 * Create a token measurement baseline for all workflows.
 * Saves snapshot to .planning/baselines/workflow-baseline-{timestamp}.json
 *
 * @param {string} cwd - Current working directory
 * @param {boolean} raw - JSON output mode
 */
function cmdWorkflowBaseline(cwd, raw) {
  const measureAllWorkflows = getMeasureAllWorkflows();
  const measurement = measureAllWorkflows(cwd);

  if (measurement.error) {
    error(measurement.error);
  }

  // Detect plugin path to read workflow files for structural fingerprinting
  // __dirname in the bundled binary is bin/, so go up one level to project root
  let pluginDir = process.env.BGSD_PLUGIN_DIR;
  if (!pluginDir) {
    pluginDir = path.resolve(__dirname, '..');
  }
  const workflowsDir = path.join(pluginDir, 'workflows');

  // Enrich each workflow with structural fingerprint
  const enrichedWorkflows = measurement.workflows.map(w => {
    let structure = {
      task_calls: [],
      cli_commands: [],
      section_markers: [],
      question_blocks: [],
      xml_tags: [],
    };
    try {
      const filePath = path.join(workflowsDir, w.name);
      const content = fs.readFileSync(filePath, 'utf-8');
      structure = extractStructuralFingerprint(content);
    } catch (e) {
      debugLog('workflow.baseline', `fingerprint failed for ${w.name}`, e);
    }
    return { ...w, structure };
  });

  // Build snapshot
  const snapshot = {
    version: 1,
    timestamp: measurement.timestamp,
    workflow_count: measurement.workflow_count,
    total_tokens: measurement.total_tokens,
    workflows: enrichedWorkflows,
  };

  // Save to .planning/baselines/
  const baselinesDir = path.join(cwd, '.planning', 'baselines');
  if (!fs.existsSync(baselinesDir)) {
    fs.mkdirSync(baselinesDir, { recursive: true });
  }

  const accelBaselinePath = path.join(cwd, ACCEL_BASELINE_PATH);
  const accelBaselineDir = path.dirname(accelBaselinePath);
  if (!fs.existsSync(accelBaselineDir)) {
    fs.mkdirSync(accelBaselineDir, { recursive: true });
  }

  const ts = measurement.timestamp.replace(/[:.]/g, '-');
  const baselineFile = `workflow-baseline-${ts}.json`;
  const baselinePath = path.join(baselinesDir, baselineFile);
  fs.writeFileSync(baselinePath, JSON.stringify(snapshot, null, 2), 'utf-8');
  fs.writeFileSync(accelBaselinePath, JSON.stringify(snapshot, null, 2), 'utf-8');

  // Print human-readable table to stderr
  const maxNameLen = Math.max(30, ...snapshot.workflows.map(w => w.name.length));
  const header = `${'Workflow'.padEnd(maxNameLen)} | Tokens  | Refs | Ref Tokens | Tasks | CLI | Sections`;
  const sep = '-'.repeat(maxNameLen) + '-+---------+------+------------+-------+-----+---------';
  process.stderr.write('\n## Workflow Token Baseline\n\n');
  process.stderr.write(header + '\n');
  process.stderr.write(sep + '\n');
  for (const w of snapshot.workflows) {
    const name = w.name.padEnd(maxNameLen);
    const tokens = String(w.workflow_tokens).padStart(7);
    const refs = String(w.ref_count).padStart(4);
    const refTokens = String(w.ref_tokens).padStart(10);
    const tasks = String(w.structure.task_calls.length).padStart(5);
    const cli = String(w.structure.cli_commands.length).padStart(3);
    const sections = String(w.structure.section_markers.length).padStart(7);
    process.stderr.write(`${name} | ${tokens} | ${refs} | ${refTokens} | ${tasks} | ${cli} | ${sections}\n`);
  }
  process.stderr.write(sep + '\n');
  process.stderr.write(`${'TOTAL'.padEnd(maxNameLen)} | ${String(snapshot.total_tokens).padStart(7)} |      |            |       |     |\n`);
  process.stderr.write(`\nBaseline saved: ${path.relative(cwd, baselinePath)}\n\n`);
  process.stderr.write(`Acceleration baseline saved: ${path.relative(cwd, accelBaselinePath)}\n\n`);

  snapshot.baseline_file = path.relative(cwd, baselinePath);
  snapshot.accel_baseline_file = path.relative(cwd, accelBaselinePath);
  output(snapshot, raw);
}

// ─── workflow:hotpath ─────────────────────────────────────────────────────────

/**
 * Aggregate and display routing telemetry from .planning/telemetry/routing-log.jsonl.
 *
 * @param {string} cwd - Current working directory
 * @param {boolean} raw - JSON output mode
 */
function cmdWorkflowHotpath(cwd, raw) {
  const logPath = path.join(cwd, '.planning', 'telemetry', 'routing-log.jsonl');

  const entries = [];
  if (fs.existsSync(logPath)) {
    try {
      const content = fs.readFileSync(logPath, 'utf-8');
      for (const line of content.split('\n')) {
        if (!line.trim()) continue;
        try {
          entries.push(JSON.parse(line));
        } catch {
          // Skip malformed lines.
        }
      }
    } catch {
      // Ignore unreadable telemetry.
    }
  }

  const byFunction = {};
  for (const entry of entries) {
    const fn = entry.function || 'unknown';
    if (!byFunction[fn]) {
      byFunction[fn] = { count: 0, profiles: {}, models: {} };
    }
    byFunction[fn].count += 1;
    if (entry.profile) {
      byFunction[fn].profiles[entry.profile] = (byFunction[fn].profiles[entry.profile] || 0) + 1;
    }
    if (entry.model) {
      byFunction[fn].models[entry.model] = (byFunction[fn].models[entry.model] || 0) + 1;
    }
  }

  const hot_paths = Object.entries(byFunction)
    .map(([fn, data]) => ({ function: fn, ...data }))
    .sort((a, b) => b.count - a.count);

  const result = {
    log_file: path.relative(cwd, logPath),
    total_entries: entries.length,
    hot_paths,
  };

  process.stderr.write('\n## Workflow Hot-Path Telemetry\n\n');
  if (entries.length === 0) {
    process.stderr.write('No telemetry data yet. Run some planning/execution cycles first.\n');
    process.stderr.write(`Log file: ${path.relative(cwd, logPath)}\n\n`);
  } else {
    process.stderr.write(`Log: ${path.relative(cwd, logPath)}  |  Entries: ${entries.length}\n\n`);
    const maxFnLen = Math.max(20, ...hot_paths.map(s => s.function.length));
    const header = `${'Function'.padEnd(maxFnLen)} | Count  | Top Profile | Top Model`;
    const sep = '-'.repeat(maxFnLen) + '-+--------+-------------+---------';
    process.stderr.write(header + '\n');
    process.stderr.write(sep + '\n');
    for (const row of hot_paths) {
      const fn = row.function.padEnd(maxFnLen);
      const count = String(row.count).padStart(6);
      const topProfile = Object.entries(row.profiles).sort((a, b) => b[1] - a[1])[0];
      const topModel = Object.entries(row.models).sort((a, b) => b[1] - a[1])[0];
      process.stderr.write(`${fn} | ${count} | ${(topProfile ? topProfile[0] : '-').padEnd(11)} | ${topModel ? topModel[0] : '-'}\n`);
    }
    process.stderr.write(sep + '\n\n');
  }

  output(result, raw);
}

// ─── workflow:compare ─────────────────────────────────────────────────────────

/**
 * Compare two workflow baseline snapshots.
 * Usage:
 *   workflow:compare <a> <b>   — diff two snapshot files
 *   workflow:compare <a>       — diff <a> against current state
 *   workflow:compare           — diff two most recent baselines
 *
 * @param {string} cwd - Current working directory
 * @param {string[]} args - Positional args [snapshotA?, snapshotB?]
 * @param {boolean} raw - JSON output mode
 */
function cmdWorkflowCompare(cwd, args, raw) {
  const baselinesDir = path.join(cwd, '.planning', 'baselines');

  /**
   * Load a snapshot JSON from a file path (absolute or relative to cwd).
   */
  function loadSnapshot(filePath) {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
    if (!fs.existsSync(fullPath)) {
      error(`Snapshot file not found: ${filePath}`);
    }
    try {
      return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    } catch (e) {
      error(`Invalid snapshot file (${filePath}): ${e.message}`);
    }
  }

  /**
   * Find the N most recent workflow baselines in baselinesDir.
   */
  function findRecentBaselines(n) {
    if (!fs.existsSync(baselinesDir)) {
      return [];
    }
    return fs.readdirSync(baselinesDir)
      .filter(f => f.startsWith('workflow-baseline-') && f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, n)
      .map(f => path.join(baselinesDir, f));
  }

  let snapshotA, snapshotB, labelA, labelB;

  if (args.length >= 2) {
    // Two explicit paths
    labelA = args[0];
    labelB = args[1];
    snapshotA = loadSnapshot(args[0]);
    snapshotB = loadSnapshot(args[1]);
  } else if (args.length === 1) {
    // One explicit path: A is provided, B is current state
    labelA = args[0];
    snapshotA = loadSnapshot(args[0]);
    const measureAllWorkflows = getMeasureAllWorkflows();
    const current = measureAllWorkflows(cwd);
    if (current.error) error(current.error);
    // Build a snapshot-shaped object from current measurement (no structure fingerprints needed for compare)
    snapshotB = { version: 1, timestamp: current.timestamp, workflow_count: current.workflow_count, total_tokens: current.total_tokens, workflows: current.workflows };
    labelB = 'current';
  } else {
    // No args: use two most recent baselines
    const recent = findRecentBaselines(2);
    if (recent.length < 2) {
      if (recent.length === 0) {
        error('No workflow baselines found. Run `workflow:baseline` first.');
      } else {
        // Only one baseline: compare against current
        labelA = path.relative(cwd, recent[0]);
        snapshotA = loadSnapshot(recent[0]);
        const measureAllWorkflows = getMeasureAllWorkflows();
        const current = measureAllWorkflows(cwd);
        if (current.error) error(current.error);
        snapshotB = { version: 1, timestamp: current.timestamp, workflow_count: current.workflow_count, total_tokens: current.total_tokens, workflows: current.workflows };
        labelB = 'current';
      }
    } else {
      // Two most recent: [0] is newer, [1] is older — compare older→newer
      labelA = path.relative(cwd, recent[1]); // older = A
      labelB = path.relative(cwd, recent[0]); // newer = B
      snapshotA = loadSnapshot(recent[1]);
      snapshotB = loadSnapshot(recent[0]);
    }
  }

  // Build lookup maps
  const mapA = {};
  for (const w of (snapshotA.workflows || [])) {
    mapA[w.name] = w;
  }
  const mapB = {};
  for (const w of (snapshotB.workflows || [])) {
    mapB[w.name] = w;
  }

  // Compare
  const allNames = new Set([...Object.keys(mapA), ...Object.keys(mapB)]);
  const workflows = [];
  let beforeTotal = 0;
  let afterTotal = 0;
  let improved = 0;
  let unchanged = 0;
  let worsened = 0;

  for (const name of allNames) {
    const a = mapA[name];
    const b = mapB[name];

    if (a && b) {
      const delta = b.total_tokens - a.total_tokens;
      const pctChange = a.total_tokens > 0
        ? Math.round((delta / a.total_tokens) * 1000) / 10
        : 0;
      beforeTotal += a.total_tokens;
      afterTotal += b.total_tokens;
      if (delta < 0) improved++;
      else if (delta > 0) worsened++;
      else unchanged++;
      workflows.push({ name, before: a.total_tokens, after: b.total_tokens, delta, percent_change: pctChange });
    } else if (a && !b) {
      // Workflow removed in B
      beforeTotal += a.total_tokens;
      workflows.push({ name, before: a.total_tokens, after: 0, delta: -a.total_tokens, percent_change: -100, status: 'removed' });
      improved++;
    } else if (!a && b) {
      // Workflow added in B
      afterTotal += b.total_tokens;
      workflows.push({ name, before: 0, after: b.total_tokens, delta: b.total_tokens, percent_change: 100, status: 'added' });
      worsened++;
    }
  }

  // Sort by delta ascending (biggest reductions first)
  workflows.sort((a, b) => a.delta - b.delta);

  const totalDelta = afterTotal - beforeTotal;
  const totalPctChange = beforeTotal > 0
    ? Math.round((totalDelta / beforeTotal) * 1000) / 10
    : 0;

  const result = {
    snapshot_a: labelA,
    snapshot_b: labelB,
    date_a: snapshotA.timestamp || 'unknown',
    date_b: snapshotB.timestamp || 'unknown',
    summary: {
      before_total: beforeTotal,
      after_total: afterTotal,
      delta: totalDelta,
      percent_change: totalPctChange,
      workflows_improved: improved,
      workflows_unchanged: unchanged,
      workflows_worsened: worsened,
    },
    workflows,
  };

  // Print comparison table to stderr
  const maxNameLen = Math.max(30, ...workflows.map(c => c.name.length));
  const header = `${'Workflow'.padEnd(maxNameLen)} | Before  | After   | Delta   | Change`;
  const sep = '-'.repeat(maxNameLen) + '-+---------+---------+---------+-------';
  process.stderr.write('\n## Workflow Token Comparison\n\n');
  process.stderr.write(`A: ${labelA} (${snapshotA.timestamp || 'unknown'})\n`);
  process.stderr.write(`B: ${labelB} (${snapshotB.timestamp || 'unknown'})\n\n`);
  process.stderr.write(header + '\n');
  process.stderr.write(sep + '\n');
  for (const c of workflows) {
    const name = c.name.padEnd(maxNameLen);
    const before = String(c.before).padStart(7);
    const after = String(c.after).padStart(7);
    const deltaStr = (c.delta >= 0 ? '+' + c.delta : String(c.delta)).padStart(7);
    const pctStr = (c.percent_change >= 0 ? '+' + c.percent_change : String(c.percent_change)) + '%';
    process.stderr.write(`${name} | ${before} | ${after} | ${deltaStr} | ${pctStr.padStart(6)}\n`);
  }
  process.stderr.write(sep + '\n');
  const totalDeltaStr = (totalDelta >= 0 ? '+' + totalDelta : String(totalDelta)).padStart(7);
  const totalPctStr = (totalPctChange >= 0 ? '+' + totalPctChange : String(totalPctChange)) + '%';
  process.stderr.write(`${'TOTAL'.padEnd(maxNameLen)} | ${String(beforeTotal).padStart(7)} | ${String(afterTotal).padStart(7)} | ${totalDeltaStr} | ${totalPctStr.padStart(6)}\n`);
  process.stderr.write(`\nImproved: ${improved} | Unchanged: ${unchanged} | Worsened: ${worsened}\n`);
  process.stderr.write(`Total reduction: ${totalPctChange}%\n\n`);

  output(result, raw);
}

// ─── workflow:verify-structure ────────────────────────────────────────────────

/**
 * Verify all workflows against a baseline snapshot to detect structural regressions.
 * Compares Task() calls, CLI commands, section markers, question blocks, and XML tags.
 *
 * Usage:
 *   workflow:verify-structure [baseline-path]
 *   - If baseline-path given: use it as reference
 *   - If omitted: use most recent workflow-baseline-*.json from .planning/baselines/
 *   - If no baseline found: error with instruction to run workflow:baseline first
 *
 * Exit code: sets process.exitCode = 1 if any workflow fails (allows cleanup before exit).
 *
 * @param {string} cwd - Current working directory
 * @param {string[]} args - Positional args [baseline-path?]
 * @param {boolean} raw - JSON output mode
 */
function cmdWorkflowVerifyStructure(cwd, args, raw) {
  const baselinesDir = path.join(cwd, '.planning', 'baselines');

  // Resolve baseline file
  let baselinePath;
  if (args && args.length >= 1) {
    const provided = args[0];
    baselinePath = path.isAbsolute(provided) ? provided : path.join(cwd, provided);
    if (!fs.existsSync(baselinePath)) {
      error(`Baseline file not found: ${args[0]}`);
    }
  } else {
    // Find most recent workflow-baseline-*.json
    if (!fs.existsSync(baselinesDir)) {
      error('No baseline found. Run `workflow:baseline` first.');
    }
    const files = fs.readdirSync(baselinesDir)
      .filter(f => f.startsWith('workflow-baseline-') && f.endsWith('.json'))
      .sort()
      .reverse();
    if (files.length === 0) {
      error('No baseline found. Run `workflow:baseline` first.');
    }
    baselinePath = path.join(baselinesDir, files[0]);
  }

  // Load baseline
  let baseline;
  try {
    baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
  } catch (e) {
    error(`Invalid baseline file (${baselinePath}): ${e.message}`);
  }

  // Detect plugin path to read workflow files
  // __dirname in the bundled binary is bin/, so go up one level to project root
  let pluginDir = process.env.BGSD_PLUGIN_DIR;
  if (!pluginDir) {
    pluginDir = path.resolve(__dirname, '..');
  }
  const workflowsDir = path.join(pluginDir, 'workflows');

  const verifiedAt = new Date().toISOString();
  const results = [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const baselineWorkflow of (baseline.workflows || [])) {
    const wfName = baselineWorkflow.name;
    const baselineStructure = baselineWorkflow.structure || {};

    // Check if current workflow file exists
    const currentPath = path.join(workflowsDir, wfName);
    if (!fs.existsSync(currentPath)) {
      // Workflow removed entirely = failure
      const allMissing = [];
      for (const call of (baselineStructure.task_calls || [])) {
        allMissing.push({ type: 'task_call', value: call });
      }
      for (const cmd of (baselineStructure.cli_commands || [])) {
        allMissing.push({ type: 'cli_command', value: cmd });
      }
      for (const marker of (baselineStructure.section_markers || [])) {
        allMissing.push({ type: 'section_marker', value: marker });
      }
      for (const qb of (baselineStructure.question_blocks || [])) {
        allMissing.push({ type: 'question_block', value: qb });
      }
      for (const tag of (baselineStructure.xml_tags || [])) {
        allMissing.push({ type: 'xml_tag', value: tag });
      }
      results.push({ name: wfName, status: 'fail', missing: allMissing, removed: true });
      failed++;
      continue;
    }

    // Read current content and extract fingerprint
    let currentStructure;
    try {
      const content = fs.readFileSync(currentPath, 'utf-8');
      currentStructure = extractStructuralFingerprint(content);
    } catch (e) {
      debugLog('workflow.verify-structure', `fingerprint failed for ${wfName}`, e);
      results.push({ name: wfName, status: 'fail', missing: [{ type: 'read_error', value: e.message }] });
      failed++;
      continue;
    }

    // Compare each element category — any removal is a failure
    const missing = [];

    // Task() calls
    for (const call of (baselineStructure.task_calls || [])) {
      if (!(currentStructure.task_calls || []).includes(call)) {
        missing.push({ type: 'task_call', value: call });
      }
    }

    // CLI commands
    for (const cmd of (baselineStructure.cli_commands || [])) {
      if (!(currentStructure.cli_commands || []).includes(cmd)) {
        missing.push({ type: 'cli_command', value: cmd });
      }
    }

    // Section markers
    for (const marker of (baselineStructure.section_markers || [])) {
      if (!(currentStructure.section_markers || []).includes(marker)) {
        missing.push({ type: 'section_marker', value: marker });
      }
    }

    // Question blocks
    for (const qb of (baselineStructure.question_blocks || [])) {
      if (!(currentStructure.question_blocks || []).includes(qb)) {
        missing.push({ type: 'question_block', value: qb });
      }
    }

    // XML tags (stored as tag names — check each baseline tag still appears)
    for (const tag of (baselineStructure.xml_tags || [])) {
      if (!(currentStructure.xml_tags || []).includes(tag)) {
        missing.push({ type: 'xml_tag', value: tag });
      }
    }

    const status = missing.length === 0 ? 'pass' : 'fail';
    results.push({ name: wfName, status, missing });
    if (status === 'pass') {
      passed++;
    } else {
      failed++;
    }
  }

  // Build result object
  const result = {
    baseline_file: path.relative(cwd, baselinePath),
    baseline_date: baseline.timestamp || 'unknown',
    verified_at: verifiedAt,
    summary: {
      total_workflows: baseline.workflows ? baseline.workflows.length : 0,
      passed,
      failed,
      skipped,
    },
    results,
  };

  // Print human-readable summary to stderr
  const maxNameLen = Math.max(30, ...results.map(r => r.name.length));
  const headerLine = `${'Workflow'.padEnd(maxNameLen)} | Status`;
  const sepLine = '-'.repeat(maxNameLen) + '-+--------';
  process.stderr.write('\n## Workflow Structure Verification\n\n');
  process.stderr.write(`Baseline: ${result.baseline_file} (${result.baseline_date})\n`);
  process.stderr.write(`Verified: ${verifiedAt}\n\n`);
  process.stderr.write(headerLine + '\n');
  process.stderr.write(sepLine + '\n');

  for (const r of results) {
    const name = r.name.padEnd(maxNameLen);
    const statusLabel = r.status === 'pass' ? 'PASS   ' : 'FAIL   ';
    process.stderr.write(`${name} | ${statusLabel}\n`);
    if (r.status === 'fail' && r.missing.length > 0) {
      for (const m of r.missing) {
        process.stderr.write(`  MISSING [${m.type}]: ${m.value}\n`);
      }
    }
  }

  process.stderr.write(sepLine + '\n');
  if (failed === 0) {
    process.stderr.write(`\nPASS: ${passed}/${result.summary.total_workflows} workflows\n\n`);
  } else {
    process.stderr.write(`\nFAIL: ${failed} regressions detected in ${result.summary.total_workflows} workflows\n\n`);
    process.exitCode = 1;
  }

  output(result, raw);
}

// ─── Elision helpers for measurement ─────────────────────────────────────────

/**
 * Strip ALL conditional sections from workflow text (worst-case elision — all conditions false).
 * This measures maximum possible token savings from elision.
 *
 * @param {string} text - Workflow content
 * @returns {string} Text with all conditional sections removed
 */
function stripAllConditionalSections(text) {
  if (!text) return text;
  const SECTION_CLOSE = '<!-- /section -->';
  const CONDITIONAL_OPEN_RE = /<!--\s*section:\s*\S+\s+if="[^"]+"\s*-->/g;

  let result = text;
  let changed = true;
  // Repeat until no more conditional sections remain (handles successive removals)
  while (changed) {
    changed = false;
    const matches = [];
    let m;
    const re = new RegExp(CONDITIONAL_OPEN_RE.source, 'g');
    while ((m = re.exec(result)) !== null) {
      matches.push({ fullMatch: m[0], startIndex: m.index });
    }
    // Process in reverse to preserve indices
    for (let i = matches.length - 1; i >= 0; i--) {
      const { fullMatch, startIndex } = matches[i];
      const closeIndex = result.indexOf(SECTION_CLOSE, startIndex + fullMatch.length);
      const sectionEnd = closeIndex === -1 ? result.length : closeIndex + SECTION_CLOSE.length;
      const afterSection = result.slice(sectionEnd);
      const trailingNewline = afterSection.startsWith('\n') ? '\n' : '';
      result = result.slice(0, startIndex) + afterSection.slice(trailingNewline.length);
      changed = true;
    }
  }
  return result;
}

// ─── workflow:savings ─────────────────────────────────────────────────────────

/**
 * Generate a cumulative token savings table showing the reduction journey
 * across milestones: original → post-compression (Phase 135) → post-elision (Phase 137).
 *
 * Attempts to load Phase 134 (original) and Phase 135 (post-compression) baselines
 * from .planning/baselines/. If unavailable, falls back to hardcoded values from
 * Phase 135 SUMMARY (the actual measured token counts).
 *
 * The post-elision column shows token counts with ALL conditional sections removed
 * (worst-case savings / maximum elision).
 *
 * @param {string} cwd - Current working directory
 * @param {string[]} args - Positional args (unused currently)
 * @param {boolean} raw - JSON output mode
 */
function cmdWorkflowSavings(cwd, args, raw) {
  const baselinesDir = path.join(cwd, '.planning', 'baselines');
  const measureAllWorkflows = getMeasureAllWorkflows();

  // ── Step 1: Measure post-elision token counts ─────────────────────────────
  // Post-elision = current workflow files with ALL conditional sections removed.
  // This represents worst-case savings (all conditions false: no TDD, no CI, no review).
  const current = measureAllWorkflows(cwd);
  if (current.error) {
    error(current.error);
  }

  // Detect plugin dir to read actual workflow file content for elision measurement
  let pluginDir = process.env.BGSD_PLUGIN_DIR;
  if (!pluginDir) {
    pluginDir = path.resolve(__dirname, '..');
  }
  const workflowsDir = path.join(pluginDir, 'workflows');

  // Build a map of post-elision token counts (all conditional sections stripped)
  const elisionTokenMap = {};
  try {
    const { estimateTokens } = require('../lib/context');
    for (const w of (current.workflows || [])) {
      const wfPath = path.join(workflowsDir, w.name);
      if (fs.existsSync(wfPath)) {
        const content = fs.readFileSync(wfPath, 'utf-8');
        const stripped = stripAllConditionalSections(content);
        elisionTokenMap[w.name] = estimateTokens(stripped);
      }
    }
  } catch (e) {
    debugLog('workflow.savings', 'failed to measure elision tokens', e);
  }

  // ── Step 2: Hardcoded baselines from Phase 135 SUMMARY (actual measured values) ──
  // Source: Phase 135 Plan 02-05 SUMMARY files, measured with workflow:baseline before compression.
  // On-disk baselines were all created during Phase 137 (post-compression), so they can't serve
  // as pre-compression reference. The SUMMARY files contain the authoritative pre/post counts.
  const PHASE135_DATA = {
    'execute-phase.md':    { original: 5355, post_compression: 3321 },
    'discuss-phase.md':    { original: 5204, post_compression: 2917 },
    'execute-plan.md':     { original: 4749, post_compression: 2727 },
    'new-milestone.md':    { original: 4716, post_compression: 2518 },
    'transition.md':       { original: 3357, post_compression: 1900 },
    'new-project.md':      { original: 3133, post_compression: 1751 },
    'audit-milestone.md':  { original: 2553, post_compression: 1496 },
    'quick.md':            { original: 2776, post_compression: 1659 },
    'resume-project.md':   { original: 2185, post_compression: 1576 },
    'map-codebase.md':     { original: 2371, post_compression: 1363 },
  };

  // ── Step 3: Try to load earlier snapshots (optional enhancement) ──────────
  // If a pre-compression snapshot exists on disk (older than Phase 135), prefer it.
  // Since the project gitignores baselines, disk-based baselines may not be pre-compression.
  // We attempt to find baselines where the token counts are HIGHER than the current state
  // (indicating a pre-compression snapshot). This is a best-effort enhancement; the
  // hardcoded PHASE135_DATA above is the authoritative fallback.
  let diskPhase134 = null;
  let diskPhase135 = null;
  try {
    if (fs.existsSync(baselinesDir)) {
      const files = fs.readdirSync(baselinesDir)
        .filter(f => f.startsWith('workflow-baseline-') && f.endsWith('.json'))
        .sort(); // oldest first
      // Look for snapshots where execute-plan.md tokens exceed current (i.e., pre-compression)
      for (const file of files) {
        try {
          const snap = JSON.parse(fs.readFileSync(path.join(baselinesDir, file), 'utf-8'));
          const epW = (snap.workflows || []).find(w => w.name === 'execute-plan.md');
          if (epW) {
            const tokens = epW.workflow_tokens || epW.total_tokens;
            if (tokens > 4000 && !diskPhase134) {
              // Token count > 4000 → pre-compression snapshot
              diskPhase134 = snap;
            } else if (tokens > 2800 && tokens <= 4000 && !diskPhase135) {
              // Token count 2800-4000 → post-compression, pre-elision snapshot
              diskPhase135 = snap;
            }
          }
        } catch { /* skip malformed snapshot */ }
      }
    }
  } catch (e) {
    debugLog('workflow.savings', 'failed to scan baselines', e);
  }

  const mapDisk134 = {};
  if (diskPhase134) {
    for (const w of (diskPhase134.workflows || [])) {
      mapDisk134[w.name] = w.workflow_tokens || w.total_tokens;
    }
  }

  const mapDisk135 = {};
  if (diskPhase135) {
    for (const w of (diskPhase135.workflows || [])) {
      mapDisk135[w.name] = w.workflow_tokens || w.total_tokens;
    }
  }

  const mapCurrent = {};
  for (const w of (current.workflows || [])) {
    mapCurrent[w.name] = w.workflow_tokens || w.total_tokens;
  }

  // ── Step 4: Build savings table ───────────────────────────────────────────
  // Include the 10 target workflows from Phase 135 that have conditional sections
  const targetWorkflows = [
    'execute-phase.md',
    'execute-plan.md',
    'quick.md',
    'discuss-phase.md',
    'new-milestone.md',
    'transition.md',
    'new-project.md',
    'audit-milestone.md',
    'resume-project.md',
    'map-codebase.md',
  ];

  const rows = [];
  for (const name of targetWorkflows) {
    const historical = PHASE135_DATA[name] || {};

    // Original: disk phase134 (if found) → hardcoded historical
    const original = mapDisk134[name] || historical.original || null;

    // Post-compression: disk phase135 (if found) → hardcoded historical
    const postCompression = mapDisk135[name] || historical.post_compression || null;

    // Post-elision: current tokens with ALL conditional sections stripped
    // Falls back to current measurement if elision measurement unavailable
    const postElision = elisionTokenMap[name] || mapCurrent[name] || null;

    // Total reduction vs original
    let totalReductionPct = null;
    if (original && postElision) {
      totalReductionPct = Math.round(((original - postElision) / original) * 1000) / 10;
    }

    // Compression-only reduction
    let compressionPct = null;
    if (original && postCompression) {
      compressionPct = Math.round(((original - postCompression) / original) * 1000) / 10;
    }

    // Elision-only reduction (vs post-compression)
    let elisionPct = null;
    if (postCompression && postElision) {
      elisionPct = Math.round(((postCompression - postElision) / postCompression) * 1000) / 10;
    }

    rows.push({
      name,
      original,
      post_compression: postCompression,
      post_elision: postElision,
      compression_pct: compressionPct,
      elision_pct: elisionPct,
      total_reduction_pct: totalReductionPct,
      baseline_source_134: mapDisk134[name] ? 'disk' : 'hardcoded',
      baseline_source_135: mapDisk135[name] ? 'disk' : 'hardcoded',
    });
  }

  // ── Step 5: Compute averages ──────────────────────────────────────────────
  const withTotalReduction = rows.filter(r => r.total_reduction_pct !== null);
  const avgTotalReduction = withTotalReduction.length > 0
    ? Math.round(withTotalReduction.reduce((s, r) => s + r.total_reduction_pct, 0) / withTotalReduction.length * 10) / 10
    : null;

  const withElisionPct = rows.filter(r => r.elision_pct !== null);
  const avgElisionPct = withElisionPct.length > 0
    ? Math.round(withElisionPct.reduce((s, r) => s + r.elision_pct, 0) / withElisionPct.length * 10) / 10
    : null;

  const result = {
    generated_at: new Date().toISOString(),
    baseline_source: diskPhase134 ? 'disk' : 'hardcoded_phase135_summary',
    summary: {
      avg_total_reduction_pct: avgTotalReduction,
      avg_elision_pct: avgElisionPct,
      workflows_measured: rows.length,
    },
    workflows: rows,
  };

  // ── Step 8: Print human-readable table ────────────────────────────────────
  const maxNameLen = Math.max(20, ...rows.map(r => r.name.length));
  const header = `${'Workflow'.padEnd(maxNameLen)} | Original | Compressed | Post-Elision | Total %`;
  const sep = '-'.repeat(maxNameLen) + '-+----------+------------+--------------+---------';
  process.stderr.write('\n## Cumulative Token Savings\n\n');
  process.stderr.write('Phase 134 → Phase 135 (compression) → Phase 137 (elision)\n\n');
  process.stderr.write(header + '\n');
  process.stderr.write(sep + '\n');
  for (const r of rows) {
    const name = r.name.padEnd(maxNameLen);
    const orig = r.original !== null ? String(r.original).padStart(8) : '       ?';
    const comp = r.post_compression !== null ? String(r.post_compression).padStart(10) : '         ?';
    const elid = r.post_elision !== null ? String(r.post_elision).padStart(12) : '           ?';
    const tot = r.total_reduction_pct !== null ? `-${r.total_reduction_pct}%`.padStart(7) : '      ?';
    process.stderr.write(`${name} | ${orig} | ${comp} | ${elid} | ${tot}\n`);
  }
  process.stderr.write(sep + '\n');
  if (avgTotalReduction !== null) {
    process.stderr.write(`${'Average'.padEnd(maxNameLen)} |          |            |              | -${avgTotalReduction}%\n`);
  }
  if (avgElisionPct !== null) {
    process.stderr.write(`\nElision-only average reduction: -${avgElisionPct}%\n`);
  }
  process.stderr.write('\n');

  output(result, raw);
}

module.exports = {
  cmdWorkflowBaseline,
  cmdWorkflowCompare,
  cmdWorkflowHotpath,
  cmdWorkflowVerifyStructure,
  cmdWorkflowSavings,
  extractStructuralFingerprint,
};
