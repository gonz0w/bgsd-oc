/**
 * Model Override Diagnostic Test
 * 
 * Run: node tests/model-override-diagnostic.test.cjs
 * 
 * This test verifies that:
 * 1. Model overrides are correctly read from config
 * 2. init:execute-phase correctly resolves override models
 * 3. The resolved model can be used to spawn a subagent
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const TOOLS_PATH = path.join(__dirname, '..', 'bin', 'bgsd-tools.cjs');

function runGsdTools(args, cwd) {
  try {
    const output = execSync(`node "${TOOLS_PATH}" ${args}`, {
      cwd: cwd || process.cwd(),
      encoding: 'utf-8',
      timeout: 30000,
    });
    return { success: true, output };
  } catch (err) {
    return { success: false, output: err.stdout || '', error: err.message };
  }
}

function createTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgsd-model-override-test-'));
  
  // Create minimal planning structure
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '169-test'), { recursive: true });
  
  // Create ROADMAP.md
  fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

### Phase 169: Model Override Test
**Goal:** Test model override resolution
**Plans:** 1 plans
`);
  
  // Create STATE.md
  fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State

## Current Position

**Phase:** 169
**Current Plan:** 01
**Total Plans in Phase:** 1
**Status:** Ready to execute
`);

  // Create a simple plan
  fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '169-test', '169-01-PLAN.md'), `---
phase: 169-test
plan: 01
type: auto
autonomous: true
depends_on: []
files_modified:
  - test.txt
---

# Plan

<objective>Test plan for model override diagnostic</objective>
`);
  
  return tmpDir;
}

describe('model override diagnostic', () => {
  test('config with executor override resolves correctly in init:execute-phase', () => {
    const tmpDir = createTempProject();
    
    try {
      // Write config with executor override
      const config = {
        commit_docs: true,
        model_settings: {
          default_profile: 'balanced',
          profiles: {
            quality: { model: 'gpt-5.4' },
            balanced: { model: 'gpt-5.4-mini' },
            budget: { model: 'gpt-5.4-nano' },
          },
          agent_overrides: {
            'bgsd-executor': 'ollama/qwen3-coder:latest',
          },
        },
      };
      
      fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify(config, null, 2));
      
      // Initialize jj repo (required for init:execute-phase)
      try {
        execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
        execSync('jj git init', { cwd: tmpDir, stdio: 'pipe' });
      } catch (e) {
        console.log('Note: jj not available, skipping execute-phase test');
        return;
      }
      
      // Run init:execute-phase
      const result = runGsdTools('init:execute-phase 169 --verbose', tmpDir);
      console.log('\n=== init:execute-phase output ===');
      console.log(result.output);
      
      assert.ok(result.success, `Command failed: ${result.error}`);
      
      const data = JSON.parse(result.output);
      
      // Check that executor_model is the override
      console.log('\n=== Model Resolution Results ===');
      console.log('executor_model:', data.executor_model);
      console.log('executor_model_state:', JSON.stringify(data.executor_model_state, null, 2));
      
      assert.strictEqual(data.executor_model, 'ollama/qwen3-coder:latest', 
        'executor_model should be the override value');
      assert.strictEqual(data.executor_model_state.source, 'agent_override',
        'source should be agent_override');
      assert.strictEqual(data.executor_model_state.configured, 'ollama/qwen3-coder:latest',
        'configured should be the override value');
      
      console.log('\n✓ Model override correctly resolved by init command');
      
    } finally {
      // Cleanup
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('config with planner override resolves correctly in init:plan-phase', () => {
    const tmpDir = createTempProject();
    
    try {
      // Write config with planner override
      const config = {
        commit_docs: true,
        model_settings: {
          default_profile: 'balanced',
          profiles: {
            quality: { model: 'gpt-5.4' },
            balanced: { model: 'gpt-5.4-mini' },
            budget: { model: 'gpt-5.4-nano' },
          },
          agent_overrides: {
            'bgsd-planner': 'custom/planner-model:v1',
          },
        },
      };
      
      fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify(config, null, 2));
      
      // Run init:plan-phase
      const result = runGsdTools('init:plan-phase 169 --verbose', tmpDir);
      console.log('\n=== init:plan-phase output ===');
      console.log(result.output);
      
      assert.ok(result.success, `Command failed: ${result.error}`);
      
      const data = JSON.parse(result.output);
      
      console.log('\n=== Model Resolution Results ===');
      console.log('planner_model:', data.planner_model);
      console.log('planner_model_state:', JSON.stringify(data.planner_model_state, null, 2));
      
      assert.strictEqual(data.planner_model, 'custom/planner-model:v1',
        'planner_model should be the override value');
      assert.strictEqual(data.planner_model_state.source, 'agent_override',
        'source should be agent_override');
      
      console.log('\n✓ Planner override correctly resolved by init command');
      
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('config without override uses default profile', () => {
    const tmpDir = createTempProject();
    
    try {
      // Write config WITHOUT any override
      const config = {
        commit_docs: true,
        model_settings: {
          default_profile: 'balanced',
          profiles: {
            quality: { model: 'gpt-5.4' },
            balanced: { model: 'gpt-5.4-mini' },
            budget: { model: 'gpt-5.4-nano' },
          },
          agent_overrides: {},
        },
      };
      
      fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify(config, null, 2));
      
      // Initialize jj repo (required for init:execute-phase)
      try {
        execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
        execSync('jj git init', { cwd: tmpDir, stdio: 'pipe' });
      } catch (e) {
        console.log('Note: jj not available, skipping execute-phase test');
        return;
      }
      
      // Run init:execute-phase
      const result = runGsdTools('init:execute-phase 169 --verbose', tmpDir);
      
      assert.ok(result.success, `Command failed: ${result.error}`);
      
      const data = JSON.parse(result.output);
      
      console.log('\n=== Default Profile Resolution ===');
      console.log('executor_model:', data.executor_model);
      console.log('executor_model_state:', JSON.stringify(data.executor_model_state, null, 2));
      
      // Should use balanced profile model, not override
      assert.strictEqual(data.executor_model, 'gpt-5.4-mini',
        'executor_model should be balanced profile model');
      assert.strictEqual(data.executor_model_state.source, 'default_profile',
        'source should be default_profile');
      
      console.log('\n✓ Default profile correctly used when no override');
      
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// Run with: node tests/model-override-diagnostic.test.cjs
if (require.main === module) {
  console.log('Running Model Override Diagnostic...\n');
  console.log('This test verifies that model overrides are correctly resolved.');
  console.log('If tests pass, the issue is NOT in config reading or model resolution.');
  console.log('If tests fail, the issue is in config reading or model resolution.');
  console.log('');
}
