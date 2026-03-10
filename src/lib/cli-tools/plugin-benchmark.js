/**
 * Plugin Benchmark Module
 * 
 * Measures plugin performance metrics: startup time, command execution,
 * memory usage, and context loading. Uses nanosecond precision timing.
 * Follows patterns from bun-runtime.js.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/**
 * Get config file path - looks for .planning/config.json in cwd or parent dirs
 */
function getConfigPath() {
  let cwd = process.cwd();
  while (cwd !== path.parse(cwd).root) {
    const configPath = path.join(cwd, '.planning', 'config.json');
    if (fs.existsSync(configPath)) {
      return configPath;
    }
    cwd = path.dirname(cwd);
  }
  return null;
}

/**
 * Find project root (where .planning directory exists)
 */
function findProjectRoot() {
  let cwd = process.cwd();
  while (cwd !== path.parse(cwd).root) {
    if (fs.existsSync(path.join(cwd, '.planning'))) {
      return cwd;
    }
    cwd = path.dirname(cwd);
  }
  return null;
}

/**
 * Measure cold start time - fresh subprocess spawn
 * @param {string} binPath - Path to bgsd-tools bin
 * @returns {number} - Time in milliseconds
 */
function measureColdStart(binPath) {
  const start = process.hrtime.bigint();
  
  // Spawn fresh subprocess - cold start
  try {
    execFileSync('node', [binPath, 'help'], {
      stdio: 'pipe',
      timeout: 30000
    });
  } catch {}
  
  const end = process.hrtime.bigint();
  return Number(end - start) / 1e6; // Convert ns to ms
}

/**
 * Measure warm cache time - modules already loaded
 * @param {string} binPath - Path to bgsd-tools bin
 * @returns {number} - Time in milliseconds
 */
function measureWarmStart(binPath) {
  // First call loads modules into cache
  try {
    execFileSync('node', [binPath, 'help'], { stdio: 'pipe', timeout: 30000 });
  } catch {}
  
  // Second call - warm cache
  const start = process.hrtime.bigint();
  try {
    execFileSync('node', [binPath, 'help'], {
      stdio: 'pipe',
      timeout: 30000
    });
  } catch {}
  const end = process.hrtime.bigint();
  
  return Number(end - start) / 1e6;
}

/**
 * Measure startup time (cold and warm)
 * @param {string} binPath - Path to bgsd-tools bin
 * @returns {object} - { cold: number, warm: number }
 */
function measureStartup(binPath = 'bin/bgsd-tools.cjs') {
  const projectRoot = findProjectRoot();
  const fullPath = projectRoot ? path.join(projectRoot, binPath) : binPath;
  
  // Ensure the file exists
  if (!fs.existsSync(fullPath)) {
    return { cold: 0, warm: 0, error: 'bin not found' };
  }
  
  const cold = measureColdStart(fullPath);
  const warm = measureWarmStart(fullPath);
  
  return {
    cold: parseFloat(cold.toFixed(2)),
    warm: parseFloat(warm.toFixed(2))
  };
}

/**
 * Measure command execution time for various bgsd commands
 * @param {string} command - Command to measure (e.g., 'help', 'progress')
 * @param {string} binPath - Path to bgsd-tools bin
 * @returns {number} - Time in milliseconds
 */
function measureCommandExecution(command = 'progress', binPath = 'bin/bgsd-tools.cjs') {
  const projectRoot = findProjectRoot();
  const fullPath = projectRoot ? path.join(projectRoot, binPath) : binPath;
  
  if (!fs.existsSync(fullPath)) {
    return { error: 'bin not found' };
  }
  
  const start = process.hrtime.bigint();
  try {
    execFileSync('node', [fullPath, command], {
      stdio: 'pipe',
      timeout: 30000,
      cwd: projectRoot || process.cwd()
    });
  } catch {}
  const end = process.hrtime.bigint();
  
  return parseFloat((Number(end - start) / 1e6).toFixed(2));
}

/**
 * Measure context file loading time
 * @returns {object} - Times for each context file in ms
 */
function measureContextLoad() {
  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    return { error: 'project root not found' };
  }
  
  const contextFiles = [
    'STATE.md',
    'ROADMAP.md',
    'REQUIREMENTS.md',
    'PROJECT.md'
  ];
  
  const results = {};
  
  for (const file of contextFiles) {
    const filePath = path.join(projectRoot, '.planning', file);
    const start = process.hrtime.bigint();
    
    try {
      if (fs.existsSync(filePath)) {
        fs.readFileSync(filePath, 'utf-8');
      }
    } catch {}
    
    const end = process.hrtime.bigint();
    results[file.replace('.md', '')] = parseFloat((Number(end - start) / 1e6).toFixed(2));
  }
  
  return results;
}

/**
 * Measure current process memory usage
 * @returns {object} - Memory stats in MB
 */
function measureMemory() {
  const mem = process.memoryUsage();
  
  return {
    heapUsed: parseFloat((mem.heapUsed / 1024 / 1024).toFixed(2)),
    heapTotal: parseFloat((mem.heapTotal / 1024 / 1024).toFixed(2)),
    rss: parseFloat((mem.rss / 1024 / 1024).toFixed(2)),
    external: parseFloat((mem.external / 1024 / 1024).toFixed(2))
  };
}

/**
 * Format results as human-readable table
 * @param {object} results - Benchmark results
 * @param {boolean} verbose - Show full metrics
 * @returns {string} - Formatted table string
 */
function formatTable(results, verbose = false) {
  let output = '\n';
  output += '┌─────────────────────────────┬──────────────┬──────────────┐\n';
  output += '│ Metric                     │ Cold (ms)    │ Warm (ms)    │\n';
  output += '├─────────────────────────────┼──────────────┼──────────────┤\n';
  
  // Startup metrics
  if (results.startup) {
    output += `│ Startup Time               │ ${String(results.startup.cold).padStart(11)} │ ${String(results.startup.warm).padStart(11)} │\n`;
  }
  
  // Command execution
  if (results.commands) {
    for (const [cmd, time] of Object.entries(results.commands)) {
      output += `│ ${cmd.padEnd(26)} │              │ ${String(time).padStart(11)} │\n`;
    }
  }
  
  output += '└─────────────────────────────┴──────────────┴──────────────┘\n';
  
  if (verbose) {
    // Memory table
    if (results.memory) {
      output += '\n';
      output += '┌─────────────────────────────┬──────────────────────────────┐\n';
      output += '│ Memory Usage                │ Value (MB)                   │\n';
      output += '├─────────────────────────────┼──────────────────────────────┤\n';
      output += `│ Heap Used                  │ ${String(results.memory.heapUsed).padStart(25)} │\n`;
      output += `│ Heap Total                 │ ${String(results.memory.heapTotal).padStart(25)} │\n`;
      output += `│ RSS (Resident Set Size)    │ ${String(results.memory.rss).padStart(25)} │\n`;
      output += `│ External                   │ ${String(results.memory.external).padStart(25)} │\n`;
      output += '└─────────────────────────────┴──────────────────────────────┘\n';
    }
    
    // Context load table
    if (results.context) {
      output += '\n';
      output += '┌─────────────────────────────┬──────────────────────────────┐\n';
      output += '│ Context Load                │ Time (ms)                    │\n';
      output += '├─────────────────────────────┼──────────────────────────────┤\n';
      for (const [file, time] of Object.entries(results.context)) {
        output += `│ ${file.padEnd(26)} │ ${String(time).padStart(25)} │\n`;
      }
      output += '└─────────────────────────────┴──────────────────────────────┘\n';
    }
  }
  
  return output;
}

/**
 * Run full benchmark suite
 * @param {object} options - Options object
 * @param {boolean} options.verbose - Show full metrics
 * @param {string} options.binPath - Path to bgsd-tools bin
 * @returns {object} - Full benchmark results
 */
function runBenchmark(options = {}) {
  const verbose = options.verbose || false;
  const binPath = options.binPath || 'bin/bgsd-tools.cjs';
  
  const results = {
    startup: measureStartup(binPath),
    commands: {},
    memory: measureMemory(),
    context: measureContextLoad()
  };
  
  // Measure common commands
  const commands = ['help', 'progress', 'health'];
  for (const cmd of commands) {
    results.commands[cmd] = measureCommandExecution(cmd, binPath);
  }
  
  return {
    results,
    table: formatTable(results, verbose)
  };
}

module.exports = {
  measureStartup,
  measureCommandExecution,
  measureContextLoad,
  measureMemory,
  formatTable,
  runBenchmark,
  findProjectRoot
};
