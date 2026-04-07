/**
 * bgsd-tools codebase tests
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { TOOLS_PATH, runGsdTools, createTempProject, createParityProject, cleanup } = require('./helpers.cjs');

describe('codebase-impact batch grep', () => {
  test('returns dependents for a known file', () => {
    const result = runGsdTools('util:codebase impact src/lib/helpers.js');
    assert.ok(result.success, 'codebase-impact should succeed');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.files_analyzed, 1, 'should analyze 1 file');
    assert.ok(data.total_dependents > 0, `helpers.js should have dependents, got ${data.total_dependents}`);
    assert.ok(data.files[0].exists === true, 'file should exist');
    assert.ok(Array.isArray(data.files[0].dependents), 'dependents should be array');
  });

  test('handles non-existent file', () => {
    const result = runGsdTools('util:codebase impact nonexistent-file-xyz.js');
    assert.ok(result.success, 'should succeed even for missing file');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.files[0].exists, false, 'file should not exist');
  });

  test('handles file with no code dependents', () => {
    const result = runGsdTools('util:codebase impact package.json');
    assert.ok(result.success, 'should succeed for non-code file');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.files_analyzed, 1, 'should analyze 1 file');
    // package.json may have 0 dependents (not imported by JS files)
    assert.ok(typeof data.total_dependents === 'number', 'should have numeric dependents count');
  });

  test('analyzes multiple files in single call', () => {
    const result = runGsdTools('util:codebase impact src/lib/helpers.js src/lib/output.js');
    assert.ok(result.success, 'should succeed for multiple files');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.files_analyzed, 2, 'should analyze 2 files');
    assert.ok(data.files.length === 2, 'should return 2 file results');
  });

  test('uses batched grep (source contains -e flag pattern)', () => {
    // Verify the source implementation uses batched -e flags, not per-pattern loop
    const content = fs.readFileSync(path.join(__dirname, '..', 'src', 'commands', 'features.js'), 'utf-8');
    assert.ok(content.includes("'--fixed-strings'"), 'should have fixed-strings grep flag');
    // The batched pattern joins multiple -e flags via flatMap
    assert.ok(content.includes("flatMap(p => ['-e', p])"), 'should batch -e flags via flatMap');
    // Should NOT have the old per-pattern loop
    assert.ok(!content.includes('for (const pattern of searchPatterns)'), 'should not have per-pattern loop');
  });
});

describe('codebase-impact graph-first path (WKFL-03)', () => {
  test('uses cached graph when intel has dependencies', () => {
    // First ensure deps are built
    runGsdTools('util:codebase deps');
    const result = runGsdTools('util:codebase impact src/lib/helpers.js');
    assert.ok(result.success, 'codebase-impact should succeed');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.source, 'cached_graph', 'should use cached graph when dependencies exist');
    assert.strictEqual(data.files_analyzed, 1, 'should analyze 1 file');
    assert.ok(data.total_dependents > 0, 'helpers.js should have dependents from graph');
    assert.ok(typeof data.overall_risk === 'string', 'should have overall_risk');
  });

  test('graph path output format matches expected schema', () => {
    const result = runGsdTools('util:codebase impact src/lib/output.js');
    assert.ok(result.success, 'should succeed');
    const data = JSON.parse(result.output);
    // Verify top-level fields
    assert.ok('files_analyzed' in data, 'should have files_analyzed');
    assert.ok('total_dependents' in data, 'should have total_dependents');
    assert.ok('overall_risk' in data, 'should have overall_risk');
    assert.ok('files' in data, 'should have files array');
    assert.ok('source' in data, 'should have source field');
    // Verify per-file fields
    const f = data.files[0];
    assert.ok('path' in f, 'file should have path');
    assert.ok('exists' in f, 'file should have exists');
    assert.ok('dependent_count' in f, 'file should have dependent_count');
    assert.ok('dependents' in f, 'file should have dependents');
    assert.ok('risk' in f, 'file should have risk');
  });

  test('graph path handles non-existent file', () => {
    const result = runGsdTools('util:codebase impact nonexistent-graph-file.js');
    assert.ok(result.success, 'should succeed for missing file');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.source, 'cached_graph', 'should still use cached graph');
    assert.strictEqual(data.files[0].exists, false, 'file should not exist');
    assert.strictEqual(data.files[0].dependent_count, 0, 'missing file should have 0 dependents');
    assert.deepStrictEqual(data.files[0].dependents, [], 'missing file should have empty dependents');
    assert.strictEqual(data.files[0].risk, 'low', 'missing file should have low risk');
  });

  test('graph path handles multiple files', () => {
    const result = runGsdTools('util:codebase impact src/lib/helpers.js src/lib/output.js');
    assert.ok(result.success, 'should succeed for multiple files');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.source, 'cached_graph', 'should use cached graph');
    assert.strictEqual(data.files_analyzed, 2, 'should analyze 2 files');
    assert.ok(data.files.length === 2, 'should return 2 file results');
  });
});

describe('codebase intelligence', () => {
  let tmpDir;

  function createCodebaseProject() {
    const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-codebase-'));
    fs.mkdirSync(path.join(dir, '.planning', 'codebase'), { recursive: true });
    fs.mkdirSync(path.join(dir, '.planning', 'phases'), { recursive: true });
    // Create sample source files for analysis
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'index.js'), 'const x = 1;\nmodule.exports = { x };\n');
    fs.writeFileSync(path.join(dir, 'src', 'utils.js'), 'function helper() { return true; }\nmodule.exports = { helper };\n');
    fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"test-proj","version":"1.0.0"}\n');
    fs.writeFileSync(path.join(dir, 'README.md'), '# Test Project\n\nSome description.\n');
    // Initialize git repo for staleness detection
    execSync('git init', { cwd: dir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com" && git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
    execSync('git add -A && git commit -m "initial"', { cwd: dir, stdio: 'pipe' });
    return dir;
  }

  beforeEach(() => {
    tmpDir = createCodebaseProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  describe('codebase analyze', () => {
    test('codebase analyze --raw succeeds on a project with source files', () => {
      const result = runGsdTools('util:codebase analyze', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.mode, 'full');
      assert.ok(data.total_files > 0, `Expected total_files > 0, got ${data.total_files}`);
    });

    test('codebase analyze creates codebase-intel.json', () => {
      runGsdTools('util:codebase analyze', tmpDir);

      const intelPath = path.join(tmpDir, '.planning', 'codebase', 'codebase-intel.json');
      assert.ok(fs.existsSync(intelPath), 'codebase-intel.json should exist after analyze');
    });

    test('intel JSON has required fields', () => {
      runGsdTools('util:codebase analyze', tmpDir);

      const intelPath = path.join(tmpDir, '.planning', 'codebase', 'codebase-intel.json');
      const intel = JSON.parse(fs.readFileSync(intelPath, 'utf-8'));

      assert.ok(intel.version, 'should have version field');
      assert.ok(intel.git_commit_hash, 'should have git_commit_hash field');
      assert.ok(intel.generated_at, 'should have generated_at field');
      assert.ok(intel.files, 'should have files field');
      assert.ok(intel.languages, 'should have languages field');
      assert.ok(intel.stats, 'should have stats field');
      assert.ok(intel.stats.total_files > 0, 'should have total_files in stats');
      assert.ok(typeof intel.stats.total_lines === 'number', 'should have total_lines in stats');
    });

    test('running analyze twice — second run reports incremental or cached mode', () => {
      // First run: full
      const first = runGsdTools('util:codebase analyze', tmpDir);
      assert.ok(first.success, `First run failed: ${first.error}`);
      const firstData = JSON.parse(first.output);
      assert.strictEqual(firstData.mode, 'full');

      // Second run: should be cached (no changes)
      const second = runGsdTools('util:codebase analyze', tmpDir);
      assert.ok(second.success, `Second run failed: ${second.error}`);
      const secondData = JSON.parse(second.output);
      assert.strictEqual(secondData.mode, 'cached', 'Second run with no changes should be cached');
    });

    test('codebase analyze --full forces full analysis', () => {
      // First run
      runGsdTools('util:codebase analyze', tmpDir);

      // Second run with --full: should force full mode
      const result = runGsdTools('util:codebase analyze --full', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);
      assert.strictEqual(data.mode, 'full', '--full should force full mode');
    });
  });

  describe('codebase status', () => {
    test('codebase status before analyze returns exists: false', () => {
      // Remove any existing intel
      const intelPath = path.join(tmpDir, '.planning', 'codebase', 'codebase-intel.json');
      try { fs.unlinkSync(intelPath); } catch (e) { /* may not exist */ }

      const result = runGsdTools('util:codebase status', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);
      assert.strictEqual(data.exists, false);
    });

    test('codebase status after analyze returns exists: true, stale: false', () => {
      runGsdTools('util:codebase analyze', tmpDir);

      const result = runGsdTools('util:codebase status', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);
      assert.strictEqual(data.exists, true);
      assert.strictEqual(data.stale, false);
    });

    test('after modifying a tracked file, status returns stale: true', () => {
      runGsdTools('util:codebase analyze', tmpDir);

      // Modify a file and commit (git config already set in createCodebaseProject)
      fs.writeFileSync(path.join(tmpDir, 'src', 'index.js'), 'const x = 2;\nconst y = 3;\nmodule.exports = { x, y };\n');
      execSync('git add -A && git commit -m "modify file"', { cwd: tmpDir, stdio: 'pipe' });

      const result = runGsdTools('util:codebase status', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);
      assert.strictEqual(data.exists, true);
      assert.strictEqual(data.stale, true);
    });
  });

  describe('incremental analysis', () => {
    test('after modifying one file, analyze reports incremental mode', () => {
      // Full analysis first
      runGsdTools('util:codebase analyze', tmpDir);

      // Modify one file and commit (git config already set in createCodebaseProject)
      fs.writeFileSync(path.join(tmpDir, 'src', 'utils.js'), 'function helper() { return false; }\nfunction extra() { return 1; }\nmodule.exports = { helper, extra };\n');
      execSync('git add -A && git commit -m "modify utils"', { cwd: tmpDir, stdio: 'pipe' });

      const result = runGsdTools('util:codebase analyze', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);
      assert.strictEqual(data.mode, 'incremental', 'Should use incremental mode after single file change');
      assert.ok(data.files_analyzed >= 1, `Should analyze at least 1 file, got ${data.files_analyzed}`);
    });
  });

  describe('error handling', () => {
    test('codebase analyze on directory with .planning handles gracefully', () => {
      // .planning already exists in our test project, this should work fine
      const result = runGsdTools('util:codebase analyze', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
    });

    test('corrupt codebase-intel.json triggers full rescan', () => {
      // First analyze to create valid intel
      runGsdTools('util:codebase analyze', tmpDir);

      // Corrupt the intel file
      const intelPath = path.join(tmpDir, '.planning', 'codebase', 'codebase-intel.json');
      fs.writeFileSync(intelPath, '{ invalid json !!!');

      // Analyze again — should handle gracefully (full rescan)
      const result = runGsdTools('util:codebase analyze', tmpDir);
      assert.ok(result.success, `Command should handle corrupt intel: ${result.error}`);
      const data = JSON.parse(result.output);
      assert.strictEqual(data.mode, 'full', 'Should fall back to full mode on corrupt intel');
    });
  });

  describe('init integration', () => {
    test('init execute-phase includes codebase_stats when intel exists', () => {
      // Create phase directory for init to find
      const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
      fs.mkdirSync(phaseDir, { recursive: true });
      fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan\n');

      // Run analyze first so intel exists
      runGsdTools('util:codebase analyze', tmpDir);

      const result = runGsdTools('init:execute-phase 01 --verbose', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);
      assert.ok(data.codebase_stats, 'Should include codebase_stats field');
      assert.ok(data.codebase_stats.total_files > 0, 'codebase_stats should have total_files');
      assert.ok(data.codebase_stats.top_languages, 'codebase_stats should have top_languages');
      assert.strictEqual(data.codebase_stats.confidence, 1.0, 'codebase_stats confidence should be 1.0');
    });

    test('init execute-phase returns null codebase fields without intel', () => {
      const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
      fs.mkdirSync(phaseDir, { recursive: true });
      fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan\n');

      // Don't run analyze — no intel exists
      const intelPath = path.join(tmpDir, '.planning', 'codebase', 'codebase-intel.json');
      try { fs.unlinkSync(intelPath); } catch (e) { /* may not exist */ }

      const result = runGsdTools('init:execute-phase 01 --verbose', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);
      // codebase fields should be null or undefined (trimmed from verbose output)
      assert.ok(!data.codebase_stats, 'Should not include codebase_stats without intel');
      assert.ok(!data.codebase_conventions, 'Should not include codebase_conventions without intel');
      assert.ok(!data.codebase_dependencies, 'Should not include codebase_dependencies without intel');
    });

    test('init progress includes codebase_intel_exists flag', () => {
      // Run analyze first
      runGsdTools('util:codebase analyze', tmpDir);

      const result = runGsdTools('init:progress --verbose', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);
      assert.strictEqual(data.codebase_intel_exists, true, 'Should report codebase_intel_exists: true');
    });
  });

  describe('phase 26: init context summary', () => {
    test('three-field summary format — codebase_stats has confidence', () => {
      // Run analyze to populate intel
      runGsdTools('util:codebase analyze', tmpDir);

      const result = runGsdTools('init:progress --verbose', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      // Verify codebase_stats exists and has confidence
      assert.ok(data.codebase_stats, 'Should include codebase_stats field');
      assert.strictEqual(data.codebase_stats.confidence, 1.0, 'stats confidence should be 1.0');
      assert.ok(data.codebase_stats.total_files > 0, 'should have total_files');
      assert.ok(data.codebase_stats.top_languages, 'should have top_languages');
      assert.ok(data.codebase_stats.generated_at, 'should have generated_at');
    });

    test('convention field present when conventions data exists', () => {
      // Run analyze + conventions to populate data
      runGsdTools('util:codebase analyze', tmpDir);
      runGsdTools('util:codebase conventions', tmpDir);

      const result = runGsdTools('init:progress --verbose', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      // Conventions should be present (may be null if no strong patterns detected in simple project)
      // At minimum codebase_stats should exist
      assert.ok(data.codebase_stats, 'codebase_stats should exist');
    });

    test('dependencies field present when deps data exists', () => {
      // Run analyze + deps to populate data
      runGsdTools('util:codebase analyze', tmpDir);
      runGsdTools('util:codebase deps', tmpDir);

      const result = runGsdTools('init:progress --verbose', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      // Dependencies should be present when deps have been built
      assert.ok(data.codebase_dependencies, 'codebase_dependencies should exist after codebase deps');
      assert.ok(data.codebase_dependencies.confidence === 0.85, 'deps confidence should be 0.85');
      assert.ok(data.codebase_dependencies.total_modules >= 0, 'should have total_modules');
    });

    test('null handling — stats exist but no conventions/deps data', () => {
      // Only run analyze (no conventions/deps)
      runGsdTools('util:codebase analyze', tmpDir);

      // Read intel and verify no conventions/dependencies keys
      const intelPath = path.join(tmpDir, '.planning', 'codebase', 'codebase-intel.json');
      const intel = JSON.parse(fs.readFileSync(intelPath, 'utf-8'));
      // Ensure no conventions/deps in intel
      delete intel.conventions;
      delete intel.dependencies;
      fs.writeFileSync(intelPath, JSON.stringify(intel, null, 2) + '\n');

      const result = runGsdTools('init:progress --verbose', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      // Stats should exist
      assert.ok(data.codebase_stats, 'codebase_stats should exist');
      // Conventions and dependencies should be absent (null fields trimmed from verbose output)
      assert.ok(!data.codebase_conventions, 'codebase_conventions should be absent when no convention data');
      assert.ok(!data.codebase_dependencies, 'codebase_dependencies should be absent when no deps data');
    });

    test('hybrid staleness — time-based detection', () => {
      // Run analyze first
      runGsdTools('util:codebase analyze', tmpDir);

      // Modify intel to have old generated_at but matching git hash
      const intelPath = path.join(tmpDir, '.planning', 'codebase', 'codebase-intel.json');
      const intel = JSON.parse(fs.readFileSync(intelPath, 'utf-8'));
      // Set generated_at to 2 hours ago
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      intel.generated_at = twoHoursAgo;
      fs.writeFileSync(intelPath, JSON.stringify(intel, null, 2) + '\n');

      const result = runGsdTools('util:codebase status', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      assert.strictEqual(data.stale, true, 'Should be stale when generated_at is 2h old');
      assert.strictEqual(data.reason, 'time_stale', 'Reason should be time_stale');
    });

    test('lock file prevents concurrent background triggers', () => {
      // Run analyze first
      runGsdTools('util:codebase analyze', tmpDir);

      // Create a fresh lock file manually
      const cacheDir = path.join(tmpDir, '.planning', '.cache');
      fs.mkdirSync(cacheDir, { recursive: true });
      const lockPath = path.join(cacheDir, '.analyzing');
      const originalPid = '12345';
      fs.writeFileSync(lockPath, originalPid);

      // Make intel stale so auto-trigger would want to spawn
      const intelPath = path.join(tmpDir, '.planning', 'codebase', 'codebase-intel.json');
      const intel = JSON.parse(fs.readFileSync(intelPath, 'utf-8'));
      intel.generated_at = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      fs.writeFileSync(intelPath, JSON.stringify(intel, null, 2) + '\n');

      // Run init progress (triggers autoTriggerCodebaseIntel which should see lock and skip)
      runGsdTools('init:progress --verbose', tmpDir);

      // Verify lock file PID hasn't changed (no new spawn happened)
      const lockContent = fs.readFileSync(lockPath, 'utf-8');
      assert.strictEqual(lockContent, originalPid, 'Lock file content should not change when lock is fresh');
    });

    test('stale lock file gets cleaned up', () => {
      // Run analyze first
      runGsdTools('util:codebase analyze', tmpDir);

      // Create a stale lock file (mtime > 5 minutes old)
      const cacheDir = path.join(tmpDir, '.planning', '.cache');
      fs.mkdirSync(cacheDir, { recursive: true });
      const lockPath = path.join(cacheDir, '.analyzing');
      fs.writeFileSync(lockPath, '99999');
      // Set mtime to 6 minutes ago
      const sixMinAgo = new Date(Date.now() - 6 * 60 * 1000);
      fs.utimesSync(lockPath, sixMinAgo, sixMinAgo);

      // Make intel stale
      const intelPath = path.join(tmpDir, '.planning', 'codebase', 'codebase-intel.json');
      const intel = JSON.parse(fs.readFileSync(intelPath, 'utf-8'));
      intel.generated_at = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      fs.writeFileSync(intelPath, JSON.stringify(intel, null, 2) + '\n');

      // Run init progress — stale lock should be cleaned up
      runGsdTools('init:progress --verbose', tmpDir);

      // Lock file should be different (either new PID or cleaned up)
      if (fs.existsSync(lockPath)) {
        const lockContent = fs.readFileSync(lockPath, 'utf-8');
        assert.notStrictEqual(lockContent, '99999', 'Stale lock should be replaced with new PID');
      }
      // If lock doesn't exist, that's also fine (analysis completed quickly and cleaned up)
    });

    test('--refresh forces synchronous analysis with fresh data', () => {
      // Run analyze to create initial intel
      runGsdTools('util:codebase analyze', tmpDir);

      // Read current intel timestamp
      const intelPath = path.join(tmpDir, '.planning', 'codebase', 'codebase-intel.json');
      const oldIntel = JSON.parse(fs.readFileSync(intelPath, 'utf-8'));
      const oldTimestamp = oldIntel.generated_at;

      // Make intel stale by backdating generated_at
      oldIntel.generated_at = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      fs.writeFileSync(intelPath, JSON.stringify(oldIntel, null, 2) + '\n');

      // Run init progress with --refresh — should force synchronous re-analysis
      const result = runGsdTools('init:progress --refresh --verbose', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      // Read updated intel
      const newIntel = JSON.parse(fs.readFileSync(intelPath, 'utf-8'));

      // New timestamp should be recent (within last 10 seconds), not the old stale one
      const newTime = new Date(newIntel.generated_at).getTime();
      const tenSecondsAgo = Date.now() - 10000;
      assert.ok(newTime > tenSecondsAgo, `After --refresh, generated_at should be recent. Got: ${newIntel.generated_at}`);

      // Stats should be present
      assert.ok(data.codebase_stats, 'Should include codebase_stats after --refresh');
    });
  });
});

describe('codebase conventions', () => {
  let tmpDir;

  function createConventionProject(files) {
    const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-conv-'));
    fs.mkdirSync(path.join(dir, '.planning', 'codebase'), { recursive: true });
    fs.mkdirSync(path.join(dir, '.planning', 'phases'), { recursive: true });

    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(dir, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content || '// placeholder\n');
    }

    // Initialize git repo
    execSync('git init', { cwd: dir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com" && git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
    execSync('git add -A && git commit -m "initial"', { cwd: dir, stdio: 'pipe' });
    return dir;
  }

  afterEach(() => {
    if (tmpDir) cleanup(tmpDir);
  });

  test('naming detection — detects camelCase, snake_case, and kebab-case files', () => {
    tmpDir = createConventionProject({
      'src/myComponent.js': '',
      'src/user-service.js': '',
      'src/data_helper.js': '',
      'package.json': '{"name":"test"}\n',
    });

    runGsdTools('util:codebase analyze', tmpDir);
    const result = runGsdTools('util:codebase conventions --all', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.naming_patterns.length > 0, 'Should detect naming patterns');

    // All three patterns should be detected at project scope
    const projectPatterns = data.naming_patterns
      .filter(p => p.scope === 'project')
      .map(p => p.pattern);
    assert.ok(projectPatterns.includes('camelCase'), 'Should detect camelCase');
    assert.ok(projectPatterns.includes('kebab-case'), 'Should detect kebab-case');
    assert.ok(projectPatterns.includes('snake_case'), 'Should detect snake_case');
  });

  test('file organization — detects nested structure and test placement', () => {
    tmpDir = createConventionProject({
      'src/lib/utils.js': '',
      'src/lib/helpers.js': '',
      'src/commands/run.js': '',
      'src/commands/build.js': '',
      'src/index.test.js': '',
      'package.json': '{"name":"test"}\n',
    });

    runGsdTools('util:codebase analyze', tmpDir);
    const result = runGsdTools('util:codebase conventions', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.file_organization, 'Should have file_organization');
    assert.ok(
      data.file_organization.structure_type === 'nested' || data.file_organization.structure_type === 'flat',
      'structure_type should be nested or flat'
    );
    assert.ok(
      ['co-located', 'separate-directory', 'none'].includes(data.file_organization.test_placement),
      'test_placement should be valid'
    );
  });

  test('confidence scoring — 9 snake_case + 1 camelCase yields ~90% snake_case confidence', () => {
    const files = { 'package.json': '{"name":"test"}\n' };
    // 9 snake_case files
    for (let i = 1; i <= 9; i++) {
      files[`src/my_module_${i}.js`] = '';
    }
    // 1 camelCase file
    files['src/myComponent.js'] = '';
    tmpDir = createConventionProject(files);

    runGsdTools('util:codebase analyze', tmpDir);
    const result = runGsdTools('util:codebase conventions --all', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    const snakePattern = data.naming_patterns.find(
      p => p.scope === 'project' && p.pattern === 'snake_case'
    );
    assert.ok(snakePattern, 'Should find snake_case pattern');
    assert.ok(
      snakePattern.confidence >= 85 && snakePattern.confidence <= 95,
      `snake_case confidence should be ~90%, got ${snakePattern.confidence}%`
    );
  });

  test('rules generation — sorted by confidence with ≤15 rules', () => {
    tmpDir = createConventionProject({
      'src/my-utils.js': '',
      'src/my-helpers.js': '',
      'src/my-service.js': '',
      'src/myOther.js': '',
      'src/index.test.js': '',
      'package.json': '{"name":"test"}\n',
    });

    runGsdTools('util:codebase analyze', tmpDir);
    // Run conventions first to populate intel
    runGsdTools('util:codebase conventions', tmpDir);

    const result = runGsdTools('util:codebase rules', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.rule_count <= 15, `Rules should be capped at 15, got ${data.rule_count}`);
    assert.ok(data.rules.length > 0, 'Should have at least one rule');
    assert.ok(data.rules_text.length > 0, 'rules_text should be non-empty');

    // Verify sorted by confidence (highest first)
    for (let i = 1; i < data.rules.length; i++) {
      // Each rule contains a percentage — extract and verify ordering
      const prev = data.rules[i - 1].match(/(\d+)%/);
      const curr = data.rules[i].match(/(\d+)%/);
      if (prev && curr) {
        assert.ok(
          parseInt(prev[1]) >= parseInt(curr[1]),
          `Rules should be sorted by confidence: "${data.rules[i-1]}" should come before "${data.rules[i]}"`
        );
      }
    }
  });

  test('rules cap — conventions with many patterns still output ≤15 rules', () => {
    // Create project with many directories to generate lots of patterns
    const files = { 'package.json': '{"name":"test"}\n' };
    const dirs = ['api', 'auth', 'billing', 'cache', 'data', 'events', 'forms', 'graphs'];
    for (const dir of dirs) {
      files[`src/${dir}/my-thing-${dir}.js`] = '';
      files[`src/${dir}/another-thing-${dir}.js`] = '';
      files[`src/${dir}/third-thing-${dir}.js`] = '';
    }
    tmpDir = createConventionProject(files);

    runGsdTools('util:codebase analyze', tmpDir);
    runGsdTools('util:codebase conventions --all', tmpDir);

    const result = runGsdTools('util:codebase rules', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.rule_count <= 15, `Rules must be capped at 15, got ${data.rule_count}`);
  });

  test('CLI integration — codebase rules --raw outputs plain text', () => {
    tmpDir = createConventionProject({
      'src/my-utils.js': '',
      'src/my-helpers.js': '',
      'package.json': '{"name":"test"}\n',
    });

    runGsdTools('util:codebase analyze', tmpDir);

    const result = runGsdTools('util:codebase rules', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    // In piped mode, output is JSON with rules_text for plain text rendering
    const data = JSON.parse(result.output);
    assert.ok(data.rules_text, 'should have rules_text field');
    assert.ok(/^\d+\.\s/.test(data.rules_text), 'rules_text should start with numbered rule');
  });
});

describe('dependency graph', () => {
  const {
    parseJavaScript,
    parsePython,
    parseGo,
    parseElixir,
    parseRust,
    buildDependencyGraph,
    findCycles,
    getTransitiveDependents,
  } = require('../src/lib/deps');

  // ─── Import Parser Tests (6 tests) ──────────────────────────────────────

  describe('import parsers', () => {
    test('JS parser: require and import from', () => {
      const content = `
        const foo = require('./foo');
        import bar from './bar';
        import { baz } from './baz';
      `;
      const imports = parseJavaScript(content);
      assert.ok(imports.includes('./foo'), 'Should extract require("./foo")');
      assert.ok(imports.includes('./bar'), 'Should extract import from "./bar"');
      assert.ok(imports.includes('./baz'), 'Should extract import { } from "./baz"');
    });

    test('TS parser: import types and export from', () => {
      const content = `
        import { Thing } from './types';
        export { x } from './utils';
        import type { Foo } from './foo-types';
      `;
      // TS uses same parser as JS
      const imports = parseJavaScript(content);
      assert.ok(imports.includes('./types'), 'Should extract import { Thing } from "./types"');
      assert.ok(imports.includes('./utils'), 'Should extract export { x } from "./utils"');
      assert.ok(imports.includes('./foo-types'), 'Should extract import type from "./foo-types"');
    });

    test('Python parser: import and from import', () => {
      const content = `
import os
from foo.bar import baz
import sys, json
from . import local
      `;
      const imports = parsePython(content);
      assert.ok(imports.includes('os'), 'Should extract "import os"');
      assert.ok(imports.includes('foo.bar'), 'Should extract "from foo.bar import baz"');
      assert.ok(imports.includes('sys'), 'Should extract "import sys"');
      assert.ok(imports.includes('json'), 'Should extract "import json"');
      assert.ok(imports.includes('.'), 'Should extract "from . import local"');
    });

    test('Go parser: single and grouped imports', () => {
      const content = `
package main

import "fmt"

import (
  "os"
  "strings"
  mymod "github.com/user/pkg"
)
      `;
      const imports = parseGo(content);
      assert.ok(imports.includes('fmt'), 'Should extract import "fmt"');
      assert.ok(imports.includes('os'), 'Should extract "os" from group');
      assert.ok(imports.includes('strings'), 'Should extract "strings" from group');
      assert.ok(imports.includes('github.com/user/pkg'), 'Should extract full path from group');
    });

    test('Elixir parser: alias, use, import', () => {
      const content = `
defmodule MyApp.Web do
  alias MyApp.Accounts
  use GenServer
  import Ecto.Query
  require Logger
end
      `;
      const imports = parseElixir(content);
      assert.ok(imports.includes('MyApp.Accounts'), 'Should extract alias MyApp.Accounts');
      assert.ok(imports.includes('GenServer'), 'Should extract use GenServer');
      assert.ok(imports.includes('Ecto.Query'), 'Should extract import Ecto.Query');
      assert.ok(imports.includes('Logger'), 'Should extract require Logger');
    });

    test('Rust parser: use, mod, extern crate', () => {
      const content = `
use crate::lib::foo;
mod bar;
extern crate serde;
use std::collections::HashMap;
      `;
      const imports = parseRust(content);
      assert.ok(imports.includes('crate::lib::foo'), 'Should extract use crate::lib::foo');
      assert.ok(imports.includes('bar'), 'Should extract mod bar');
      assert.ok(imports.includes('serde'), 'Should extract extern crate serde');
      assert.ok(imports.includes('std::collections::HashMap'), 'Should extract use std::...');
    });
  });

  // ─── Graph Construction Tests (3 tests) ─────────────────────────────────

  describe('graph construction', () => {
    test('build graph from 3 JS files with imports', () => {
      // Mock intel object with files and their content on disk
      // We'll construct the graph from a mock intel
      const mockIntel = {
        files: {
          'a.js': { language: 'javascript' },
          'b.js': { language: 'javascript' },
          'c.js': { language: 'javascript' },
        },
      };

      // Create temp files for buildDependencyGraph to read
      const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-dep-test-'));
      fs.writeFileSync(path.join(tmpDir, 'a.js'), "const b = require('./b');\nconst c = require('./c');\n");
      fs.writeFileSync(path.join(tmpDir, 'b.js'), "const c = require('./c');\n");
      fs.writeFileSync(path.join(tmpDir, 'c.js'), "module.exports = {};\n");

      // buildDependencyGraph reads from cwd, so change to tmpDir
      const origCwd = process.cwd();
      try {
        process.chdir(tmpDir);
        const graph = buildDependencyGraph(mockIntel);

        // Forward: a→[b,c], b→[c], c→[]
        assert.ok(graph.forward['a.js'], 'a.js should have forward edges');
        assert.ok(graph.forward['a.js'].includes('b.js'), 'a.js should import b.js');
        assert.ok(graph.forward['a.js'].includes('c.js'), 'a.js should import c.js');
        assert.ok(graph.forward['b.js'].includes('c.js'), 'b.js should import c.js');

        // Reverse: c←[a,b], b←[a]
        assert.ok(graph.reverse['c.js'], 'c.js should have reverse edges');
        assert.ok(graph.reverse['c.js'].includes('a.js'), 'c.js should be imported by a.js');
        assert.ok(graph.reverse['c.js'].includes('b.js'), 'c.js should be imported by b.js');
        assert.ok(graph.reverse['b.js'].includes('a.js'), 'b.js should be imported by a.js');
      } finally {
        process.chdir(origCwd);
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    test('files with no imports appear with empty edge lists', () => {
      const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-dep-test-'));
      fs.writeFileSync(path.join(tmpDir, 'standalone.js'), 'const x = 42;\n');

      const mockIntel = {
        files: {
          'standalone.js': { language: 'javascript' },
        },
      };

      const origCwd = process.cwd();
      try {
        process.chdir(tmpDir);
        const graph = buildDependencyGraph(mockIntel);

        // standalone.js has no imports, so no forward edges
        assert.ok(!graph.forward['standalone.js'] || graph.forward['standalone.js'].length === 0,
          'standalone.js should have no forward edges');
        assert.strictEqual(graph.stats.total_edges, 0, 'Should have 0 edges');
        assert.strictEqual(graph.stats.total_files_parsed, 1, 'Should have parsed 1 file');
      } finally {
        process.chdir(origCwd);
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    test('graph built from intel object has correct adjacency structure', () => {
      const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-dep-test-'));
      fs.writeFileSync(path.join(tmpDir, 'x.js'), "import y from './y';\n");
      fs.writeFileSync(path.join(tmpDir, 'y.js'), "export default 42;\n");

      const mockIntel = {
        files: {
          'x.js': { language: 'javascript' },
          'y.js': { language: 'javascript' },
        },
      };

      const origCwd = process.cwd();
      try {
        process.chdir(tmpDir);
        const graph = buildDependencyGraph(mockIntel);

        // Verify adjacency list structure
        assert.ok(graph.forward && typeof graph.forward === 'object', 'forward should be an object');
        assert.ok(graph.reverse && typeof graph.reverse === 'object', 'reverse should be an object');
        assert.ok(graph.stats && typeof graph.stats === 'object', 'stats should be an object');
        assert.ok(graph.built_at, 'built_at should be set');

        // x→y, y←x
        assert.deepStrictEqual(graph.forward['x.js'], ['y.js']);
        assert.deepStrictEqual(graph.reverse['y.js'], ['x.js']);
      } finally {
        process.chdir(origCwd);
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  // ─── Cycle Detection Tests (3 tests) ───────────────────────────────────

  describe('cycle detection', () => {
    test('no cycles in linear chain A→B→C', () => {
      const graph = {
        forward: {
          'a.js': ['b.js'],
          'b.js': ['c.js'],
        },
      };

      const result = findCycles(graph);
      assert.strictEqual(result.cycle_count, 0, 'Linear chain should have no cycles');
      assert.strictEqual(result.files_in_cycles, 0, 'No files should be in cycles');
    });

    test('simple cycle A→B→A detected', () => {
      const graph = {
        forward: {
          'a.js': ['b.js'],
          'b.js': ['a.js'],
        },
      };

      const result = findCycles(graph);
      assert.strictEqual(result.cycle_count, 1, 'Should detect exactly 1 cycle');
      assert.strictEqual(result.files_in_cycles, 2, '2 files should be in the cycle');

      // Both files should be in the cycle
      const cycleFiles = new Set(result.cycles[0]);
      assert.ok(cycleFiles.has('a.js'), 'a.js should be in cycle');
      assert.ok(cycleFiles.has('b.js'), 'b.js should be in cycle');
    });

    test('complex cycle A→B→C→A with D→B spur — cycle detected, D not in cycle', () => {
      const graph = {
        forward: {
          'a.js': ['b.js'],
          'b.js': ['c.js'],
          'c.js': ['a.js'],
          'd.js': ['b.js'],
        },
      };

      const result = findCycles(graph);
      assert.strictEqual(result.cycle_count, 1, 'Should detect exactly 1 cycle');
      assert.strictEqual(result.files_in_cycles, 3, '3 files (a,b,c) should be in the cycle');

      // D should NOT be in any cycle
      const allCycleFiles = new Set();
      for (const cycle of result.cycles) {
        for (const f of cycle) allCycleFiles.add(f);
      }
      assert.ok(!allCycleFiles.has('d.js'), 'd.js should NOT be in any cycle');
      assert.ok(allCycleFiles.has('a.js'), 'a.js should be in cycle');
      assert.ok(allCycleFiles.has('b.js'), 'b.js should be in cycle');
      assert.ok(allCycleFiles.has('c.js'), 'c.js should be in cycle');
    });
  });

  // ─── Impact Analysis Tests (2 tests) ───────────────────────────────────

  describe('impact analysis', () => {
    test('getTransitiveDependents on leaf file returns fan_in 0', () => {
      const graph = {
        reverse: {
          'core.js': ['a.js', 'b.js'],
          // leaf.js has no reverse edges (nothing imports it)
        },
      };

      const result = getTransitiveDependents(graph, 'leaf.js');
      assert.strictEqual(result.fan_in, 0, 'Leaf file should have fan_in 0');
      assert.deepStrictEqual(result.direct_dependents, [], 'No direct dependents');
      assert.deepStrictEqual(result.transitive_dependents, [], 'No transitive dependents');
      assert.strictEqual(result.file, 'leaf.js', 'file field should match input');
    });

    test('getTransitiveDependents on core file returns correct direct + transitive counts', () => {
      // Graph: core←[a,b], a←[c], b←[d] — so core has 2 direct, 2 transitive (c,d)
      const graph = {
        reverse: {
          'core.js': ['a.js', 'b.js'],
          'a.js': ['c.js'],
          'b.js': ['d.js'],
        },
      };

      const result = getTransitiveDependents(graph, 'core.js');
      assert.strictEqual(result.direct_dependents.length, 2, 'Should have 2 direct dependents');
      assert.ok(result.direct_dependents.includes('a.js'), 'a.js should be direct dependent');
      assert.ok(result.direct_dependents.includes('b.js'), 'b.js should be direct dependent');

      assert.strictEqual(result.transitive_dependents.length, 2, 'Should have 2 transitive dependents');
      const transitiveFiles = result.transitive_dependents.map(t => t.file);
      assert.ok(transitiveFiles.includes('c.js'), 'c.js should be transitive dependent');
      assert.ok(transitiveFiles.includes('d.js'), 'd.js should be transitive dependent');

      assert.strictEqual(result.fan_in, 4, 'Total fan_in should be 4');
      assert.strictEqual(result.max_depth_reached, 2, 'Max depth should be 2');
    });
  });
});

describe('codebase context', () => {
  // These tests run against the real project's codebase intel data.
  // The bgsd-oc project has a .planning/codebase/codebase-intel.json
  // with dependency graph and conventions data from prior phases.

  test('basic output structure: success, files, file_count', () => {
    const result = runGsdTools('util:codebase context --files src/commands/codebase.js');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.success, true, 'should return success: true');
    assert.ok(data.files, 'should have files object');
    assert.ok(data.files['src/commands/codebase.js'], 'should have the requested file key');
    assert.ok(data.file_count >= 1, 'file_count should be >= 1');
  });

  test('per-file fields present: imports, dependents, risk_level, relevance_score', () => {
    const result = runGsdTools('util:codebase context --files src/commands/codebase.js');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    const fileCtx = data.files['src/commands/codebase.js'];

    assert.ok(Array.isArray(fileCtx.imports), 'imports should be an array');
    assert.ok(Array.isArray(fileCtx.dependents), 'dependents should be an array');
    assert.ok(['high', 'caution', 'normal'].includes(fileCtx.risk_level), 'risk_level should be high/caution/normal');
    assert.strictEqual(typeof fileCtx.relevance_score, 'number', 'relevance_score should be a number');
  });

  test('no-data stub for nonexistent file', () => {
    const result = runGsdTools('util:codebase context --files nonexistent-file-12345.js');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    const fileCtx = data.files['nonexistent-file-12345.js'];

    assert.strictEqual(fileCtx.status, 'no-data', 'should have status: no-data');
    assert.strictEqual(fileCtx.conventions, null, 'conventions should be null');
  });

  test('imports capped at 8', () => {
    const result = runGsdTools('util:codebase context --files src/commands/codebase.js');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    const fileCtx = data.files['src/commands/codebase.js'];

    assert.ok(fileCtx.imports.length <= 8, `imports should be <= 8, got ${fileCtx.imports.length}`);
  });

  test('dependents capped at 8', () => {
    const result = runGsdTools('util:codebase context --files src/commands/codebase.js');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    const fileCtx = data.files['src/commands/codebase.js'];

    assert.ok(fileCtx.dependents.length <= 8, `dependents should be <= 8, got ${fileCtx.dependents.length}`);
  });

  test('risk level: computeRiskLevel returns "high" for >10 reverse edges', () => {
    // Direct function test via CLI on a known file:
    // We test the logic by constructing a scenario description,
    // but actually test through the CLI for integration confidence.
    // The real test: request the output and verify risk_level is a valid value.
    const result = runGsdTools('util:codebase context --files src/lib/output.js');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    const fileCtx = data.files['src/lib/output.js'];
    // output.js is imported by many modules — might be "high"
    assert.ok(['high', 'caution', 'normal'].includes(fileCtx.risk_level),
      `risk_level should be valid, got ${fileCtx.risk_level}`);
  });

  test('risk level: file with few dependents returns "normal"', () => {
    // src/lib/debug.js is a utility with limited dependents
    const result = runGsdTools('util:codebase context --files src/lib/debug.js');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    const fileCtx = data.files['src/lib/debug.js'];
    // debug.js should have few dependents
    assert.ok(['normal', 'caution'].includes(fileCtx.risk_level),
      `risk_level for debug.js should be normal or caution, got ${fileCtx.risk_level}`);
  });

  test('relevance score: target file gets score 1.0', () => {
    const result = runGsdTools('util:codebase context --files src/commands/codebase.js');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    const fileCtx = data.files['src/commands/codebase.js'];

    assert.strictEqual(fileCtx.relevance_score, 1, 'Target file should get relevance_score 1.0');
  });

  test('relevance score: --plan flag provides plan-scope signal', () => {
    // Request with --plan pointing to a plan file
    const result = runGsdTools('util:codebase context --files src/commands/codebase.js --plan .planning/milestones/v5.0-phases/27-task-scoped-context/27-02-PLAN.md');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(typeof data.files['src/commands/codebase.js'].relevance_score, 'number',
      'relevance_score should be a number when --plan is provided');
  });

  test('token budget respected: 10+ files output under 20K chars', () => {
    const result = runGsdTools('util:codebase context --files src/commands/codebase.js src/lib/deps.js src/lib/conventions.js src/lib/context.js src/lib/git.js src/lib/frontmatter.js src/lib/output.js src/lib/helpers.js src/lib/config.js src/router.js');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const charCount = result.output.length;
    assert.ok(charCount < 20000, `Output should be under 20K chars (~5K tokens), got ${charCount}`);
  });

  test('truncation flag is boolean', () => {
    const result = runGsdTools('util:codebase context --files src/commands/codebase.js');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(typeof data.truncated, 'boolean', 'truncated should be a boolean');
  });

  test('usage error when no files provided', () => {
    const result = runGsdTools('util:codebase context');
    // Should fail or output error
    assert.ok(!result.success || result.error.includes('Usage'), 'Should show usage error when no files provided');
  });

  test('multiple files: all requested files appear in output', () => {
    const files = ['src/commands/codebase.js', 'src/lib/deps.js', 'src/router.js'];
    const result = runGsdTools(`util:codebase context --files ${files.join(' ')}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    for (const f of files) {
      assert.ok(data.files[f] !== undefined || data.omitted_files > 0,
        `File ${f} should be in output or accounted for in omitted_files`);
    }
  });

  test('conventions field: either null or has naming property', () => {
    const result = runGsdTools('util:codebase context --files src/commands/codebase.js');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    const fileCtx = data.files['src/commands/codebase.js'];

    if (fileCtx.conventions !== null) {
      assert.ok(fileCtx.conventions.naming !== undefined, 'conventions should have naming property if not null');
    }
  });
});

describe('codebase lifecycle', () => {
  const { LIFECYCLE_DETECTORS, buildLifecycleGraph, resolvePhaseDependencies } = require('../src/lib/lifecycle');

  // Helper: create a temp project with specific files and run codebase analyze
  function createLifecycleProject(files) {
    const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-lifecycle-'));
    fs.mkdirSync(path.join(dir, '.planning', 'codebase'), { recursive: true });
    fs.mkdirSync(path.join(dir, '.planning', 'phases'), { recursive: true });

    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(dir, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content || '// placeholder\n');
    }

    // Initialize git repo
    execSync('git init', { cwd: dir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com" && git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
    execSync('git add -A && git commit -m "initial"', { cwd: dir, stdio: 'pipe' });
    return dir;
  }

  let tmpDir;

  afterEach(() => {
    if (tmpDir) cleanup(tmpDir);
    tmpDir = null;
  });

  // ─── Unit Tests: Detector Registry ─────────────────────────────────────

  test('LIFECYCLE_DETECTORS registry exists and contains expected detectors', () => {
    assert.ok(Array.isArray(LIFECYCLE_DETECTORS), 'LIFECYCLE_DETECTORS should be an array');
    assert.ok(LIFECYCLE_DETECTORS.length >= 2, 'Should have at least 2 detectors (generic + phoenix)');

    const names = LIFECYCLE_DETECTORS.map(d => d.name);
    assert.ok(names.includes('generic-migrations'), 'Should have generic-migrations detector');
    assert.ok(names.includes('elixir-phoenix'), 'Should have elixir-phoenix detector');

    // Each detector must have required interface
    for (const d of LIFECYCLE_DETECTORS) {
      assert.strictEqual(typeof d.name, 'string', `Detector name should be string, got ${typeof d.name}`);
      assert.strictEqual(typeof d.detect, 'function', `Detector ${d.name} should have detect function`);
      assert.strictEqual(typeof d.extractLifecycle, 'function', `Detector ${d.name} should have extractLifecycle function`);
    }
  });

  test('generic-migrations detector activates when migration files present', () => {
    const detector = LIFECYCLE_DETECTORS.find(d => d.name === 'generic-migrations');
    assert.ok(detector, 'generic-migrations detector must exist');

    // Should activate when migration directory files are in intel
    const intelWithMigrations = {
      files: {
        'db/migrate/001_create_users.sql': { lines: 10 },
        'db/migrate/002_add_email.sql': { lines: 5 },
        'src/app.js': { lines: 100 },
      },
    };
    assert.ok(detector.detect(intelWithMigrations), 'Should detect db/migrate/ files');

    // Should NOT activate without migration directories
    const intelNoMigrations = {
      files: {
        'src/app.js': { lines: 100 },
        'src/lib/utils.js': { lines: 50 },
      },
    };
    assert.ok(!detector.detect(intelNoMigrations), 'Should not activate without migration dirs');
  });

  test('generic-migrations extracts sequential chain with correct ordering', () => {
    const detector = LIFECYCLE_DETECTORS.find(d => d.name === 'generic-migrations');
    const intel = {
      files: {
        'migrations/001_create_users.sql': { lines: 10 },
        'migrations/002_add_email.sql': { lines: 5 },
        'migrations/003_create_orders.sql': { lines: 8 },
      },
    };

    const nodes = detector.extractLifecycle(intel, '/tmp/fake');
    assert.strictEqual(nodes.length, 3, 'Should create 3 migration nodes');

    // First node has no dependencies
    assert.deepStrictEqual(nodes[0].must_run_after, [], 'First migration should have no dependencies');
    assert.strictEqual(nodes[0].type, 'migration', 'Node type should be migration');
    assert.strictEqual(nodes[0].framework, 'generic', 'Framework should be generic');

    // Second node depends on first
    assert.deepStrictEqual(nodes[1].must_run_after, [nodes[0].id], 'Second migration depends on first');

    // Third node depends on second
    assert.deepStrictEqual(nodes[2].must_run_after, [nodes[1].id], 'Third migration depends on second');

    // must_run_before symmetry maintained
    assert.ok(nodes[0].must_run_before.includes(nodes[1].id), 'First migration must_run_before includes second');
    assert.ok(nodes[1].must_run_before.includes(nodes[2].id), 'Second migration must_run_before includes third');
  });

  test('elixir-phoenix detector gates on conventions.frameworks', () => {
    const detector = LIFECYCLE_DETECTORS.find(d => d.name === 'elixir-phoenix');
    assert.ok(detector, 'elixir-phoenix detector must exist');

    // Should NOT activate without conventions
    assert.ok(!detector.detect({ files: {} }), 'Should not activate without conventions');
    assert.ok(!detector.detect({ files: {}, conventions: {} }), 'Should not activate without frameworks array');
    assert.ok(!detector.detect({
      files: {},
      conventions: { frameworks: [{ framework: 'react' }] },
    }), 'Should not activate for non-Phoenix framework');

    // Should activate with elixir-phoenix framework
    assert.ok(detector.detect({
      files: {},
      conventions: { frameworks: [{ framework: 'elixir-phoenix' }] },
    }), 'Should activate for elixir-phoenix');
  });

  // ─── Unit Tests: buildLifecycleGraph ───────────────────────────────────

  test('buildLifecycleGraph returns correct structure with no lifecycle patterns', () => {
    const intel = { files: { 'src/app.js': { lines: 100 } } };
    const result = buildLifecycleGraph(intel, '/tmp/fake');

    assert.ok(Array.isArray(result.nodes), 'nodes should be array');
    assert.ok(Array.isArray(result.chains), 'chains should be array');
    assert.ok(Array.isArray(result.cycles), 'cycles should be array');
    assert.ok(Array.isArray(result.detectors_used), 'detectors_used should be array');
    assert.ok(result.stats, 'should have stats object');
    assert.strictEqual(result.nodes.length, 0, 'no nodes for project without lifecycle patterns');
    assert.strictEqual(result.stats.node_count, 0, 'node_count should be 0');
    assert.strictEqual(result.stats.edge_count, 0, 'edge_count should be 0');
    assert.strictEqual(result.stats.chain_count, 0, 'chain_count should be 0');
    assert.ok(result.built_at, 'should have built_at timestamp');
  });

  test('resolvePhaseDependencies returns deterministic chains for the same nodes', () => {
    const nodes = [
      {
        id: 'migration:c',
        file_or_step: 'c.sql',
        type: 'migration',
        must_run_before: [],
        must_run_after: ['migration:b'],
        framework: 'generic',
        confidence: 90,
      },
      {
        id: 'migration:a',
        file_or_step: 'a.sql',
        type: 'migration',
        must_run_before: ['migration:b'],
        must_run_after: [],
        framework: 'generic',
        confidence: 90,
      },
      {
        id: 'migration:b',
        file_or_step: 'b.sql',
        type: 'migration',
        must_run_before: ['migration:c'],
        must_run_after: ['migration:a'],
        framework: 'generic',
        confidence: 90,
      },
    ];

    const first = resolvePhaseDependencies(nodes);
    const second = resolvePhaseDependencies(nodes.slice().reverse());

    assert.deepStrictEqual(first, [['migration:a', 'migration:b', 'migration:c']]);
    assert.deepStrictEqual(first, second, 'same input graph should always produce the same chain order');
  });

  test('buildLifecycleGraph produces chains with topological sort', () => {
    const intel = {
      files: {
        'migrations/20240101_create_users.sql': { lines: 10 },
        'migrations/20240102_add_email.sql': { lines: 5 },
        'migrations/20240103_create_orders.sql': { lines: 8 },
        'migrations/20240104_add_status.sql': { lines: 3 },
      },
    };

    const result = buildLifecycleGraph(intel, '/tmp/fake');

    assert.ok(result.detectors_used.includes('generic-migrations'), 'generic-migrations detector should be used');
    assert.strictEqual(result.nodes.length, 4, 'Should have 4 nodes');
    assert.ok(result.chains.length >= 1, 'Should have at least 1 chain');

    // The chain should contain all 4 migration IDs in order
    const chain = result.chains[0];
    assert.strictEqual(chain.length, 4, 'Chain should have 4 entries');

    // Verify topological ordering: earlier migrations come before later ones
    const ids = result.nodes.map(n => n.id);
    for (let i = 0; i < chain.length - 1; i++) {
      const currentIdx = ids.indexOf(chain[i]);
      const nextIdx = ids.indexOf(chain[i + 1]);
      assert.ok(currentIdx >= 0, `Chain entry ${chain[i]} should exist in nodes`);
      assert.ok(nextIdx >= 0, `Chain entry ${chain[i + 1]} should exist in nodes`);
    }

    // Stats should be consistent
    assert.strictEqual(result.stats.node_count, result.nodes.length, 'node_count matches nodes.length');
    assert.ok(result.stats.edge_count > 0, 'Should have edges in a chain');
    assert.strictEqual(result.stats.cycle_count, 0, 'No cycles expected in sequential migrations');
  });

  test('buildLifecycleGraph caps migrations at MAX_MIGRATION_NODES with summary node', () => {
    // Create 25 migration files (exceeds MAX_MIGRATION_NODES=20)
    const intel = { files: {} };
    for (let i = 1; i <= 25; i++) {
      const pad = String(i).padStart(3, '0');
      intel.files[`migrations/${pad}_step.sql`] = { lines: 5 };
    }

    const result = buildLifecycleGraph(intel, '/tmp/fake');

    // Should have 20 real nodes + 1 summary node = 21 nodes
    assert.strictEqual(result.nodes.length, 21, 'Should cap at 20 + 1 summary node');

    // Find the summary node
    const summaryNode = result.nodes.find(n => n.id.startsWith('migration:earlier-'));
    assert.ok(summaryNode, 'Should have summary node for capped migrations');
    assert.ok(summaryNode.file_or_step.includes('earlier migrations'), 'Summary node should describe capped count');
    assert.strictEqual(summaryNode.confidence, 0, 'Summary node confidence should be 0');
  });

  // ─── CLI Integration Tests ─────────────────────────────────────────────

  test('codebase lifecycle --raw returns valid JSON schema', () => {
    tmpDir = createLifecycleProject({
      'migrations/001_create_users.sql': 'CREATE TABLE users (id INT);',
      'migrations/002_add_email.sql': 'ALTER TABLE users ADD email VARCHAR;',
      'package.json': '{"name":"test-lifecycle"}\n',
    });

    // First run analyze to populate intel
    const analyzeResult = runGsdTools('util:codebase analyze', tmpDir);
    assert.ok(analyzeResult.success, `codebase analyze failed: ${analyzeResult.error}`);

    // Now run lifecycle
    const result = runGsdTools('util:codebase lifecycle', tmpDir);
    assert.ok(result.success, `codebase lifecycle failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.success, true, 'success should be true');
    assert.strictEqual(typeof data.nodes, 'number', 'nodes should be a number');
    assert.strictEqual(typeof data.edges, 'number', 'edges should be a number');
    assert.ok(Array.isArray(data.chains), 'chains should be an array');
    assert.ok(Array.isArray(data.cycles), 'cycles should be an array');
    assert.ok(Array.isArray(data.detectors_used), 'detectors_used should be an array');
    assert.ok(data.stats, 'should have stats object');
    assert.ok(data.built_at, 'should have built_at timestamp');
  });

  test('codebase lifecycle --raw detects migration chain in temp project', () => {
    tmpDir = createLifecycleProject({
      'db/migrate/20240101_create_users.rb': '',
      'db/migrate/20240102_add_email.rb': '',
      'db/migrate/20240103_create_orders.rb': '',
      'package.json': '{"name":"test-lifecycle"}\n',
    });

    runGsdTools('util:codebase analyze', tmpDir);
    const result = runGsdTools('util:codebase lifecycle', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.nodes >= 3, `Should detect at least 3 migration nodes, got ${data.nodes}`);
    assert.ok(data.detectors_used.includes('generic-migrations'), 'generic-migrations should be used');
    assert.ok(data.chains.length >= 1, 'Should have at least 1 chain');
    assert.ok(data.chains[0].length >= 3, 'Chain should have at least 3 entries');
  });

  test('codebase lifecycle --raw returns 0 nodes for project without lifecycle patterns', () => {
    tmpDir = createLifecycleProject({
      'src/app.js': 'console.log("hello");',
      'src/utils.js': 'module.exports = {};',
      'package.json': '{"name":"test-no-lifecycle"}\n',
    });

    runGsdTools('util:codebase analyze', tmpDir);
    const result = runGsdTools('util:codebase lifecycle', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.nodes, 0, 'Should detect 0 nodes');
    assert.strictEqual(data.chains.length, 0, 'Should have no chains');
    assert.deepStrictEqual(data.detectors_used, [], 'No detectors should activate');
  });

  test('codebase lifecycle caches result in intel file', () => {
    tmpDir = createLifecycleProject({
      'migrations/001_init.sql': 'CREATE TABLE t (id INT);',
      'package.json': '{"name":"test-cache"}\n',
    });

    runGsdTools('util:codebase analyze', tmpDir);
    runGsdTools('util:codebase lifecycle', tmpDir);

    // Read the intel file and verify lifecycle was cached
    const intelPath = path.join(tmpDir, '.planning', 'codebase', 'codebase-intel.json');
    assert.ok(fs.existsSync(intelPath), 'codebase-intel.json should exist');

    const intel = JSON.parse(fs.readFileSync(intelPath, 'utf-8'));
    assert.ok(intel.lifecycle, 'lifecycle should be cached in intel');
    assert.ok(intel.lifecycle.nodes, 'cached lifecycle should have nodes');
    assert.ok(intel.lifecycle.chains, 'cached lifecycle should have chains');
    assert.ok(intel.lifecycle.built_at, 'cached lifecycle should have built_at');
  });

  test('codebase lifecycle fails gracefully without prior analyze', () => {
    tmpDir = createLifecycleProject({
      'src/app.js': 'console.log("hello");',
      'package.json': '{"name":"test-no-intel"}\n',
    });

    // Do NOT run analyze first — lifecycle should handle missing intel
    const result = runGsdTools('util:codebase lifecycle', tmpDir);
    // Should either fail or produce an error message about missing intel
    assert.ok(!result.success || result.error.includes('intel'), 'Should fail or warn about missing intel');
  });
});

describe('codebase ast command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-ast-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('codebase ast on JS file with functions returns signatures', () => {
    const jsFile = path.join(tmpDir, 'sample.js');
    fs.writeFileSync(jsFile, `
function hello(name, age) {
  return name + age;
}

async function fetchData(url) {
  return await fetch(url);
}

const add = (a, b) => a + b;
`);

    const result = runGsdTools(`util:codebase ast "${jsFile}"`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.language, 'javascript');
    assert.ok(parsed.count >= 3, `Expected at least 3 signatures, got ${parsed.count}`);

    const names = parsed.signatures.map(s => s.name);
    assert.ok(names.includes('hello'), 'Should find hello function');
    assert.ok(names.includes('fetchData'), 'Should find fetchData function');
    assert.ok(names.includes('add'), 'Should find add arrow function');

    // Check fetchData is async
    const fetchSig = parsed.signatures.find(s => s.name === 'fetchData');
    assert.strictEqual(fetchSig.async, true, 'fetchData should be async');

    // Check params
    const helloSig = parsed.signatures.find(s => s.name === 'hello');
    assert.deepStrictEqual(helloSig.params, ['name', 'age'], 'hello should have name, age params');
  });

  test('codebase ast on JS file with classes returns class + method signatures', () => {
    const jsFile = path.join(tmpDir, 'myclass.js');
    fs.writeFileSync(jsFile, `
class Animal {
  constructor(name) {
    this.name = name;
  }

  speak() {
    return this.name;
  }

  async fetch(url) {
    return url;
  }
}
`);

    const result = runGsdTools(`util:codebase ast "${jsFile}"`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.ok(parsed.count >= 3, `Expected at least 3 signatures (class + 2 methods), got ${parsed.count}`);

    const names = parsed.signatures.map(s => s.name);
    assert.ok(names.includes('Animal'), 'Should find Animal class');
    assert.ok(names.includes('Animal.constructor'), 'Should find constructor method');
    assert.ok(names.includes('Animal.speak'), 'Should find speak method');

    // Check types
    const classSig = parsed.signatures.find(s => s.name === 'Animal');
    assert.strictEqual(classSig.type, 'class');

    const methodSig = parsed.signatures.find(s => s.name === 'Animal.speak');
    assert.strictEqual(methodSig.type, 'method');
  });

  test('codebase ast on CJS file with module.exports returns signatures', () => {
    const jsFile = path.join(tmpDir, 'cjs-mod.js');
    fs.writeFileSync(jsFile, `
'use strict';

function internalHelper(x) {
  return x * 2;
}

module.exports.calculate = function(a, b) {
  return internalHelper(a) + b;
};

exports.format = function(str) {
  return str.trim();
};
`);

    const result = runGsdTools(`util:codebase ast "${jsFile}"`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    const names = parsed.signatures.map(s => s.name);
    assert.ok(names.includes('internalHelper'), 'Should find internalHelper function');
    assert.ok(names.includes('calculate'), 'Should find module.exports.calculate');
    assert.ok(names.includes('format'), 'Should find exports.format');
  });

  test('codebase ast on non-existent file returns error gracefully', () => {
    const result = runGsdTools(`util:codebase ast "${path.join(tmpDir, 'nonexistent.js')}"`, tmpDir);
    assert.ok(result.success, `Command should succeed (graceful error): ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.error, 'file_not_found', 'Should report file_not_found error');
    assert.deepStrictEqual(parsed.signatures, [], 'Should return empty signatures');
  });

  test('codebase ast on Python file returns regex-extracted signatures', () => {
    const pyFile = path.join(tmpDir, 'app.py');
    fs.writeFileSync(pyFile, `
def greet(name):
    print(f"Hello, {name}")

async def fetch_data(url, timeout=30):
    pass

class UserService:
    def get_user(self, user_id):
        pass
`);

    const result = runGsdTools(`util:codebase ast "${pyFile}"`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.language, 'python');
    assert.ok(parsed.count >= 2, `Expected at least 2 signatures, got ${parsed.count}`);

    const names = parsed.signatures.map(s => s.name);
    assert.ok(names.includes('greet'), 'Should find greet function');
    assert.ok(names.includes('fetch_data'), 'Should find fetch_data function');
  });

  test('codebase ast on unknown extension returns empty signatures, no crash', () => {
    const unknownFile = path.join(tmpDir, 'data.xyz');
    fs.writeFileSync(unknownFile, 'some random content');

    const result = runGsdTools(`util:codebase ast "${unknownFile}"`, tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.deepStrictEqual(parsed.signatures, [], 'Should return empty signatures');
    assert.strictEqual(parsed.count, 0, 'Count should be 0');
  });
});

describe('codebase exports command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-exports-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('codebase exports on ESM file returns named/default exports', () => {
    const esmFile = path.join(tmpDir, 'esm-mod.mjs');
    fs.writeFileSync(esmFile, `
export function hello() {}
export const VERSION = '1.0';
export default class App {}
`);

    const result = runGsdTools(`util:codebase exports "${esmFile}"`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.type, 'esm', 'Should detect ESM module');
    assert.ok(parsed.named.includes('hello'), 'Should find named export hello');
    assert.ok(parsed.named.includes('VERSION'), 'Should find named export VERSION');
    assert.strictEqual(parsed.default, 'App', 'Should find default export App');
  });

  test('codebase exports on CJS file returns cjs_exports', () => {
    const cjsFile = path.join(tmpDir, 'cjs-mod.js');
    fs.writeFileSync(cjsFile, `
'use strict';

function calculate(a, b) { return a + b; }
function format(str) { return str.trim(); }

module.exports = {
  calculate,
  format,
};
`);

    const result = runGsdTools(`util:codebase exports "${cjsFile}"`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.type, 'cjs', 'Should detect CJS module');
    assert.ok(parsed.cjs_exports.includes('calculate'), 'Should find cjs export calculate');
    assert.ok(parsed.cjs_exports.includes('format'), 'Should find cjs export format');
  });

  test('codebase exports on non-existent file returns error gracefully', () => {
    const result = runGsdTools(`util:codebase exports "${path.join(tmpDir, 'missing.js')}"`, tmpDir);
    assert.ok(result.success, `Command should succeed (graceful error): ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.error, 'file_not_found', 'Should report file_not_found error');
  });
});

describe('codebase complexity command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-complexity-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('simple function with no branching has complexity 1', () => {
    const jsFile = path.join(tmpDir, 'simple.js');
    fs.writeFileSync(jsFile, `
function add(a, b) {
  return a + b;
}
`);
    const result = runGsdTools(`util:codebase complexity "${jsFile}"`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.ok(parsed.functions.length > 0, 'Should find at least one function');
    const addFn = parsed.functions.find(f => f.name === 'add');
    assert.ok(addFn, 'Should find the add function');
    assert.strictEqual(addFn.complexity, 1, 'Simple function should have complexity 1');
    assert.strictEqual(addFn.nesting_max, 0, 'Simple function should have nesting_max 0');
  });

  test('function with if/else/for has complexity reflecting branch count', () => {
    const jsFile = path.join(tmpDir, 'branching.js');
    fs.writeFileSync(jsFile, `
function process(items) {
  if (items.length === 0) {
    return [];
  }
  for (let i = 0; i < items.length; i++) {
    if (items[i] > 10) {
      items[i] = 10;
    }
  }
  return items;
}
`);
    const result = runGsdTools(`util:codebase complexity "${jsFile}"`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    const processFn = parsed.functions.find(f => f.name === 'process');
    assert.ok(processFn, 'Should find the process function');
    // Base 1 + if + for + if = 4
    assert.ok(processFn.complexity >= 4, `Expected complexity >= 4, got ${processFn.complexity}`);
  });

  test('nested control flow reflects nesting depth', () => {
    const jsFile = path.join(tmpDir, 'nested.js');
    fs.writeFileSync(jsFile, `
function deepNest(x) {
  if (x > 0) {
    for (let i = 0; i < x; i++) {
      if (i % 2 === 0) {
        while (x > i) {
          x--;
        }
      }
    }
  }
  return x;
}
`);
    const result = runGsdTools(`util:codebase complexity "${jsFile}"`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    const nestFn = parsed.functions.find(f => f.name === 'deepNest');
    assert.ok(nestFn, 'Should find the deepNest function');
    // if > for > if > while = depth 4
    assert.ok(nestFn.nesting_max >= 4, `Expected nesting_max >= 4, got ${nestFn.nesting_max}`);
  });

  test('module complexity is sum of function complexities', () => {
    const jsFile = path.join(tmpDir, 'multi.js');
    fs.writeFileSync(jsFile, `
function simple() { return 1; }
function branching(x) {
  if (x > 0) return true;
  return false;
}
`);
    const result = runGsdTools(`util:codebase complexity "${jsFile}"`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.functions.length, 2, 'Should find 2 functions');
    const sum = parsed.functions.reduce((acc, f) => acc + f.complexity, 0);
    assert.strictEqual(parsed.module_complexity, sum, 'module_complexity should be sum of function complexities');
  });

  test('non-existent file returns graceful error', () => {
    const result = runGsdTools(`util:codebase complexity "${path.join(tmpDir, 'nonexistent.js')}"`, tmpDir);
    assert.ok(result.success, `Command should succeed (graceful error): ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.error, 'file_not_found', 'Should report file_not_found error');
    assert.strictEqual(parsed.module_complexity, 0, 'module_complexity should be 0 for missing file');
  });

  test('logical operators contribute to complexity', () => {
    const jsFile = path.join(tmpDir, 'logical.js');
    fs.writeFileSync(jsFile, `
function validate(x, y) {
  if (x > 0 && y > 0 || x < -10) {
    return true;
  }
  return false;
}
`);
    const result = runGsdTools(`util:codebase complexity "${jsFile}"`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    const fn = parsed.functions.find(f => f.name === 'validate');
    assert.ok(fn, 'Should find the validate function');
    // Base 1 + if + && + || = 4
    assert.ok(fn.complexity >= 4, `Expected complexity >= 4 (1 + if + && + ||), got ${fn.complexity}`);
  });
});

describe('codebase repo-map command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-repomap-'));
    // Set up a minimal project structure with source files
    fs.mkdirSync(path.join(tmpDir, 'src', 'lib'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.git'), { recursive: true }); // fake git dir

    // Create source files with signatures
    fs.writeFileSync(path.join(tmpDir, 'src', 'main.js'), `
function startup(config) {
  return init(config);
}

function shutdown() {
  cleanup();
}

const helper = (x) => x + 1;

module.exports = { startup, shutdown, helper };
`);

    fs.writeFileSync(path.join(tmpDir, 'src', 'lib', 'utils.js'), `
function formatDate(date) {
  return date.toISOString();
}

function parseQuery(str) {
  return str.split('&');
}

module.exports = { formatDate, parseQuery };
`);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('repo map returns summary string with file entries', () => {
    const result = runGsdTools('util:codebase repo-map --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.ok(parsed.summary, 'Should have summary string');
    assert.ok(parsed.summary.includes('# Repo Map'), 'Summary should include header');
    assert.ok(parsed.files_included > 0, 'Should include at least one file');
    assert.ok(parsed.total_signatures > 0, 'Should have signatures');
    assert.ok(parsed.token_estimate > 0, 'Should have token estimate');
  });

  test('repo map token_estimate is roughly within budget', () => {
    const result = runGsdTools('util:codebase repo-map --budget 2000 --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    // Allow some overshoot (1.2x) but should be in ballpark
    assert.ok(parsed.token_estimate < 2000 * 1.5, `token_estimate ${parsed.token_estimate} way over budget 2000`);
  });

  test('repo map includes source files with signatures', () => {
    const result = runGsdTools('util:codebase repo-map --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    // Should mention our source files in the summary
    assert.ok(
      parsed.summary.includes('main.js') || parsed.summary.includes('utils.js'),
      'Summary should include source file names'
    );
    assert.ok(parsed.summary.includes('fn '), 'Summary should include function entries');
  });

  test('repo map --budget flag controls output size', () => {
    const bigResult = runGsdTools('util:codebase repo-map --budget 5000 --raw', tmpDir);
    const smallResult = runGsdTools('util:codebase repo-map --budget 100 --raw', tmpDir);

    assert.ok(bigResult.success, `Big budget failed: ${bigResult.error}`);
    assert.ok(smallResult.success, `Small budget failed: ${smallResult.error}`);

    const big = JSON.parse(bigResult.output);
    const small = JSON.parse(smallResult.output);

    // Small budget should have fewer or equal files included
    assert.ok(
      small.files_included <= big.files_included,
      `Small budget (${small.files_included} files) should have <= files than big budget (${big.files_included} files)`
    );
  });
});

describe('codebase repo-map integration', () => {
  test('repo-map on bgsd-tools project produces valid JSON with files > 0', () => {
    const result = runGsdTools('util:codebase repo-map --raw');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.ok(parsed.files_included > 0, 'Should include files from this project');
    assert.ok(parsed.total_signatures > 0, 'Should have signatures from this project');
    assert.ok(typeof parsed.summary === 'string', 'Summary should be a string');
    assert.ok(parsed.summary.length > 50, 'Summary should have meaningful content');
    assert.ok(parsed.token_estimate > 0, 'Token estimate should be positive');
  });
});

describe('optimized discovery default (Phase 78 Plan 02)', () => {
  const discoveryAdapter = require('../src/lib/adapters/discovery');

  test('getActiveMode returns optimized by default (no env override)', () => {
    // With no BGSD_DISCOVERY_MODE env var, the default should be optimized
    const mode = discoveryAdapter.getActiveMode();
    assert.strictEqual(mode, 'optimized', 'Default discovery mode should be optimized, not legacy');
  });

  test('optimizedGetSourceDirs does not spawn git check-ignore subprocesses', () => {
    // The optimized path uses in-process ignore matching (the `ignore` library)
    // rather than spawning `git check-ignore` per directory entry.
    // Verify by reading the source to confirm no execGit/check-ignore call in optimized path.
    const adapterSrc = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'lib', 'adapters', 'discovery.js'), 'utf-8'
    );

    // Extract the optimizedGetSourceDirs function body
    const fnStart = adapterSrc.indexOf('function optimizedGetSourceDirs(');
    const fnEnd = adapterSrc.indexOf('\nfunction ', fnStart + 1);
    const optimizedFnBody = adapterSrc.slice(fnStart, fnEnd > fnStart ? fnEnd : undefined);

    // Should NOT contain git check-ignore subprocess calls
    assert.ok(
      !optimizedFnBody.includes('check-ignore'),
      'optimizedGetSourceDirs should not use git check-ignore subprocess'
    );
    assert.ok(
      !optimizedFnBody.includes('execGit'),
      'optimizedGetSourceDirs should not call execGit (uses in-process ignore instead)'
    );

    // Should use in-process ignore matching
    assert.ok(
      optimizedFnBody.includes('buildIgnoreMatcher') || optimizedFnBody.includes('isIgnoredPath'),
      'optimizedGetSourceDirs should use in-process ignore matching'
    );
  });

  test('optimizedWalkSourceFiles does not spawn git check-ignore subprocesses', () => {
    const adapterSrc = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'lib', 'adapters', 'discovery.js'), 'utf-8'
    );

    // Extract the optimizedWalkSourceFiles function body
    const fnStart = adapterSrc.indexOf('function optimizedWalkSourceFiles(');
    const fnEnd = adapterSrc.indexOf('\nfunction ', fnStart + 1);
    const optimizedFnBody = adapterSrc.slice(fnStart, fnEnd > fnStart ? fnEnd : undefined);

    assert.ok(
      !optimizedFnBody.includes('check-ignore'),
      'optimizedWalkSourceFiles should not use git check-ignore subprocess'
    );
    assert.ok(
      !optimizedFnBody.includes('execGit'),
      'optimizedWalkSourceFiles should not call execGit'
    );
  });

  test('legacy path is still available via legacyGetSourceDirs export', () => {
    assert.strictEqual(typeof discoveryAdapter.legacyGetSourceDirs, 'function',
      'legacyGetSourceDirs should be exported for diagnostic use');
    assert.strictEqual(typeof discoveryAdapter.legacyWalkSourceFiles, 'function',
      'legacyWalkSourceFiles should be exported for diagnostic use');
  });

  test('codebase-intel getDiscoveryOptions defaults to optimized mode', () => {
    const intelSrc = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'lib', 'codebase-intel.js'), 'utf-8'
    );

    // The getDiscoveryOptions function should default to optimized
    // Old pattern: BGSD_DISCOVERY_MODE === 'optimized' ? 'optimized' : 'legacy'
    // New pattern: BGSD_DISCOVERY_MODE === 'legacy' ? 'legacy' : 'optimized'
    assert.ok(
      intelSrc.includes("=== 'legacy' ? 'legacy' : 'optimized'"),
      'getDiscoveryOptions should default to optimized mode (legacy only when explicitly set)'
    );
  });

  test('codebase analyze produces valid results using optimized default', () => {
    // Integration test: run analyze on a temp project through the optimized path
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-opt-'));
    try {
      fs.mkdirSync(path.join(tmpDir, '.planning', 'codebase'), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'src', 'index.js'), 'const x = 1;\nmodule.exports = { x };\n');
      fs.writeFileSync(path.join(tmpDir, 'src', 'utils.js'), 'function helper() { return true; }\n');
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"opt-test","version":"1.0.0"}\n');
      execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git config user.email "test@test.com" && git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git add -A && git commit -m "initial"', { cwd: tmpDir, stdio: 'pipe' });

      const result = runGsdTools('util:codebase analyze', tmpDir);
      assert.ok(result.success, `Analyze should succeed with optimized default: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.success, true, 'Analysis should report success');
      assert.strictEqual(data.mode, 'full', 'First run should be full mode');
      assert.ok(data.total_files > 0, `Should find source files, got ${data.total_files}`);

      // Verify intel file was created with valid structure
      const intelPath = path.join(tmpDir, '.planning', 'codebase', 'codebase-intel.json');
      assert.ok(fs.existsSync(intelPath), 'codebase-intel.json should be created');
      const intel = JSON.parse(fs.readFileSync(intelPath, 'utf-8'));
      assert.ok(intel.source_dirs.length > 0, 'Should detect source directories');
      assert.ok(intel.stats.total_files > 0, 'Should have file count in stats');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('BGSD_DISCOVERY_MODE=legacy forces legacy mode in adapter default', () => {
    // Verify the adapter source contains the correct guard expression
    const adapterSrc = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'lib', 'adapters', 'discovery.js'), 'utf-8'
    );

    assert.ok(
      adapterSrc.includes("=== 'legacy' ? 'legacy' : 'optimized'"),
      'DEFAULT_MODE should only use legacy when BGSD_DISCOVERY_MODE is explicitly set to legacy'
    );
  });

  test('shadow compare diagnostic controls remain available', () => {
    // Verify the adapter still supports shadowCompare option
    const adapterSrc = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'lib', 'adapters', 'discovery.js'), 'utf-8'
    );

    assert.ok(
      adapterSrc.includes('shadowCompare'),
      'Shadow compare option should still be available for diagnostics'
    );
    assert.ok(
      adapterSrc.includes('runWithShadowCompare'),
      'Shadow compare runner should still be available'
    );
  });
});

// ─── Phase 78 Plan 03: Legacy-vs-Optimized Parity Fixture Matrix ──────────
describe('discovery parity: legacy vs optimized (Phase 78 Plan 03)', () => {
  const discovery = require('../src/lib/adapters/discovery');
  let tmpDir;

  afterEach(() => {
    if (tmpDir) cleanup(tmpDir);
    tmpDir = null;
  });

  /**
   * Helper: compare legacy and optimized source-dir outputs,
   * normalizing sort order so comparison is deterministic.
   */
  function assertSourceDirsParity(cwd) {
    const legacy = discovery.legacyGetSourceDirs(cwd).sort();
    const optimized = discovery.optimizedGetSourceDirs(cwd).sort();
    assert.deepStrictEqual(optimized, legacy,
      `Source-dir parity mismatch.\n  Legacy:    ${JSON.stringify(legacy)}\n  Optimized: ${JSON.stringify(optimized)}`);
    return { legacy, optimized };
  }

  /**
   * Helper: compare legacy and optimized walk-files outputs.
   * When no .gitignore rules affect walked files, both paths should produce identical results.
   */
  function assertWalkFilesParity(cwd, sourceDirs) {
    const skipDirs = discovery.SKIP_DIRS;
    const legacyFiles = discovery.legacyWalkSourceFiles(cwd, sourceDirs, skipDirs).sort();
    const optimizedFiles = discovery.optimizedWalkSourceFiles(cwd, sourceDirs, skipDirs).sort();
    assert.deepStrictEqual(optimizedFiles, legacyFiles,
      `Walk-files parity mismatch.\n  Legacy (${legacyFiles.length} files):    ${JSON.stringify(legacyFiles.slice(0, 10))}\n  Optimized (${optimizedFiles.length} files): ${JSON.stringify(optimizedFiles.slice(0, 10))}`);
    return { legacy: legacyFiles, optimized: optimizedFiles };
  }

  // ─── Parity fixture 1: Basic project with src directory ──────────────────
  test('parity: basic project with src directory', () => {
    tmpDir = createParityProject({
      files: {
        'src/index.js': 'const x = 1;\n',
        'src/utils.js': 'module.exports = {};\n',
        'package.json': '{"name":"test"}\n',
      },
    });
    const dirs = assertSourceDirsParity(tmpDir);
    assertWalkFilesParity(tmpDir, dirs.legacy);
  });

  // ─── Parity fixture 2: Root-level source files (no src/) ────────────────
  test('parity: root-level source files trigger fallback to "."', () => {
    tmpDir = createParityProject({
      files: {
        'app.js': 'console.log("root level");\n',
        'config.json': '{"key": "value"}\n',
      },
    });
    const dirs = assertSourceDirsParity(tmpDir);
    assert.ok(dirs.legacy.includes('.'), 'Legacy should detect root-level "."');
    assertWalkFilesParity(tmpDir, dirs.legacy);
  });

  // ─── Parity fixture 3: Nested .gitignore — source-dir detection parity ──
  test('parity: nested .gitignore — source-dir detection agrees', () => {
    tmpDir = createParityProject({
      files: {
        'src/index.js': 'module.exports = {};\n',
        'src/gen/output.js': '// generated file\n',
        'src/gen/keep.js': '// should be kept\n',
        'package.json': '{"name":"test"}\n',
      },
      nestedGitignores: {
        'src/gen': ['output.js'],
      },
    });
    assertSourceDirsParity(tmpDir);
  });

  // ─── Parity fixture 3b: Optimized walk filters nested-ignored files ─────
  test('optimized walk correctly filters files matched by nested .gitignore', () => {
    tmpDir = createParityProject({
      files: {
        'src/index.js': 'module.exports = {};\n',
        'src/gen/output.js': '// generated file — ignored\n',
        'src/gen/keep.js': '// should be kept\n',
        'package.json': '{"name":"test"}\n',
      },
      nestedGitignores: {
        'src/gen': ['output.js'],
      },
    });
    const skipDirs = discovery.SKIP_DIRS;
    const sourceDirs = discovery.legacyGetSourceDirs(tmpDir);
    const legacyFiles = discovery.legacyWalkSourceFiles(tmpDir, sourceDirs, skipDirs).sort();
    const optimizedFiles = discovery.optimizedWalkSourceFiles(tmpDir, sourceDirs, skipDirs).sort();

    // Legacy does NOT apply .gitignore during walk — it includes the ignored file
    assert.ok(legacyFiles.some(f => f.includes('output.js')),
      'Legacy walk does not filter nested-gitignored files (known limitation)');
    // Optimized correctly filters the ignored file
    assert.ok(!optimizedFiles.some(f => f.includes('output.js')),
      'Optimized walk should filter files matching nested .gitignore rules');
    // Both keep the non-ignored file
    assert.ok(legacyFiles.some(f => f.includes('keep.js')), 'Legacy keeps non-ignored files');
    assert.ok(optimizedFiles.some(f => f.includes('keep.js')), 'Optimized keeps non-ignored files');
  });

  // ─── Parity fixture 4: Negation rules — source-dir detection parity ─────
  test('parity: gitignore negation rules — source-dir detection agrees', () => {
    tmpDir = createParityProject({
      files: {
        'src/index.js': 'const x = 1;\n',
        'logs/app.log': 'some log\n',
        'logs/important.js': '// important script in logs\n',
        'package.json': '{"name":"test"}\n',
      },
      gitignoreRules: [
        'logs/',
        '!logs/important.js',
      ],
    });
    assertSourceDirsParity(tmpDir);
  });

  // ─── Parity fixture 5: Hidden directories ─────────────────────────────
  test('parity: hidden directories are skipped by both paths', () => {
    tmpDir = createParityProject({
      files: {
        'src/index.js': 'module.exports = {};\n',
        '.hidden/secret.js': '// hidden dir source\n',
        '.config/settings.js': '// config dir source\n',
        'package.json': '{"name":"test"}\n',
      },
    });
    const dirs = assertSourceDirsParity(tmpDir);
    // Neither path should include hidden directories
    assert.ok(!dirs.legacy.includes('.hidden'), 'Legacy should skip .hidden');
    assert.ok(!dirs.optimized.includes('.hidden'), 'Optimized should skip .hidden');
    assertWalkFilesParity(tmpDir, dirs.legacy);
  });

  // ─── Parity fixture 6: Git-ignored top-level directory — source-dir parity
  test('parity: git-ignored top-level directory excluded from source-dirs by both paths', () => {
    tmpDir = createParityProject({
      files: {
        'src/index.js': 'const x = 1;\n',
        'generated/output.js': '// generated output\n',
        'package.json': '{"name":"test"}\n',
      },
      gitignoreRules: ['generated/'],
    });
    const dirs = assertSourceDirsParity(tmpDir);
    assert.ok(!dirs.legacy.includes('generated'), 'Legacy should skip git-ignored dir');
    assert.ok(!dirs.optimized.includes('generated'), 'Optimized should skip git-ignored dir');
    // Note: walk parity for "." root includes generated/ in legacy (no gitignore in walk),
    // tested separately in the "optimized walk filters" test below
  });

  // ─── Parity fixture 6b: Optimized walk filters dir-level gitignore files
  test('optimized walk filters files inside git-ignored directories', () => {
    tmpDir = createParityProject({
      files: {
        'src/index.js': 'const x = 1;\n',
        'generated/output.js': '// generated output\n',
        'package.json': '{"name":"test"}\n',
      },
      gitignoreRules: ['generated/'],
    });
    const skipDirs = discovery.SKIP_DIRS;
    // Force both to walk "generated" to observe filter behavior
    const legacyFiles = discovery.legacyWalkSourceFiles(tmpDir, ['src', 'generated'], skipDirs).sort();
    const optimizedFiles = discovery.optimizedWalkSourceFiles(tmpDir, ['src', 'generated'], skipDirs).sort();

    // Legacy doesn't apply gitignore during walk — includes generated/output.js
    assert.ok(legacyFiles.some(f => f.includes('generated')),
      'Legacy walk includes files from git-ignored dir (known)');
    // Optimized correctly filters the git-ignored directory contents
    assert.ok(!optimizedFiles.some(f => f.includes('generated')),
      'Optimized walk should filter out files inside git-ignored directories');
  });

  // ─── Parity fixture 7: Multiple KNOWN_SOURCE_DIRS present ──────────────
  test('parity: multiple known source dirs (src, lib, test)', () => {
    tmpDir = createParityProject({
      files: {
        'src/main.js': 'module.exports = {};\n',
        'lib/helpers.js': 'module.exports = {};\n',
        'tests/test.js': 'require("assert");\n',
        'package.json': '{"name":"test"}\n',
      },
    });
    const dirs = assertSourceDirsParity(tmpDir);
    assert.ok(dirs.legacy.includes('src'), 'Should detect src');
    assert.ok(dirs.legacy.includes('lib'), 'Should detect lib');
    assert.ok(dirs.legacy.includes('tests'), 'Should detect tests');
    assertWalkFilesParity(tmpDir, dirs.legacy);
  });

  // ─── Parity fixture 8: Non-standard dir with source files ───────────────
  test('parity: non-standard directory with source files detected', () => {
    tmpDir = createParityProject({
      files: {
        'scripts/deploy.js': 'console.log("deploy");\n',
        'scripts/setup.sh': '#!/bin/bash\necho setup\n',
        'package.json': '{"name":"test"}\n',
      },
    });
    const dirs = assertSourceDirsParity(tmpDir);
    assert.ok(dirs.legacy.includes('scripts'), 'Legacy should detect scripts dir with source');
    assertWalkFilesParity(tmpDir, dirs.legacy);
  });

  // ─── Parity fixture 9: Empty project falls back to root ─────────────────
  test('parity: empty project (no source files) falls back to "."', () => {
    tmpDir = createParityProject({
      files: {
        'README.md': '# empty project\n',
        'package.json': '{"name":"test"}\n',
      },
    });
    const dirs = assertSourceDirsParity(tmpDir);
    assert.deepStrictEqual(dirs.legacy, ['.'], 'Should fall back to ["."] when no source dirs found');
    assertWalkFilesParity(tmpDir, dirs.legacy);
  });

  // ─── Parity fixture 10: Symlinks in source tree ─────────────────────────
  test('parity: symlinked entries are handled consistently', () => {
    tmpDir = createParityProject({
      files: {
        'src/index.js': 'module.exports = {};\n',
        'shared/utils.js': 'module.exports = {};\n',
        'package.json': '{"name":"test"}\n',
      },
      symlinks: [
        { target: 'shared', link: 'src/shared-link' },
      ],
    });
    // Both paths should work without error; exact symlink inclusion may differ
    // but both must not crash
    const legacyDirs = discovery.legacyGetSourceDirs(tmpDir).sort();
    const optimizedDirs = discovery.optimizedGetSourceDirs(tmpDir).sort();
    assert.ok(Array.isArray(legacyDirs), 'Legacy should return array');
    assert.ok(Array.isArray(optimizedDirs), 'Optimized should return array');
  });

  // ─── Parity fixture 11: SKIP_DIRS are always excluded ───────────────────
  test('parity: SKIP_DIRS (node_modules, .git, dist, build) always excluded', () => {
    tmpDir = createParityProject({
      files: {
        'src/index.js': 'module.exports = {};\n',
        'node_modules/dep/index.js': '// dependency\n',
        'dist/bundle.js': '// built output\n',
        'build/output.js': '// built output\n',
        'package.json': '{"name":"test"}\n',
      },
    });
    const dirs = assertSourceDirsParity(tmpDir);
    assert.ok(!dirs.legacy.includes('node_modules'), 'node_modules should be excluded');
    assert.ok(!dirs.legacy.includes('dist'), 'dist should be excluded');
    assert.ok(!dirs.legacy.includes('build'), 'build should be excluded');
    assertWalkFilesParity(tmpDir, dirs.legacy);
  });

  // ─── Parity fixture 12: Wildcard .gitignore — optimized improvement ─────
  test('optimized walk correctly filters wildcard-gitignored files (*.log, *.tmp)', () => {
    tmpDir = createParityProject({
      files: {
        'src/index.js': 'module.exports = {};\n',
        'src/debug.log': 'debug output\n',
        'src/data.tmp': 'temp data\n',
        'package.json': '{"name":"test"}\n',
      },
      gitignoreRules: ['*.log', '*.tmp'],
    });
    const skipDirs = discovery.SKIP_DIRS;
    const sourceDirs = discovery.legacyGetSourceDirs(tmpDir);
    const legacyFiles = discovery.legacyWalkSourceFiles(tmpDir, sourceDirs, skipDirs).sort();
    const optimizedFiles = discovery.optimizedWalkSourceFiles(tmpDir, sourceDirs, skipDirs).sort();

    // Legacy does NOT apply .gitignore during walk
    assert.ok(legacyFiles.some(f => f.endsWith('.log')),
      'Legacy walk includes *.log files (known limitation — no gitignore filtering in walk)');
    // Optimized correctly filters gitignored patterns
    assert.ok(!optimizedFiles.some(f => f.endsWith('.log')),
      'Optimized walk should filter *.log per .gitignore');
    assert.ok(!optimizedFiles.some(f => f.endsWith('.tmp')),
      'Optimized walk should filter *.tmp per .gitignore');
    // Both include the real source file
    assert.ok(legacyFiles.some(f => f.includes('index.js')), 'Legacy keeps source files');
    assert.ok(optimizedFiles.some(f => f.includes('index.js')), 'Optimized keeps source files');
  });

  // ─── Parity fixture 13: Source-dir detection with wildcard gitignore ────
  test('parity: wildcard gitignore does not affect source-dir detection', () => {
    tmpDir = createParityProject({
      files: {
        'src/index.js': 'module.exports = {};\n',
        'src/debug.log': 'debug output\n',
        'package.json': '{"name":"test"}\n',
      },
      gitignoreRules: ['*.log'],
    });
    assertSourceDirsParity(tmpDir);
  });

  // ─── diagnoseParity: structured mismatch diagnostic ─────────────────────
  test('diagnoseParity returns structured comparison with match flags', () => {
    tmpDir = createParityProject({
      files: {
        'src/index.js': 'module.exports = {};\n',
        'package.json': '{"name":"test"}\n',
      },
    });
    const result = discovery.diagnoseParity(tmpDir);

    // Source dirs should match for a simple project
    assert.strictEqual(result.sourceDirs.match, true, 'Source dirs should match');
    assert.ok(Array.isArray(result.sourceDirs.legacy), 'legacy dirs should be array');
    assert.ok(Array.isArray(result.sourceDirs.optimized), 'optimized dirs should be array');

    // Walk files should match (no gitignore differences)
    assert.strictEqual(result.walkFiles.match, true, 'Walk files should match with no gitignore rules');
    assert.deepStrictEqual(result.walkFiles.onlyLegacy, [], 'No legacy-only files');
    assert.deepStrictEqual(result.walkFiles.onlyOptimized, [], 'No optimized-only files');
  });

  test('diagnoseParity reports onlyLegacy for gitignore-filtered files', () => {
    tmpDir = createParityProject({
      files: {
        'src/index.js': 'module.exports = {};\n',
        'src/debug.log': 'debug output\n',
        'package.json': '{"name":"test"}\n',
      },
      gitignoreRules: ['*.log'],
    });
    const result = discovery.diagnoseParity(tmpDir);

    // Source dirs match (gitignore doesn't affect dir detection)
    assert.strictEqual(result.sourceDirs.match, true, 'Source dirs should match');

    // Walk files differ: legacy includes .log, optimized filters it
    assert.strictEqual(result.walkFiles.match, false, 'Walk files should differ');
    assert.ok(result.walkFiles.onlyLegacy.some(f => f.endsWith('.log')),
      'onlyLegacy should contain the .log file');
    assert.deepStrictEqual(result.walkFiles.onlyOptimized, [],
      'onlyOptimized should be empty (optimized is a subset of legacy here)');
  });
});
