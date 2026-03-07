'use strict';

const fs = require('fs');
const path = require('path');
const { output, error, debugLog } = require('../lib/output');
const { loadConfig } = require('../lib/config');
const { safeReadFile } = require('../lib/helpers');
const { extractFrontmatter } = require('../lib/frontmatter');

/**
 * Scan all agent .md files in the agents directory
 */
function scanAgents(agentsDir) {
  const agents = [];
  
  if (!fs.existsSync(agentsDir)) {
    return agents;
  }
  
  const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md') && f !== 'RACI.md');
  
  for (const file of files) {
    const filePath = path.join(agentsDir, file);
    const content = safeReadFile(filePath);
    if (!content) continue;
    
    const frontmatter = extractFrontmatter(content);
    
    // Note: extractFrontmatter returns parsed YAML directly, not wrapped in "data" key
    if (frontmatter && frontmatter.description) {
      agents.push({
        name: file.replace('.md', ''),
        description: frontmatter.description,
        color: frontmatter.color || null,
        tools: frontmatter.tools || {},
      });
    }
  }
  
  return agents;
}

/**
 * Parse RACI matrix to extract lifecycle step mappings
 * Format: | Step | Responsible (R) | Accountable (A) | Consulted (C) | Informed (I) |
 */
function parseRaciMatrix(raciPath) {
  const content = safeReadFile(raciPath);
  if (!content) return {};
  const lines = content.split('\n');
  
  // Extract responsible agents for each lifecycle step
  const stepMapping = {};
  let inRaciTable = false;
  
  for (const line of lines) {
    // Detect the RACI table by the header row
    if (line.includes('| Step |') && line.includes('Responsible')) {
      inRaciTable = true;
      continue;
    }
    
    // End of RACI table (next section)
    if (inRaciTable && (line.startsWith('## ') || line.startsWith('# '))) {
      inRaciTable = false;
    }
    
    if (!inRaciTable) continue;
    
    // Skip separator lines
    if (line.match(/^\|[\s\-]+\|/)) continue;
    
    // Parse table rows: | Init | User | gsd-planner | ... |
    const match = line.match(/^\|\s*(\w+)\s*\|\s*([^|]+?)\s*\|/);
    if (match) {
      const step = match[1];
      const responsible = match[2].trim();
      
      // Skip header-like rows
      if (step === 'Step') continue;
      
      // Store the responsible agent (only one per step in our RACI)
      if (responsible && responsible !== 'Responsible (R)') {
        stepMapping[step] = [responsible];
      }
    }
  }
  
  return stepMapping;
}

/**
 * Audit agent lifecycle coverage
 */
function cmdAgentAudit(cwd, raw) {
  // GSD_HOME is typically ~/.config/oc/get-shit-done
  // Agents are in ~/.config/oc/agents
  const GSD_HOME = process.env.GSD_HOME || 
    (process.env.HOME ? path.join(process.env.HOME, '.config', 'oc', 'get-shit-done') : '/home/cam/.config/oc/get-shit-done');
  
  const agentsDir = path.join(path.dirname(GSD_HOME), 'agents');
  const raciPath = path.join(agentsDir, 'RACI.md');
  
  // Check prerequisites
  if (!fs.existsSync(raciPath)) {
    error('RACI.md not found at ' + raciPath);
    process.exit(1);
  }
  
  // Scan agents
  const agents = scanAgents(agentsDir);
  
  if (agents.length === 0) {
    error('No agent files found in ' + agentsDir);
    process.exit(1);
  }
  
  // Parse RACI matrix
  const stepMapping = parseRaciMatrix(raciPath);
  
  const lifecycleSteps = ['Init', 'Discuss', 'Research', 'Plan', 'Execute', 'Verify', 'Complete'];
  const agentNames = new Set(agents.map(a => a.name));
  
  // Detect gaps (steps with no owner) and overlaps (multiple owners)
  const gaps = [];
  const overlaps = [];
  const validAgentNames = new Set([
    'gsd-executor', 'gsd-planner', 'gsd-verifier', 'gsd-roadmapper',
    'gsd-phase-researcher', 'gsd-project-researcher', 'gsd-codebase-mapper',
    'gsd-debugger', 'gsd-plan-checker'
  ]);
  
  for (const step of lifecycleSteps) {
    const responsible = stepMapping[step] || [];
    
    if (responsible.length === 0) {
      gaps.push(step);
    } else if (responsible.length > 1) {
      overlaps.push({ step, agents: responsible });
    }
  }
  
  // Check for invalid agent references in RACI
  const invalidRefs = [];
  for (const step of Object.keys(stepMapping)) {
    for (const agent of stepMapping[step]) {
      if (!agentNames.has(agent) && agent !== 'User') {
        invalidRefs.push({ step, agent });
      }
    }
  }
  
  const result = {
    agents_found: agents.length,
    lifecycle_steps: lifecycleSteps,
    step_mapping: stepMapping,
    gaps: gaps,
    overlaps: overlaps,
    invalid_references: invalidRefs,
    status: gaps.length === 0 && overlaps.length === 0 && invalidRefs.length === 0 ? 'pass' : 'fail'
  };
  
  // Output results
  output(result, raw, null, {
    pass: 'All lifecycle steps have exactly one responsible agent',
    fail: `Found ${gaps.length} gap(s), ${overlaps.length} overlap(s), ${invalidRefs.length} invalid reference(s)`
  });
  
  // Exit with appropriate code
  if (result.status === 'fail') {
    process.exit(1);
  }
}

/**
 * List all agents
 */
function cmdAgentList(cwd, raw) {
  const GSD_HOME = process.env.GSD_HOME || 
    (process.env.HOME ? path.join(process.env.HOME, '.config', 'oc', 'get-shit-done') : '/home/cam/.config/oc/get-shit-done');
  
  const agentsDir = path.join(path.dirname(GSD_HOME), 'agents');
  const agents = scanAgents(agentsDir);
  
  output({ agents }, raw);
}

module.exports = {
  cmdAgentAudit,
  cmdAgentList,
};
