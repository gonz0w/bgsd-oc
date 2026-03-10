import { getProjectState } from '../project-state.js';
import { parseRoadmap } from '../parsers/roadmap.js';
import { parsePlans } from '../parsers/plan.js';
import { createObjectSchema, validateArgs } from '../validation/adapter.js';

const PLAN_ARGS_SCHEMA = createObjectSchema({
  phase: { type: 'coerceNumber', optional: true },
});

/**
 * bgsd_plan — Roadmap and phase reader.
 *
 * Two modes:
 * - No args: returns all phases with status, goal, and plan count (roadmap summary)
 * - With phase number: returns detailed phase info plus plan contents
 */
export const bgsd_plan = {
  description:
    'Get roadmap overview or detailed phase information.\n\n' +
    'Two modes:\n' +
    '- No args: returns all phases with status, goal, and plan count (roadmap summary)\n' +
    '- With phase number: returns detailed phase info (goal, requirements, success criteria, ' +
    'dependencies) plus plan contents (tasks, objectives) if plans exist\n\n' +
    'Use no-args mode to understand project structure. Use phase mode to dive into specific phase details.',

  args: {
    phase: {
      type: 'number',
      optional: true,
      description: 'Phase number to get details for. Omit for roadmap overview.',
    },
  },

  async execute(args, context) {
    try {
      const parsedArgs = validateArgs('bgsd_plan', PLAN_ARGS_SCHEMA, args);
      if (!parsedArgs.ok) {
        return JSON.stringify({
          error: parsedArgs.error.code,
          message: parsedArgs.error.message,
        });
      }

      const projectDir = context.directory || process.cwd();
      const projectState = getProjectState(projectDir);

      if (!projectState) {
        return JSON.stringify({
          status: 'no_project',
          message: 'No .planning/ directory found. Run /bgsd-new-project to initialize a project.',
        });
      }

      const { roadmap } = projectState;

      if (!roadmap) {
        return JSON.stringify({
          error: 'runtime_error',
          message: 'ROADMAP.md could not be parsed. Run /bgsd-health to diagnose.',
        });
      }

      // No-args mode: roadmap summary
      if (parsedArgs.data.phase === undefined || parsedArgs.data.phase === null) {
        const phases = roadmap.phases.map(p => ({
          number: p.number,
          name: p.name,
          status: p.status,
          goal: p.goal,
          planCount: p.planCount,
        }));

        const currentMilestone = roadmap.currentMilestone
          ? { name: roadmap.currentMilestone.name, version: roadmap.currentMilestone.version, status: roadmap.currentMilestone.status }
          : null;

        return JSON.stringify({ phases, currentMilestone });
      }

      // Phase mode: detailed phase info
      const phaseDetail = roadmap.getPhase(parsedArgs.data.phase);

      if (!phaseDetail) {
        return JSON.stringify({
          error: 'validation_error',
          message: `Phase ${parsedArgs.data.phase} not found in roadmap. Call bgsd_plan with no args to see available phases.`,
        });
      }

      // Get plans for this phase
      const plans = parsePlans(parsedArgs.data.phase, projectDir);
      const planData = plans.map(p => ({
        plan: p.frontmatter.plan || null,
        wave: p.frontmatter.wave || null,
        objective: p.objective || null,
        tasks: p.tasks.map(t => ({
          name: t.name,
          type: t.type,
          files: t.files,
        })),
        requirements: p.frontmatter.requirements || [],
      }));

      return JSON.stringify({
        phase: {
          number: phaseDetail.number,
          name: phaseDetail.name,
          goal: phaseDetail.goal,
          dependsOn: phaseDetail.dependsOn,
          requirements: phaseDetail.requirements,
          successCriteria: phaseDetail.successCriteria,
          plans: planData,
        },
      });
    } catch (err) {
      return JSON.stringify({
        error: 'runtime_error',
        message: 'Failed to read roadmap data: ' + err.message,
      });
    }
  },
};
