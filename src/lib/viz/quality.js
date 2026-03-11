/**
 * Quality Score Visualization
 * Provides quality grade and score display
 */

const DEFAULT_FILLED = '█';

/**
 * Returns letter grade based on score
 * @param {number} score - Quality score (0-100)
 * @returns {string} Letter grade (A, B, C, D, or F)
 */
function getQualityGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Renders quality bar based on grade
 * @param {string} grade - Letter grade (A, B, C, D, F)
 * @returns {string} Quality bar string
 */
function renderQualityBar(grade) {
  // Bar length by grade: A=8, B=7, C=5, D=3, F=1
  const barLengths = {
    'A': 8,
    'B': 7,
    'C': 5,
    'D': 3,
    'F': 1
  };
  
  const length = barLengths[grade] || 1;
  return DEFAULT_FILLED.repeat(length);
}

/**
 * Renders complete quality score with grade, bar, and percentage
 * @param {number} score - Quality score (0-100)
 * @returns {string} Formatted quality score string
 */
function renderQualityScore(score) {
  const grade = getQualityGrade(score);
  const bar = renderQualityBar(grade);
  return `Quality: ${grade} ${bar} (${score}%)`;
}

module.exports = {
  getQualityGrade,
  renderQualityBar,
  renderQualityScore
};
