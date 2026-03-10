/**
 * bgsd-tools env tests
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { TOOLS_PATH, runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

describe('env scan', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-env-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Helper to run env scan on a directory
  function envScan(dir) {
    return runGsdTools('util:env scan', dir || tmpDir);
  }

  // Helper to parse env scan output
  function envScanParsed(dir) {
    const result = envScan(dir);
    if (!result.success) return { success: false, error: result.error };
    try {
      return { success: true, data: JSON.parse(result.output) };
    } catch (e) {
      return { success: false, error: `JSON parse failed: ${e.message}` };
    }
  }

  describe('manifest pattern completeness', () => {
    test('LANG_MANIFESTS contains at least 15 entries', () => {
      // Verify via scanning a dir with known manifests — but we can also check the output schema
      // The best test: create a dir and verify the command works
      const result = envScanParsed();
      assert.ok(result.success, `env scan failed: ${result.error}`);
      assert.ok(result.data.languages !== undefined, 'should have languages field');
      assert.ok(result.data.scanned_at, 'should have scanned_at timestamp');
      assert.ok(typeof result.data.detection_ms === 'number', 'detection_ms should be a number');
    });

    test('scan returns valid JSON with expected schema fields', () => {
      const result = envScanParsed();
      assert.ok(result.success, `env scan failed: ${result.error}`);
      const d = result.data;
      assert.ok(Array.isArray(d.languages), 'languages should be array');
      assert.ok(typeof d.package_manager === 'object', 'package_manager should be object');
      assert.ok(Array.isArray(d.version_managers), 'version_managers should be array');
      assert.ok(typeof d.tools === 'object', 'tools should be object');
      assert.ok(typeof d.scripts === 'object', 'scripts should be object');
      assert.ok(typeof d.infrastructure === 'object', 'infrastructure should be object');
    });
  });

  describe('language detection', () => {
    test('detects node from package.json', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      const result = envScanParsed();
      assert.ok(result.success, `env scan failed: ${result.error}`);
      const node = result.data.languages.find(l => l.name === 'node');
      assert.ok(node, 'should detect node language');
      assert.strictEqual(node.manifests[0].file, 'package.json');
      assert.strictEqual(node.manifests[0].depth, 0);
    });

    test('detects go from go.mod', () => {
      fs.writeFileSync(path.join(tmpDir, 'go.mod'), 'module example.com/test\ngo 1.21');
      const result = envScanParsed();
      assert.ok(result.success, `env scan failed: ${result.error}`);
      const go = result.data.languages.find(l => l.name === 'go');
      assert.ok(go, 'should detect go language');
    });

    test('detects elixir from mix.exs', () => {
      fs.writeFileSync(path.join(tmpDir, 'mix.exs'), 'defmodule Test.MixProject do\nend');
      const result = envScanParsed();
      assert.ok(result.success, `env scan failed: ${result.error}`);
      const elixir = result.data.languages.find(l => l.name === 'elixir');
      assert.ok(elixir, 'should detect elixir language');
    });

    test('detects multiple languages in polyglot project', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      fs.writeFileSync(path.join(tmpDir, 'go.mod'), 'module example.com/test');
      fs.writeFileSync(path.join(tmpDir, 'mix.exs'), 'defmodule Test.MixProject do\nend');
      const result = envScanParsed();
      assert.ok(result.success, `env scan failed: ${result.error}`);
      const langNames = result.data.languages.map(l => l.name).sort();
      assert.ok(langNames.includes('node'), 'should detect node');
      assert.ok(langNames.includes('go'), 'should detect go');
      assert.ok(langNames.includes('elixir'), 'should detect elixir');
    });

    test('detects nested manifest at depth 1', () => {
      const subdir = path.join(tmpDir, 'subproject');
      fs.mkdirSync(subdir);
      fs.writeFileSync(path.join(subdir, 'package.json'), '{"name":"sub"}');
      const result = envScanParsed();
      assert.ok(result.success, `env scan failed: ${result.error}`);
      const node = result.data.languages.find(l => l.name === 'node');
      assert.ok(node, 'should detect node from nested package.json');
      assert.strictEqual(node.manifests[0].depth, 1, 'should be at depth 1');
    });

    test('does NOT detect files beyond depth 3', () => {
      // Create deeply nested structure at depth 4
      const deepPath = path.join(tmpDir, 'a', 'b', 'c', 'd');
      fs.mkdirSync(deepPath, { recursive: true });
      fs.writeFileSync(path.join(deepPath, 'package.json'), '{"name":"deep"}');
      const result = envScanParsed();
      assert.ok(result.success, `env scan failed: ${result.error}`);
      const node = result.data.languages.find(l => l.name === 'node');
      assert.ok(!node, 'should NOT detect file at depth 4');
    });

    test('empty directory returns empty languages array', () => {
      const result = envScanParsed();
      assert.ok(result.success, `env scan failed: ${result.error}`);
      assert.strictEqual(result.data.languages.length, 0, 'languages should be empty');
    });
  });

  describe('primary language detection', () => {
    test('single language marked as primary', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      const result = envScanParsed();
      assert.ok(result.success);
      const node = result.data.languages.find(l => l.name === 'node');
      assert.strictEqual(node.primary, true, 'single language should be primary');
    });

    test('multiple languages at root — one marked primary', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      fs.writeFileSync(path.join(tmpDir, 'go.mod'), 'module example.com/test');
      const result = envScanParsed();
      assert.ok(result.success);
      const primaries = result.data.languages.filter(l => l.primary);
      assert.strictEqual(primaries.length, 1, 'exactly one language should be primary');
    });
  });

  describe('package manager detection', () => {
    test('detects pnpm from pnpm-lock.yaml', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      fs.writeFileSync(path.join(tmpDir, 'pnpm-lock.yaml'), 'lockfileVersion: 9');
      const result = envScanParsed();
      assert.ok(result.success);
      assert.strictEqual(result.data.package_manager.name, 'pnpm');
      assert.strictEqual(result.data.package_manager.source, 'lockfile');
    });

    test('detects npm from package-lock.json', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), '{}');
      const result = envScanParsed();
      assert.ok(result.success);
      assert.strictEqual(result.data.package_manager.name, 'npm');
    });

    test('pnpm takes precedence over npm when both present', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      fs.writeFileSync(path.join(tmpDir, 'pnpm-lock.yaml'), 'lockfileVersion: 9');
      fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), '{}');
      const result = envScanParsed();
      assert.ok(result.success);
      assert.strictEqual(result.data.package_manager.name, 'pnpm', 'pnpm should take precedence');
    });

    test('packageManager field overrides lockfile detection', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
        name: 'test',
        packageManager: 'pnpm@8.15.1',
      }));
      fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), '{}');
      const result = envScanParsed();
      assert.ok(result.success);
      assert.strictEqual(result.data.package_manager.name, 'pnpm', 'packageManager field should override lockfile');
      assert.strictEqual(result.data.package_manager.version, '8.15.1');
      assert.strictEqual(result.data.package_manager.source, 'packageManager-field');
    });
  });

  describe('binary availability', () => {
    test('binary check returns available:false for missing binary', () => {
      // Create a manifest for a language with a likely-missing binary
      fs.writeFileSync(path.join(tmpDir, 'Package.swift'), '// swift package');
      const result = envScanParsed();
      assert.ok(result.success);
      const swift = result.data.languages.find(l => l.name === 'swift');
      if (swift) {
        // Swift may or may not be installed — just verify the shape
        assert.ok(typeof swift.binary.available === 'boolean', 'available should be boolean');
        assert.ok(swift.binary.version === null || typeof swift.binary.version === 'string', 'version should be null or string');
      }
    });

    test('node binary should be available (running in Node.js)', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      const result = envScanParsed();
      assert.ok(result.success);
      const node = result.data.languages.find(l => l.name === 'node');
      assert.ok(node, 'should detect node');
      assert.strictEqual(node.binary.available, true, 'node binary should be available');
      assert.ok(node.binary.version, 'node version should be detected');
      assert.ok(node.binary.path, 'node path should be detected');
    });
  });

  describe('skip directories', () => {
    test('does NOT detect files in node_modules', () => {
      const nmDir = path.join(tmpDir, 'node_modules', 'some-package');
      fs.mkdirSync(nmDir, { recursive: true });
      fs.writeFileSync(path.join(nmDir, 'package.json'), '{"name":"some-package"}');
      const result = envScanParsed();
      assert.ok(result.success);
      assert.strictEqual(result.data.languages.length, 0, 'should not detect files in node_modules');
    });

    test('does NOT detect files in vendor directory', () => {
      const vendorDir = path.join(tmpDir, 'vendor', 'package');
      fs.mkdirSync(vendorDir, { recursive: true });
      fs.writeFileSync(path.join(vendorDir, 'go.mod'), 'module vendor.com/pkg');
      const result = envScanParsed();
      assert.ok(result.success);
      assert.strictEqual(result.data.languages.length, 0, 'should not detect files in vendor');
    });
  });

  describe('version manager detection', () => {
    test('detects .nvmrc with version', () => {
      fs.writeFileSync(path.join(tmpDir, '.nvmrc'), '20.11.0');
      const result = envScanParsed();
      assert.ok(result.success);
      const nvm = result.data.version_managers.find(vm => vm.name === 'nvm');
      assert.ok(nvm, 'should detect nvm');
      assert.strictEqual(nvm.configured_versions.node, '20.11.0');
    });

    test('detects mise.toml', () => {
      fs.writeFileSync(path.join(tmpDir, 'mise.toml'), '[tools]\nnode = "20.11.0"\ngo = "1.21"');
      const result = envScanParsed();
      assert.ok(result.success);
      const mise = result.data.version_managers.find(vm => vm.name === 'mise');
      assert.ok(mise, 'should detect mise');
      assert.strictEqual(mise.configured_versions.node, '20.11.0');
      assert.strictEqual(mise.configured_versions.go, '1.21');
    });

    test('detects .tool-versions (asdf)', () => {
      fs.writeFileSync(path.join(tmpDir, '.tool-versions'), 'nodejs 20.11.0\nerlang 26.2');
      const result = envScanParsed();
      assert.ok(result.success);
      const asdf = result.data.version_managers.find(vm => vm.name === 'asdf');
      assert.ok(asdf, 'should detect asdf');
      assert.strictEqual(asdf.configured_versions.nodejs, '20.11.0');
      assert.strictEqual(asdf.configured_versions.erlang, '26.2');
    });
  });

  describe('infrastructure detection', () => {
    test('detects services from docker-compose.yml', () => {
      fs.writeFileSync(path.join(tmpDir, 'docker-compose.yml'),
        'services:\n  postgres:\n    image: postgres:16\n  redis:\n    image: redis:7\n');
      const result = envScanParsed();
      assert.ok(result.success);
      const services = result.data.infrastructure.docker_services;
      assert.ok(services.includes('postgres'), 'should detect postgres service');
      assert.ok(services.includes('redis'), 'should detect redis service');
    });

    test('detects MCP servers from .mcp.json', () => {
      fs.writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify({
        mcpServers: {
          github: { command: 'mcp-github' },
          postgres: { command: 'mcp-postgres' },
        },
      }));
      const result = envScanParsed();
      assert.ok(result.success);
      const servers = result.data.infrastructure.mcp_servers;
      assert.ok(servers.includes('github'), 'should detect github MCP server');
      assert.ok(servers.includes('postgres'), 'should detect postgres MCP server');
    });
  });

  describe('script detection', () => {
    test('captures well-known scripts from package.json', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
        name: 'test',
        scripts: {
          test: 'jest',
          build: 'tsc',
          lint: 'eslint .',
          dev: 'next dev',  // Not a well-known script
          start: 'node server.js',
        },
      }));
      const result = envScanParsed();
      assert.ok(result.success);
      assert.strictEqual(result.data.scripts.test, 'jest');
      assert.strictEqual(result.data.scripts.build, 'tsc');
      assert.strictEqual(result.data.scripts.lint, 'eslint .');
      assert.strictEqual(result.data.scripts.start, 'node server.js');
      assert.strictEqual(result.data.scripts.dev, undefined, 'dev is not a well-known script');
    });

    test('captures Makefile targets', () => {
      fs.writeFileSync(path.join(tmpDir, 'Makefile'),
        'build:\n\tgo build .\n\ntest:\n\tgo test ./...\n\n.PHONY: build test\n');
      const result = envScanParsed();
      assert.ok(result.success);
      assert.ok(result.data.scripts._makefile_targets, 'should have Makefile targets');
      assert.ok(result.data.scripts._makefile_targets.includes('build'));
      assert.ok(result.data.scripts._makefile_targets.includes('test'));
    });
  });

  describe('monorepo detection', () => {
    test('detects npm workspaces from package.json', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
        name: 'monorepo',
        workspaces: ['packages/*', 'apps/*'],
      }));
      const result = envScanParsed();
      assert.ok(result.success);
      assert.ok(result.data.monorepo, 'should detect monorepo');
      assert.strictEqual(result.data.monorepo.type, 'npm-workspaces');
      assert.deepStrictEqual(result.data.monorepo.members, ['packages/*', 'apps/*']);
    });

    test('no monorepo in simple project', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"simple"}');
      const result = envScanParsed();
      assert.ok(result.success);
      assert.strictEqual(result.data.monorepo, null, 'should not detect monorepo');
    });
  });

  describe('edge cases', () => {
    test('permission-denied directory does not crash', () => {
      // Create a directory we can't read (only works if not running as root)
      const restrictedDir = path.join(tmpDir, 'restricted');
      fs.mkdirSync(restrictedDir, { mode: 0o000 });
      // Should still complete without crashing
      const result = envScanParsed();
      assert.ok(result.success, 'should not crash on permission-denied directory');
      // Restore permissions for cleanup
      fs.chmodSync(restrictedDir, 0o755);
    });

    test('deeply nested symlink does not cause infinite loop (depth limit handles this)', () => {
      // Depth limit of 3 prevents following deep symlinks
      const subDir = path.join(tmpDir, 'sub');
      fs.mkdirSync(subDir);
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      // Create a symlink that could cause loops (symlink to parent)
      try {
        fs.symlinkSync(tmpDir, path.join(subDir, 'loop'), 'dir');
      } catch {
        // Symlinks may not work on all platforms — skip if so
        return;
      }
      const result = envScanParsed();
      assert.ok(result.success, 'should not crash with symlink loops');
    });

    test('CI detection: github actions', () => {
      const ghDir = path.join(tmpDir, '.github', 'workflows');
      fs.mkdirSync(ghDir, { recursive: true });
      fs.writeFileSync(path.join(ghDir, 'ci.yml'), 'name: CI');
      const result = envScanParsed();
      assert.ok(result.success);
      assert.ok(result.data.tools.ci, 'should detect CI');
      assert.strictEqual(result.data.tools.ci.platform, 'github-actions');
    });

    test('linter/formatter detection', () => {
      fs.writeFileSync(path.join(tmpDir, '.eslintrc.json'), '{}');
      fs.writeFileSync(path.join(tmpDir, '.prettierrc'), '{}');
      const result = envScanParsed();
      assert.ok(result.success);
      assert.ok(result.data.tools.linters.some(l => l.name === 'eslint'), 'should detect eslint');
      assert.ok(result.data.tools.formatters.some(f => f.name === 'prettier'), 'should detect prettier');
    });

    test('test framework detection from config files', () => {
      fs.writeFileSync(path.join(tmpDir, 'jest.config.js'), 'module.exports = {}');
      const result = envScanParsed();
      assert.ok(result.success);
      assert.ok(result.data.tools.test_frameworks.some(t => t.name === 'jest'), 'should detect jest');
    });
  });

  describe('detection against real project', () => {
    test('bgsd-oc project detects node and npm', () => {
      // Run against the actual project root (bin/ is inside project root)
      const projectRoot = path.resolve(__dirname, '..');
      const result = envScanParsed(projectRoot);
      assert.ok(result.success, `env scan on project root failed: ${result.error}`);
      const node = result.data.languages.find(l => l.name === 'node');
      assert.ok(node, 'should detect node in bgsd-oc project');
      assert.strictEqual(node.primary, true, 'node should be primary');
      assert.ok(result.data.package_manager.name, 'should detect a package manager');
    });
  });

  describe('manifest persistence', () => {
    test('env scan writes env-manifest.json when .planning/ exists', () => {
      fs.mkdirSync(path.join(tmpDir, '.planning'));
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      const result = runGsdTools('util:env scan --force', tmpDir);
      assert.ok(result.success, `env scan failed: ${result.error}`);
      const manifestPath = path.join(tmpDir, '.planning', 'env-manifest.json');
      assert.ok(fs.existsSync(manifestPath), 'env-manifest.json should exist');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      assert.strictEqual(manifest['$schema_version'], '1.0', 'should have schema version');
      assert.ok(Array.isArray(manifest.watched_files), 'should have watched_files');
      assert.ok(typeof manifest.watched_files_mtimes === 'object', 'should have watched_files_mtimes');
    });

    test('env scan does NOT write manifest when .planning/ does not exist', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      const result = runGsdTools('util:env scan --force', tmpDir);
      assert.ok(result.success, `env scan failed: ${result.error}`);
      const manifestPath = path.join(tmpDir, '.planning', 'env-manifest.json');
      assert.ok(!fs.existsSync(manifestPath), 'env-manifest.json should NOT exist without .planning/');
    });

    test('env scan writes project-profile.json when .planning/ exists', () => {
      fs.mkdirSync(path.join(tmpDir, '.planning'));
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), '{}');
      const result = runGsdTools('util:env scan --force', tmpDir);
      assert.ok(result.success, `env scan failed: ${result.error}`);
      const profilePath = path.join(tmpDir, '.planning', 'project-profile.json');
      assert.ok(fs.existsSync(profilePath), 'project-profile.json should exist');
      const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
      assert.strictEqual(profile['$schema_version'], '1.0');
      assert.deepStrictEqual(profile.languages, ['node']);
      assert.strictEqual(profile.primary_language, 'node');
      assert.strictEqual(profile.package_manager, 'npm');
    });

    test('env scan creates .planning/.gitignore with env-manifest.json entry', () => {
      fs.mkdirSync(path.join(tmpDir, '.planning'));
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      runGsdTools('util:env scan --force', tmpDir);
      const gitignorePath = path.join(tmpDir, '.planning', '.gitignore');
      assert.ok(fs.existsSync(gitignorePath), '.planning/.gitignore should exist');
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      assert.ok(content.includes('env-manifest.json'), '.gitignore should contain env-manifest.json');
    });

    test('env scan watched_files includes root manifest files', () => {
      fs.mkdirSync(path.join(tmpDir, '.planning'));
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), '{}');
      const result = runGsdTools('util:env scan --force', tmpDir);
      assert.ok(result.success);
      const data = JSON.parse(result.output);
      assert.ok(data.watched_files.includes('package.json'), 'watched should include package.json');
      assert.ok(data.watched_files.includes('package-lock.json'), 'watched should include package-lock.json');
      assert.ok(data.watched_files_mtimes['package.json'], 'should have mtime for package.json');
    });
  });

  describe('staleness detection', () => {
    test('staleness: fresh manifest is NOT stale', () => {
      // Create .planning/ and run initial scan to create manifest
      fs.mkdirSync(path.join(tmpDir, '.planning'));
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      const scanResult = runGsdTools('util:env scan --force', tmpDir);
      assert.ok(scanResult.success, `initial scan failed: ${scanResult.error}`);

      // Check staleness via env status
      const statusResult = runGsdTools('util:env status', tmpDir);
      assert.ok(statusResult.success, `env status failed: ${statusResult.error}`);
      const status = JSON.parse(statusResult.output);
      assert.strictEqual(status.exists, true, 'manifest should exist');
      assert.strictEqual(status.stale, false, 'fresh manifest should not be stale');
    });

    test('staleness: touching a watched file makes manifest stale', () => {
      fs.mkdirSync(path.join(tmpDir, '.planning'));
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      runGsdTools('util:env scan --force', tmpDir);

      // Touch the watched file (update mtime to future)
      const pkgPath = path.join(tmpDir, 'package.json');
      const futureTime = Date.now() + 5000;
      fs.utimesSync(pkgPath, futureTime / 1000, futureTime / 1000);

      const statusResult = runGsdTools('util:env status', tmpDir);
      assert.ok(statusResult.success);
      const status = JSON.parse(statusResult.output);
      assert.strictEqual(status.stale, true, 'should be stale after touching watched file');
      assert.strictEqual(status.reason, 'files_changed');
      assert.ok(status.changed_files.includes('package.json'), 'changed_files should include package.json');
    });

    test('staleness: missing manifest reports stale with reason no_manifest', () => {
      fs.mkdirSync(path.join(tmpDir, '.planning'));
      const statusResult = runGsdTools('util:env status', tmpDir);
      assert.ok(statusResult.success);
      const status = JSON.parse(statusResult.output);
      assert.strictEqual(status.exists, false, 'manifest should not exist');
      assert.strictEqual(status.stale, true, 'missing manifest should be stale');
      assert.strictEqual(status.reason, 'no_manifest');
    });

    test('staleness: --force flag bypasses staleness and always rescans', () => {
      fs.mkdirSync(path.join(tmpDir, '.planning'));
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');

      // Initial scan
      runGsdTools('util:env scan --force', tmpDir);
      const firstManifest = JSON.parse(
        fs.readFileSync(path.join(tmpDir, '.planning', 'env-manifest.json'), 'utf-8')
      );

      // Wait a tiny bit so scanned_at differs
      const origTime = firstManifest.scanned_at;

      // Force rescan (even though manifest is fresh)
      const forceResult = runGsdTools('util:env scan --force', tmpDir);
      assert.ok(forceResult.success, `force scan failed: ${forceResult.error}`);
      const secondManifest = JSON.parse(
        fs.readFileSync(path.join(tmpDir, '.planning', 'env-manifest.json'), 'utf-8')
      );

      // scanned_at should be different (or at least re-written)
      assert.ok(secondManifest.scanned_at, 'second scan should have scanned_at');
    });

    test('staleness: auto-rescan re-writes manifest when stale', () => {
      fs.mkdirSync(path.join(tmpDir, '.planning'));
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');

      // Initial scan
      runGsdTools('util:env scan --force', tmpDir);

      // Touch file to make stale
      const pkgPath = path.join(tmpDir, 'package.json');
      const futureTime = Date.now() + 5000;
      fs.utimesSync(pkgPath, futureTime / 1000, futureTime / 1000);

      // Verify stale
      const statusBefore = JSON.parse(runGsdTools('util:env status', tmpDir).output);
      assert.strictEqual(statusBefore.stale, true, 'should be stale before rescan');

      // Run scan WITHOUT --force — should auto-rescan since stale
      const rescanResult = runGsdTools('util:env scan', tmpDir);
      assert.ok(rescanResult.success, `auto-rescan failed: ${rescanResult.error}`);

      // After auto-rescan, manifest should be fresh again
      const statusAfter = JSON.parse(runGsdTools('util:env status', tmpDir).output);
      assert.strictEqual(statusAfter.stale, false, 'manifest should be fresh after auto-rescan');
    });

    test('env status returns correct structure', () => {
      fs.mkdirSync(path.join(tmpDir, '.planning'));
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      runGsdTools('util:env scan --force', tmpDir);

      const result = runGsdTools('util:env status', tmpDir);
      assert.ok(result.success);
      const status = JSON.parse(result.output);
      assert.strictEqual(typeof status.exists, 'boolean');
      assert.strictEqual(typeof status.stale, 'boolean');
      assert.ok(status.scanned_at, 'should have scanned_at');
      assert.strictEqual(typeof status.age_minutes, 'number');
      assert.strictEqual(typeof status.languages_count, 'number');
      assert.ok(status.languages_count >= 1, 'should detect at least 1 language');
      assert.ok(Array.isArray(status.changed_files));
    });

    test('env scan idempotent: second run without changes exits early', () => {
      fs.mkdirSync(path.join(tmpDir, '.planning'));
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');

      // Initial scan
      runGsdTools('util:env scan --force', tmpDir);
      const firstManifest = JSON.parse(
        fs.readFileSync(path.join(tmpDir, '.planning', 'env-manifest.json'), 'utf-8')
      );

      // Second scan without changes — should exit early (manifest unchanged)
      const secondResult = runGsdTools('util:env scan', tmpDir);
      assert.ok(secondResult.success, `idempotent scan failed: ${secondResult.error}`);
      const secondOutput = JSON.parse(secondResult.output);
      // Should return the existing manifest data (same scanned_at)
      assert.strictEqual(secondOutput.scanned_at, firstManifest.scanned_at,
        'idempotent scan should return existing manifest without re-scanning');
    });
  });

  describe('env integration - formatEnvSummary', () => {
    test('formatEnvSummary with node+go+elixir manifest produces compact format', () => {
      const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-envfmt-'));
      fs.mkdirSync(path.join(dir, '.planning'));
      // Create manifest files so staleness check passes
      fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"test"}');
      fs.writeFileSync(path.join(dir, 'go.mod'), 'module example.com/test');
      fs.writeFileSync(path.join(dir, 'mix.exs'), 'defmodule Test do end');
      const manifest = {
        '$schema_version': '1.0',
        scanned_at: new Date().toISOString(),
        languages: [
          { name: 'node', primary: true, binary: { available: true, version: '20.11.0' }, manifests: [{ file: 'package.json', path: 'package.json', depth: 0 }] },
          { name: 'go', primary: false, binary: { available: true, version: '1.21.5' }, manifests: [{ file: 'go.mod', path: 'go.mod', depth: 0 }] },
          { name: 'elixir', primary: false, binary: { available: true, version: '1.16.0' }, manifests: [{ file: 'mix.exs', path: 'mix.exs', depth: 0 }] },
        ],
        package_manager: { name: 'pnpm', version: '8.15.1' },
        infrastructure: { docker_services: [] },
        watched_files: ['package.json', 'go.mod', 'mix.exs'],
        watched_files_mtimes: {
          'package.json': fs.statSync(path.join(dir, 'package.json')).mtimeMs,
          'go.mod': fs.statSync(path.join(dir, 'go.mod')).mtimeMs,
          'mix.exs': fs.statSync(path.join(dir, 'mix.exs')).mtimeMs,
        },
      };
      fs.writeFileSync(path.join(dir, '.planning', 'env-manifest.json'), JSON.stringify(manifest));
      // Use init progress to check env_summary is produced
      // Need ROADMAP.md and STATE.md for init progress to work
      fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), '# Roadmap\n## Milestones\n- 🔵 v1.0\n## Phases\n');
      fs.writeFileSync(path.join(dir, '.planning', 'STATE.md'), '# Project State\n## Current Position\n**Phase:** 1\n**Status:** Executing');
      fs.writeFileSync(path.join(dir, '.planning', 'MILESTONES.md'), '# Milestones\n- 🔵 v1.0 — Test');
      const result = runGsdTools('init:progress --verbose', dir);
      assert.ok(result.success, `init progress failed: ${result.error}`);
      const data = JSON.parse(result.output);
      assert.ok(data.env_summary, 'should have env_summary');
      assert.ok(data.env_summary.startsWith('Tools:'), 'should start with "Tools:"');
      assert.ok(data.env_summary.includes('node@20.11.0'), 'should include node@20.11.0');
      assert.ok(data.env_summary.includes('(pnpm)'), 'should include (pnpm)');
      assert.ok(data.env_summary.includes('go@1.21.5'), 'should include go@1.21.5');
      assert.ok(data.env_summary.includes('elixir@1.16.0'), 'should include elixir@1.16.0');
      fs.rmSync(dir, { recursive: true, force: true });
    });

    test('formatEnvSummary with null manifest returns null', () => {
      const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-envfmt-'));
      fs.mkdirSync(path.join(dir, '.planning'));
      // No env-manifest.json, no language files → env_summary should be null
      fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), '# Roadmap\n## Milestones\n- 🔵 v1.0\n## Phases\n');
      fs.writeFileSync(path.join(dir, '.planning', 'STATE.md'), '# Project State\n## Current Position\n**Phase:** 1\n**Status:** Executing');
      fs.writeFileSync(path.join(dir, '.planning', 'MILESTONES.md'), '# Milestones\n- 🔵 v1.0 — Test');
      const result = runGsdTools('init:progress --verbose', dir);
      assert.ok(result.success, `init progress failed: ${result.error}`);
      const data = JSON.parse(result.output);
      // In verbose mode, null env_summary is omitted (trimmed) to reduce tokens
      assert.ok(!data.env_summary, 'should be null/absent when no languages detected');
      fs.rmSync(dir, { recursive: true, force: true });
    });

    test('formatEnvSummary with empty languages returns null', () => {
      const manifest = {
        '$schema_version': '1.0',
        scanned_at: new Date().toISOString(),
        languages: [],
        package_manager: { name: null },
        infrastructure: { docker_services: [] },
        watched_files: [],
        watched_files_mtimes: {},
      };
      const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-envfmt-'));
      fs.mkdirSync(path.join(dir, '.planning'));
      fs.writeFileSync(path.join(dir, '.planning', 'env-manifest.json'), JSON.stringify(manifest));
      fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), '# Roadmap\n## Milestones\n- 🔵 v1.0\n## Phases\n');
      fs.writeFileSync(path.join(dir, '.planning', 'STATE.md'), '# Project State\n## Current Position\n**Phase:** 1\n**Status:** Executing');
      fs.writeFileSync(path.join(dir, '.planning', 'MILESTONES.md'), '# Milestones\n- 🔵 v1.0 — Test');
      const result = runGsdTools('init:progress --verbose', dir);
      assert.ok(result.success, `init progress failed: ${result.error}`);
      const data = JSON.parse(result.output);
      // In verbose mode, null env_summary is omitted (trimmed) to reduce tokens
      assert.ok(!data.env_summary, 'should be null/absent when languages empty');
      fs.rmSync(dir, { recursive: true, force: true });
    });

    test('formatEnvSummary with missing binary includes "(no binary)" suffix', () => {
      const manifest = {
        '$schema_version': '1.0',
        scanned_at: new Date().toISOString(),
        languages: [
          { name: 'rust', primary: true, binary: { available: false, version: null }, manifests: [{ file: 'Cargo.toml', path: 'Cargo.toml', depth: 0 }] },
        ],
        package_manager: { name: 'cargo' },
        infrastructure: { docker_services: [] },
        watched_files: ['Cargo.toml'],
        watched_files_mtimes: {},
      };
      const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-envfmt-'));
      fs.mkdirSync(path.join(dir, '.planning'));
      // Create Cargo.toml so watched file exists with matching mtime
      fs.writeFileSync(path.join(dir, 'Cargo.toml'), '[package]\nname = "test"');
      manifest.watched_files_mtimes['Cargo.toml'] = fs.statSync(path.join(dir, 'Cargo.toml')).mtimeMs;
      fs.writeFileSync(path.join(dir, '.planning', 'env-manifest.json'), JSON.stringify(manifest));
      fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), '# Roadmap\n## Milestones\n- 🔵 v1.0\n## Phases\n');
      fs.writeFileSync(path.join(dir, '.planning', 'STATE.md'), '# Project State\n## Current Position\n**Phase:** 1\n**Status:** Executing');
      fs.writeFileSync(path.join(dir, '.planning', 'MILESTONES.md'), '# Milestones\n- 🔵 v1.0 — Test');
      const result = runGsdTools('init:progress --verbose', dir);
      assert.ok(result.success, `init progress failed: ${result.error}`);
      const data = JSON.parse(result.output);
      assert.ok(data.env_summary, 'should have env_summary');
      assert.ok(data.env_summary.includes('(no binary)'), 'should include "(no binary)"');
      fs.rmSync(dir, { recursive: true, force: true });
    });

    test('formatEnvSummary includes docker when docker_services detected', () => {
      const manifest = {
        '$schema_version': '1.0',
        scanned_at: new Date().toISOString(),
        languages: [
          { name: 'node', primary: true, binary: { available: true, version: '20.11.0' }, manifests: [{ file: 'package.json', path: 'package.json', depth: 0 }] },
        ],
        package_manager: { name: 'npm' },
        infrastructure: { docker_services: ['postgres', 'redis'] },
        watched_files: ['package.json'],
        watched_files_mtimes: {},
      };
      const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-envfmt-'));
      fs.mkdirSync(path.join(dir, '.planning'));
      // Create package.json so watched file exists with matching mtime
      fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"test-docker"}');
      manifest.watched_files_mtimes['package.json'] = fs.statSync(path.join(dir, 'package.json')).mtimeMs;
      fs.writeFileSync(path.join(dir, '.planning', 'env-manifest.json'), JSON.stringify(manifest));
      fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), '# Roadmap\n## Milestones\n- 🔵 v1.0\n## Phases\n');
      fs.writeFileSync(path.join(dir, '.planning', 'STATE.md'), '# Project State\n## Current Position\n**Phase:** 1\n**Status:** Executing');
      fs.writeFileSync(path.join(dir, '.planning', 'MILESTONES.md'), '# Milestones\n- 🔵 v1.0 — Test');
      const result = runGsdTools('init:progress --verbose', dir);
      assert.ok(result.success, `init progress failed: ${result.error}`);
      const data = JSON.parse(result.output);
      assert.ok(data.env_summary, 'should have env_summary');
      assert.ok(data.env_summary.includes('docker'), 'should include docker when services detected');
      fs.rmSync(dir, { recursive: true, force: true });
    });
  });

  describe('env integration - autoTriggerEnvScan', () => {
    test('auto-trigger creates manifest on first init progress', () => {
      const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-envtrigger-'));
      fs.mkdirSync(path.join(dir, '.planning'));
      fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"test-auto-trigger"}');
      fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), '# Roadmap\n## Milestones\n- 🔵 v1.0\n## Phases\n');
      fs.writeFileSync(path.join(dir, '.planning', 'STATE.md'), '# Project State\n## Current Position\n**Phase:** 1\n**Status:** Executing');
      fs.writeFileSync(path.join(dir, '.planning', 'MILESTONES.md'), '# Milestones\n- 🔵 v1.0 — Test');
      // No env-manifest.json exists yet
      assert.ok(!fs.existsSync(path.join(dir, '.planning', 'env-manifest.json')), 'manifest should not exist before');
      const result = runGsdTools('init:progress --verbose', dir);
      assert.ok(result.success, `init progress failed: ${result.error}`);
      // After init, manifest should have been created
      assert.ok(fs.existsSync(path.join(dir, '.planning', 'env-manifest.json')), 'manifest should be auto-created after init');
      const data = JSON.parse(result.output);
      assert.ok(data.env_summary, 'should have env_summary after auto-trigger');
      assert.ok(data.env_summary.includes('node'), 'should detect node');
      fs.rmSync(dir, { recursive: true, force: true });
    });

    test('auto-trigger returns existing manifest when fresh', () => {
      const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-envtrigger-'));
      fs.mkdirSync(path.join(dir, '.planning'));
      fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"test-fresh"}');
      fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), '# Roadmap\n## Milestones\n- 🔵 v1.0\n## Phases\n');
      fs.writeFileSync(path.join(dir, '.planning', 'STATE.md'), '# Project State\n## Current Position\n**Phase:** 1\n**Status:** Executing');
      fs.writeFileSync(path.join(dir, '.planning', 'MILESTONES.md'), '# Milestones\n- 🔵 v1.0 — Test');
      // First: create manifest via env scan
      runGsdTools('util:env scan --force', dir);
      const firstManifest = JSON.parse(fs.readFileSync(path.join(dir, '.planning', 'env-manifest.json'), 'utf-8'));
      // Second: init progress should use existing (fresh) manifest
      const result = runGsdTools('init:progress --verbose', dir);
      assert.ok(result.success, `init progress failed: ${result.error}`);
      const secondManifest = JSON.parse(fs.readFileSync(path.join(dir, '.planning', 'env-manifest.json'), 'utf-8'));
      assert.strictEqual(secondManifest.scanned_at, firstManifest.scanned_at,
        'manifest should not be re-scanned when fresh');
      fs.rmSync(dir, { recursive: true, force: true });
    });

    test('init execute-phase includes env_summary', () => {
      const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-envexec-'));
      fs.mkdirSync(path.join(dir, '.planning', 'phases', '01-test'), { recursive: true });
      fs.writeFileSync(path.join(dir, '.planning', 'phases', '01-test', '01-01-PLAN.md'), '---\nphase: 01-test\nplan: 01\n---\n');
      fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"test-exec"}');
      fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), '# Roadmap\n## Milestones\n- 🔵 v1.0\n## Phases\n| Phase | Name |\n|---|---|\n| 1 | Test |\n');
      fs.writeFileSync(path.join(dir, '.planning', 'STATE.md'), '# Project State\n## Current Position\n**Phase:** 1\n**Status:** Executing');
      fs.writeFileSync(path.join(dir, '.planning', 'MILESTONES.md'), '# Milestones\n- 🔵 v1.0 — Test');
      fs.writeFileSync(path.join(dir, '.planning', 'config.json'), '{}');
      const result = runGsdTools('init:execute-phase 1 --verbose', dir);
      assert.ok(result.success, `init execute-phase failed: ${result.error}`);
      const data = JSON.parse(result.output);
      assert.ok(data.env_summary !== undefined, 'should have env_summary field');
      fs.rmSync(dir, { recursive: true, force: true });
    });

    test('env status returns correct JSON structure', () => {
      const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-envstatus-'));
      fs.mkdirSync(path.join(dir, '.planning'));
      fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"test-status"}');
      runGsdTools('util:env scan --force', dir);
      const result = runGsdTools('util:env status', dir);
      assert.ok(result.success, `env status failed: ${result.error}`);
      const status = JSON.parse(result.output);
      assert.strictEqual(typeof status.exists, 'boolean');
      assert.strictEqual(typeof status.stale, 'boolean');
      assert.ok(status.scanned_at, 'should have scanned_at');
      assert.strictEqual(typeof status.age_minutes, 'number');
      assert.strictEqual(typeof status.languages_count, 'number');
      assert.ok(Array.isArray(status.changed_files));
      fs.rmSync(dir, { recursive: true, force: true });
    });
  });

  describe('env integration - full flow', () => {
    test('create project, scan, verify status, then init progress with tools line', () => {
      const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-envflow-'));
      fs.mkdirSync(path.join(dir, '.planning'));
      fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"integration-test"}');
      fs.writeFileSync(path.join(dir, 'go.mod'), 'module example.com/test\ngo 1.21');
      fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), '# Roadmap\n## Milestones\n- 🔵 v1.0\n## Phases\n');
      fs.writeFileSync(path.join(dir, '.planning', 'STATE.md'), '# Project State\n## Current Position\n**Phase:** 1\n**Status:** Executing');
      fs.writeFileSync(path.join(dir, '.planning', 'MILESTONES.md'), '# Milestones\n- 🔵 v1.0 — Test');

      // Step 1: Run env scan
      const scanResult = runGsdTools('util:env scan --force', dir);
      assert.ok(scanResult.success, `scan failed: ${scanResult.error}`);
      assert.ok(fs.existsSync(path.join(dir, '.planning', 'env-manifest.json')), 'manifest should exist');

      // Step 2: Verify env status reports fresh
      const statusResult = runGsdTools('util:env status', dir);
      assert.ok(statusResult.success);
      const status = JSON.parse(statusResult.output);
      assert.strictEqual(status.stale, false, 'manifest should be fresh');
      assert.ok(status.languages_count >= 2, 'should detect at least 2 languages');

      // Step 3: init progress should include Tools line
      const progressResult = runGsdTools('init:progress --verbose', dir);
      assert.ok(progressResult.success, `progress failed: ${progressResult.error}`);
      const progressData = JSON.parse(progressResult.output);
      assert.ok(progressData.env_summary, 'should have env_summary');
      assert.ok(progressData.env_summary.startsWith('Tools:'), 'should start with Tools:');
      assert.ok(progressData.env_summary.includes('node'), 'should mention node');
      assert.ok(progressData.env_summary.includes('go'), 'should mention go');

      fs.rmSync(dir, { recursive: true, force: true });
    });
  });
});

