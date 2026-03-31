/**
 * Tool naming registry for bGSD plugin.
 *
 * Enforces bgsd_ prefix convention and snake_case naming for custom tools.
 * Tool handlers are wrapped in safeHook for universal error boundary protection.
 *
 * Registry is internal only — no public has/get/list API.
 * Registration is permanent for the session — no unregistration.
 */

import { writeDebugDiagnostic } from './debug-contract.js';

// Validation pattern: bgsd_ prefix followed by lowercase letter, then lowercase alphanumeric + underscores
const TOOL_NAME_PATTERN = /^bgsd_[a-z][a-z0-9_]*$/;
const BGSD_PREFIX = 'bgsd_';

/**
 * Create a tool registry instance.
 *
 * @param {Function} safeHookFn - Reference to safeHook for wrapping tool handlers
 * @returns {{ registerTool: Function, getTools: Function }}
 */
export function createToolRegistry(safeHookFn) {
  const registry = new Map();

  /**
   * Register a tool with name validation, prefix enforcement, and error boundary wrapping.
   *
   * @param {string} name - Tool name (auto-prefixed with bgsd_ if missing)
   * @param {{ description?: string, args?: object, execute: Function }} definition - Tool definition
   * @returns {string} Normalized tool name (with bgsd_ prefix)
   * @throws {Error} If name doesn't match snake_case pattern after normalization
   */
  function registerTool(name, definition) {
    // Auto-prefix if missing
    let normalized = name;
    if (!normalized.startsWith(BGSD_PREFIX)) {
      normalized = BGSD_PREFIX + normalized;
    }

    // Enforce snake_case
    if (!TOOL_NAME_PATTERN.test(normalized)) {
      throw new Error(`Tool name must be snake_case: ${normalized}`);
    }

    // Duplicate detection
    if (registry.has(normalized)) {
      writeDebugDiagnostic('[bGSD:tool-registry]', `Tool '${normalized}' already registered — overwriting`);
    }

    // Wrap handler in safeHook
    const wrappedDefinition = { ...definition };
    if (typeof wrappedDefinition.execute === 'function') {
      wrappedDefinition.execute = safeHookFn('tool:' + normalized, wrappedDefinition.execute);
    }

    // Store in registry
    registry.set(normalized, {
      name: normalized,
      ...wrappedDefinition,
    });

    return normalized;
  }

  /**
   * Get all registered tools as a plain object.
   * Used by plugin entry point to populate the tool return key.
   *
   * @returns {object} Map of tool names to their full definitions
   */
  function getTools() {
    const tools = {};
    for (const [name, def] of registry) {
      tools[name] = def;
    }
    return tools;
  }

  return { registerTool, getTools };
}
