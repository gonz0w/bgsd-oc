import { z } from 'zod';
import { getProjectState } from '../project-state.js';
import { readFileSync, writeFileSync, mkdirSync, rmdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { invalidateState } from '../parsers/state.js';
import { invalidatePlans } from '../parsers/plan.js';
import { getDb, PlanningCache } from '../lib/db-cache.js';

/**
 * bgsd_progress — State mutation tool.
 *
 * Updates project progress: mark tasks complete, add/remove blockers,
 * record decisions, advance plan. Writes STATE.md to disk, invalidates
 * parser caches, and returns a fresh state snapshot.
 *
 * Uses atomic directory-based file locking to prevent concurrent corruption.
 * Does NOT create git commits — the agent handles commits separately.
 */

const LOCK_STALE_MS = 10000; // 10 seconds

const VALID_ACTIONS = ['complete-task', 'uncomplete-task', 'add-blocker', 'remove-blocker', 'record-decision', 'advance'];

export const bgsd_progress = {
  description:
    'Update bGSD project progress \u2014 mark tasks complete, add/remove blockers, record decisions, advance plan.\n\n' +
    'Single tool with an action parameter:\n' +
    '- complete-task: Mark the next pending task as complete\n' +
    '- uncomplete-task: Un-complete the last completed task\n' +
    '- add-blocker: Add a blocker to STATE.md\n' +
    '- remove-blocker: Remove a blocker by index\n' +
    '- record-decision: Record a decision to STATE.md\n' +
    '- advance: Advance to next plan (when current plan is complete)\n\n' +
    'Updates files on disk (STATE.md, PLAN.md). Does NOT create git commits \u2014 the agent handles commits separately.\n\n' +
    'Returns updated state snapshot after the change.',

  args: {
    action: z.enum(VALID_ACTIONS).describe('The progress action to perform'),
    value: z.string().optional().describe('Value for the action: blocker text for add-blocker, blocker index (1-based) for remove-blocker, decision text for record-decision. Not needed for complete-task, uncomplete-task, advance.'),
  },

  async execute(args, context) {
    const projectDir = context?.directory || process.cwd();
    const lockDir = join(projectDir, '.planning', '.lock');

    try {
      // Validate action (defense-in-depth for direct calls bypassing Zod)
      if (!args.action || !VALID_ACTIONS.includes(args.action)) {
        return JSON.stringify({
          error: 'validation_error',
          message: `Invalid option: expected one of ${VALID_ACTIONS.map(a => `"${a}"`).join('|')}`,
        });
      }

      // Check project exists
      const projectState = getProjectState(projectDir);
      if (!projectState) {
        return JSON.stringify({
          status: 'no_project',
          message: 'No .planning/ directory found. Run /bgsd-new-project to initialize a project.',
        });
      }

      // Validate action-specific requirements
      if ((args.action === 'add-blocker' || args.action === 'record-decision') && !args.value) {
        return JSON.stringify({
          error: 'validation_error',
          message: `Action '${args.action}' requires a 'value' parameter.`,
        });
      }
      if (args.action === 'remove-blocker' && !args.value) {
        return JSON.stringify({
          error: 'validation_error',
          message: "Action 'remove-blocker' requires a 'value' parameter (blocker index, 1-based).",
        });
      }

      // File locking: mkdirSync is atomic on POSIX
      try {
        mkdirSync(lockDir);
      } catch (lockErr) {
        // Lock exists — check staleness
        if (lockErr.code === 'EEXIST') {
          try {
            const lockStat = statSync(lockDir);
            const age = Date.now() - lockStat.mtimeMs;
            if (age > LOCK_STALE_MS) {
              // Stale lock — break it
              rmdirSync(lockDir);
              mkdirSync(lockDir);
            } else {
              return JSON.stringify({
                error: 'runtime_error',
                message: 'Another operation in progress. Try again.',
              });
            }
          } catch {
            return JSON.stringify({
              error: 'runtime_error',
              message: 'Failed to check lock status. Try again.',
            });
          }
        } else {
          throw lockErr;
        }
      }

      try {
        // Read current STATE.md
        const statePath = join(projectDir, '.planning', 'STATE.md');
        let content = readFileSync(statePath, 'utf-8');

        const { state } = projectState;
        let actionResult = null;

        // SQL-first: attempt SQLite write before regex mutation
        let sqliteCache = null;
        try {
          const db = getDb(projectDir);
          if (db.backend === 'sqlite') {
            sqliteCache = new PlanningCache(db);
          }
        } catch { /* SQLite unavailable — use regex path only */ }

        switch (args.action) {
          case 'complete-task': {
            // Increment progress percentage
            const currentProgress = state.progress !== null ? state.progress : 0;
            const step = 10;
            const newProgress = Math.min(100, currentProgress + step);

            // SQL-first: update progress in session_state
            if (sqliteCache) {
              try {
                const sessionState = sqliteCache.getSessionState(projectDir);
                if (sessionState) {
                  sqliteCache.storeSessionState(projectDir, { ...sessionState, progress: newProgress, last_activity: new Date().toISOString().split('T')[0] });
                }
              } catch { /* non-fatal */ }
            }

            content = updateProgress(content, newProgress);
            actionResult = `Progress updated to ${newProgress}%`;
            break;
          }

          case 'uncomplete-task': {
            const currentProgress = state.progress !== null ? state.progress : 0;
            const step = 10;
            const newProgress = Math.max(0, currentProgress - step);

            // SQL-first: update progress in session_state
            if (sqliteCache) {
              try {
                const sessionState = sqliteCache.getSessionState(projectDir);
                if (sessionState) {
                  sqliteCache.storeSessionState(projectDir, { ...sessionState, progress: newProgress });
                }
              } catch { /* non-fatal */ }
            }

            content = updateProgress(content, newProgress);
            actionResult = `Progress reverted to ${newProgress}%`;
            break;
          }

          case 'add-blocker': {
            // SQL-first: write blocker to SQLite
            if (sqliteCache) {
              try {
                sqliteCache.writeSessionBlocker(projectDir, {
                  text: args.value,
                  status: 'open',
                  created_at: new Date().toISOString(),
                });
              } catch { /* non-fatal */ }
            }

            content = addBlocker(content, args.value);
            actionResult = `Blocker added: ${args.value}`;
            break;
          }

          case 'remove-blocker': {
            const idx = parseInt(args.value, 10);
            if (isNaN(idx) || idx < 1) {
              return JSON.stringify({
                error: 'validation_error',
                message: 'remove-blocker value must be a positive integer (1-based index).',
              });
            }
            const result = removeBlocker(content, idx);
            if (result.error) {
              return JSON.stringify({
                error: 'validation_error',
                message: result.error,
              });
            }

            // SQL-first: resolve blocker by 1-based index in SQLite
            if (sqliteCache) {
              try {
                const blockersResult = sqliteCache.getSessionBlockers(projectDir, { status: 'open', limit: 100 });
                const blockers = blockersResult ? blockersResult.entries : [];
                // entries are ordered by id DESC — reverse to get oldest-first (same as display order)
                const sorted = blockers.slice().reverse();
                const target = sorted[idx - 1];
                if (target && target._id != null) {
                  sqliteCache.resolveSessionBlocker(projectDir, target._id, 'Removed');
                }
              } catch { /* non-fatal */ }
            }

            content = result.content;
            actionResult = `Blocker ${idx} removed`;
            break;
          }

          case 'record-decision': {
            // SQL-first: write decision to SQLite
            if (sqliteCache) {
              try {
                const phaseTag = state.phase ? (state.phase.match(/^(\d+)/)?.[1] || '?') : '?';
                sqliteCache.writeSessionDecision(projectDir, {
                  phase: `Phase ${phaseTag}`,
                  summary: args.value,
                  rationale: null,
                  timestamp: new Date().toISOString(),
                  milestone: null,
                });
              } catch { /* non-fatal */ }
            }

            content = recordDecision(content, args.value, state.phase);
            actionResult = `Decision recorded: ${args.value}`;
            break;
          }

          case 'advance': {
            const result = advancePlan(content, state.currentPlan);

            // SQL-first: update current_plan in session_state
            if (sqliteCache && result.newPlanNum) {
              try {
                const sessionState = sqliteCache.getSessionState(projectDir);
                if (sessionState) {
                  sqliteCache.storeSessionState(projectDir, {
                    ...sessionState,
                    current_plan: String(result.newPlanNum),
                    last_activity: new Date().toISOString().split('T')[0],
                  });
                }
              } catch { /* non-fatal */ }
            }

            content = result.content;
            actionResult = result.message;
            break;
          }
        }

        // Write updated STATE.md
        writeFileSync(statePath, content, 'utf-8');

        // SQL-first: update file_cache mtime so _checkAndReimportState doesn't re-import
        if (sqliteCache) {
          try { sqliteCache.updateMtime(statePath); } catch { /* non-fatal */ }
        }

        // Release lock before invalidating caches
        try { rmdirSync(lockDir); } catch { /* already released */ }

        // Invalidate caches so next read gets fresh data
        invalidateState(projectDir);
        invalidatePlans(projectDir);

        // Read fresh state
        const freshState = getProjectState(projectDir);
        const fresh = freshState ? freshState.state : null;

        return JSON.stringify({
          success: true,
          action: args.action,
          result: actionResult,
          state: {
            phase: fresh ? fresh.phase : null,
            plan: fresh ? fresh.currentPlan : null,
            progress: fresh ? fresh.progress : null,
            status: fresh ? fresh.status : null,
          },
        });
      } finally {
        // Ensure lock is always released
        try { rmdirSync(lockDir); } catch { /* already released or doesn't exist */ }
      }
    } catch (err) {
      // Ensure lock is released on error
      try { rmdirSync(lockDir); } catch { /* ignore */ }

      return JSON.stringify({
        error: 'runtime_error',
        message: 'Failed to update progress: ' + err.message,
      });
    }
  },
};

// --- Helper functions for STATE.md manipulation ---

function updateProgress(content, newPercent) {
  const barLength = 10;
  const filled = Math.round(newPercent / 100 * barLength);
  const empty = barLength - filled;
  const newBar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
  const progressLine = `**Progress:** [${newBar}] ${newPercent}%`;

  const replaced = content.replace(
    /\*\*Progress:\*\*\s*\[[\u2588\u2591]+\]\s*\d+%/,
    progressLine
  );

  return replaced;
}

function addBlocker(content, blockerText) {
  const sectionPattern = /(### Blockers\/Concerns\s*\n)([\s\S]*?)(\n###|\n## |$)/;
  const match = content.match(sectionPattern);

  if (!match) {
    return content + '\n### Blockers/Concerns\n\n- ' + blockerText + '\n';
  }

  const header = match[1];
  let body = match[2];
  const after = match[3];

  if (body.trim().toLowerCase() === 'none' || body.trim() === '') {
    body = '\n- ' + blockerText + '\n';
  } else {
    body = body.trimEnd() + '\n- ' + blockerText + '\n';
  }

  return content.replace(sectionPattern, header + body + after);
}

function removeBlocker(content, index) {
  const sectionPattern = /(### Blockers\/Concerns\s*\n)([\s\S]*?)(\n###|\n## |$)/;
  const match = content.match(sectionPattern);

  if (!match) {
    return { error: 'No Blockers/Concerns section found in STATE.md' };
  }

  const header = match[1];
  const body = match[2];
  const after = match[3];

  const lines = body.split('\n').filter(l => l.match(/^[-*]\s+/));

  if (index > lines.length || index < 1) {
    return { error: `Blocker index ${index} out of range. Found ${lines.length} blocker(s).` };
  }

  lines.splice(index - 1, 1);

  let newBody;
  if (lines.length === 0) {
    newBody = '\nNone\n';
  } else {
    newBody = '\n' + lines.join('\n') + '\n';
  }

  return { content: content.replace(sectionPattern, header + newBody + after) };
}

function recordDecision(content, decisionText, phase) {
  const phaseTag = phase ? phase.match(/^(\d+)/)?.[1] || '?' : '?';
  const entry = `- [Phase ${phaseTag}]: ${decisionText}`;

  const sectionPattern = /(### Decisions\s*\n)([\s\S]*?)(\n###|\n## |$)/;
  const match = content.match(sectionPattern);

  if (!match) {
    return content + '\n### Decisions\n\n' + entry + '\n';
  }

  const header = match[1];
  let body = match[2];
  const after = match[3];

  body = body.trimEnd() + '\n' + entry + '\n';

  return content.replace(sectionPattern, header + body + after);
}

function advancePlan(content, currentPlan) {
  if (!currentPlan) {
    return { content, message: 'No current plan to advance from', newPlanNum: null };
  }

  const planNumMatch = currentPlan.match(/(\d+)\s*(?:pending|$)/i) || currentPlan.match(/(\d+)/);
  if (!planNumMatch) {
    return { content, message: `Could not parse plan number from: ${currentPlan}`, newPlanNum: null };
  }

  const currentNum = parseInt(planNumMatch[1], 10);
  const nextNum = currentNum + 1;
  const nextPlanStr = `Plan ${String(currentNum).padStart(2, '0')} complete, Plan ${String(nextNum).padStart(2, '0')} pending`;

  const updated = content.replace(
    /\*\*Current Plan:\*\*\s*[^\n]+/,
    `**Current Plan:** ${nextPlanStr}`
  );

  return { content: updated, message: `Advanced to Plan ${String(nextNum).padStart(2, '0')}`, newPlanNum: nextNum };
}
