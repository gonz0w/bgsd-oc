import { join } from 'path';
import { homedir } from 'os';
import { safeHook } from './safe-hook.js';
import { createToolRegistry } from './tool-registry.js';
import { buildSystemPrompt, buildCompactionContext } from './context-builder.js';
import { enrichCommand } from './command-enricher.js';
import { getTools } from './tools/index.js';

// Re-export parsers, tool registry, and safeHook for external consumption
export { parseState, invalidateState } from './parsers/state.js';
export { parseRoadmap, invalidateRoadmap } from './parsers/roadmap.js';
export { parsePlan, parsePlans, invalidatePlans } from './parsers/plan.js';
export { parseConfig, invalidateConfig } from './parsers/config.js';
export { parseProject, invalidateProject } from './parsers/project.js';
export { parseIntent, invalidateIntent } from './parsers/intent.js';
export { invalidateAll } from './parsers/index.js';
export { getProjectState } from './project-state.js';
export { buildSystemPrompt, buildCompactionContext } from './context-builder.js';
export { enrichCommand } from './command-enricher.js';
export { createToolRegistry } from './tool-registry.js';
export { safeHook } from './safe-hook.js';

/**
 * bGSD (Get Stuff Done) — Plugin Entry Point
 *
 * Provides session lifecycle integration for the bGSD planning system:
 * - Session greeting with plugin availability notice
 * - BGSD_HOME environment variable injection for workflow resolution
 * - System prompt injection with current project state (Phase 73 P01)
 * - Enhanced compaction with structured XML context preservation (Phase 73 P02)
 * - Command enrichment: auto-injects init-equivalent context for /bgsd-* commands (Phase 73 P02)
 * - In-process parsers for STATE.md, ROADMAP.md, PLAN.md, config.json, PROJECT.md, INTENT.md
 * - Unified ProjectState facade for cached data access
 * - Tool registry with bgsd_ prefix enforcement
 *
 * Hooks registered (5 total):
 * 1. session.created — greeting
 * 2. shell.env — BGSD_HOME injection
 * 3. experimental.chat.system.transform — compact system prompt
 * 4. experimental.session.compacting — structured XML context preservation
 * 5. command.execute.before — slash command enrichment
 *
 * All hooks are wrapped in safeHook for universal error boundary protection:
 * retry, timeout, circuit breaker, correlation-ID logging.
 *
 * Hook signature: (input, output) => Promise<void>
 * Source uses ESM imports — esbuild produces clean ESM output.
 */
export const BgsdPlugin = async ({ directory }) => {
  const bgsdHome = join(homedir(), '.config', 'opencode', 'bgsd-oc');

  // Initialize tool registry — Phase 74 will add custom tools
  const registry = createToolRegistry(safeHook);

  const sessionCreated = safeHook('session.created', async (input, output) => {
    console.log('[bGSD] Planning plugin available. Use /bgsd-help to get started.');
  });

  const shellEnv = safeHook('shell.env', async (input, output) => {
    if (!output || !output.env) return;
    output.env.BGSD_HOME = bgsdHome;
  });

  // Enhanced compaction: structured XML blocks preserving project, task, decisions, intent, session
  // Replaces Phase 71's raw STATE.md dump with rich context per CONTEXT.md decisions
  const compacting = safeHook('compacting', async (input, output) => {
    const projectDir = directory || process.cwd();
    const ctx = buildCompactionContext(projectDir);
    if (ctx && output && output.context) {
      output.context.push(ctx);
    }
  });

  const systemTransform = safeHook('system.transform', async (input, output) => {
    const projectDir = directory || process.cwd();
    const prompt = buildSystemPrompt(projectDir);
    if (prompt && output && output.system) {
      output.system.push(prompt);
    }
  });

  // Command enrichment: auto-inject init-equivalent context for all /bgsd-* commands
  // Prepends <bgsd-context> JSON block to output.parts before workflow execution
  const commandEnrich = safeHook('command.enrich', async (input, output) => {
    const projectDir = directory || process.cwd();
    enrichCommand(input, output, projectDir);
  });

  return {
    'session.created': sessionCreated,
    'shell.env': shellEnv,
    'experimental.session.compacting': compacting,
    'experimental.chat.system.transform': systemTransform,
    'command.execute.before': commandEnrich,
    tool: getTools(registry),
  };
};
