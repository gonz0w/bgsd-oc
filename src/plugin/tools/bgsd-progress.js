import { z } from 'zod';
import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getProjectState } from '../project-state.js';
import { invalidateState } from '../parsers/state.js';
import { invalidatePlans } from '../parsers/plan.js';

/**
 * bgsd_progress — State mutation tool.
 *
 * Updates project progress: mark tasks complete, add/remove blockers,
 * record decisions, advance plan. Writes STATE.md to disk, invalidates
 * parser caches, and returns a fresh state snapshot.
 *
 * Uses the canonical state/session mutator shared with CLI state commands.
 * Does NOT create git commits — the agent handles commits separately.
 */

const VALID_ACTIONS = ['complete-task', 'uncomplete-task', 'add-blocker', 'remove-blocker', 'record-decision', 'advance'];

function resolveCliPath() {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env.BGSD_PLUGIN_DIR ? join(process.env.BGSD_PLUGIN_DIR, 'bin', 'bgsd-tools.cjs') : null,
    join(currentDir, '..', '..', '..', 'bin', 'bgsd-tools.cjs'),
    join(currentDir, 'bin', 'bgsd-tools.cjs'),
    join(currentDir, '..', 'bin', 'bgsd-tools.cjs'),
  ];

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }

  throw new Error('Could not locate bgsd-tools.cjs');
}

function runCanonicalStateCommand(projectDir, args) {
  const cliPath = resolveCliPath();
  const output = execFileSync(process.execPath, [cliPath, 'verify:state', ...args], {
    cwd: projectDir,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(String(output || '{}').trim() || '{}');
}

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

      const { state } = projectState;
      let actionResult = null;

      switch (args.action) {
        case 'complete-task': {
          const currentProgress = state.progress !== null ? state.progress : 0;
          const newProgress = Math.min(100, currentProgress + 10);
          runCanonicalStateCommand(projectDir, ['patch', `--Progress`, String(newProgress)]);
          actionResult = `Progress updated to ${newProgress}%`;
          break;
        }

        case 'uncomplete-task': {
          const currentProgress = state.progress !== null ? state.progress : 0;
          const newProgress = Math.max(0, currentProgress - 10);
          runCanonicalStateCommand(projectDir, ['patch', `--Progress`, String(newProgress)]);
          actionResult = `Progress reverted to ${newProgress}%`;
          break;
        }

        case 'add-blocker': {
          runCanonicalStateCommand(projectDir, ['add-blocker', '--text', args.value]);
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
          const blockers = listOpenBlockers(state.raw || '');
          if (blockers.error) {
            return JSON.stringify({
              error: 'validation_error',
              message: blockers.error,
            });
          }
          if (idx > blockers.entries.length) {
            return JSON.stringify({
              error: 'validation_error',
              message: `Blocker index ${idx} out of range. Found ${blockers.entries.length} blocker(s).`,
            });
          }

          runCanonicalStateCommand(projectDir, ['resolve-blocker', '--text', blockers.entries[idx - 1]]);
          actionResult = `Blocker ${idx} removed`;
          break;
        }

        case 'record-decision': {
          const phaseTag = state.phase ? (state.phase.match(/^(\d+)/)?.[1] || '?') : '?';
          runCanonicalStateCommand(projectDir, ['add-decision', '--phase', phaseTag, '--summary', args.value]);
          actionResult = `Decision recorded: ${args.value}`;
          break;
        }

        case 'advance': {
          const result = runCanonicalStateCommand(projectDir, ['advance-plan']);
          actionResult = result.advanced === false ? 'No current plan advanced' : `Advanced to Plan ${String(result.current_plan).padStart(2, '0')}`;
          break;
        }
      }

      invalidateState(projectDir);
      invalidatePlans(projectDir);

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
    } catch (err) {
      return JSON.stringify({
        error: 'runtime_error',
        message: 'Failed to update progress: ' + err.message,
      });
    }
  },
};

function listOpenBlockers(content) {
  const match = content.match(/(###\s*(?:Blockers|Blockers\/Concerns|Concerns)\s*\n)([\s\S]*?)(?=\n###|\n## |$)/i);
  if (!match) {
    return { error: 'No Blockers/Concerns section found in STATE.md' };
  }

  const entries = match[2]
    .split('\n')
    .map((line) => line.match(/^\s*[-*]\s+(.+)$/)?.[1]?.trim() || null)
    .filter((line) => line && !/^none(?: yet)?\.?$/i.test(line));

  return { entries };
}
