'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { createTempProject, cleanup, writeStateFixture } = require('./helpers.cjs');
const { hasSQLiteSupport } = require('../src/lib/db');

const pluginPath = path.join(__dirname, '..', 'plugin.js');

function runPluginScript(body, cwdArg) {
  const script = `
    import * as mod from ${JSON.stringify(`file://${pluginPath}`)};
    const cwd = process.argv[1];
    ${body}
    process.exit(0);
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '--eval', script, cwdArg], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(output);
}

describe('plugin progress canonical contract', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeStateFixture(tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('progress actions keep plugin results on the canonical state/session contract', () => {
    const result = runPluginScript(`
      const plugin = await mod.BgsdPlugin({ directory: cwd });
      const outputs = [];
      outputs.push(JSON.parse(await plugin.tool.bgsd_progress.execute({ action: 'complete-task' }, { directory: cwd })));
      outputs.push(JSON.parse(await plugin.tool.bgsd_progress.execute({ action: 'uncomplete-task' }, { directory: cwd })));
      outputs.push(JSON.parse(await plugin.tool.bgsd_progress.execute({ action: 'add-blocker', value: 'Config drift issue' }, { directory: cwd })));
      outputs.push(JSON.parse(await plugin.tool.bgsd_progress.execute({ action: 'remove-blocker', value: '1' }, { directory: cwd })));
      outputs.push(JSON.parse(await plugin.tool.bgsd_progress.execute({ action: 'record-decision', value: 'Use canonical plugin mutations' }, { directory: cwd })));
      outputs.push(JSON.parse(await plugin.tool.bgsd_progress.execute({ action: 'advance' }, { directory: cwd })));
      const reparsed = mod.parseState(cwd);
      process.stdout.write(JSON.stringify({ outputs, reparsed }));
    `, tmpDir);

    const [complete, uncomplete, addBlocker, removeBlocker, recordDecision, advance] = result.outputs;
    for (const output of result.outputs) {
        assert.strictEqual(output.success, true);
      }

    assert.strictEqual(complete.state.progress, 10);
    assert.strictEqual(uncomplete.state.progress, 0);
    assert.strictEqual(advance.state.plan, '2');
    assert.ok(result.reparsed);
    assert.strictEqual(result.reparsed.currentPlan, '2');
    assert.strictEqual(result.reparsed.progress, 0);

    const stateContent = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.match(stateContent, /\*\*Current Plan:\*\* 2/);
    assert.match(stateContent, /Use canonical plugin mutations/);
    assert.doesNotMatch(stateContent, /Config drift issue/);
  });

  test('invalidateState clears related session tables beyond session_state', async () => {
    if (!hasSQLiteSupport()) return;

    runPluginScript(`
      mod.parseState(cwd);
      process.stdout.write(JSON.stringify({ ok: true }));
    `, tmpDir);

    const { DatabaseSync } = require('node:sqlite');
    const dbPath = path.join(tmpDir, '.planning', '.cache.db');
    const db = new DatabaseSync(dbPath);

    db.prepare('INSERT OR REPLACE INTO session_state (cwd, current_plan, status, progress, data_json) VALUES (?, ?, ?, ?, ?)')
      .run(tmpDir, '99', 'Stale', 75, JSON.stringify({ current_plan: '99', status: 'Stale', progress: 75 }));
    db.prepare('INSERT INTO session_decisions (cwd, phase, summary, timestamp, data_json) VALUES (?, ?, ?, ?, ?)')
      .run(tmpDir, 'Phase 1', 'stale decision', '2026-01-01T00:00:00.000Z', JSON.stringify({ summary: 'stale decision' }));
    db.prepare('INSERT INTO session_todos (cwd, text, status, created_at, data_json) VALUES (?, ?, ?, ?, ?)')
      .run(tmpDir, 'stale todo', 'pending', '2026-01-01T00:00:00.000Z', JSON.stringify({ text: 'stale todo' }));
    db.prepare('INSERT INTO session_blockers (cwd, text, status, created_at, data_json) VALUES (?, ?, ?, ?, ?)')
      .run(tmpDir, 'stale blocker', 'open', '2026-01-01T00:00:00.000Z', JSON.stringify({ text: 'stale blocker' }));
    db.prepare('INSERT INTO session_metrics (cwd, phase, plan, duration, timestamp, data_json) VALUES (?, ?, ?, ?, ?, ?)')
      .run(tmpDir, '1', '1', '1 min', '2026-01-01T00:00:00.000Z', JSON.stringify({ duration: '1 min' }));
    db.prepare('INSERT OR REPLACE INTO session_continuity (cwd, last_session, stopped_at, next_step, data_json) VALUES (?, ?, ?, ?, ?)')
      .run(tmpDir, '2026-01-01T00:00:00.000Z', 'stale stop', 'stale next', JSON.stringify({ stopped_at: 'stale stop', next_step: 'stale next' }));

    const reparsed = runPluginScript(`
      mod.invalidateState(cwd);
      const reparsed = mod.parseState(cwd);
      process.stdout.write(JSON.stringify({ reparsed }));
    `, tmpDir);

    const counts = {
      state: db.prepare('SELECT COUNT(*) AS count FROM session_state WHERE cwd = ?').get(tmpDir).count,
      decisions: db.prepare('SELECT COUNT(*) AS count FROM session_decisions WHERE cwd = ?').get(tmpDir).count,
      todos: db.prepare('SELECT COUNT(*) AS count FROM session_todos WHERE cwd = ?').get(tmpDir).count,
      blockers: db.prepare('SELECT COUNT(*) AS count FROM session_blockers WHERE cwd = ?').get(tmpDir).count,
      metrics: db.prepare('SELECT COUNT(*) AS count FROM session_metrics WHERE cwd = ?').get(tmpDir).count,
      continuity: db.prepare('SELECT COUNT(*) AS count FROM session_continuity WHERE cwd = ?').get(tmpDir).count,
    };
    db.close();

    assert.deepStrictEqual(counts, {
      state: 0,
      decisions: 0,
      todos: 0,
      blockers: 0,
      metrics: 0,
      continuity: 0,
    });

    assert.ok(reparsed.reparsed);
    assert.strictEqual(reparsed.reparsed.currentPlan, '1');
    assert.strictEqual(reparsed.reparsed.status, 'In progress');
    assert.strictEqual(reparsed.reparsed.progress, 0);
  });
});
