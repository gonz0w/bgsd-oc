import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { getProjectState } from './project-state.js';
import { countTokens, TOKEN_BUDGET } from './token-budget.js';
import { writeDebugDiagnostic } from './debug-contract.js';

const MEMORY_FILE = join('.planning', 'MEMORY.md');
const MEMORY_SECTIONS = [
  'Active / Recent',
  'Project Facts',
  'User Preferences',
  'Environment Patterns',
  'Correction History',
];
const MEMORY_SECTION_DEFAULT_TYPE = {
  'Active / Recent': 'project-fact',
  'Project Facts': 'project-fact',
  'User Preferences': 'user-preference',
  'Environment Patterns': 'environment-pattern',
  'Correction History': 'correction',
};
const MEMORY_ENTRY_METADATA_ORDER = ['Added', 'Updated', 'Source', 'Keep', 'Status', 'Expires', 'Replaces'];
const MEMORY_BLOCK_PATTERNS = [
  {
    category: 'instruction-override',
    patterns: [
      /ignore\s+(all\s+)?previous\s+instructions?/i,
      /\byou\s+are\s+now\b/i,
      /\bnew\s+instructions?\b/i,
      /<system>|\[inst\]/i,
    ],
  },
  {
    category: 'exfiltration',
    patterns: [
      /reveal\s+(your\s+)?system\s+prompt/i,
      /show\s+(hidden|system)\s+instructions/i,
      /(print|output|dump)\s+(the\s+)?(env|environment|secret|secrets)/i,
      /prompt\s+leak/i,
    ],
  },
  {
    category: 'tool-bypass',
    patterns: [
      /always\s+use\s+bash/i,
      /force\s+tool\s+call/i,
      /(skip|bypass|disable).{0,24}(guardrails|confirmation|approval|approvals)/i,
      /(tool|command).{0,24}(bypass|override)/i,
    ],
  },
];

/**
 * Context builder for system prompt injection and compaction.
 * 
 * buildSystemPrompt: Compact <bgsd> tag for every LLM turn (~70 tokens).
 * buildCompactionContext: Structured XML blocks preserved across compaction (~500-1000 tokens).
 *
 * Both use cached ProjectState data — no file I/O in hot paths.
 */

// =============================================================================
// Trajectory Block Builder
// =============================================================================

/**
 * Build a trajectory block showing phase progression and plan completion history.
 * Target: ~100-200 tokens.
 * 
 * @param {Object} state - Project state
 * @param {Array} plans - Array of plan objects
 * @returns {string|null} Trajectory XML block, or null if no data
 */
function buildTrajectoryBlock(state, plans) {
  try {
    const parts = [];
    
    // Phase progression - completed phases from roadmap
    if (state && state.phase) {
      // Extract current phase number
      const phaseMatch = state.phase.match(/^(\d+)/);
      if (phaseMatch) {
        parts.push(`Current: Phase ${phaseMatch[1]}`);
      }
    }
    
    // Completed plans - find plans that were executed
    if (plans && plans.length > 0) {
      const completedPlans = [];
      const executedPlans = [];
      
      for (const plan of plans) {
        if (plan.executed || plan.completed) {
          completedPlans.push(plan.frontmatter?.plan || '?');
        }
        if (plan.executed) {
          executedPlans.push(plan.frontmatter?.plan || '?');
        }
      }
      
      if (completedPlans.length > 0) {
        parts.push(`Completed: ${completedPlans.join(', ')}`);
      }
      if (executedPlans.length > 0) {
        parts.push(`Executed: ${executedPlans.join(', ')}`);
      }
    }
    
    if (parts.length === 0) return null;
    
    return `<trajectory>\n${parts.join('\n')}\n</trajectory>`;
  } catch {
    return null;
  }
}

// =============================================================================
// Sacred Data Block Builder  
// =============================================================================

/**
 * Build a sacred data block with protected project information.
 * Includes: INTENT objectives, ROADMAP current phase, critical decisions.
 * Target: ~150-250 tokens.
 * 
 * @param {Object} intent - Intent object with objectives
 * @param {Object} roadmap - Roadmap object with current phase
 * @returns {string|null} Sacred XML block, or null if no data
 */
function buildSacredBlock(intent, roadmap) {
  try {
    const parts = [];
    
    // Intent objectives (DO-XX items)
    if (intent && intent.objective) {
      parts.push(`Objective: ${intent.objective}`);
    }
    
    // Additional intent items (key outcomes)
    if (intent && intent.items && intent.items.length > 0) {
      const keyItems = intent.items.slice(0, 3);  // Limit to 3 key items
      for (const item of keyItems) {
        if (item.id && item.id.startsWith('DO-')) {
          parts.push(`${item.id}: ${item.text || item.description || ''}`);
        }
      }
    }
    
    // Current milestone from roadmap
    if (roadmap && roadmap.currentMilestone) {
      const ms = roadmap.currentMilestone;
      parts.push(`Milestone: ${ms.version || ms.name || 'Current'}`);
      if (ms.status) {
        parts.push(`Status: ${ms.status}`);
      }
    }
    
    // Current phase from roadmap
    if (roadmap && roadmap.phases) {
      const currentPhase = roadmap.phases.find(p => p.status === 'current');
      if (currentPhase) {
        parts.push(`Phase: ${currentPhase.num}: ${currentPhase.name}`);
      }
    }
    
    if (parts.length === 0) return null;
    
    return `<sacred>\n${parts.join('\n')}\n</sacred>`;
  } catch {
    return null;
  }
}

function normalizeMemorySection(section) {
  if (!section) return null;
  const trimmed = String(section).trim().toLowerCase();
  return MEMORY_SECTIONS.find(name => name.toLowerCase() === trimmed) || null;
}

function normalizeMemoryType(type, section) {
  const trimmed = String(type || '').trim().toLowerCase();
  return trimmed || MEMORY_SECTION_DEFAULT_TYPE[section] || 'project-fact';
}

function canonicalMetadataKey(key) {
  if (!key) return null;
  const trimmed = String(key).trim().toLowerCase();
  return MEMORY_ENTRY_METADATA_ORDER.find(name => name.toLowerCase() === trimmed) || null;
}

function createEmptyStructuredMemory() {
  return {
    title: '# Agent Memory',
    sections: MEMORY_SECTIONS.map(name => ({ name, entries: [] })),
  };
}

function structuredMemoryToMap(doc) {
  const map = new Map();
  for (const section of doc.sections) {
    map.set(section.name, section);
  }
  return map;
}

function parseStructuredMemory(content) {
  const lines = String(content || '').replace(/\r\n/g, '\n').split('\n');
  const doc = createEmptyStructuredMemory();
  const sectionMap = structuredMemoryToMap(doc);
  let currentSection = null;
  let currentEntry = null;

  function finalizeEntry() {
    if (!currentSection || !currentEntry) return;
    currentSection.entries.push(currentEntry);
    currentEntry = null;
  }

  for (const line of lines) {
    const sectionMatch = line.match(/^##\s+(.+?)\s*$/);
    if (sectionMatch) {
      finalizeEntry();
      currentSection = sectionMap.get(normalizeMemorySection(sectionMatch[1]));
      continue;
    }

    if (!currentSection) continue;

    const entryMatch = line.match(/^\-\s+\*\*(MEM-\d+)\*\*(?:\s+\[([^\]]+)\])?\s+(.+?)\s*$/);
    if (entryMatch) {
      finalizeEntry();
      currentEntry = {
        id: entryMatch[1],
        type: normalizeMemoryType(entryMatch[2], currentSection.name),
        text: entryMatch[3].trim(),
        metadata: {},
      };
      continue;
    }

    const metadataMatch = line.match(/^\s{2,}-\s+([^:]+):\s*(.*?)\s*$/);
    if (metadataMatch && currentEntry) {
      const key = canonicalMetadataKey(metadataMatch[1]);
      if (key) currentEntry.metadata[key] = metadataMatch[2];
    }
  }

  finalizeEntry();
  return doc;
}

function normalizeMemoryForScan(raw) {
  let normalized = String(raw || '').normalize('NFKD');
  normalized = normalized.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '');
  normalized = normalized.replace(/[\u0300-\u036F]/g, '');
  return normalized.toLowerCase().replace(/\s+/g, ' ').trim();
}

function redactBlockedSnippet(value, max = 56) {
  const collapsed = String(value || '').replace(/\s+/g, ' ').trim();
  if (!collapsed) return '[redacted]';
  const preview = collapsed.slice(0, max);
  const visible = preview.slice(0, 18);
  const masked = preview.slice(18).replace(/[A-Za-z0-9]/g, '•');
  return `${visible}${masked}${collapsed.length > max ? '…' : ''}`;
}

function classifyBlockedMemoryEntry(rawText) {
  const normalizedText = normalizeMemoryForScan(rawText);
  for (const matcher of MEMORY_BLOCK_PATTERNS) {
    if (matcher.patterns.some(pattern => pattern.test(rawText) || pattern.test(normalizedText))) {
      return matcher.category;
    }
  }
  return null;
}

function summarizeBlockedEntries(blockedEntries) {
  const grouped = new Map();
  for (const entry of blockedEntries) {
    const existing = grouped.get(entry.category) || { category: entry.category, count: 0, snippet: entry.snippet };
    existing.count += 1;
    grouped.set(entry.category, existing);
  }
  return [...grouped.values()];
}

function renderMemorySnapshot(doc) {
  const lines = ['<bgsd-memory>'];
  for (const sectionName of MEMORY_SECTIONS) {
    const section = doc.sections.find(item => item.name === sectionName);
    if (!section || section.entries.length === 0) continue;
    lines.push(sectionName);
    for (const entry of section.entries) {
      lines.push(`- ${entry.id} [${entry.type}] ${entry.text}`);
    }
  }
  lines.push('</bgsd-memory>');
  return lines.length > 2 ? lines.join('\n') : '';
}

export function buildMemorySnapshot(cwd) {
  const memoryPath = join(cwd || process.cwd(), MEMORY_FILE);
  if (!existsSync(memoryPath)) {
    return {
      exists: false,
      text: '',
      blockedWarnings: [],
      budgetWarning: null,
    };
  }

  let doc;
  try {
    doc = parseStructuredMemory(readFileSync(memoryPath, 'utf-8'));
  } catch {
    return {
      exists: true,
      text: '',
      blockedWarnings: [{ category: 'parse-failure', count: 1, snippet: 'MEMORY.md could not be parsed' }],
      budgetWarning: null,
    };
  }

  const safeDoc = createEmptyStructuredMemory();
  const safeSectionMap = structuredMemoryToMap(safeDoc);
  const blockedEntries = [];

  for (const section of doc.sections) {
    const targetSection = safeSectionMap.get(section.name);
    for (const entry of section.entries) {
      const rawText = `${entry.id} ${entry.type} ${entry.text}`;
      const category = classifyBlockedMemoryEntry(rawText);
      if (category) {
        blockedEntries.push({
          category,
          snippet: redactBlockedSnippet(entry.text),
        });
        continue;
      }
      targetSection.entries.push(entry);
    }
  }

  const text = renderMemorySnapshot(safeDoc);
  const tokenCount = countTokens(text);
  const budgetWarning = text && tokenCount > Math.floor(TOKEN_BUDGET * 0.5)
    ? `MEMORY.md snapshot is using ~${tokenCount} tokens; consider pruning if prompt space feels tight.`
    : null;

  return {
    exists: true,
    text,
    blockedWarnings: summarizeBlockedEntries(blockedEntries),
    budgetWarning,
  };
}

/**
 * Build the system prompt injection string.
 * Returns a compact <bgsd> tag with current project state.
 *
 * @param {string} [cwd] - Working directory (defaults to process.cwd())
 * @returns {string} System prompt injection string
 */
export function buildSystemPrompt(cwd, options = {}) {
  let projectState;
  try {
    projectState = getProjectState(cwd);
  } catch {
    return '<bgsd>Failed to load project state. Run /bgsd-inspect health to diagnose.</bgsd>';
  }

  // No .planning/ directory — inject minimal hint
  if (!projectState) {
    return '<bgsd>No active project. Run /bgsd-new-project to start.</bgsd>';
  }

  const { state, roadmap, currentPhase, currentMilestone, plans } = projectState;

  // If state parsing partially succeeded but is missing critical data
  if (!state || !state.phase) {
    return '<bgsd>Failed to load project state. Run /bgsd-inspect health to diagnose.</bgsd>';
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

  const memorySnapshot = options && typeof options === 'object' ? options.memorySnapshot || '' : '';
  const prompt = `<bgsd>\nPhase ${phaseNum}: ${phaseName}${planInfo}${milestoneInfo}${goalLine}${blockerLine}\n</bgsd>${memorySnapshot ? `\n${memorySnapshot}` : ''}`;

  // Token budget check — warn but don't block
  const tokenCount = countTokens(prompt);
  if (tokenCount > TOKEN_BUDGET) {
    writeDebugDiagnostic('[bGSD:context-budget]', `System prompt injection exceeds budget: ${tokenCount} tokens (budget: ${TOKEN_BUDGET})`);
  }

  return prompt;
}

/**
 * Build enhanced compaction context with structured XML blocks.
 * Preserves full project awareness across context window resets.
 *
 * Blocks (per CONTEXT.md):
 * - <sacred>: Critical project data (intent, roadmap, key decisions) - FIRST
 * - <project>: Core value + tech stack (1 line each from PROJECT.md)
 * - <task-state>: Phase, plan, current task name + files
 * - <decisions>: Last 3 decisions from STATE.md
 * - <intent>: Objective from INTENT.md
 * - <session>: Session continuity hint (stopped_at, next_step)
 * - <trajectory>: Phase progression and plan completion history
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
    return '<project-error>Failed to load project state for compaction. Run /bgsd-inspect health to diagnose.</project-error>';
  }

  // No .planning/ → inject nothing (per CONTEXT.md decision)
  if (!projectState) {
    return null;
  }

  const { state, project, intent, plans, currentPhase, roadmap } = projectState;
  const blocks = [];

  // <sacred> block: Critical project data (MOST IMPORTANT - first)
  // Includes: INTENT objectives, ROADMAP current phase, critical decisions
  try {
    const sacredBlock = buildSacredBlock(intent, roadmap);
    if (sacredBlock) {
      blocks.push(sacredBlock);
    }
  } catch { /* skip block on failure */ }

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

  // <trajectory> block: Phase progression and plan completion history
  try {
    const trajectoryBlock = buildTrajectoryBlock(state, plans);
    if (trajectoryBlock) {
      blocks.push(trajectoryBlock);
    }
  } catch { /* skip block on failure */ }

  if (blocks.length === 0) {
    return null;
  }

  return blocks.join('\n\n');
}
