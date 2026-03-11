/**
 * ASCII Progress Bar Visualization
 * Provides progress bar rendering for tasks and phases
 */

const DEFAULT_WIDTH = 10;
const DEFAULT_FILLED = '█';
const DEFAULT_EMPTY = '░';

/**
 * Renders an ASCII progress bar
 * @param {number} current - Current progress value
 * @param {number} total - Total value
 * @param {object} options - Options for customization
 * @returns {string} ASCII progress bar string
 */
function renderProgressBar(current, total, options = {}) {
  const {
    filled = DEFAULT_FILLED,
    empty = DEFAULT_EMPTY,
    width = DEFAULT_WIDTH
  } = options;
  
  // Handle edge cases
  if (total === 0) {
    return `[${empty.repeat(width)}] 0%`;
  }
  
  const percentage = Math.min(100, Math.max(0, (current / total) * 100));
  const filledCount = Math.round((percentage / 100) * width);
  const emptyCount = width - filledCount;
  
  return `[${filled.repeat(filledCount)}${empty.repeat(emptyCount)}] ${percentage}%`;
}

/**
 * Renders task-specific progress
 * @param {number} completed - Number of completed tasks
 * @param {number} total - Total number of tasks
 * @returns {string} Task progress string
 */
function renderTaskProgress(completed, total) {
  // Calculate bar width to show 7 chars for visual balance
  const width = 7;
  const percentage = total > 0 ? (completed / total) * 100 : 0;
  const filledCount = Math.round((percentage / 100) * width);
  const emptyCount = width - filledCount;
  
  return `[${DEFAULT_FILLED.repeat(filledCount)}${DEFAULT_EMPTY.repeat(emptyCount)}] ${completed}/${total} tasks`;
}

/**
 * Renders phase-specific progress with percentage
 * @param {number} completed - Number of completed items
 * @param {number} total - Total number of items
 * @returns {string} Phase progress string
 */
function renderPhaseProgress(completed, total) {
  return renderProgressBar(completed, total);
}

module.exports = {
  renderProgressBar,
  renderTaskProgress,
  renderPhaseProgress
};
