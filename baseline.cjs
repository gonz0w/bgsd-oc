#!/usr/bin/env node

/**
 * Performance baseline capture script.
 * Captures init timing, bundle size, and source metrics for before/after comparison.
 * Zero dependencies — uses only Node.js built-ins.
 *
 * Usage: node baseline.js
 *        npm run baseline
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// --- 1. Init timing (median of 5 runs) ---
const RUNS = 5;
const timings = [];

for (let i = 0; i < RUNS; i++) {
  const start = Date.now();
  try {
    execSync('node bin/bgsd-tools.cjs util:current-timestamp --raw', {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    console.error(`Run ${i + 1} failed: ${err.message}`);
    process.exit(1);
  }
  const elapsed = Date.now() - start;
  timings.push(elapsed);
}

// Compute median
const sorted = [...timings].sort((a, b) => a - b);
const median = sorted[Math.floor(sorted.length / 2)];

// --- 1b. VALD-01 validation hot-path timing (median of 5 runs) ---
const valdRuns = [];
const VALIDATION_BATCH = 200;
const valdCommand = `node --input-type=module -e "import('./plugin.js').then(async (mod) => { const plugin = await mod.BgsdPlugin({ directory: process.cwd() }); const start = Date.now(); for (let i = 0; i < ${VALIDATION_BATCH}; i++) { await plugin.tool.bgsd_plan.execute({ phase: '77' }, { directory: process.cwd() }); } process.stdout.write(String(Date.now() - start)); process.exit(0); }).catch((err) => { console.error(err.message); process.exit(1); });"`;

for (let i = 0; i < RUNS; i++) {
  try {
    const output = execSync(valdCommand, {
      encoding: 'utf-8',
      timeout: 20000,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });
    const elapsed = parseInt(String(output).trim(), 10);
    if (!Number.isFinite(elapsed)) {
      throw new Error('non-numeric VALD benchmark output');
    }
    valdRuns.push(elapsed);
  } catch (err) {
    console.error(`VALD-01 run ${i + 1} failed: ${err.message}`);
    process.exit(1);
  }
}

const valdSorted = [...valdRuns].sort((a, b) => a - b);
const valdMedian = valdSorted[Math.floor(valdSorted.length / 2)];

// --- 1c. SCAN-01 discovery scan timing: legacy vs optimized (in-process, median of 5 runs) ---
// Measures the discovery adapter directly (getSourceDirs + walkSourceFiles) to isolate
// scan improvement from Node.js startup overhead.
const scanLegacyRuns = [];
const scanOptimizedRuns = [];
const discovery = require('./src/lib/adapters/discovery');

const scanFixtureDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-scan-bench-'));
const SCAN_DIRS = 12;
const SCAN_FILES_PER_DIR = 30;
try {
  // Create .planning structure and source tree
  fs.mkdirSync(path.join(scanFixtureDir, '.planning', 'codebase'), { recursive: true });
  fs.mkdirSync(path.join(scanFixtureDir, '.planning', 'phases'), { recursive: true });
  for (let d = 0; d < SCAN_DIRS; d++) {
    const dirName = `module_${d}`;
    fs.mkdirSync(path.join(scanFixtureDir, 'src', dirName), { recursive: true });
    for (let f = 0; f < SCAN_FILES_PER_DIR; f++) {
      fs.writeFileSync(
        path.join(scanFixtureDir, 'src', dirName, `file_${f}.js`),
        `// module ${d}, file ${f}\nmodule.exports = { id: ${d * SCAN_FILES_PER_DIR + f} };\n`
      );
    }
  }
  // Add some non-source dirs that should be ignored via gitignore
  fs.mkdirSync(path.join(scanFixtureDir, 'coverage', 'reports'), { recursive: true });
  for (let f = 0; f < 20; f++) {
    fs.writeFileSync(path.join(scanFixtureDir, 'coverage', 'reports', `report_${f}.js`), '// coverage\n');
  }
  fs.writeFileSync(path.join(scanFixtureDir, '.gitignore'), 'node_modules/\n*.log\ncoverage/\n');
  fs.writeFileSync(path.join(scanFixtureDir, 'package.json'), '{"name":"scan-bench"}\n');
  fs.mkdirSync(path.join(scanFixtureDir, 'node_modules', 'dep'), { recursive: true });
  fs.writeFileSync(path.join(scanFixtureDir, 'node_modules', 'dep', 'index.js'), '// dep\n');
  execSync('git init', { cwd: scanFixtureDir, stdio: 'pipe' });
  execSync('git config user.email "bench@test.com" && git config user.name "Bench"', { cwd: scanFixtureDir, stdio: 'pipe' });
  execSync('git add -A && git commit -m "init"', { cwd: scanFixtureDir, stdio: 'pipe' });

  // In-process benchmark: call discovery adapter functions directly
  for (let i = 0; i < RUNS; i++) {
    // Legacy: getSourceDirs + walkSourceFiles with mode=legacy
    const legStart = process.hrtime.bigint();
    const legDirs = discovery.legacyGetSourceDirs(scanFixtureDir);
    discovery.legacyWalkSourceFiles(scanFixtureDir, legDirs, discovery.SKIP_DIRS);
    const legElapsed = Number(process.hrtime.bigint() - legStart) / 1e6;
    scanLegacyRuns.push(Math.round(legElapsed * 100) / 100);

    // Optimized: getSourceDirs + walkSourceFiles with mode=optimized
    const optStart = process.hrtime.bigint();
    const optDirs = discovery.optimizedGetSourceDirs(scanFixtureDir);
    discovery.optimizedWalkSourceFiles(scanFixtureDir, optDirs, discovery.SKIP_DIRS);
    const optElapsed = Number(process.hrtime.bigint() - optStart) / 1e6;
    scanOptimizedRuns.push(Math.round(optElapsed * 100) / 100);
  }
} finally {
  fs.rmSync(scanFixtureDir, { recursive: true, force: true });
}

const scanLegacySorted = [...scanLegacyRuns].sort((a, b) => a - b);
const scanOptimizedSorted = [...scanOptimizedRuns].sort((a, b) => a - b);
const scanLegacyMedian = scanLegacySorted[Math.floor(scanLegacySorted.length / 2)];
const scanOptimizedMedian = scanOptimizedSorted[Math.floor(scanOptimizedSorted.length / 2)];
const scanDeltaPct = scanLegacyMedian > 0
  ? Math.round(((scanLegacyMedian - scanOptimizedMedian) / scanLegacyMedian) * 100)
  : 0;

// --- 2. Bundle size ---
const bundlePath = 'bin/bgsd-tools.cjs';
const bundleStat = fs.statSync(bundlePath);
const bundleSizeBytes = bundleStat.size;
const bundleSizeKb = Math.round(bundleSizeBytes / 1024);

// --- 3. File I/O counting via /proc/self/io or strace ---
let fsReadCount = null;
let fsWriteCount = null;

// Approach 1: Use /proc/<pid>/io to measure I/O bytes (Linux)
if (fs.existsSync('/proc/self/io')) {
  try {
    // Capture I/O before and after running a command via a wrapper script
    const wrapper = `
      const fs = require('fs');
      const { execSync } = require('child_process');
      const before = fs.readFileSync('/proc/self/io', 'utf-8');
      execSync('node bin/bgsd-tools.cjs init:plan-phase 1', { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] });
      const after = fs.readFileSync('/proc/self/io', 'utf-8');
      const parse = (s) => {
        const m = {};
        for (const line of s.trim().split('\\n')) {
          const [k, v] = line.split(': ');
          m[k.trim()] = parseInt(v.trim(), 10);
        }
        return m;
      };
      const b = parse(before), a = parse(after);
      console.log(JSON.stringify({ syscr: a.syscr - b.syscr, syscw: a.syscw - b.syscw }));
    `;
    const ioOut = execSync(`node -e "${wrapper.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
      encoding: 'utf-8',
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const io = JSON.parse(ioOut.trim());
    fsReadCount = io.syscr;
    fsWriteCount = io.syscw;
  } catch {
    // /proc/self/io exists but subprocess approach failed
  }
}

// Approach 2: strace (if available)
if (fsReadCount === null) {
  try {
    const straceOut = execSync(
      'strace -c -e trace=openat node bin/bgsd-tools.cjs init:plan-phase 1 2>&1 >/dev/null',
      { encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'], shell: true }
    );
    const openatMatch = straceOut.match(/(\d+)\s+[\d.]+\s+[\d.]+\s+\d+\s+\d+\s+openat/);
    if (openatMatch) {
      fsReadCount = parseInt(openatMatch[1], 10);
      fsWriteCount = 0;
    }
  } catch {
    // strace not available
  }
}

// Fallback: zeros (metric unavailable on this platform)
if (fsReadCount === null) {
  fsReadCount = 0;
  fsWriteCount = 0;
}

// --- 4. Source file count and total lines ---
function collectSourceFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { recursive: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    if (fs.statSync(fullPath).isFile() && entry.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

const sourceFiles = collectSourceFiles('src');
let totalLines = 0;
for (const file of sourceFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  totalLines += content.split('\n').length;
}

// --- 5. Write performance.json ---
const baselinesDir = '.planning/baselines';
if (!fs.existsSync(baselinesDir)) {
  fs.mkdirSync(baselinesDir, { recursive: true });
}

const baselines = {
  timestamp: new Date().toISOString(),
  init_timing_ms: median,
  init_timing_runs: timings,
  vald01_timing_ms: valdMedian,
  vald01_timing_runs: valdRuns,
  vald01_batch_size: VALIDATION_BATCH,
  scan_legacy_ms: scanLegacyMedian,
  scan_legacy_runs: scanLegacyRuns,
  scan_optimized_ms: scanOptimizedMedian,
  scan_optimized_runs: scanOptimizedRuns,
  scan_delta_pct: scanDeltaPct,
  scan_fixture_files: SCAN_DIRS * SCAN_FILES_PER_DIR,
  bundle_size_kb: bundleSizeKb,
  bundle_size_bytes: bundleSizeBytes,
  fs_read_count: fsReadCount,
  fs_write_count: fsWriteCount,
  source_file_count: sourceFiles.length,
  source_total_lines: totalLines,
  node_version: process.version,
};

const outPath = path.join(baselinesDir, 'performance.json');
fs.writeFileSync(outPath, JSON.stringify(baselines, null, 2) + '\n');

// --- 6. Console output ---
console.log('Performance Baselines:');
console.log(`  Init timing:    ${median}ms (median of ${RUNS} runs)`);
console.log(`  VALD-01 timing: ${valdMedian}ms (median of ${RUNS} runs, batch=${VALIDATION_BATCH})`);
console.log(`  SCAN legacy:    ${scanLegacyMedian}ms (median of ${RUNS} runs, ${SCAN_DIRS * SCAN_FILES_PER_DIR} files)`);
console.log(`  SCAN optimized: ${scanOptimizedMedian}ms (median of ${RUNS} runs, ${SCAN_DIRS * SCAN_FILES_PER_DIR} files)`);
console.log(`  SCAN delta:     ${scanDeltaPct}% improvement`);
console.log(`  Bundle size:    ${bundleSizeKb}KB`);
console.log(`  Source files:   ${sourceFiles.length} files, ${totalLines} lines`);
console.log(`  Node version:   ${process.version}`);
if (fsReadCount !== null) {
  console.log(`  FS reads:       ${fsReadCount}`);
  console.log(`  FS writes:      ${fsWriteCount}`);
}
console.log(`Saved to: ${outPath}`);
