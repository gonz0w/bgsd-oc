/**
 * Model Override Flow Diagnostic
 * 
 * Run: node tests/model-override-flow-diagnostic.test.cjs
 * 
 * This test traces the full model override flow to identify where it breaks.
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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgsd-model-flow-test-'));
  
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '169-test'), { recursive: true });
  
  fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

### Phase 169: Model Override Flow Test
**Goal:** Test model override flow
**Plans:** 1 plan
`);
  
  fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State

## Current Position

**Phase:** 169
**Current Plan:** 01
**Total Plans in Phase:** 1
**Status:** Ready to execute
`);

  fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '169-test', '169-01-PLAN.md'), `---
phase: 169-test
plan: 01
type: auto
autonomous: true
depends_on: []
files_modified:
  - test.txt
---

<objective>Test plan for model override flow</objective>
`);
  
  return tmpDir;
}

describe('model override flow diagnostic', () => {
  test('verifies init:execute-phase output contains executor_model', () => {
    const tmpDir = createTempProject();
    
    try {
      // Initialize git/jj
      try {
        execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
        execSync('jj git init', { cwd: tmpDir, stdio: 'pipe' });
      } catch (e) {
        console.log('Note: jj not available, skipping');
        return;
      }
      
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
      
      // Run init:execute-phase to get the CLI output
      const result = runGsdTools('init:execute-phase 169 --verbose', tmpDir);
      console.log('\n=== init:execute-phase CLI output ===');
      console.log(result.output);
      
      const data = JSON.parse(result.output);
      
      console.log('\n=== Key fields in CLI output ===');
      console.log('executor_model:', data.executor_model);
      console.log('executor_model_state:', JSON.stringify(data.executor_model_state, null, 2));
      console.log('model_summary:', data.model_summary);
      
      // Verify CLI output has correct executor_model
      assert.strictEqual(data.executor_model, 'ollama/qwen3-coder:latest',
        'CLI output should have correct executor_model');
      assert.strictEqual(data.executor_model_state.source, 'agent_override',
        'CLI output should show source as agent_override');
      
      console.log('\n✓ CLI output correctly resolves executor_model override');
      
      // Now check what the decision rules return
      console.log('\n=== Checking decision rules ===');
      const { evaluateDecisions, resolveModelSelection } = require('../src/lib/decision-rules');
      
      // Simulate what the enricher does
      const state = {
        agent_type: 'bgsd-executor',
        model_profile: 'balanced',
        model_settings: config.model_settings,
      };
      
      const decisionResult = resolveModelSelection(state);
      console.log('resolveModelSelection result:', JSON.stringify(decisionResult, null, 2));
      
      assert.strictEqual(decisionResult.value.source, 'agent_override',
        'Decision rule should report source as agent_override');
      assert.strictEqual(decisionResult.value.resolved_model, 'ollama/qwen3-coder:latest',
        'Decision rule should resolve to override model');
      
      console.log('\n✓ Decision rules correctly resolve executor_model override');
      
      // Now the critical question: what does the enricher actually put in bgsd-context?
      console.log('\n=== Critical Question: What does enricher set in bgsd-context? ===');
      console.log('The enricher sets:');
      console.log('  - enrichment.resolved_model = modelState.resolved_model');
      console.log('  - enrichment.configured = modelState.configured');
      console.log('  - enrichment.selected_profile = modelState.selected_profile');
      console.log('  - enrichment.source = modelState.source');
      console.log('');
      console.log('But the enricher does NOT set:');
      console.log('  - enrichment.executor_model (NOT SET!)');
      console.log('');
      console.log('The workflow uses: model="{executor_model}"');
      console.log('But executor_model is NOT in bgsd-context!');
      console.log('');
      console.log('This is the bug: executor_model from init output is NOT passed to Task()!');
      
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

if (require.main === module) {
  console.log('Running Model Override Flow Diagnostic...\n');
  console.log('This test traces the full flow to identify where model overrides break.\n');
}
