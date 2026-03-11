/**
 * ASCII Burndown Chart Visualization
 * Provides burndown chart rendering for milestone progress tracking
 */

// Unicode box-drawing characters
const CHARS = {
  // Unicode (default)
  ul: '┌', ur: '┐', ll: '└', lr: '┘',
  h: '─', v: '│',
  // ASCII fallback
  ul_ascii: '+', ur_ascii: '+', ll_ascii: '+', lr_ascii: '+',
  h_ascii: '-', v_ascii: '|'
};

/**
 * Check if Unicode is supported
 */
function hasUnicodeSupport() {
  try {
    return process.stdout.columns >= 80;
  } catch {
    return false;
  }
}

/**
 * Calculate burndown data from milestone phases
 * @param {object} milestoneData - Milestone data
 * @param {number} milestoneData.totalTasks - Total tasks in milestone
 * @param {number} milestoneData.completedTasks - Completed tasks
 * @param {number} milestoneData.totalDays - Total days in milestone
 * @param {number} milestoneData.daysElapsed - Days elapsed so far
 * @param {Array} milestoneData.phases - Array of {completed, total} per phase
 * @returns {object} Burndown data with ideal and actual lines
 */
function calculateBurndownData(milestoneData) {
  const { totalTasks, completedTasks, totalDays, daysElapsed, phases = [] } = milestoneData;
  
  // Calculate ideal burndown line (straight line from total to 0)
  const ideal = [];
  const dailyBurn = totalTasks / totalDays;
  
  for (let day = 0; day <= totalDays; day++) {
    const remaining = Math.max(0, totalTasks - (dailyBurn * day));
    ideal.push({ day, remaining: Math.round(remaining * 10) / 10 });
  }
  
  // Calculate actual burndown from phase completion
  const actual = [];
  let runningTotal = totalTasks;
  
  // Start point
  actual.push({ day: 0, remaining: totalTasks });
  
  if (phases.length > 0) {
    // Interpolate actual progress through phases
    const daysPerPhase = totalDays / phases.length;
    
    phases.forEach((phase, idx) => {
      const day = Math.round((idx + 1) * daysPerPhase);
      const completed = phase.completed || 0;
      runningTotal = Math.max(0, totalTasks - completed);
      actual.push({ day, remaining: runningTotal });
    });
  } else if (daysElapsed > 0) {
    // Fallback: use simple completion rate
    const dailyActual = completedTasks / daysElapsed;
    for (let day = 1; day <= Math.min(daysElapsed, totalDays); day++) {
      const remaining = Math.max(0, totalTasks - (dailyActual * day));
      actual.push({ day, remaining: Math.round(remaining * 10) / 10 });
    }
  }
  
  // Ensure we have data points for all days up to current
  if (daysElapsed > 0 && actual.length <= daysElapsed) {
    const lastActual = actual[actual.length - 1];
    for (let day = lastActual.day + 1; day <= daysElapsed; day++) {
      actual.push({ day, remaining: lastActual.remaining });
    }
  }
  
  return {
    ideal,
    actual,
    remainingDays: Math.max(0, totalDays - daysElapsed),
    totalTasks,
    completedTasks,
    daysElapsed,
    totalDays
  };
}

/**
 * Render ASCII burndown chart
 * @param {object} burndownData - Data from calculateBurndownData
 * @param {object} options - Chart options
 * @param {number} options.width - Chart width (default 50)
 * @param {number} options.height - Chart height (default 15)
 * @param {boolean} options.showLegend - Show legend (default true)
 * @returns {string} ASCII chart string
 */
function renderBurndownChart(burndownData, options = {}) {
  const { width = 50, height = 15, showLegend = true } = options;
  const { ideal, actual, totalTasks, daysElapsed, totalDays } = burndownData;
  
  const useUnicode = hasUnicodeSupport();
  const box = useUnicode ? {
    ul: CHARS.ul, ur: CHARS.ur, ll: CHARS.ll, lr: CHARS.lr,
    h: CHARS.h, v: CHARS.v
  } : {
    ul: CHARS.ul_ascii, ur: CHARS.ur_ascii, ll: CHARS.ll_ascii, lr: CHARS.lr_ascii,
    h: CHARS.h_ascii, v: CHARS.v_ascii
  };
  
  // Build Y-axis labels
  const maxVal = Math.max(totalTasks, ...ideal.map(d => d.remaining), ...actual.map(d => d.remaining));
  const yLabels = [];
  for (let i = 0; i <= height; i++) {
    const val = Math.round((maxVal / height) * (height - i));
    yLabels.push(val.toString().padStart(3));
  }
  
  // Map data to grid
  const grid = Array(height).fill(null).map(() => Array(width).fill(' '));
  
  // Scale functions
  const xScale = (day) => Math.round((day / totalDays) * (width - 1));
  const yScale = (val) => Math.round((val / maxVal) * (height - 1));
  
  // Plot ideal line (dashed)
  for (let i = 0; i < ideal.length - 1; i++) {
    const x1 = xScale(ideal[i].day);
    const y1 = yScale(ideal[i].remaining);
    const x2 = xScale(ideal[i + 1].day);
    const y2 = yScale(ideal[i + 1].remaining);
    
    // Simple line drawing
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    for (let s = 0; s <= steps; s++) {
      const t = steps === 0 ? 0 : s / steps;
      const x = Math.round(x1 + (x2 - x1) * t);
      const y = Math.round(y1 + (y2 - y1) * t);
      if (x >= 0 && x < width && y >= 0 && y < height) {
        grid[y][x] = useUnicode ? '·' : '.';
      }
    }
  }
  
  // Plot actual line (solid)
  for (let i = 0; i < actual.length - 1; i++) {
    const x1 = xScale(actual[i].day);
    const y1 = yScale(actual[i].remaining);
    const x2 = xScale(actual[i + 1].day);
    const y2 = yScale(actual[i + 1].remaining);
    
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    for (let s = 0; s <= steps; s++) {
      const t = steps === 0 ? 0 : s / steps;
      const x = Math.round(x1 + (x2 - x1) * t);
      const y = Math.round(y1 + (y2 - y1) * t);
      if (x >= 0 && x < width && y >= 0 && y < height) {
        grid[y][x] = useUnicode ? '●' : '*';
      }
    }
  }
  
  // Build output
  let output = '';
  
  // Title
  output += '  Burndown Chart\n';
  output += '\n';
  
  // Chart with Y-axis
  for (let row = 0; row < height; row++) {
    output += yLabels[row] + ' ' + box.v;
    output += grid[row].join('');
    output += '\n';
  }
  
  // X-axis
  output += '     ' + box.ll + box.h.repeat(width) + box.lr;
  output += '\n';
  
  // X-axis labels
  const xLabels = ['Day 0', `Day ${Math.floor(totalDays / 2)}`, `Day ${totalDays}`];
  output += '     ' + ' '.repeat(Math.floor(width / 2) - 5) + xLabels[0];
  output += ' '.repeat(width - 20) + xLabels[2];
  output += '\n';
  
  // Legend
  if (showLegend) {
    output += '\n';
    output += '  Legend: ';
    output += (useUnicode ? '·' : '.') + ' Ideal (planned)  ';
    output += (useUnicode ? '●' : '*') + ' Actual\n';
    output += `  Progress: ${daysElapsed}/${totalDays} days, ${Math.round((1 - (actual[actual.length - 1]?.remaining || 0) / totalTasks) * 100)}% complete\n`;
  }
  
  return output;
}

module.exports = {
  calculateBurndownData,
  renderBurndownChart
};
