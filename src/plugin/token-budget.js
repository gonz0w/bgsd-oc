/**
 * Token budget enforcement for system prompt injection.
 * Uses a simple chars/4 estimator — tokenx is bundled in bgsd-tools.cjs
 * but not in the plugin ESM bundle. The chars/4 heuristic is sufficient
 * for budget enforcement since we're comparing against a generous 500-token limit.
 *
 * Self-contained — no imports from src/lib/ or external packages.
 */

/** Maximum token budget for system prompt injection */
export const TOKEN_BUDGET = 500;

/**
 * Estimate token count for a text string.
 * Uses chars/4 heuristic (~75% accuracy, sufficient for budget checks).
 *
 * @param {string} text - Text to count tokens for
 * @returns {number} Estimated token count
 */
export function countTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Check if text is within the token budget.
 *
 * @param {string} text - Text to check
 * @returns {boolean} True if within budget
 */
export function isWithinBudget(text) {
  return countTokens(text) <= TOKEN_BUDGET;
}
