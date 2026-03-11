/**
 * Milestone Progress Visualization
 * Provides milestone progress indicators and summaries
 */

const { renderProgressBar } = require('./progress');

/**
 * Calculates milestone completion percentage
 * @param {number} completedPhases - Number of completed phases
 * @param {number} totalPhases - Total number of phases
 * @returns {number} Percentage (0-100)
 */
function calculateMilestonePercentage(completedPhases, totalPhases) {
  if (totalPhases === 0) return 0;
  return Math.min(100, Math.round((completedPhases / totalPhases) * 100));
}

/**
 * Renders milestone progress with visual bar
 * @param {number} percentage - Completion percentage (0-100)
 * @param {string} label - Milestone label (e.g., "v11.0")
 * @returns {string} Formatted milestone progress string
 */
function renderMilestoneProgress(percentage, label) {
  const bar = renderProgressBar(percentage, 100, { width: 20 });
  return `Milestone ${label}: ${percentage}% complete ${bar}`;
}

/**
 * Renders milestone summary with phases count
 * @param {string} name - Milestone name (e.g., "v11.0")
 * @param {number} completed - Number of completed phases
 * @param {number} total - Total number of phases
 * @returns {string} Formatted milestone summary
 */
function renderMilestoneSummary(name, completed, total) {
  const percentage = calculateMilestonePercentage(completed, total);
  return `Milestone ${name}: ${completed}/${total} phases complete (${percentage}%)`;
}

module.exports = {
  calculateMilestonePercentage,
  renderMilestoneProgress,
  renderMilestoneSummary
};
