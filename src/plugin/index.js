import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { safeHook } from './safe-hook.js';

/**
 * bGSD (Get Stuff Done) — Plugin Entry Point
 *
 * Provides session lifecycle integration for the bGSD planning system:
 * - Session greeting with plugin availability notice
 * - GSD_HOME environment variable injection for workflow resolution
 * - State preservation across session compaction
 *
 * All hooks are wrapped in safeHook for universal error boundary protection:
 * retry, timeout, circuit breaker, correlation-ID logging.
 *
 * Hook signature: (input, output) => Promise<void>
 * Source uses ESM imports — esbuild produces clean ESM output.
 */
export const BgsdPlugin = async ({ directory }) => {
  const gsdHome = join(homedir(), '.config', 'opencode', 'get-shit-done');

  const sessionCreated = safeHook('session.created', async (input, output) => {
    console.log('[bGSD] Planning plugin available. Use /bgsd-help to get started.');
  });

  const shellEnv = safeHook('shell.env', async (input, output) => {
    if (!output || !output.env) return;
    output.env.GSD_HOME = gsdHome;
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

  return {
    'session.created': sessionCreated,
    'shell.env': shellEnv,
    'experimental.session.compacting': compacting,
  };
};
