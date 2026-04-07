#!/usr/bin/env node
/**
 * Debug model override flow for /bgsd-map-codebase
 * 
 * Run: node bin/debug-model-override.cjs
 * 
 * This script traces exactly what the enricher does when /bgsd-map-codebase is invoked.
 */

const path = require('path');

// Load the enricher module directly
const { enrichCommand } = require('../src/plugin/command-enricher.js');

// Mock the plugin's output structure
function debugEnricher() {
  const command = 'bgsd-map-codebase';
  const cwd = process.cwd();
  
  console.log('=== Debugging model override flow for:', command, '===\n');
  console.log('CWD:', cwd);
  console.log('');
  
  // Load config directly to verify
  const configPath = path.join(cwd, '.planning', 'config.json');
  let config;
  try {
    config = require(configPath);
    console.log('Config loaded successfully:');
    console.log('  model_settings:', JSON.stringify(config.model_settings, null, 2));
  } catch (e) {
    console.log('Failed to load config:', e.message);
    return;
  }
  
  console.log('\n=== Simulating enricher ===');
  
  // Simulate what resolveConfiguredModelStateFromConfig does
  const { resolveConfiguredModelStateFromConfig } = require('../src/lib/helpers');
  
  const modelState = resolveConfiguredModelStateFromConfig(config, 'bgsd-codebase-mapper');
  console.log('\nresolveConfiguredModelStateFromConfig result:');
  console.log(JSON.stringify(modelState, null, 2));
  
  // Now simulate what the decision rule does
  const { resolveModelSelection } = require('../src/lib/decision-rules');
  
  const enrichment = {
    agent_type: 'bgsd-codebase-mapper',
    model_settings: config.model_settings,
    model_profile: config.model_profile || 'balanced',
  };
  
  console.log('\n=== Simulating resolveModelSelection decision ===');
  const decision = resolveModelSelection(enrichment);
  console.log('\nresolveModelSelection result:');
  console.log(JSON.stringify(decision, null, 2));
  
  console.log('\n=== Comparison ===');
  console.log('Initial resolved_model:', modelState.resolved_model);
  console.log('Decision resolved_model:', decision.value.resolved_model);
  console.log('Match:', modelState.resolved_model === decision.value.resolved_model ? 'YES' : 'NO');
  
  // Check what mapper_model would be set to
  console.log('\n=== What enricher would set ===');
  console.log('enrichment.mapper_model =', modelState.resolved_model);
  console.log('enrichment.resolved_model (updated by decision) =', decision.value.resolved_model);
  
  // The key question: is mapper_model updated by the decision?
  console.log('\n=== THE BUG ===');
  console.log('The enricher sets: enrichment.mapper_model = modelState.resolved_model');
  console.log('But evaluateDecisions only updates: enrichment.resolved_model');
  console.log('mapper_model is NOT updated after decision evaluation!');
  console.log('');
  console.log('If the decision returns a DIFFERENT model than initially set,');
  console.log('mapper_model would be stale and incorrect.');
}

debugEnricher();
