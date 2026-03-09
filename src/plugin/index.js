import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { safeHook } from './safe-hook.js';
import { createToolRegistry } from './tool-registry.js';
import { buildSystemPrompt } from './context-builder.js';

// Re-export parsers, tool registry, and safeHook for external consumption
export { parseState, invalidateState } from './parsers/state.js';
export { parseRoadmap, invalidateRoadmap } from './parsers/roadmap.js';
export { parsePlan, parsePlans, invalidatePlans } from './parsers/plan.js';
export { parseConfig, invalidateConfig } from './parsers/config.js';
export { parseProject, invalidateProject } from './parsers/project.js';
export { parseIntent, invalidateIntent } from './parsers/intent.js';
export { invalidateAll } from './parsers/index.js';
export { getProjectState } from './project-state.js';
export { buildSystemPrompt } from './context-builder.js';
export { createToolRegistry } from './tool-registry.js';
export { safeHook } from './safe-hook.js';

/**
 * bGSD (Get Stuff Done) — Plugin Entry Point
 *
 * Provides session lifecycle integration for the bGSD planning system:
 * - Session greeting with plugin availability notice
 * - BGSD_HOME environment variable injection for workflow resolution
 * - System prompt injection with current project state (Phase 73)
 * - State preservation across session compaction
 * - In-process parsers for STATE.md, ROADMAP.md, PLAN.md, config.json, PROJECT.md, INTENT.md
 * - Unified ProjectState facade for cached data access
 * - Tool registry with bgsd_ prefix enforcement
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

  const compacting = safeHook('compacting', async (input, output) => {
    const projectDir = directory || input?.cwd;
    const statePath = join(projectDir, '.planning', 'STATE.md');
    const stateContent = readFileSync(statePath, 'utf-8');
    if (output && output.context) {
      output.context.push(
        `## bGSD Project State (preserved across compaction)\n${stateContent}`
      );
    }
  });

  const systemTransform = safeHook('system.transform', async (input, output) => {
    const projectDir = directory || process.cwd();
    const prompt = buildSystemPrompt(projectDir);
    if (prompt && output && output.system) {
      output.system.push(prompt);
    }
  });

  return {
    'session.created': sessionCreated,
    'shell.env': shellEnv,
    'experimental.session.compacting': compacting,
    'experimental.chat.system.transform': systemTransform,
    // tool: registry.getTools(),  // Uncomment in Phase 74 when tools exist
  };
};
