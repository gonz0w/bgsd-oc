import { getProjectState } from './project-state.js';
import { countTokens, TOKEN_BUDGET } from './token-budget.js';

/**
 * Context builder for system prompt injection and compaction.
 * 
 * buildSystemPrompt: Compact <bgsd> tag for every LLM turn (~70 tokens).
 * buildCompactionContext: Structured XML blocks preserved across compaction (~500-1000 tokens).
 *
 * Both use cached ProjectState data — no file I/O in hot paths.
 */

/**
 * Build the system prompt injection string.
 * Returns a compact <bgsd> tag with current project state.
 *
 * @param {string} [cwd] - Working directory (defaults to process.cwd())
 * @returns {string} System prompt injection string
 */
export function buildSystemPrompt(cwd) {
  let projectState;
  try {
    projectState = getProjectState(cwd);
  } catch {
    return '<bgsd>Failed to load project state. Run /bgsd-health to diagnose.</bgsd>';
  }

  // No .planning/ directory — inject minimal hint
  if (!projectState) {
    return '<bgsd>No active project. Run /bgsd-new-project to start.</bgsd>';
  }

  const { state, roadmap, currentPhase, currentMilestone, plans } = projectState;

  // If state parsing partially succeeded but is missing critical data
  if (!state || !state.phase) {
    return '<bgsd>Failed to load project state. Run /bgsd-health to diagnose.</bgsd>';
  }

  // Extract phase number and name from state.phase
  // Format: "73 — Context Injection" or "73 - Context Injection"
  const phaseMatch = state.phase.match(/^(\d+)\s*(?:—|-|–)\s*(.+)/);
  const phaseNum = phaseMatch ? phaseMatch[1] : state.phase;
  const phaseName = phaseMatch ? phaseMatch[2].trim() : '';

  // Determine current plan info
  let planInfo = '';
  if (state.currentPlan && state.currentPlan !== 'Not started') {
    // Find current/incomplete plan from plans array
    const currentPlanMatch = state.currentPlan.match(/(\d+)/);
    const planNum = currentPlanMatch ? currentPlanMatch[1].padStart(2, '0') : null;

    if (planNum && plans.length > 0) {
      // Find the plan matching the current plan number
      const plan = plans.find(p =>
        p.frontmatter && p.frontmatter.plan === planNum
      );
      if (plan) {
        const totalTasks = plan.tasks ? plan.tasks.length : 0;
        // We don't track completed tasks here — show total
        planInfo = ` | Plan: P${planNum} (${totalTasks} tasks)`;
      } else {
        planInfo = ` | Plan: P${planNum}`;
      }
    } else {
      planInfo = ` | Plan: ${state.currentPlan}`;
    }
  } else {
    planInfo = ' | Ready to plan';
  }

  // Milestone position
  let milestoneInfo = '';
  if (currentMilestone && roadmap) {
    const milestonePhases = currentMilestone.phases;
    if (milestonePhases) {
      const totalPhases = milestonePhases.end - milestonePhases.start + 1;
      const currentPhaseNum = parseInt(phaseNum, 10);
      const phasePosition = currentPhaseNum - milestonePhases.start + 1;
      milestoneInfo = ` | ${currentMilestone.version} ${phasePosition}/${totalPhases} phases`;
    } else {
      milestoneInfo = ` | ${currentMilestone.version}`;
    }
  }

  // Phase goal
  let goalLine = '';
  if (currentPhase && currentPhase.goal) {
    goalLine = `\nGoal: ${currentPhase.goal}`;
  }

  // Blockers — only show if present
  let blockerLine = '';
  if (state.raw) {
    const blockersSection = state.getSection('Blockers/Concerns');
    if (blockersSection) {
      // Extract first non-empty blocker line
      const blockerLines = blockersSection
        .split('\n')
        .map(l => l.replace(/^-\s*/, '').trim())
        .filter(l => l && l !== 'None' && l !== 'None.' && !l.startsWith('None —'));
      if (blockerLines.length > 0) {
        // Show first blocker only to save tokens
        blockerLine = `\nBlocker: ${blockerLines[0]}`;
      }
    }
  }

  const prompt = `<bgsd>\nPhase ${phaseNum}: ${phaseName}${planInfo}${milestoneInfo}${goalLine}${blockerLine}\n</bgsd>`;

  // Token budget check — warn but don't block
  const tokenCount = countTokens(prompt);
  if (tokenCount > TOKEN_BUDGET) {
    console.warn(`[bGSD] System prompt injection exceeds budget: ${tokenCount} tokens (budget: ${TOKEN_BUDGET})`);
  }

  return prompt;
}

/**
 * Build enhanced compaction context with structured XML blocks.
 * Preserves full project awareness across context window resets.
 *
 * Blocks (per CONTEXT.md):
 * - <project>: Core value + tech stack (1 line each from PROJECT.md)
 * - <task-state>: Phase, plan, current task name + files
 * - <decisions>: Last 3 decisions from STATE.md
 * - <intent>: Objective from INTENT.md
 * - <session>: Session continuity hint (stopped_at, next_step)
 *
 * Uses `task-state` (not `task`) as tag name to avoid XML parser conflicts
 * with PLAN.md task tags.
 *
 * Target: under 1000 tokens. Individual section failures are skipped,
 * not fatal — partial context is better than none.
 *
 * @param {string} [cwd] - Working directory (defaults to process.cwd())
 * @returns {string|null} Compaction context string, or null if no .planning/
 */
export function buildCompactionContext(cwd) {
  let projectState;
  try {
    projectState = getProjectState(cwd);
  } catch {
    return '<project-error>Failed to load project state for compaction. Run /bgsd-health to diagnose.</project-error>';
  }

  // No .planning/ → inject nothing (per CONTEXT.md decision)
  if (!projectState) {
    return null;
  }

  const { state, project, intent, plans, currentPhase } = projectState;
  const blocks = [];

  // <project> block: Core value + Tech stack
  try {
    if (project) {
      const parts = [];
      if (project.coreValue) parts.push(`Core value: ${project.coreValue}`);
      if (project.techStack) parts.push(`Tech: ${project.techStack}`);
      if (parts.length > 0) {
        blocks.push(`<project>\n${parts.join('\n')}\n</project>`);
      }
    }
  } catch { /* skip block on failure */ }

  // <task-state> block: Phase, plan, current task
  try {
    if (state && state.phase) {
      const phaseMatch = state.phase.match(/^(\d+)\s*(?:—|-|–)\s*(.+)/);
      const phaseNum = phaseMatch ? phaseMatch[1] : state.phase;
      const phaseName = phaseMatch ? phaseMatch[2].trim() : '';

      let taskLine = `Phase ${phaseNum}: ${phaseName}`;

      // Find current plan and task
      if (state.currentPlan && plans && plans.length > 0) {
        const planNumMatch = state.currentPlan.match(/(\d+)/);
        const planNum = planNumMatch ? planNumMatch[1].padStart(2, '0') : null;

        if (planNum) {
          const plan = plans.find(p => p.frontmatter && p.frontmatter.plan === planNum);
          if (plan && plan.tasks && plan.tasks.length > 0) {
            const totalTasks = plan.tasks.length;
            // Find first task without completion marker (heuristic: tasks are sequential)
            // Since we don't track completion in the parser, show task count
            taskLine += ` — Plan P${planNum}, ${totalTasks} tasks`;

            // Show first task name and files as "current" context
            const firstTask = plan.tasks[0];
            if (firstTask.name) {
              taskLine += `\nCurrent: ${firstTask.name}`;
            }
            if (firstTask.files && firstTask.files.length > 0) {
              taskLine += `\nFiles: ${firstTask.files.join(', ')}`;
            }
          } else {
            taskLine += ` — Plan P${planNum}`;
          }
        }
      }

      blocks.push(`<task-state>\n${taskLine}\n</task-state>`);
    }
  } catch { /* skip block on failure */ }

  // <decisions> block: Last 3 decisions from STATE.md
  try {
    if (state && state.raw) {
      const decisionsSection = state.getSection('Decisions');
      if (decisionsSection) {
        // Parse bullet points, take last 3
        const decisionLines = decisionsSection
          .split('\n')
          .map(l => l.trim())
          .filter(l => l.startsWith('- '));

        if (decisionLines.length > 0) {
          const last3 = decisionLines.slice(-3);
          blocks.push(`<decisions>\n${last3.join('\n')}\n</decisions>`);
        }
      }
    }
  } catch { /* skip block on failure */ }

  // <intent> block: Objective from INTENT.md
  try {
    if (intent && intent.objective) {
      blocks.push(`<intent>\nObjective: ${intent.objective}\n</intent>`);
    }
  } catch { /* skip block on failure */ }

  // <session> block: Session continuity hint from STATE.md
  try {
    if (state && state.raw) {
      const sessionSection = state.getSection('Session Continuity');
      if (sessionSection) {
        const stoppedAt = sessionSection.match(/\*\*Stopped at:\*\*\s*(.+)/i);
        const nextStep = sessionSection.match(/\*\*Next step:\*\*\s*(.+)/i);
        const parts = [];
        if (stoppedAt) parts.push(`Stopped at: ${stoppedAt[1].trim()}`);
        if (nextStep) parts.push(`Next step: ${nextStep[1].trim()}`);
        if (parts.length > 0) {
          blocks.push(`<session>\n${parts.join('\n')}\n</session>`);
        }
      }
    }
  } catch { /* skip block on failure */ }

  if (blocks.length === 0) {
    return null;
  }

  return blocks.join('\n\n');
}
