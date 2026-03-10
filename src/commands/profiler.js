'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// ANSI color codes
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

/**
 * Parse arguments for profiler compare command.
 */
function parseCompareArgs(args) {
  const options = {
    before: null,
    after: null,
    threshold: 10,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--before' && args[i + 1]) {
      options.before = args[++i];
    } else if (arg === '--after' && args[i + 1]) {
      options.after = args[++i];
    } else if (arg === '--threshold' && args[i + 1]) {
      options.threshold = parseInt(args[++i], 10) || 10;
    } else if (arg === '--help' || arg === '-h') {
      return { help: true };
    }
  }

  return options;
}

/**
 * Load a baseline JSON file.
 */
function loadBaseline(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    throw new Error(`Failed to load baseline from ${filePath}: ${e.message}`);
  }
}

/**
 * Match timings by label (fuzzy match for similar operations).
 */
function matchTimings(beforeTimings, afterTimings) {
  const matched = [];
  const beforeMap = new Map(beforeTimings.map(t => [t.label, t]));

  for (const after of afterTimings) {
    const before = beforeMap.get(after.label);
    if (before) {
      matched.push({ label: after.label, before: before.duration_ms, after: after.duration_ms });
      beforeMap.delete(after.label);
    } else {
      // Try fuzzy match
      let bestMatch = null;
      let bestScore = 0;
      for (const [label, beforeTiming] of beforeMap) {
        const score = fuzzyScore(after.label, label);
        if (score > bestScore && score > 0.5) {
          bestScore = score;
          bestMatch = { label, timing: beforeTiming };
        }
      }
      if (bestMatch) {
        matched.push({ label: after.label, before: bestMatch.timing.duration_ms, after: after.duration_ms });
        beforeMap.delete(bestMatch.label);
      }
    }
  }

  // Add unmatched before timings
  for (const [label, timing] of beforeMap) {
    matched.push({ label, before: timing.duration_ms, after: 0, missing: true });
  }

  return matched;
}

/**
 * Simple fuzzy score between two strings.
 */
function fuzzyScore(a, b) {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  if (aLower === bLower) return 1;
  if (aLower.includes(bLower) || bLower.includes(aLower)) return 0.8;
  
  let matches = 0;
  for (const char of bLower) {
    if (aLower.includes(char)) matches++;
  }
  return matches / Math.max(aLower.length, bLower.length);
}

/**
 * Format a number with fixed decimal places.
 */
function formatNum(n, decimals = 2) {
  return n.toFixed(decimals);
}

/**
 * Compare two baseline profiles and display timing deltas.
 */
function cmdProfilerCompare(args) {
  const options = parseCompareArgs(args);

  if (options.help) {
    process.stderr.write(`Usage: bgsd-tools profiler compare --before <file> --after <file> [--threshold N]

Compare two baseline profiles and show timing deltas.

Options:
  --before <file>   Baseline JSON file (before)
  --after <file>    Current timing JSON file (after)
  --threshold N     Regression threshold percentage (default: 10)

Examples:
  bgsd-tools profiler compare --before baseline.json --after current.json
  bgsd-tools profiler compare --before b.json --after a.json --threshold 15
`);
    return;
  }

  if (!options.before || !options.after) {
    process.stderr.write('Error: --before and --after are required\n');
    process.exit(1);
  }

  const before = loadBaseline(options.before);
  const after = loadBaseline(options.after);

  // Match timings
  const matched = matchTimings(before.timings, after.timings);

  // Calculate deltas and sort by absolute delta
  const results = matched.map(m => {
    const delta = m.after - m.before;
    const percent = m.before > 0 ? (delta / m.before) * 100 : (m.after > 0 ? 100 : 0);
    return { ...m, delta, percent };
  }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  // Print header
  process.stdout.write(`\n${BOLD}Profiler Compare${RESET}\n`);
  process.stdout.write(`${BOLD}Before:${RESET} ${path.basename(options.before)} (${before.timestamp})\n`);
  process.stdout.write(`${BOLD}After:${RESET}  ${path.basename(options.after)} (${after.timestamp})\n\n`);

  // Print table header
  const colOp = 'Operation';
  const colBefore = 'Before (ms)';
  const colAfter = 'After (ms)';
  const colDelta = 'Delta (ms)';
  const colChange = 'Change%';
  
  process.stdout.write(`${BOLD}${colOp.padEnd(30)}${colBefore.padEnd(14)}${colAfter.padEnd(14)}${colDelta.padEnd(14)}${colChange}${RESET}\n`);
  process.stdout.write('-'.repeat(92) + '\n');

  // Count stats
  let faster = 0, slower = 0, unchanged = 0;

  // Print each row
  for (const r of results) {
    const label = r.label.length > 28 ? r.label.slice(0, 25) + '...' : r.label.padEnd(30);
    
    let deltaStr = r.missing ? '(missing in after)' : formatNum(r.delta, 2).padEnd(14);
    let changeStr = r.missing ? 'N/A' : formatNum(r.percent, 1) + '%';
    
    let color = RESET;
    if (!r.missing) {
      if (r.delta < 0) {
        color = GREEN;  // Faster
        faster++;
      } else if (r.delta > 0) {
        color = r.percent > options.threshold ? RED : YELLOW;  // Slower
        slower++;
      } else {
        unchanged++;
      }
    }

    process.stdout.write(`${label}${formatNum(r.before, 2).padEnd(14)}${formatNum(r.after, 2).padEnd(14)}${color}${deltaStr}${changeStr}${RESET}\n`);
  }

  // Print summary
  process.stdout.write('\n');
  if (faster > 0) process.stdout.write(`${GREEN}${faster} operation(s) faster${RESET}, `);
  if (slower > 0) process.stdout.write(`${RED}${slower} operation(s) slower${RESET}, `);
  if (unchanged > 0) process.stdout.write(`${unchanged} unchanged`);
  process.stdout.write('\n');

  // Overall comparison
  const totalBefore = before.total_ms;
  const totalAfter = after.total_ms;
  const totalDelta = totalAfter - totalBefore;
  const totalPercent = totalBefore > 0 ? (totalDelta / totalBefore) * 100 : 0;

  process.stdout.write(`\n${BOLD}Total:${RESET} ${formatNum(totalBefore)}ms → ${formatNum(totalAfter)}ms `);
  if (totalDelta < 0) {
    process.stdout.write(`(${GREEN}${formatNum(totalDelta)}ms (${formatNum(totalPercent, 1)}%)${RESET} faster)\n`);
  } else if (totalDelta > 0) {
    process.stdout.write(`(${totalPercent > options.threshold ? RED : YELLOW}+${formatNum(totalDelta)}ms (+${formatNum(totalPercent, 1)}%)${RESET} ${totalPercent > options.threshold ? 'slower' : 'slightly slower'})\n`);
  } else {
    process.stdout.write('(unchanged)\n');
  }
}

/**
 * Parse arguments for cache speedup command.
 */
function parseCacheSpeedupArgs(args) {
  const options = {
    runs: 5,
    command: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--runs' && args[i + 1]) {
      options.runs = parseInt(args[++i], 10) || 5;
    } else if (arg === '--command' && args[i + 1]) {
      options.command = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      return { help: true };
    }
  }

  return options;
}

/**
 * Run a command and measure execution time.
 */
function runCommandMeasure(cmd) {
  return new Promise((resolve, reject) => {
    const start = process.hrtime.bigint();
    const child = spawn('node', ['bin/bgsd-tools.cjs'].concat(cmd.split(' ')), {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: 'pipe',
    });

    let stderr = '';
    child.stderr.on('data', d => { stderr += d.toString(); });
    
    child.on('close', code => {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1000000;
      resolve({ durationMs, code, stderr });
    });

    child.on('error', err => {
      reject(err);
    });
  });
}

/**
 * Measure cache speedup by running commands with/without cache.
 */
async function cmdProfilerCacheSpeedup(args) {
  const options = parseCacheSpeedupArgs(args);

  if (options.help) {
    process.stderr.write(`Usage: bgsd-tools profiler cache-speedup --runs N --command "args"

Run commands with and without cache to measure speedup.

Options:
  --runs N       Number of runs for each mode (default: 5)
  --command "cmd"  Command to test (required)

Examples:
  bgsd-tools profiler cache-speedup --runs 3 --command "verify:state validate"
  bgsd-tools profiler cache-speedup --runs 5 --command "plan:roadmap analyze"
`);
    return;
  }

  if (!options.command) {
    process.stderr.write('Error: --command is required\n');
    process.exit(1);
  }

  const runs = options.runs;

  process.stdout.write(`\n${BOLD}Cache Speedup Test${RESET}\n`);
  process.stdout.write(`Command: ${options.command}\n`);
  process.stdout.write(`Runs per mode: ${runs}\n\n`);

  // Warm up run (first run may have overhead)
  process.stdout.write('Warming up...\n');
  await runCommandMeasure(options.command);
  await runCommandMeasure(options.command);

  // Run with cache enabled (default)
  process.stdout.write('Running with cache enabled...\n');
  const cachedTimes = [];
  for (let i = 0; i < runs; i++) {
    const result = await runCommandMeasure(options.command);
    if (result.code !== 0) {
      process.stderr.write(`Warning: Command exited with code ${result.code}\n`);
    }
    cachedTimes.push(result.durationMs);
    process.stdout.write(`  Run ${i + 1}: ${formatNum(result.durationMs)}ms\n`);
  }

  // Run with cache disabled
  process.stdout.write('Running with cache disabled...\n');
  const uncachedTimes = [];
  for (let i = 0; i < runs; i++) {
    const result = await runCommandMeasure(options.command + ' --no-cache');
    if (result.code !== 0) {
      process.stderr.write(`Warning: Command exited with code ${result.code}\n`);
    }
    uncachedTimes.push(result.durationMs);
    process.stdout.write(`  Run ${i + 1}: ${formatNum(result.durationMs)}ms\n`);
  }

  // Calculate averages
  const avgCached = cachedTimes.reduce((a, b) => a + b, 0) / cachedTimes.length;
  const avgUncached = uncachedTimes.reduce((a, b) => a + b, 0) / uncachedTimes.length;

  // Calculate speedup
  const speedupMs = avgUncached - avgCached;
  const speedupPercent = avgUncached > 0 ? (speedupMs / avgUncached) * 100 : 0;

  // Print results
  process.stdout.write(`\n${BOLD}Results:${RESET}\n`);
  process.stdout.write(`  Cache enabled:  ${GREEN}${formatNum(avgCached)}ms${RESET} (avg of ${runs} runs)\n`);
  process.stdout.write(`  Cache disabled: ${RED}${formatNum(avgUncached)}ms${RESET} (avg of ${runs} runs)\n`);
  process.stdout.write('\n');

  if (speedupMs > 0) {
    process.stdout.write(`  ${GREEN}Speedup: ${formatNum(speedupMs)}ms (${formatNum(speedupPercent, 1)}%)${RESET}\n`);
    process.stdout.write(`  Cache is ${formatNum(speedupPercent, 1)}% faster with caching enabled.\n`);
  } else if (speedupMs < 0) {
    process.stdout.write(`  ${RED}Slowdown: ${formatNum(Math.abs(speedupMs))}ms (${formatNum(Math.abs(speedupPercent), 1)}%)${RESET}\n`);
    process.stdout.write(`  Cache is ${formatNum(Math.abs(speedupPercent), 1)}% slower. Check cache configuration.\n`);
  } else {
    process.stdout.write('  No measurable difference between cached and uncached runs.\n');
  }
}

module.exports = { cmdProfilerCompare, cmdProfilerCacheSpeedup };
