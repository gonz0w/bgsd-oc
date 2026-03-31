'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { getDb, closeAll, hasSQLiteSupport } = require('../src/lib/db');
const { PlanningCache } = require('../src/lib/planning-cache');
const { applyStateSessionMutation } = require('../src/lib/state-session-mutator');
const { createTempProject, cleanup, STATE_FIXTURE } = require('./helpers.cjs');

function writeFixture(tmpDir, content = STATE_FIXTURE) {
  fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), content);
}

describe('state-session mutator', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeFixture(tmpDir);
  });

  afterEach(() => {
    closeAll();
    cleanup(tmpDir);
  });

  test('patch computes one canonical next state for markdown and SQLite', () => {
    const result = applyStateSessionMutation(tmpDir, {
      type: 'patch',
      patches: {
        Status: 'Review',
        'Last Activity': '2026-02-01',
      },
    });

    assert.deepStrictEqual(result.updated, ['Status', 'Last Activity']);
    assert.deepStrictEqual(result.failed, []);

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('**Status:** Review'));
    assert.ok(content.includes('**Last Activity:** 2026-02-01'));

    if (hasSQLiteSupport()) {
      const cache = new PlanningCache(getDb(tmpDir));
      const state = cache.getSessionState(tmpDir);
      assert.strictEqual(state.status, 'Review');
      assert.strictEqual(state.last_activity, '2026-02-01');
    }
  });

  test('decision, blocker, resolve, and continuity operations keep markdown and SQLite aligned', () => {
    applyStateSessionMutation(tmpDir, { type: 'appendDecision', phase: '1', summary: 'Use canonical mutator', rationale: 'Prevent drift' });
    applyStateSessionMutation(tmpDir, { type: 'appendBlocker', text: 'Config drift issue' });
    applyStateSessionMutation(tmpDir, { type: 'resolveBlocker', text: 'Config drift' });
    applyStateSessionMutation(tmpDir, { type: 'recordContinuity', stopped_at: 'Task boundary', resume_file: 'None' });

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('Use canonical mutator'));
    assert.ok(!content.includes('Config drift issue'));
    assert.ok(content.includes('**Stopped at:** Task boundary'));

    if (hasSQLiteSupport()) {
      const cache = new PlanningCache(getDb(tmpDir));
      const decisions = cache.getSessionDecisions(tmpDir);
      const blockers = cache.getSessionBlockers(tmpDir, { status: 'resolved' });
      const continuity = cache.getSessionContinuity(tmpDir);
      assert.ok(decisions.entries.some((entry) => entry.summary === 'Use canonical mutator'));
      assert.ok(blockers.entries.some((entry) => entry.text === 'Config drift issue'));
      assert.strictEqual(continuity.stopped_at, 'Task boundary');
    }
  });

  test('completePlanCore updates the canonical core contract', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan 1\n');
    fs.writeFileSync(path.join(phaseDir, '01-02-PLAN.md'), '# Plan 2\n');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary 1\n');

    const result = applyStateSessionMutation(tmpDir, {
      type: 'completePlanCore',
      phase: '151',
      progress_percent: 50,
      decision_summary: 'Canonical plan completion',
      decision_rationale: 'Keep core writes in one path',
    });

    assert.strictEqual(result.completed, true);
    assert.strictEqual(result.core.current_plan, 2);
    assert.strictEqual(result.core.progress, 50);

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('**Current Plan:** 2'));
    assert.ok(content.includes('50%'));
    assert.ok(content.includes('Canonical plan completion'));

    if (hasSQLiteSupport()) {
      const cache = new PlanningCache(getDb(tmpDir));
      const state = cache.getSessionState(tmpDir);
      const decisions = cache.getSessionDecisions(tmpDir);
      assert.strictEqual(state.current_plan, '2');
      assert.strictEqual(state.progress, 50);
      assert.ok(decisions.entries.some((entry) => entry.summary === 'Canonical plan completion'));
    }
  });

  test('completePlanCore can refresh total plans and current focus from disk truth', () => {
    writeFixture(tmpDir, `# Project State\n\n## Project Reference\n\n**Current focus:** stale summary text\n\n## Current Position\n\n**Phase:** 151 of 200 (Execution Realism)\n**Current Plan:** 1\n**Total Plans in Phase:** 9\n**Status:** In progress\n**Last Activity:** 2026-03-10\n\n**Progress:** [░░░░░░░░░░] 0%\n\n## Accumulated Context\n\n### Decisions\n\nNone yet.\n\n### Blockers/Concerns\n\nNone.\n\n## Session Continuity\n\n**Last session:** 2026-03-10T14:22:00.000Z\n**Stopped at:** Completed 0151-01-PLAN.md\n**Resume file:** None\n`);

    applyStateSessionMutation(tmpDir, {
      type: 'completePlanCore',
      phase: '151',
      progress_percent: 100,
      total_plans_in_phase: 2,
      current_plan: 2,
      status: 'Phase complete — ready for verification',
      current_focus: 'Phase 151 complete — ready for verification',
    });

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('**Current Plan:** 2'));
    assert.ok(content.includes('**Total Plans in Phase:** 2'));
    assert.ok(content.includes('**Current focus:** Phase 151 complete — ready for verification'));
    assert.ok(content.includes('**Status:** Phase complete — ready for verification'));
  });

  test('preserves compatibility with alternate STATE.md continuity labels', () => {
    writeFixture(tmpDir, `# Project State\n\n## Current Position\n\n**Phase:** 5 of 12 (API Layer)\n**Current Plan:** 1\n**Total Plans in Phase:** 3\n**Status:** In progress\n**Last Activity:** 2026-03-10\n\nProgress: [░░░░░░░░░░] 0%\n\n## Accumulated Context\n\n### Decisions\n\nNone yet.\n\n### Blockers/Concerns\n\nNone.\n\n## Session Continuity\n\n**Last Date:** 2026-03-10T14:22:00.000Z\n**Stopped At:** Completed 0005-01-PLAN.md\n**Next step:** Phase 5 (continue)\n`);

    applyStateSessionMutation(tmpDir, { type: 'recordContinuity', stopped_at: 'Completed 0005-02-PLAN.md', resume_file: 'None' });

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('**Last Date:**'));
    assert.ok(content.includes('**Stopped At:** Completed 0005-02-PLAN.md'));
    assert.ok(content.includes('**Next step:** None'));
  });

  test('restores markdown when SQLite persistence fails', () => {
    if (!hasSQLiteSupport()) return;

    const before = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.throws(() => {
      applyStateSessionMutation(tmpDir, {
        type: 'appendDecision',
        phase: '1',
        summary: 'Will fail',
      }, {
        beforeStoreBundle() {
          throw new Error('boom');
        },
      });
    }, /boom/);

    const after = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.strictEqual(after, before);

    const cache = new PlanningCache(getDb(tmpDir));
    const decisions = cache.getSessionDecisions(tmpDir);
    assert.strictEqual(decisions.entries.length, 0);
  });
});
