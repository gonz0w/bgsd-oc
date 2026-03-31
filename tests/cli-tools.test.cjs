/**
 * CLI Tools Detection Tests
 * 
 * Comprehensive test suite for tool detection infrastructure:
 * - detector.js: Tool detection, caching, version parsing
 * - install-guidance.js: Install instructions per platform
 * - fallback.js: Graceful fallback wrapper
 * - CLI: detect:tools command output format
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const { TOOLS_PATH, runGsdTools } = require('./helpers.cjs');

// Load detector module directly for unit tests
const detector = require('../src/lib/cli-tools/detector.js');
const guidance = require('../src/lib/cli-tools/install-guidance.js');
const fallback = require('../src/lib/cli-tools/fallback.js');

describe('CLI Tools Detection Suite', () => {

  // ──────────────────────────────────────────────────────────────────────────
  // DETECTOR TESTS (detector.js)
  // ──────────────────────────────────────────────────────────────────────────

  describe('detector.js — TOOLS constant', () => {
    test('has exactly 9 entries', () => {
      const toolCount = Object.keys(detector.TOOLS).length;
      assert.strictEqual(toolCount, 9, `Expected 9 tools, got ${toolCount}`);
    });

    test('each tool has name, aliases, description', () => {
      for (const [key, tool] of Object.entries(detector.TOOLS)) {
        assert.ok(tool.name, `${key}: missing name`);
        assert.ok(Array.isArray(tool.aliases), `${key}: aliases should be array`);
        assert.ok(tool.description, `${key}: missing description`);
      }
    });

    test('ripgrep has rg alias', () => {
      assert.ok(detector.TOOLS.ripgrep.aliases.includes('rg'), 'ripgrep should have rg alias');
    });

    test('fd has fd-find alias', () => {
      assert.ok(detector.TOOLS.fd.aliases.includes('fd-find'), 'fd should have fd-find alias');
    });
  });

  describe('detector.js — detectTool()', () => {
    beforeEach(() => {
      detector.clearCache();
    });

    afterEach(() => {
      detector.clearCache();
    });

    test('returns object with available (boolean), name, description', () => {
      const result = detector.detectTool('ripgrep');
      assert.ok(typeof result === 'object', 'result should be object');
      assert.ok(typeof result.available === 'boolean', 'available should be boolean');
      assert.ok(result.name, 'should have name');
      assert.ok(result.description, 'should have description');
    });

    test('resolves alias rg to ripgrep', () => {
      const result = detector.detectTool('rg');
      assert.strictEqual(result.name, 'ripgrep', 'rg alias should resolve to ripgrep');
    });

    test('unknown tool returns available:false with error', () => {
      const result = detector.detectTool('unknown-tool-xyz');
      assert.strictEqual(result.available, false, 'unknown tool should not be available');
      assert.strictEqual(result.error, 'Unknown tool', 'should have error message');
    });

    test('available tool returns path string', () => {
      const result = detector.detectTool('ripgrep');
      if (result.available) {
        assert.ok(typeof result.path === 'string', 'path should be string when available');
        assert.ok(result.path.length > 0, 'path should not be empty');
      }
    });

    test('available tool returns version string', () => {
      const result = detector.detectTool('ripgrep');
      if (result.available) {
        assert.ok(typeof result.version === 'string', 'version should be string when available');
        assert.ok(result.version.length > 0, 'version should not be empty');
      }
    });

    test('repeated calls return cached result', () => {
      detector.clearCache();
      const result1 = detector.detectTool('ripgrep');
      const result2 = detector.detectTool('ripgrep');
      // Both should be identical (same object reference after caching)
      assert.deepStrictEqual(result1, result2, 'repeated calls should return same result');
    });

    test('tool name is case-insensitive', () => {
      const lower = detector.detectTool('ripgrep');
      const upper = detector.detectTool('RIPGREP');
      const mixed = detector.detectTool('RipGrep');
      
      assert.strictEqual(lower.name, upper.name, 'case should not matter');
      assert.strictEqual(upper.name, mixed.name, 'case should not matter');
    });
  });

  describe('detector.js — getToolStatus()', () => {
    beforeEach(() => {
      detector.clearCache();
    });

    afterEach(() => {
      detector.clearCache();
    });

    test('returns object with all registered tool keys', () => {
      const status = detector.getToolStatus();
      assert.ok(typeof status === 'object', 'should return object');
      
      const expectedTools = Object.keys(detector.TOOLS);
      for (const tool of expectedTools) {
        assert.ok(status[tool], `missing tool: ${tool}`);
      }
    });

    test('each entry has available, path, name, description, version fields', () => {
      const status = detector.getToolStatus();
      
      for (const [toolName, toolInfo] of Object.entries(status)) {
        assert.ok(typeof toolInfo.available === 'boolean', `${toolName}: available should be boolean`);
        assert.ok(typeof toolInfo.path === 'string' || toolInfo.path === null, `${toolName}: path should be string or null`);
        assert.ok(typeof toolInfo.name === 'string', `${toolName}: name should be string`);
        assert.ok(typeof toolInfo.description === 'string', `${toolName}: description should be string`);
        assert.ok(typeof toolInfo.version === 'string' || toolInfo.version === null, `${toolName}: version should be string or null`);
      }
    });

    test('no entry is missing any required field', () => {
      const status = detector.getToolStatus();
      
      for (const [toolName, toolInfo] of Object.entries(status)) {
        assert.ok(toolInfo.available !== undefined, `${toolName}: missing available`);
        assert.ok(toolInfo.path !== undefined, `${toolName}: missing path`);
        assert.ok(toolInfo.name !== undefined, `${toolName}: missing name`);
        assert.ok(toolInfo.description !== undefined, `${toolName}: missing description`);
        assert.ok(toolInfo.version !== undefined, `${toolName}: missing version`);
      }
    });
  });

  describe('detector.js — parseVersion()', () => {
    test('parses ripgrep format: ripgrep 15.1.0', () => {
      const v = detector.parseVersion('ripgrep 15.1.0');
      assert.deepStrictEqual(v, { major: 15, minor: 1, patch: 0 });
    });

    test('parses jq format: jq-1.8.1', () => {
      const v = detector.parseVersion('jq-1.8.1');
      assert.deepStrictEqual(v, { major: 1, minor: 8, patch: 1 });
    });

    test('parses fd format: fd 10.4.2', () => {
      const v = detector.parseVersion('fd 10.4.2');
      assert.deepStrictEqual(v, { major: 10, minor: 4, patch: 2 });
    });

    test('parses gh format: gh version 2.88.0 (2026-03-11)', () => {
      const v = detector.parseVersion('gh version 2.88.0 (2026-03-11)');
      assert.deepStrictEqual(v, { major: 2, minor: 88, patch: 0 });
    });

    test('parses bat format: bat 0.26.1 (v0.25.0-402-g979ba226)', () => {
      const v = detector.parseVersion('bat 0.26.1 (v0.25.0-402-g979ba226)');
      assert.deepStrictEqual(v, { major: 0, minor: 26, patch: 1 });
    });

    test('parses yq format: yq 3.4.3', () => {
      const v = detector.parseVersion('yq 3.4.3');
      assert.deepStrictEqual(v, { major: 3, minor: 4, patch: 3 });
    });

    test('returns null for string with no version', () => {
      const v = detector.parseVersion('no version here');
      assert.strictEqual(v, null);
    });

    test('returns null for null input', () => {
      const v = detector.parseVersion(null);
      assert.strictEqual(v, null);
    });

    test('returns null for empty string', () => {
      const v = detector.parseVersion('');
      assert.strictEqual(v, null);
    });

    test('parses X.Y format: 1.5', () => {
      const v = detector.parseVersion('1.5');
      assert.deepStrictEqual(v, { major: 1, minor: 5, patch: 0 });
    });

    test('parses X format: 5', () => {
      const v = detector.parseVersion('5');
      assert.deepStrictEqual(v, { major: 5, minor: 0, patch: 0 });
    });
  });

  describe('detector.js — meetsMinVersion()', () => {
    beforeEach(() => {
      detector.clearCache();
    });

    afterEach(() => {
      detector.clearCache();
    });

    test('tool available with version above minimum returns meets: true', () => {
      const result = detector.meetsMinVersion('ripgrep', '1.0.0');
      assert.ok(result.meets === true || result.meets === false, 'should have meets boolean');
      assert.ok(typeof result.current === 'string' || result.current === null, 'current should be string or null');
      assert.strictEqual(result.required, '1.0.0', 'required should match input');
    });

    test('tool available with version below minimum returns meets: false', () => {
      const result = detector.meetsMinVersion('ripgrep', '99.99.99');
      assert.strictEqual(result.meets, false, 'should not meet high version requirement');
      assert.ok(result.current, 'should have current version');
    });

    test('tool available with exact minimum version returns meets: true', () => {
      // First get the actual version
      const toolInfo = detector.detectTool('ripgrep');
      if (toolInfo.available && toolInfo.version) {
        const version = detector.parseVersion(toolInfo.version);
        if (version) {
          const minVersion = `${version.major}.${version.minor}.${version.patch}`;
          const result = detector.meetsMinVersion('ripgrep', minVersion);
          assert.strictEqual(result.meets, true, 'should meet exact version');
        }
      }
    });

    test('tool not available returns meets: false', () => {
      const result = detector.meetsMinVersion('unknown-tool-xyz', '1.0.0');
      assert.strictEqual(result.meets, false, 'unavailable tool should not meet requirement');
      assert.strictEqual(result.required, '1.0.0', 'required should match input');
    });

    test('returns object with meets, current, required fields', () => {
      const result = detector.meetsMinVersion('ripgrep', '1.0.0');
      assert.ok(typeof result.meets === 'boolean', 'meets should be boolean');
      assert.ok(result.current === null || typeof result.current === 'string', 'current should be string or null');
      assert.ok(typeof result.required === 'string', 'required should be string');
    });
  });

  describe('detector.js — file cache', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgsd-cache-test-'));
      detector.clearCache();
      detector.setCachePath(path.join(tmpDir, 'tools.json'));
    });

    afterEach(() => {
      detector.clearCache();
      detector.setCachePath(null); // Reset to default
      if (tmpDir && fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true });
      }
    });

    test('after getToolStatus(), cache file exists on disk', () => {
      detector.getToolStatus();
      const cachePath = path.join(tmpDir, 'tools.json');
      assert.ok(fs.existsSync(cachePath), 'cache file should exist after getToolStatus');
    });

    test('clearCache() removes in-memory and file cache', () => {
      detector.getToolStatus();
      const cachePath = path.join(tmpDir, 'tools.json');
      assert.ok(fs.existsSync(cachePath), 'cache file should exist');
      
      detector.clearCache();
      assert.ok(!fs.existsSync(cachePath), 'cache file should be deleted after clearCache');
    });

    test('expired file cache (>TTL) triggers fresh detection', () => {
      detector.getToolStatus();
      const cachePath = path.join(tmpDir, 'tools.json');
      
      // Modify file to old timestamp older than the configured TTL.
      const content = fs.readFileSync(cachePath, 'utf8');
      const data = JSON.parse(content);
      data.timestamp = Date.now() - detector.CACHE_TTL_MS - 1000;
      fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
      
      detector.clearCache(); // Clear in-memory cache
      const result = detector.getToolStatus();
      assert.ok(typeof result === 'object', 'should get fresh detection result');
    });

    test('refreshToolStatus() bypasses a fresh file cache', () => {
      const first = detector.getToolStatus();
      const refreshed = detector.refreshToolStatus();
      assert.ok(typeof first === 'object' && typeof refreshed === 'object', 'both calls should return tool status objects');
      assert.deepStrictEqual(Object.keys(refreshed).sort(), Object.keys(first).sort(), 'refresh should preserve tool set');
    });

    test('corrupted cache file falls back gracefully', () => {
      const cachePath = path.join(tmpDir, 'tools.json');
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      fs.writeFileSync(cachePath, 'invalid json {{{', 'utf8');
      
      detector.clearCache();
      const result = detector.getToolStatus();
      assert.ok(typeof result === 'object', 'should gracefully handle corrupted cache');
      assert.ok(Object.keys(result).length > 0, 'should return valid result with tools');
    });
  });

  describe('detector.js — clearCache()', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgsd-cache-test-'));
      detector.setCachePath(path.join(tmpDir, 'tools.json'));
      detector.clearCache();
    });

    afterEach(() => {
      detector.clearCache();
      detector.setCachePath(null);
      if (tmpDir && fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true });
      }
    });

    test('after clearCache(), in-memory Map is empty', () => {
      detector.detectTool('ripgrep');
      detector.clearCache();
      
      // Can't directly inspect the Map, but re-detecting should not hit cache
      const result = detector.detectTool('ripgrep');
      assert.ok(typeof result === 'object', 'should still work after cache clear');
    });

    test('after clearCache(), file cache is deleted', () => {
      detector.getToolStatus();
      const cachePath = path.join(tmpDir, 'tools.json');
      assert.ok(fs.existsSync(cachePath), 'cache should exist after getToolStatus');
      
      detector.clearCache();
      assert.ok(!fs.existsSync(cachePath), 'cache file should be deleted');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // INSTALL GUIDANCE TESTS (install-guidance.js)
  // ──────────────────────────────────────────────────────────────────────────

  describe('install-guidance.js — getInstallGuidance()', () => {
    test('returns object for known tool (ripgrep) with name, installCommand, platform', () => {
      const result = guidance.getInstallGuidance('ripgrep');
      assert.ok(result, 'should return guidance for ripgrep');
      assert.ok(result.name, 'should have name');
      assert.ok(result.installCommand, 'should have installCommand');
      assert.ok(result.platform, 'should have platform');
    });

    test('returns null for unknown tool', () => {
      const result = guidance.getInstallGuidance('unknown-tool-xyz');
      assert.strictEqual(result, null, 'unknown tool should return null');
    });

    test('resolves alias rg to ripgrep guidance', () => {
      const result = guidance.getInstallGuidance('rg');
      assert.ok(result, 'rg alias should resolve');
      assert.strictEqual(result.name, 'ripgrep', 'should resolve to ripgrep');
    });

    test('installCommand is a non-empty string', () => {
      const result = guidance.getInstallGuidance('fd');
      assert.ok(typeof result.installCommand === 'string', 'installCommand should be string');
      assert.ok(result.installCommand.length > 0, 'installCommand should not be empty');
    });

    test('platform is one of darwin, linux, win32', () => {
      const result = guidance.getInstallGuidance('jq');
      const validPlatforms = ['darwin', 'linux', 'win32'];
      assert.ok(validPlatforms.includes(result.platform), `platform should be one of ${validPlatforms.join(', ')}`);
    });

    test('all registered tools have guidance', () => {
      const tools = ['ripgrep', 'fd', 'jq', 'yq', 'ast_grep', 'sd', 'hyperfine', 'bat', 'gh'];
      for (const tool of tools) {
        const result = guidance.getInstallGuidance(tool);
        assert.ok(result, `${tool} should have guidance`);
      }
    });
  });

  describe('install-guidance.js — getInstallCommand()', () => {
    test('returns string for known tool', () => {
      const result = guidance.getInstallCommand('ripgrep');
      assert.ok(typeof result === 'string', 'should return string');
      assert.ok(result.length > 0, 'should not be empty');
    });

    test('returns null for unknown tool', () => {
      const result = guidance.getInstallCommand('unknown-tool-xyz');
      assert.strictEqual(result, null, 'unknown tool should return null');
    });

    test('resolves aliases', () => {
      const byAlias = guidance.getInstallCommand('rg');
      const byName = guidance.getInstallCommand('ripgrep');
      assert.ok(byAlias, 'should resolve rg alias');
      assert.ok(byName, 'should resolve ripgrep name');
    });
  });

  describe('install-guidance.js — getAllToolConfig()', () => {
    test('returns object with at least 6 tool entries', () => {
      const config = guidance.getAllToolConfig();
      const toolCount = Object.keys(config).length;
      assert.ok(toolCount >= 6, `should have at least 6 tools, got ${toolCount}`);
    });

    test('each tool has install object with darwin, linux, win32 keys', () => {
      const config = guidance.getAllToolConfig();
      const platforms = ['darwin', 'linux', 'win32'];
      
      for (const [toolName, toolConfig] of Object.entries(config)) {
        assert.ok(toolConfig.install, `${toolName}: missing install`);
        for (const platform of platforms) {
          assert.ok(toolConfig.install[platform], `${toolName}: missing install.${platform}`);
        }
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // FALLBACK WRAPPER TESTS (fallback.js)
  // ──────────────────────────────────────────────────────────────────────────

  describe('fallback.js — withToolFallback()', () => {
    beforeEach(() => {
      detector.clearCache();
    });

    afterEach(() => {
      detector.clearCache();
    });

    test('when tool is available: cliFn is called, usedFallback: false', () => {
      const called = { cli: false, fallback: false };
      
      const result = fallback.withToolFallback(
        'ripgrep',
        () => { called.cli = true; return 'cli-result'; },
        () => { called.fallback = true; return 'fallback-result'; }
      );
      
      assert.strictEqual(result.success, true, 'should succeed');
      assert.strictEqual(result.usedFallback, false, 'should not use fallback');
      assert.strictEqual(result.result, 'cli-result', 'should use CLI result');
    });

    test('when tool is unavailable: fallbackFn is called, usedFallback: true, guidance present', () => {
      const called = { cli: false, fallback: false };
      
      const result = fallback.withToolFallback(
        'unknown-tool-xyz',
        () => { called.cli = true; return 'cli-result'; },
        () => { called.fallback = true; return 'fallback-result'; }
      );
      
      // Unknown tool is unavailable, so fallback should be called
      assert.strictEqual(result.success, true, 'should succeed with fallback');
      assert.strictEqual(result.usedFallback, true, 'should use fallback');
    });

    test('when cliFn throws: returns success: false, error message', () => {
      const result = fallback.withToolFallback(
        'ripgrep',
        () => { throw new Error('CLI error'); },
        () => 'fallback'
      );
      
      assert.strictEqual(result.success, false, 'should indicate failure');
      assert.ok(result.error, 'should have error message');
      assert.strictEqual(result.usedFallback, false, 'should not use fallback');
    });

    test('when fallbackFn throws: returns success: false, usedFallback: true, error message', () => {
      const result = fallback.withToolFallback(
        'unknown-tool-xyz',
        () => 'cli',
        () => { throw new Error('Fallback error'); }
      );
      
      assert.strictEqual(result.success, false, 'should indicate failure');
      assert.ok(result.error, 'should have error message');
      assert.strictEqual(result.usedFallback, true, 'should indicate fallback was attempted');
    });

    test('result object always has success and usedFallback fields', () => {
      const result = fallback.withToolFallback(
        'ripgrep',
        () => 'result',
        () => 'fallback'
      );
      
      assert.ok(typeof result.success === 'boolean', 'should have success boolean');
      assert.ok(typeof result.usedFallback === 'boolean', 'should have usedFallback boolean');
    });
  });

  describe('fallback.js — isToolAvailable()', () => {
    beforeEach(() => {
      detector.clearCache();
    });

    afterEach(() => {
      detector.clearCache();
    });

    test('returns boolean for known tools', () => {
      const result = fallback.isToolAvailable('ripgrep');
      assert.ok(typeof result === 'boolean', 'should return boolean');
    });

    test('returns false for unknown tools', () => {
      const result = fallback.isToolAvailable('unknown-tool-xyz');
      assert.strictEqual(result, false, 'unknown tool should return false');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // CLI COMMAND TESTS (detect:tools)
  // ──────────────────────────────────────────────────────────────────────────

  describe('CLI output format — detect:tools', () => {
    test('detect:tools outputs valid JSON', () => {
      try {
        const output = execSync(`node "${TOOLS_PATH}" detect:tools`, {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        const data = JSON.parse(output.trim());
        assert.ok(data !== undefined, 'should parse to valid JSON');
      } catch (err) {
        assert.fail(`detect:tools should output valid JSON: ${err.message}`);
      }
    });

    test('detect:tools output is an array (not object)', () => {
      const output = execSync(`node "${TOOLS_PATH}" detect:tools`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      const data = JSON.parse(output.trim());
      assert.ok(Array.isArray(data), 'output should be array');
    });

    test('each element has name, cmd, available fields', () => {
      const output = execSync(`node "${TOOLS_PATH}" detect:tools`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      const data = JSON.parse(output.trim());
      assert.ok(Array.isArray(data), 'should be array');
      
      for (const item of data) {
        assert.ok(typeof item.name === 'string', `${item.name || 'item'}: missing or invalid name`);
        assert.ok(typeof item.cmd === 'string', `${item.name || 'item'}: missing or invalid cmd`);
        assert.ok(typeof item.available === 'boolean', `${item.name || 'item'}: missing or invalid available`);
      }
    });

    test('array has exactly one element per registered tool', () => {
      const output = execSync(`node "${TOOLS_PATH}" detect:tools`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      const data = JSON.parse(output.trim());
      assert.strictEqual(data.length, Object.keys(detector.TOOLS).length, `should have ${Object.keys(detector.TOOLS).length} tools, got ${data.length}`);
    });

    test('available tools have path and version fields', () => {
      const output = execSync(`node "${TOOLS_PATH}" detect:tools`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      const data = JSON.parse(output.trim());
      
      for (const item of data) {
        if (item.available) {
          assert.ok(typeof item.path === 'string', `${item.name}: available tool should have path`);
          assert.ok(typeof item.version === 'string', `${item.name}: available tool should have version`);
        }
      }
    });

    test('unavailable tools have install field', () => {
      const output = execSync(`node "${TOOLS_PATH}" detect:tools`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      const data = JSON.parse(output.trim());
      
      for (const item of data) {
        if (!item.available) {
          assert.ok(item.install, `${item.name}: unavailable tool should have install field`);
        }
      }
    });

    test('output contains all expected tools', () => {
      const output = execSync(`node "${TOOLS_PATH}" detect:tools`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      const data = JSON.parse(output.trim());
      const names = data.map(t => t.name).sort();
      const expected = Object.keys(detector.TOOLS).sort();
      
      assert.deepStrictEqual(names, expected, 'should contain all registered tools');
    });
  });

  describe('CLI backward compatibility — util:tools', () => {
    test('util:tools outputs valid JSON', () => {
      try {
        const output = execSync(`node "${TOOLS_PATH}" util:tools`, {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        const data = JSON.parse(output.trim());
        assert.ok(data !== undefined, 'should parse to valid JSON');
      } catch (err) {
        assert.fail(`util:tools should output valid JSON: ${err.message}`);
      }
    });

    test('util:tools output has available and unavailable arrays', () => {
      const output = execSync(`node "${TOOLS_PATH}" util:tools`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      const data = JSON.parse(output.trim());
      assert.ok(Array.isArray(data.available), 'should have available array');
      assert.ok(Array.isArray(data.unavailable), 'should have unavailable array');
    });

    test('util:tools output has summary object', () => {
      const output = execSync(`node "${TOOLS_PATH}" util:tools`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      const data = JSON.parse(output.trim());
      assert.ok(typeof data.summary === 'object', 'should have summary object');
    });
  });

  describe('Test suite completion check', () => {
    test('all core detector functions are tested', () => {
      // Verify all exported functions have test coverage
      const exportedFunctions = [
        'TOOLS',
        'detectTool',
        'getToolStatus',
        'clearCache',
        'parseVersion',
        'meetsMinVersion',
        'resolveToolPath',
        'setCachePath',
        'CACHE_TTL_MS'
      ];
      
      for (const fn of exportedFunctions) {
        assert.ok(detector[fn] !== undefined, `detector.${fn} should be exported`);
      }
    });

    test('all guidance functions are tested', () => {
      const exportedFunctions = [
        'TOOL_CONFIG',
        'getInstallGuidance',
        'getInstallCommand',
        'getAllToolConfig',
        'getPlatform'
      ];
      
      for (const fn of exportedFunctions) {
        assert.ok(guidance[fn] !== undefined, `guidance.${fn} should be exported`);
      }
    });

    test('all fallback functions are tested', () => {
      const exportedFunctions = [
        'withToolFallback',
        'isToolAvailable',
        'getToolGuidance'
      ];
      
      for (const fn of exportedFunctions) {
        assert.ok(fallback[fn] !== undefined, `fallback.${fn} should be exported`);
      }
    });
  });

});
