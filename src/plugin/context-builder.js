import { getProjectState } from './project-state.js';
import { countTokens, TOKEN_BUDGET } from './token-budget.js';

/**
 * Context builder for system prompt injection.
 * Composes a compact project state string from cached ProjectState data.
 *
 * Format (per CONTEXT.md decision):
 * <bgsd>
 * Phase N: Name | Plan: PNN (X/Y tasks) | vX.X N/M phases
 * Goal: phase goal sentence
 * Blocker: text (only if present)
 * </bgsd>
 *
 * Target: under 500 tokens. Warns if exceeded but doesn't block.
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
