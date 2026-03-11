/**
 * Unified Visualization API
 * Exports all visualization modules through a single entry point
 */

module.exports = {
  progress: require('./progress'),
  milestone: require('./milestone'),
  quality: require('./quality'),
  burndown: require('./burndown'),
  sparkline: require('./sparkline'),
  dashboard: require('./dashboard')
};
