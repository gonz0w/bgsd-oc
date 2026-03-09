/**
 * Tool barrel — exports all bGSD tools and handles registration.
 *
 * Single wiring point for all LLM-callable tools.
 * Each tool is defined in its own file in src/plugin/tools/.
 * This module imports them, registers via the tool registry, and
 * returns the assembled tool object for the plugin entry point.
 */

import { bgsd_status } from './bgsd-status.js';

/**
 * Register all tools and return the assembled tool object.
 *
 * @param {{ registerTool: Function, getTools: Function }} registry - Tool registry instance
 * @returns {object} Plain object of all registered tools
 */
export function getTools(registry) {
  registry.registerTool('status', bgsd_status);

  return registry.getTools();
}
