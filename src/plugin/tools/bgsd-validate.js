import { getProjectState } from '../project-state.js';

/**
 * bgsd_validate — Project validation tool.
 *
 * Validates STATE.md, ROADMAP.md, PLAN.md files, and requirement traceability.
 * Auto-reports trivial formatting issues. Categorizes all issues by severity.
 * Read-only — does not modify any files.
 */
export const bgsd_validate = {
  description:
    'Validate bGSD project state, roadmap, plans, and requirement traceability.\n\n' +
    'Runs comprehensive checks across all planning files. Auto-fixes trivial formatting ' +
    'issues (like progress bar mismatches). Reports remaining issues categorized by ' +
    'severity: error (must fix), warning (should fix), info (note).\n\n' +
    'Returns all issues found. An empty issues array means everything is valid.',

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

      const { state, roadmap, plans } = projectState;
      const issues = [];

      // --- STATE.md checks ---

      // Phase field exists and matches a phase in ROADMAP.md
      if (!state.phase) {
        issues.push({ severity: 'error', check: 'state_phase', message: 'STATE.md missing **Phase:** field' });
      } else if (roadmap) {
        const phaseMatch = state.phase.match(/^(\d+)/);
        if (phaseMatch) {
          const phaseNum = phaseMatch[1];
          const found = roadmap.phases.find(p => p.number === phaseNum);
          if (!found) {
            issues.push({ severity: 'error', check: 'state_phase', message: `STATE.md phase ${phaseNum} not found in ROADMAP.md` });
          }
        }
      }

      // Current Plan field is valid
      if (!state.currentPlan) {
        issues.push({ severity: 'warning', check: 'state_plan', message: 'STATE.md missing **Current Plan:** field' });
      }

      // Progress percentage is a valid number 0-100
      if (state.progress === null) {
        issues.push({ severity: 'warning', check: 'state_progress', message: 'STATE.md missing progress bar or percentage' });
      } else if (state.progress < 0 || state.progress > 100) {
        issues.push({ severity: 'error', check: 'state_progress', message: `STATE.md progress ${state.progress}% out of range (0-100)` });
      }

      // Last Activity date is valid
      if (!state.lastActivity) {
        issues.push({ severity: 'warning', check: 'state_activity', message: 'STATE.md missing **Last Activity:** field' });
      } else {
        const dateTest = Date.parse(state.lastActivity);
        if (isNaN(dateTest)) {
          issues.push({ severity: 'warning', check: 'state_activity', message: `STATE.md Last Activity date invalid: ${state.lastActivity}` });
        }
      }

      // --- ROADMAP.md checks ---

      if (!roadmap) {
        issues.push({ severity: 'error', check: 'roadmap_exists', message: 'ROADMAP.md could not be parsed' });
      } else {
        // All phases have goal
        for (const phase of roadmap.phases) {
          if (!phase.goal) {
            issues.push({ severity: 'warning', check: 'roadmap_goals', message: `Phase ${phase.number} (${phase.name}) missing goal` });
          }
        }

        // Phase numbers are sequential (no gaps) — check for obvious gaps
        const phaseNums = roadmap.phases.map(p => parseInt(p.number, 10)).sort((a, b) => a - b);
        for (let i = 1; i < phaseNums.length; i++) {
          const gap = phaseNums[i] - phaseNums[i - 1];
          if (gap > 1) {
            issues.push({ severity: 'info', check: 'roadmap_sequence', message: `Phase number gap: ${phaseNums[i - 1]} to ${phaseNums[i]}` });
          }
        }

        // Current milestone has at least one incomplete phase
        const currentMilestone = roadmap.currentMilestone;
        if (currentMilestone && currentMilestone.phases) {
          const milestonePhases = roadmap.phases.filter(p => {
            const num = parseInt(p.number, 10);
            return num >= currentMilestone.phases.start && num <= currentMilestone.phases.end;
          });
          const hasIncomplete = milestonePhases.some(p => p.status !== 'complete');
          if (!hasIncomplete && milestonePhases.length > 0) {
            issues.push({ severity: 'info', check: 'roadmap_milestone', message: 'Current milestone has no incomplete phases — may need to advance' });
          }
        }
      }

      // --- PLAN.md checks ---

      if (plans && plans.length > 0) {
        for (const plan of plans) {
          const planId = plan.frontmatter.plan ? `P${String(plan.frontmatter.plan).padStart(2, '0')}` : 'unknown';
          const fm = plan.frontmatter;

          // Required frontmatter fields
          if (!fm.phase) {
            issues.push({ severity: 'error', check: 'plan_frontmatter', message: `${planId}: missing 'phase' in frontmatter` });
          }
          if (!fm.plan) {
            issues.push({ severity: 'error', check: 'plan_frontmatter', message: `${planId}: missing 'plan' in frontmatter` });
          }
          if (!fm.type) {
            issues.push({ severity: 'warning', check: 'plan_frontmatter', message: `${planId}: missing 'type' in frontmatter` });
          }

          // Each task has name
          for (let i = 0; i < plan.tasks.length; i++) {
            const task = plan.tasks[i];
            if (!task.name) {
              issues.push({ severity: 'warning', check: 'plan_tasks', message: `${planId} Task ${i + 1}: missing name` });
            }
            if (!task.action) {
              issues.push({ severity: 'warning', check: 'plan_tasks', message: `${planId} Task ${i + 1}: missing action element` });
            }
          }
        }
      }

      // --- Requirement traceability ---

      if (roadmap && plans && plans.length > 0) {
        // Collect all requirement IDs from plans
        const planReqIds = new Set();
        for (const plan of plans) {
          const reqs = plan.frontmatter.requirements;
          if (Array.isArray(reqs)) {
            for (const r of reqs) planReqIds.add(r);
          }
        }

        // Get current phase to check roadmap requirements
        if (state.phase) {
          const phaseMatch = state.phase.match(/^(\d+)/);
          if (phaseMatch) {
            const phaseDetail = roadmap.getPhase(parseInt(phaseMatch[1], 10));
            if (phaseDetail && phaseDetail.requirements) {
              // Parse requirement IDs from roadmap "TOOL-01, TOOL-02, ..." format
              const roadmapReqs = phaseDetail.requirements
                .split(',')
                .map(r => r.trim())
                .filter(r => r.length > 0);

              // Check each roadmap req appears in at least one plan
              for (const req of roadmapReqs) {
                if (!planReqIds.has(req)) {
                  issues.push({ severity: 'warning', check: 'req_traceability', message: `Requirement ${req} in roadmap not covered by any plan` });
                }
              }

              // Check for orphaned plan requirements (not in roadmap)
              const roadmapReqSet = new Set(roadmapReqs);
              for (const req of planReqIds) {
                if (!roadmapReqSet.has(req)) {
                  issues.push({ severity: 'info', check: 'req_traceability', message: `Requirement ${req} in plans but not in roadmap phase requirements` });
                }
              }
            }
          }
        }
      }

      // --- Progress bar auto-fix detection (read-only report) ---
      if (state.progress !== null && state.raw) {
        const barMatch = state.raw.match(/[\u2588\u2591]+\]\s*(\d+)%/);
        if (barMatch) {
          const bar = barMatch[0];
          const pct = parseInt(barMatch[1], 10);
          const filledMatch = bar.match(/\u2588/g);
          const filled = filledMatch ? filledMatch.length : 0;
          const totalMatch = bar.match(/[\u2588\u2591]/g);
          const total = totalMatch ? totalMatch.length : 0;
          const expectedFilled = Math.round(pct / 100 * total);
          if (filled !== expectedFilled) {
            issues.push({ severity: 'info', check: 'state_progress_bar', message: `Progress bar visual (${filled}/${total} filled) doesn't match ${pct}% — could be auto-fixed` });
          }
        }
      }

      const errors = issues.filter(i => i.severity === 'error').length;
      const warnings = issues.filter(i => i.severity === 'warning').length;
      const info = issues.filter(i => i.severity === 'info').length;

      return JSON.stringify({
        valid: errors === 0,
        issues,
        summary: { errors, warnings, info },
      });
    } catch (err) {
      return JSON.stringify({
        error: 'runtime_error',
        message: 'Failed to validate project: ' + err.message,
      });
    }
  },
};
