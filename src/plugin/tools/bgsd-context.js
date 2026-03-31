import { z } from 'zod';
import { getProjectState } from '../project-state.js';

/**
 * bgsd_context — Task-scoped context reader.
 *
 * Returns file paths, line ranges, and summaries relevant to a specific task.
 * Does NOT return actual file contents — use the Read tool for that.
 * Defaults to the first task of the current plan if no task number given.
 */
export const bgsd_context = {
  description:
    'Get task-scoped context for the current or specified task.\n\n' +
    'Returns file paths, line ranges, and summaries relevant to a specific task — ' +
    'not actual file contents (use the Read tool for that).\n\n' +
    'Defaults to the current task from STATE.md. Pass a task number to get context ' +
    'for a different task in the current plan.',

  args: {
    task: z.coerce.number().optional().describe('Task number within current plan. Defaults to current task.'),
  },

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

      const { plans } = projectState;
      const phaseNumber = projectState.state?.phase?.match(/^(\d+(?:\.\d+)?)/)?.[1] || null;

      if (!plans || plans.length === 0) {
        const nextCommand = phaseNumber ? `/bgsd-plan phase ${phaseNumber}` : '/bgsd-inspect progress';
        return JSON.stringify({
          error: 'validation_error',
          message: phaseNumber
            ? `No plans found for current phase. Run ${nextCommand} to create plans.`
            : `No plans found for the active phase. Run ${nextCommand} to confirm the current phase before planning.`,
        });
      }

      // Find current plan — use the first plan (or match state.currentPlan if available)
      let currentPlan = plans[0];
      if (projectState.state.currentPlan) {
        const planNum = projectState.state.currentPlan.match(/(\d+)/);
        if (planNum) {
          const found = plans.find(p =>
            p.frontmatter.plan === planNum[1] ||
            p.frontmatter.plan === parseInt(planNum[1], 10)
          );
          if (found) currentPlan = found;
        }
      }

      const planId = currentPlan.frontmatter.plan
        ? 'P' + String(currentPlan.frontmatter.plan).padStart(2, '0')
        : null;

      // Validate task if provided (defense-in-depth for direct calls)
      if (args.task !== undefined && args.task !== null && isNaN(Number(args.task))) {
        return JSON.stringify({
          error: 'validation_error',
          message: 'Invalid input: expected number, received NaN',
        });
      }

      // Determine task index (1-indexed input, 0-indexed array)
      const taskNumber = args.task;
      const taskIndex = taskNumber ? taskNumber - 1 : 0;
      const totalTasks = currentPlan.tasks.length;

      if (taskIndex < 0 || taskIndex >= totalTasks) {
        return JSON.stringify({
          error: 'validation_error',
          message: `Task ${taskNumber} not found. Current plan has ${totalTasks} task${totalTasks !== 1 ? 's' : ''}.`,
        });
      }

      const task = currentPlan.tasks[taskIndex];

      return JSON.stringify({
        task: {
          number: taskIndex + 1,
          name: task.name || null,
          files: task.files || [],
          action: task.action || null,
          done: task.done || null,
        },
        plan: {
          id: planId,
          objective: currentPlan.objective || null,
          verification: currentPlan.verification || null,
          filesModified: currentPlan.frontmatter.files_modified || [],
        },
      });
    } catch (err) {
      return JSON.stringify({
        error: 'runtime_error',
        message: 'Failed to read task context: ' + err.message,
      });
    }
  },
};
