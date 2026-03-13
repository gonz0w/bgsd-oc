import { getProjectState } from '../project-state.js';

/**
 * bgsd_status — Execution state reader.
 *
 * Returns current phase, plan, task list with statuses, progress, and blockers.
 * No parameters — reads current state from .planning/STATE.md and related files.
 */
export const bgsd_status = {
  description:
    'Get current bGSD execution state — phase, plan, tasks, progress, blockers.\n\n' +
    'Call this to understand where the project is right now. Returns structured JSON with ' +
    'the current phase number and name, active plan, full task list with completion statuses, ' +
    'progress percentage, and any blockers.\n\n' +
    'Requires an active bGSD project (.planning/ directory).',

  args: {},

  async execute(args, context) {
    try {
      const projectDir = context?.directory || process.cwd();
      const projectState = getProjectState(projectDir);

      if (!projectState) {
        return JSON.stringify({
          status: 'no_project',
          message: 'No .planning/ directory found. Run /bgsd-new-project to initialize a project.',
        });
      }

      const { state, plans } = projectState;

      // Parse phase number and name from "73 — Context Injection" format
      let phase = null;
      if (state.phase) {
        const phaseMatch = state.phase.match(/^(\d+)\s*[—\-]\s*(.+)/);
        if (phaseMatch) {
          phase = { number: phaseMatch[1], name: phaseMatch[2].trim() };
        } else {
          const numOnly = state.phase.match(/^(\d+)/);
          phase = numOnly
            ? { number: numOnly[1], name: null }
            : null;
        }
      }

      // Parse current plan
      let plan = null;
      if (state.currentPlan && state.currentPlan !== 'Not started') {
        plan = { id: state.currentPlan, status: state.status || 'in_progress' };
      }

      // Extract blockers from state
      let blockers = [];
      const blockersSection = state.getSection('Blockers/Concerns');
      if (blockersSection) {
        blockers = blockersSection
          .split('\n')
          .map(line => line.replace(/^[-*]\s*/, '').trim())
          .filter(line => line.length > 0 && line.toLowerCase() !== 'none');
      }

      // Build full task list from parsed plans
      const tasks = [];
      for (const p of plans) {
        const planId = p.frontmatter.plan
          ? 'P' + String(p.frontmatter.plan).padStart(2, '0')
          : null;
        for (let i = 0; i < p.tasks.length; i++) {
          const t = p.tasks[i];
          tasks.push({
            plan: planId,
            task: i + 1,
            name: t.name || null,
            files: t.files || [],
            status: 'pending',
          });
        }
      }

      const result = {
        phase,
        plan,
        progress: state.progress !== null ? state.progress : null,
        tasks,
        blockers,
      };

      return JSON.stringify(result);
    } catch (err) {
      return JSON.stringify({
        error: 'runtime_error',
        message: 'Failed to read project state: ' + err.message,
      });
    }
  },
};
