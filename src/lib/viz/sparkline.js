/**
 * ASCII Sparkline Visualization
 * Provides compact velocity sparkline rendering for session trends
 */

// Unicode block characters for sparkline bars
const UNICODE_BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
const ASCII_BLOCKS = ['_', '-', '=', '+', '#'];

/**
 * Calculate velocity trend from session history
 * @param {Array} sessionHistory - Array of {tasksCompleted, duration} objects
 * @returns {Array} Normalized values (0-1 scale) for sparkline
 */
function calculateVelocityTrend(sessionHistory) {
  if (!sessionHistory || sessionHistory.length === 0) {
    return [];
  }

  // Calculate velocity (tasks per hour) for each session
  const velocities = sessionHistory.map(session => {
    if (!session.duration || session.duration === 0) return 0;
    return session.tasksCompleted / (session.duration / 60); // tasks per hour
  });

  // Normalize to 0-1 range
  const maxVel = Math.max(...velocities, 1);
  const minVel = Math.min(...velocities);
  const range = maxVel - minVel || 1;

  return velocities.map(v => (v - minVel) / range);
}

/**
 * Render inline sparkline
 * @param {Array} data - Normalized data (0-1 values)
 * @param {object} options - Rendering options
 * @param {number} options.width - Number of bars (default 10)
 * @param {boolean} options.showValues - Show numeric values (default false)
 * @param {Array} options.chars - Custom characters
 * @returns {string} Sparkline string
 */
function renderSparkline(data, options = {}) {
  const { width = 10, showValues = false, chars = null } = options;

  if (!data || data.length === 0) {
    return showValues ? '∅' : '∅';
  }

  // Use custom chars or defaults
  const blocks = chars || UNICODE_BLOCKS;

  // Resample data to fit width
  const resampled = resampleData(data, Math.min(width, 15));

  // Map values to block characters
  const bars = resampled.map(val => {
    const idx = Math.min(Math.floor(val * blocks.length), blocks.length - 1);
    return blocks[idx];
  });

  let result = bars.join('');

  // Add value in expanded mode
  if (showValues && data.length > 0) {
    // Calculate average velocity
    const avgVel = data.reduce((a, b) => a + b, 0) / data.length;
    const avgPercent = Math.round(avgVel * 100);
    result += ` ${avgPercent}%`;
  }

  return result;
}

/**
 * Resample data to target width
 * @param {Array} data - Original data
 * @param {number} targetWidth - Target width
 * @returns {Array} Resampled data
 */
function resampleData(data, targetWidth) {
  if (data.length === targetWidth) return data;
  if (data.length < targetWidth) {
    // Upsample: repeat values
    const result = [];
    const factor = targetWidth / data.length;
    for (let i = 0; i < targetWidth; i++) {
      const srcIdx = Math.floor(i / factor);
      result.push(data[Math.min(srcIdx, data.length - 1)]);
    }
    return result;
  } else {
    // Downsample: average
    const result = [];
    const factor = data.length / targetWidth;
    for (let i = 0; i < targetWidth; i++) {
      const start = Math.floor(i * factor);
      const end = Math.floor((i + 1) * factor);
      const slice = data.slice(start, end);
      const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
      result.push(avg);
    }
    return result;
  }
}

/**
 * Render expanded sparkline with detailed information
 * @param {Array} data - Normalized data
 * @param {object} options - Options
 * @returns {string} Detailed sparkline
 */
function renderExpandedSparkline(data, options = {}) {
  const { showTrend = true } = options;

  const inline = renderSparkline(data, { width: Math.min(data.length, 15) });

  if (!showTrend) {
    return inline;
  }

  // Calculate trend direction
  if (data.length < 2) {
    return inline + ' (stable)';
  }

  const first = data.slice(0, Math.ceil(data.length / 2));
  const second = data.slice(Math.ceil(data.length / 2));

  const firstAvg = first.reduce((a, b) => a + b, 0) / first.length;
  const secondAvg = second.reduce((a, b) => a + b, 0) / second.length;

  const diff = secondAvg - firstAvg;
  let trend = 'stable';
  if (diff > 0.15) trend = '↑ improving';
  else if (diff < -0.15) trend = '↓ declining';

  return inline + ' (' + trend + ')';
}

module.exports = {
  calculateVelocityTrend,
  renderSparkline,
  renderExpandedSparkline
};
