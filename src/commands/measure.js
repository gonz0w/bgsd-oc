'use strict';

const { runBenchmark } = require('../lib/cli-tools/plugin-benchmark');

/**
 * Run benchmark and output results
 * @param {string} cwd - Working directory
 * @param {object} options - Options object
 * @param {boolean} options.verbose - Show full metrics
 * @param {string} options.binPath - Path to bgsd-tools bin
 * @param {boolean} raw - Unused - always outputs table per requirement
 */
function cmdMeasure(cwd, options = {}, raw = false) {
  const verbose = options.verbose || false;
  const binPath = options.binPath || 'bin/bgsd-tools.cjs';
  
  // Run the benchmark
  const { table } = runBenchmark({ verbose, binPath });
  
  // Always output as table (no JSON per requirement)
  process.stdout.write(table);
}

module.exports = {
  cmdMeasure
};
