/**
 * Tool barrel — exports all bGSD tools and handles registration.
 *
 * Single wiring point for all LLM-callable tools.
 * Each tool is defined in its own file in src/plugin/tools/.
 * This module imports them, registers via the tool registry, and
 * returns the assembled tool object for the plugin entry point.
 */

import { bgsd_status } from './bgsd-status.js';
import { bgsd_plan } from './bgsd-plan.js';
import { bgsd_context } from './bgsd-context.js';
import { bgsd_validate } from './bgsd-validate.js';
import { bgsd_progress } from './bgsd-progress.js';

/**
 * Register all tools and return the assembled tool object.
 *
 * @param {{ registerTool: Function, getTools: Function }} registry - Tool registry instance
 * @returns {object} Plain object of all registered tools
 */
export function getTools(registry) {
  registry.registerTool('status', bgsd_status);
  registry.registerTool('plan', bgsd_plan);
  registry.registerTool('context', bgsd_context);
  registry.registerTool('validate', bgsd_validate);
  registry.registerTool('progress', bgsd_progress);

  return registry.getTools();
}
