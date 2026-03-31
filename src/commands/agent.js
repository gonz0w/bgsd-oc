'use strict';

const fs = require('fs');
const path = require('path');
const { output, error, debugLog } = require('../lib/output');
const { loadConfig } = require('../lib/config');
const { safeReadFile } = require('../lib/helpers');
const { extractFrontmatter } = require('../lib/frontmatter');
const { resolvePluginDirs } = require('../lib/plugin-paths');

/**
 * Resolve plugin asset directories for runtime and tests.
 */
function resolveBgsdPaths() {
  const { pluginRoot, agentsDir, referencesDir } = resolvePluginDirs();
  return { pluginRoot, agentsDir, referencesDir };
}

/**
 * Parse YAML list-of-objects from raw frontmatter text for inputs/outputs
 * The standard extractFrontmatter doesn't handle nested objects within arrays,
 * so we parse the raw YAML text for these specific fields.
 * 
 * Expected format:
 *   inputs:
 *     - file: "PLAN.md"
 *       required_sections: ["## Section1", "## Section2"]
 *       source: "bgsd-planner"
 */
function parseContractArrays(rawYaml) {
  const result = { inputs: [], outputs: [] };
  if (!rawYaml) return result;
  
  const lines = rawYaml.split('\n');
  let currentField = null; // 'inputs' or 'outputs'
  let currentItem = null;
  let fieldIndent = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    
    const indent = line.search(/\S/);
    
    // Detect top-level inputs: or outputs: key
    if (indent === 0 && (trimmed === 'inputs:' || trimmed === 'outputs:')) {
      if (currentItem && currentField) {
        result[currentField].push(currentItem);
      }
      currentField = trimmed.replace(':', '');
      currentItem = null;
      fieldIndent = indent;
      continue;
    }
    
    // If we encounter another top-level key, stop collecting
    if (indent === 0 && trimmed.match(/^[a-zA-Z0-9_-]+:/)) {
      if (currentItem && currentField) {
        result[currentField].push(currentItem);
        currentItem = null;
      }
      currentField = null;
      continue;
    }
    
    if (!currentField) continue;
    
    // List item start: "  - file: ..."
    if (trimmed.startsWith('- ')) {
      if (currentItem) {
        result[currentField].push(currentItem);
      }
      currentItem = {};
      // Parse the key-value on the same line as the dash
      const kvMatch = trimmed.slice(2).match(/^([a-zA-Z0-9_-]+):\s*(.*)/);
      if (kvMatch) {
        currentItem[kvMatch[1]] = parseYamlValue(kvMatch[2]);
      }
      continue;
    }
    
    // Continuation key-value within a list item (indented under the dash)
    if (currentItem && indent > fieldIndent) {
      const kvMatch = trimmed.match(/^([a-zA-Z0-9_-]+):\s*(.*)/);
      if (kvMatch) {
        currentItem[kvMatch[1]] = parseYamlValue(kvMatch[2]);
      }
    }
  }
  
  // Push last item
  if (currentItem && currentField) {
    result[currentField].push(currentItem);
  }
  
  return result;
}

/**
 * Parse a simple YAML value: inline arrays, quoted strings, plain strings
 */
function parseYamlValue(val) {
  const trimmed = val.trim();
  if (!trimmed) return '';
  
  // Inline array: ["item1", "item2"]
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed.slice(1, -1)
      .split(',')
      .map(s => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }
  
  // Quoted string
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  
  return trimmed;
}

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
      // Parse inputs/outputs from raw frontmatter since extractFrontmatter
      // doesn't handle YAML list-of-objects (nested maps within arrays)
      const fmMatch = content.match(/^---\n([\s\S]+?)\n---/);
      const contracts = fmMatch ? parseContractArrays(fmMatch[1]) : { inputs: [], outputs: [] };
      
      agents.push({
        name: file.replace('.md', ''),
        description: frontmatter.description,
        color: frontmatter.color || null,
        tools: frontmatter.tools || {},
        inputs: contracts.inputs,
        outputs: contracts.outputs,
      });
    }
  }
  
  return agents;
}

/**
 * Resolve the path to RACI.md
 * Checks in priority order:
 * 1. plugin references/ (deployed canonical location)
 * 2. cwd/references/ (dev workspace — before deploy)
 * 3. agents/RACI.md (legacy fallback)
 */
function resolveRaciPath(pluginRoot, referencesDir, agentsDir) {
  // Primary: plugin references/RACI.md (deployed canonical location per 66-01)
  const refPath = path.join(referencesDir || path.join(pluginRoot, 'references'), 'RACI.md');
  if (fs.existsSync(refPath)) return refPath;
  
  // Dev workspace: cwd/references/RACI.md (pre-deploy)
  const cwdPath = path.join(process.cwd(), 'references', 'RACI.md');
  if (fs.existsSync(cwdPath)) return cwdPath;
  
  // Legacy fallback: agents/RACI.md
  const agentPath = path.join(agentsDir, 'RACI.md');
  if (fs.existsSync(agentPath)) return agentPath;
  
  return null;
}

/**
 * Parse RACI matrix to extract lifecycle step mappings
 * Format: | Step | Responsible (R) | Accountable (A) | Consulted (C) | Informed (I) |
 * Supports hyphenated step names (e.g., "plan-creation", "post-execution-review")
 */
function parseRaciMatrix(raciPath) {
  const content = safeReadFile(raciPath);
  if (!content) return { stepMapping: {}, lifecycleSteps: [] };
  const lines = content.split('\n');
  
  // Extract responsible agents for each lifecycle step
  const stepMapping = {};
  const lifecycleSteps = [];
  let inRaciTable = false;
  
  for (const line of lines) {
    // Detect the RACI table by the header row
    if (line.includes('| Step |') && line.includes('Responsible')) {
      inRaciTable = true;
      continue;
    }
    
    // End of RACI table (next section or blank line after table)
    if (inRaciTable && (line.startsWith('## ') || line.startsWith('# '))) {
      inRaciTable = false;
    }
    
    if (!inRaciTable) continue;
    
    // Skip separator lines
    if (line.match(/^\|[\s\-]+\|/)) continue;
    
    // Parse table rows: | project-init | bgsd-roadmapper | /bgsd-new-project | ... |
    // Updated regex to support hyphenated step names ([\w-]+ instead of \w+)
    const match = line.match(/^\|\s*([\w-]+)\s*\|\s*([^|]+?)\s*\|/);
    if (match) {
      const step = match[1];
      const responsible = match[2].trim();
      
      // Skip header-like rows
      if (step === 'Step') continue;
      
      // Track lifecycle steps in order
      lifecycleSteps.push(step);
      
      // Store the responsible agent (only one per step in our RACI)
      if (responsible && responsible !== 'Responsible (R)') {
        stepMapping[step] = [responsible];
      }
    }
  }
  
  return { stepMapping, lifecycleSteps };
}

/**
 * Audit agent lifecycle coverage
 * Reads lifecycle steps dynamically from RACI.md, falls back to hardcoded list
 */
function cmdAgentAudit(cwd, raw) {
  const { pluginRoot, agentsDir, referencesDir } = resolveBgsdPaths();
  const raciPath = resolveRaciPath(pluginRoot, referencesDir, agentsDir);
  
  // Check prerequisites
  if (!raciPath) {
    error('RACI.md not found. Checked: references/RACI.md, agents/RACI.md');
    process.exit(1);
  }
  
  // Scan agents
  const agents = scanAgents(agentsDir);
  
  if (agents.length === 0) {
    error('No agent files found in ' + agentsDir);
    process.exit(1);
  }
  
  // Parse RACI matrix — gets both step mapping and dynamic lifecycle steps
  const { stepMapping, lifecycleSteps: dynamicSteps } = parseRaciMatrix(raciPath);
  
  // Use dynamic steps from RACI.md, fall back to hardcoded list if parsing failed
  const FALLBACK_STEPS = ['Init', 'Discuss', 'Research', 'Plan', 'Execute', 'Verify', 'Complete'];
  const lifecycleSteps = dynamicSteps.length > 0 ? dynamicSteps : FALLBACK_STEPS;
  
  const agentNames = new Set(agents.map(a => a.name));
  
  // Detect gaps (steps with no R) and overlaps (multiple R on same step)
  // Per CONTEXT.md: "permissive" — only flag when TWO agents have R on the SAME step
  // Multiple A/C/I is fine
  const gaps = [];
  const overlaps = [];
  
  for (const step of lifecycleSteps) {
    const responsible = stepMapping[step] || [];
    
    if (responsible.length === 0) {
      gaps.push(step);
    } else if (responsible.length > 1) {
      // Only dual-R is a problem — multiple A/C/I is fine
      overlaps.push({ step, agents: responsible });
    }
  }
  
  // Check for invalid agent references in RACI
  // Allow known non-agent entries: User, reviewer-agent, orchestrator commands
  const invalidRefs = [];
  for (const step of Object.keys(stepMapping)) {
    for (const agent of stepMapping[step]) {
      if (!agentNames.has(agent) && agent !== 'User' && agent !== 'reviewer-agent') {
        invalidRefs.push({ step, agent });
      }
    }
  }
  
  const result = {
    agents_found: agents.length,
    lifecycle_steps: lifecycleSteps,
    lifecycle_steps_count: lifecycleSteps.length,
    step_mapping: stepMapping,
    gaps: gaps,
    overlaps: overlaps,
    invalid_references: invalidRefs,
    raci_source: raciPath,
    status: gaps.length === 0 && overlaps.length === 0 && invalidRefs.length === 0 ? 'pass' : 'fail'
  };
  
  // Output results
  output(result, raw, null, {
    pass: `All ${lifecycleSteps.length} lifecycle steps have exactly one responsible agent`,
    fail: `Found ${gaps.length} gap(s), ${overlaps.length} overlap(s), ${invalidRefs.length} invalid reference(s)`
  });
  
  // Exit with appropriate code
  if (result.status === 'fail') {
    process.exit(1);
  }
}

/**
 * Validate agent handoff contracts
 * Checks that agent outputs have declared required sections
 * 
 * Without --phase: validates contract declarations only (well-formed inputs/outputs)
 * With --phase N: also checks actual output files for required sections
 */
function cmdAgentValidateContracts(cwd, raw, args) {
  const { agentsDir } = resolveBgsdPaths();
  
  // Parse --phase argument
  const phaseIdx = (args || []).indexOf('--phase');
  const phaseNum = phaseIdx !== -1 ? args[phaseIdx + 1] : null;
  
  // Scan agents
  const agents = scanAgents(agentsDir);
  
  if (agents.length === 0) {
    error('No agent files found in ' + agentsDir);
    process.exit(1);
  }
  
  const errors = [];
  const warnings = [];
  let contractsValid = 0;
  let contractsInvalid = 0;
  
  for (const agent of agents) {
    // Validate output declarations are well-formed
    if (!agent.outputs || !Array.isArray(agent.outputs) || agent.outputs.length === 0) {
      warnings.push({
        agent: agent.name,
        issue: 'No outputs declared in frontmatter',
        severity: 'warning'
      });
      continue;
    }
    
    let agentValid = true;
    
    for (const out of agent.outputs) {
      // Check output declaration has required fields
      if (!out.file) {
        errors.push({
          agent: agent.name,
          output: '(unknown)',
          issue: 'Output declaration missing "file" field',
          severity: 'error'
        });
        agentValid = false;
        continue;
      }
      
      if (!out.required_sections || !Array.isArray(out.required_sections) || out.required_sections.length === 0) {
        errors.push({
          agent: agent.name,
          output: out.file,
          issue: 'Output declaration missing "required_sections"',
          severity: 'error'
        });
        agentValid = false;
        continue;
      }
      
      // If --phase provided, check actual output files
      if (phaseNum) {
        const resolvedFiles = resolveOutputFile(cwd, out.file, phaseNum);
        
        for (const resolvedFile of resolvedFiles) {
          if (!fs.existsSync(resolvedFile)) {
            // File not existing is a warning, not error — may not have been created yet
            warnings.push({
              agent: agent.name,
              output: out.file,
              resolved_path: resolvedFile,
              issue: 'Output file not found',
              severity: 'warning'
            });
            continue;
          }
          
          // Check required sections in the file
          const content = safeReadFile(resolvedFile);
          if (!content) continue;
          
          const missingSections = [];
          for (const section of out.required_sections) {
            // Handle both markdown heading sections and frontmatter-style sections
            if (!contentHasSection(content, section)) {
              missingSections.push(section);
            }
          }
          
          if (missingSections.length > 0) {
            errors.push({
              agent: agent.name,
              output: out.file,
              resolved_path: resolvedFile,
              missing_sections: missingSections,
              severity: 'error'
            });
            agentValid = false;
          }
        }
      }
    }
    
    // Also validate input declarations are well-formed
    if (agent.inputs && Array.isArray(agent.inputs)) {
      for (const inp of agent.inputs) {
        if (!inp.file) {
          errors.push({
            agent: agent.name,
            input: '(unknown)',
            issue: 'Input declaration missing "file" field',
            severity: 'error'
          });
          agentValid = false;
        }
      }
    }
    
    if (agentValid) {
      contractsValid++;
    } else {
      contractsInvalid++;
    }
  }
  
  const result = {
    agents_checked: agents.length,
    contracts_valid: contractsValid,
    contracts_invalid: contractsInvalid,
    phase_checked: phaseNum || null,
    errors: errors,
    warnings: warnings,
    status: errors.length === 0 ? 'pass' : 'fail'
  };
  
  output(result, raw, null, {
    pass: `All ${agents.length} agent contracts valid`,
    fail: `${contractsInvalid} agent(s) with contract errors: ${errors.length} error(s), ${warnings.length} warning(s)`
  });
  
  if (result.status === 'fail') {
    process.exit(1);
  }
}

/**
 * Resolve an output file pattern to actual file path(s)
 * Handles template variables like {phase} and {plan}
 */
function resolveOutputFile(cwd, filePattern, phaseNum) {
  const planningDir = path.join(cwd, '.planning', 'phases');
  
  if (!fs.existsSync(planningDir)) return [];
  
  // Find phase directory matching phaseNum
  const phaseDirs = fs.readdirSync(planningDir)
    .filter(d => d.match(new RegExp(`^${phaseNum}[.-]`)));
  
  if (phaseDirs.length === 0) return [];
  
  const results = [];
  
  for (const phaseDir of phaseDirs) {
    const fullPhaseDir = path.join(planningDir, phaseDir);
    
    // If file pattern has template variables, try to resolve
    if (filePattern.includes('{phase}') || filePattern.includes('{plan}')) {
      // List files in the phase dir and match pattern
      const files = fs.readdirSync(fullPhaseDir);
      const suffix = filePattern.replace(/\{phase\}/g, '').replace(/\{plan\}/g, '').replace(/^-+/, '');
      
      for (const f of files) {
        if (f.endsWith(suffix)) {
          results.push(path.join(fullPhaseDir, f));
        }
      }
    } else if (filePattern.startsWith('.planning/')) {
      // Absolute-ish path from .planning root
      const absPath = path.join(cwd, filePattern);
      if (fs.existsSync(absPath)) {
        results.push(absPath);
      }
    } else {
      // Try direct file in phase dir
      const directPath = path.join(fullPhaseDir, filePattern);
      if (fs.existsSync(directPath)) {
        results.push(directPath);
      }
    }
  }
  
  return results;
}

/**
 * Check if content contains a section (heading or frontmatter-style reference)
 */
function contentHasSection(content, section) {
  // Normalize the section reference
  const trimmed = section.trim();
  
  // Handle markdown headings (## Section Name)
  if (trimmed.startsWith('#')) {
    // Check for exact heading match (case-insensitive)
    const headingPattern = new RegExp('^' + escapeRegex(trimmed), 'im');
    return headingPattern.test(content);
  }
  
  // Handle frontmatter-style references like "frontmatter (field1, field2)"
  if (trimmed.startsWith('frontmatter')) {
    // Check that --- frontmatter delimiters exist
    return content.startsWith('---\n');
  }
  
  // Handle XML-style tags like "<objective>"
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
    return content.includes(trimmed);
  }
  
  // Handle generic section name — check as heading at any level
  const genericPattern = new RegExp('^#{1,6}\\s+' + escapeRegex(trimmed), 'im');
  return genericPattern.test(content);
}

/**
 * Escape special regex characters
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validate YAML frontmatter in an agent file content
 * Returns { valid: true, name } on success or { valid: false, error, line } on failure
 */
function validateAgentFrontmatter(content) {
  if (!content || typeof content !== 'string') {
    return { valid: false, error: 'No YAML frontmatter found (missing --- delimiters)', line: 1 };
  }
  
  // Check for opening and closing --- delimiters
  if (!content.startsWith('---\n')) {
    return { valid: false, error: 'No YAML frontmatter found (missing --- delimiters)', line: 1 };
  }
  
  const closingDelim = content.indexOf('\n---', 4);
  if (closingDelim === -1) {
    return { valid: false, error: 'No YAML frontmatter found (missing --- delimiters)', line: 1 };
  }
  
  // Try to parse using extractFrontmatter
  let parsed;
  try {
    parsed = extractFrontmatter(content);
  } catch (e) {
    // Find approximate line number from error if available
    const lineNum = e.mark ? e.mark.line + 1 : null;
    return { valid: false, error: 'Malformed YAML frontmatter', line: lineNum };
  }
  
  // extractFrontmatter returns {} on parse failure (no throw), check if we got anything
  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, error: 'Malformed YAML frontmatter', line: null };
  }
  
  // Check for required name field
  if (!parsed.name || typeof parsed.name !== 'string' || parsed.name.trim() === '') {
    return { valid: false, error: 'Missing required "name" field in YAML frontmatter', line: null };
  }
  
  return { valid: true, name: parsed.name };
}

/**
 * Sanitize agent file content
 * - Replaces editor name variants in non-path contexts with generic terms
 * - Strips structural injection markers
 * Returns the sanitized content string
 */
function sanitizeAgentContent(content) {
  if (!content || typeof content !== 'string') return content;
  
  let result = content;
  
  // Strip structural injection markers (full lines containing these markers)
  // Remove lines with <system>...</system> or standalone <system>/<system> tags
  result = result.replace(/^.*<\/?system>.*$/gm, '');
  // Remove lines with [INST] and [/INST] markers
  result = result.replace(/^.*\[\/?(INST)\].*$/gm, '');
  // Remove triple-backtick system blocks: ```system ... ```
  result = result.replace(/^```system\b[\s\S]*?^```/gm, '');
  
  // Replace editor name variants in non-path contexts:
  // Target 'opencode' preceded by space or start-of-line, followed by space or end-of-line
  // But NOT when preceded by `/` or `.` (path-like contexts)
  // Pattern: (^|(?<=[^/.]))opencode(?=[^/a-zA-Z0-9_-]|$)
  // Using a simpler approach: replace \bOpenCode\b and \bopencode\b when not preceded by . or /
  result = result.replace(/(?<![./])(?<!\w)(opencode)(?![/a-zA-Z0-9_-])/gi, (match) => {
    return 'OC';
  });
  // Also handle "OpenCode" as a product name (e.g. "Use OpenCode")
  result = result.replace(/(?<![./])(?<!\w)(OpenCode)(?![/a-zA-Z0-9_-])/g, 'OC');
  
  // Clean up any empty lines left by marker removal (collapse 3+ newlines to 2)
  result = result.replace(/\n{3,}/g, '\n\n');
  
  return result;
}

/**
 * Generate a unified diff between two text strings
 * Pure JS implementation, zero external dependencies
 * Returns unified diff string with --- / +++ headers and @@ hunks
 */
function generateUnifiedDiff(textA, textB, labelA, labelB) {
  if (textA === textB) return '';
  
  const linesA = textA.split('\n');
  const linesB = textB.split('\n');
  
  // Remove trailing empty element from split if text ends with \n
  if (linesA[linesA.length - 1] === '') linesA.pop();
  if (linesB[linesB.length - 1] === '') linesB.pop();
  
  const m = linesA.length;
  const n = linesB.length;
  
  // Compute LCS using standard O(mn) DP
  // dp[i][j] = LCS length for linesA[0..i-1] and linesB[0..j-1]
  const dp = new Array(m + 1);
  for (let i = 0; i <= m; i++) {
    dp[i] = new Array(n + 1).fill(0);
  }
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (linesA[i - 1] === linesB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  // Backtrack to produce edit script
  // Result: array of {type: 'common'|'remove'|'add', lineA, lineB, text}
  const edits = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      edits.unshift({ type: 'common', lineA: i, lineB: j, text: linesA[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      edits.unshift({ type: 'add', lineA: i, lineB: j, text: linesB[j - 1] });
      j--;
    } else {
      edits.unshift({ type: 'remove', lineA: i, lineB: j, text: linesA[i - 1] });
      i--;
    }
  }
  
  // Group into hunks with 3 lines of context
  const CONTEXT = 3;
  const hunks = [];
  let currentHunk = null;
  
  for (let k = 0; k < edits.length; k++) {
    const edit = edits[k];
    const isChange = edit.type !== 'common';
    
    if (isChange) {
      // Start a new hunk if needed, or extend current
      if (!currentHunk) {
        // Include up to CONTEXT lines before this change
        const startIdx = Math.max(0, k - CONTEXT);
        currentHunk = {
          startA: edits[startIdx] ? edits[startIdx].lineA : 1,
          startB: edits[startIdx] ? edits[startIdx].lineB : 1,
          lines: []
        };
        // Add context lines before the change
        for (let c = startIdx; c < k; c++) {
          currentHunk.lines.push(' ' + edits[c].text);
        }
      }
      currentHunk.lines.push((edit.type === 'add' ? '+' : '-') + edit.text);
    } else if (currentHunk) {
      // Common line while in a hunk — add as context
      currentHunk.lines.push(' ' + edit.text);
      
      // Check if next change is within CONTEXT lines
      let nextChangeIdx = -1;
      for (let c = k + 1; c < edits.length && c <= k + CONTEXT * 2; c++) {
        if (edits[c].type !== 'common') {
          nextChangeIdx = c;
          break;
        }
      }
      
      if (nextChangeIdx === -1 || nextChangeIdx > k + CONTEXT) {
        // No nearby change, close the hunk (trim trailing context to CONTEXT lines)
        const contextAdded = currentHunk.lines.filter(l => l.startsWith(' ')).length;
        // Trim to at most CONTEXT trailing context lines
        let trailingContext = 0;
        let trimIdx = currentHunk.lines.length - 1;
        while (trimIdx >= 0 && currentHunk.lines[trimIdx].startsWith(' ')) {
          trailingContext++;
          trimIdx--;
        }
        if (trailingContext > CONTEXT) {
          currentHunk.lines.splice(trimIdx + 1 + CONTEXT);
        }
        hunks.push(currentHunk);
        currentHunk = null;
      }
    }
  }
  if (currentHunk) {
    // Trim trailing context
    let trimIdx = currentHunk.lines.length - 1;
    let trailingContext = 0;
    while (trimIdx >= 0 && currentHunk.lines[trimIdx].startsWith(' ')) {
      trailingContext++;
      trimIdx--;
    }
    if (trailingContext > CONTEXT) {
      currentHunk.lines.splice(trimIdx + 1 + CONTEXT);
    }
    hunks.push(currentHunk);
  }
  
  if (hunks.length === 0) return '';
  
  // Build the diff output
  const output = [];
  output.push('--- ' + labelA);
  output.push('+++ ' + labelB);
  
  for (const hunk of hunks) {
    // Calculate proper line counts for the hunk header
    const countA = hunk.lines.filter(l => l.startsWith(' ') || l.startsWith('-')).length;
    const countB = hunk.lines.filter(l => l.startsWith(' ') || l.startsWith('+')).length;
    
    // Calculate startA and startB from the first non-context line
    let hunkStartA = hunk.startA;
    let hunkStartB = hunk.startB;
    
    // Adjust startA/startB for context lines at beginning of hunk
    const leadingContext = [];
    for (const line of hunk.lines) {
      if (line.startsWith(' ')) leadingContext.push(line);
      else break;
    }
    hunkStartA = Math.max(1, hunk.startA - leadingContext.length);
    hunkStartB = Math.max(1, hunk.startB - leadingContext.length);
    
    output.push(`@@ -${hunkStartA},${countA} +${hunkStartB},${countB} @@`);
    output.push(...hunk.lines);
  }
  
  return output.join('\n') + '\n';
}

/**
 * Find the closest agent name match via substring or prefix matching
 * Returns the closest name or null if no match found
 */
function findClosestAgent(name, agentNames) {
  if (!name || !agentNames || agentNames.length === 0) return null;
  
  const lower = name.toLowerCase();
  const matches = [];
  
  for (const agent of agentNames) {
    const agentLower = agent.toLowerCase();
    // Check substring containment
    if (agentLower.includes(lower) || lower.includes(agentLower)) {
      matches.push({ agent, score: 1000 + agentLower.length });
      continue;
    }
    // Check common prefix of length >= 4
    let prefixLen = 0;
    const minLen = Math.min(lower.length, agentLower.length);
    for (let i = 0; i < minLen; i++) {
      if (lower[i] === agentLower[i]) prefixLen++;
      else break;
    }
    if (prefixLen >= 4) {
      // Score by prefix length (longer prefix = better match)
      matches.push({ agent, score: prefixLen });
    }
  }
  
  if (matches.length === 0) return null;
  // Return the match with highest score (longest prefix or substring match)
  // Tie-break: shorter agent name is more specific
  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.agent.length - b.agent.length;
  });
  return matches[0].agent;
}

/**
 * Inject `name: <agentName>` into YAML frontmatter if the name field is missing
 * Returns the modified content string
 */
function injectNameField(content, agentName) {
  if (!content || !content.startsWith('---\n')) return content;
  const closingIdx = content.indexOf('\n---', 4);
  if (closingIdx === -1) return content;
  
  const frontmatterBody = content.slice(4, closingIdx);
  const rest = content.slice(closingIdx);
  
  // Insert name as first field in frontmatter
  return '---\nname: ' + agentName + '\n' + frontmatterBody + rest;
}

/**
 * Create a project-local override of a global agent file
 */
function cmdAgentOverride(cwd, raw, args) {
  const name = args && args[0];
  if (!name) {
    error('Usage: agent override <name>');
    process.exit(1);
  }
  
  // Normalize: strip .md extension if provided
  const agentName = name.endsWith('.md') ? name.slice(0, -3) : name;
  
  const { agentsDir } = resolveBgsdPaths();
  const globalAgentPath = path.join(agentsDir, agentName + '.md');
  
  // Check global agent exists; if not, suggest closest match
  if (!fs.existsSync(globalAgentPath)) {
    // Scan available agent names
    let agentNames = [];
    if (fs.existsSync(agentsDir)) {
      agentNames = fs.readdirSync(agentsDir)
        .filter(f => f.endsWith('.md') && f !== 'RACI.md')
        .map(f => f.replace('.md', ''));
    }
    const closest = findClosestAgent(agentName, agentNames);
    if (closest) {
      error(`Agent "${agentName}" not found. Did you mean "${closest}"?`);
    } else {
      error(`Agent "${agentName}" not found. Run "agent list" to see available agents.`);
    }
    process.exit(1);
  }
  
  // Resolve local agents dir and path
  const localDir = path.join(cwd, '.opencode', 'agents');
  const localPath = path.join(localDir, agentName + '.md');
  
  // Read global agent content
  let content = safeReadFile(globalAgentPath);
  if (!content) {
    error(`Failed to read global agent file: ${globalAgentPath}`);
    process.exit(1);
  }
  
  // Validate frontmatter — if name: field missing, inject it first
  let validation = validateAgentFrontmatter(content);
  if (!validation.valid && validation.error && validation.error.includes('"name" field')) {
    // Inject name field into frontmatter
    content = injectNameField(content, agentName);
    // Re-validate
    validation = validateAgentFrontmatter(content);
  }
  
  if (!validation.valid) {
    error(`Agent "${agentName}" has invalid frontmatter: ${validation.error}`);
    process.exit(1);
  }
  
  // Create local agents directory silently if it doesn't exist
  fs.mkdirSync(localDir, { recursive: true });
  
  // Exclusive write — fails atomically if already overridden (no TOCTOU)
  let fd;
  try {
    fd = fs.openSync(localPath, 'wx');
  } catch (e) {
    if (e.code === 'EEXIST') {
      error(`Agent "${agentName}" already has a local override at ${localPath}. Use "agent diff ${agentName}" to view changes or "agent sync ${agentName}" to update.`);
      process.exit(1);
    }
    throw e;
  }
  try { fs.writeSync(fd, content, 0, 'utf8'); } finally { fs.closeSync(fd); }
  
  // Output: just the file path created
  if (raw) {
    output({ created: localPath, agent: agentName }, raw);
  } else {
    console.log(localPath);
  }
}

/**
 * Synchronize a local override with the upstream global agent
 * Flags: --accept (apply sync), --reject (exit silently)
 * Silent exit when identical; error when no local override exists
 */
function cmdAgentSync(cwd, raw, args) {
  const name = args && args[0];
  if (!name || name.startsWith('--')) {
    error('Usage: agent sync <name>');
    process.exit(1);
  }

  // Normalize: strip .md extension if provided
  const agentName = name.endsWith('.md') ? name.slice(0, -3) : name;

  const { agentsDir } = resolveBgsdPaths();
  const globalAgentPath = path.join(agentsDir, agentName + '.md');
  const localDir = path.join(cwd, '.opencode', 'agents');
  const localPath = path.join(localDir, agentName + '.md');

  // Read both files (throws ENOENT if not found — no existence pre-check needed)
  let globalContent, localContent;
  try {
    localContent = fs.readFileSync(localPath, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') {
      error(`No local override for "${agentName}". Create one with: agent override ${agentName}`);
      process.exit(1);
    }
    throw e;
  }
  try {
    globalContent = fs.readFileSync(globalAgentPath, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') {
      error(`Global agent "${agentName}" not found`);
      process.exit(1);
    }
    throw e;
  }

  // Silent exit when identical
  if (globalContent === localContent) {
    if (raw) {
      output({ agent: agentName, action: 'none', identical: true }, raw);
    }
    return;
  }

  // Generate unified diff
  const diffStr = generateUnifiedDiff(globalContent, localContent, 'global', 'local');

  // Count hunk sections (@@) in the diff
  const hunkMatches = diffStr.match(/^@@/gm);
  const hunkCount = hunkMatches ? hunkMatches.length : 0;

  // Parse flags
  const hasAccept = args.includes('--accept');
  const hasReject = args.includes('--reject');

  if (hasReject) {
    // Silent exit on reject
    if (raw) {
      output({ agent: agentName, action: 'rejected' }, raw);
    }
    return;
  }

  if (hasAccept) {
    // Apply sync: write sanitized global content to local path
    let contentToWrite = globalContent;

    // Validate and inject name: field if missing (same as override)
    let validation = validateAgentFrontmatter(contentToWrite);
    if (!validation.valid && validation.error && validation.error.includes('"name" field')) {
      contentToWrite = injectNameField(contentToWrite, agentName);
      validation = validateAgentFrontmatter(contentToWrite);
    }

    // Apply content sanitization before writing
    contentToWrite = sanitizeAgentContent(contentToWrite);

    // Write synced content — 'w' flag truncates and writes atomically
    fs.writeFileSync(localPath, contentToWrite, 'utf8');

    if (raw) {
      output({ agent: agentName, action: 'accepted', path: localPath }, raw);
    } else {
      console.log('Synced: ' + localPath);
    }
    return;
  }

  // Neither --accept nor --reject: show summary and prompt for action
  if (raw) {
    output({ agent: agentName, action: 'pending', sections_modified: hunkCount, diff: diffStr }, raw);
  } else {
    process.stdout.write(
      hunkCount + ' section(s) modified in upstream. Diff:\n' + diffStr +
      '\nAccept upstream changes? (accept/reject)\n' +
      'Re-run with --accept to apply or --reject to skip.\n'
    );
  }
}

/**
 * Show unified diff between local override and global counterpart
 */
function cmdAgentDiff(cwd, raw, args) {
  const name = args && args[0];
  if (!name) {
    error('Usage: agent diff <name>');
    process.exit(1);
  }
  
  // Normalize: strip .md extension if provided
  const agentName = name.endsWith('.md') ? name.slice(0, -3) : name;
  
  const { agentsDir } = resolveBgsdPaths();
  const globalAgentPath = path.join(agentsDir, agentName + '.md');
  const localDir = path.join(cwd, '.opencode', 'agents');
  const localPath = path.join(localDir, agentName + '.md');
  
  // Check local override exists
  if (!fs.existsSync(localPath)) {
    error(`No local override for "${agentName}". Create one with: agent override ${agentName}`);
    process.exit(1);
  }
  
  // Check global agent exists
  if (!fs.existsSync(globalAgentPath)) {
    error(`Global agent "${agentName}" not found — local override exists but has no upstream counterpart`);
    process.exit(1);
  }
  
  // Read both files
  const globalContent = safeReadFile(globalAgentPath) || '';
  const localContent = safeReadFile(localPath) || '';
  
  // Generate unified diff
  const diffStr = generateUnifiedDiff(
    globalContent,
    localContent,
    'global/' + agentName + '.md',
    'local/' + agentName + '.md'
  );
  
  if (!diffStr) {
    // Identical files — silent exit
    if (raw) {
      output({ agent: agentName, diff: null, identical: true }, raw);
    }
    return;
  }
  
  // Output the diff
  if (raw) {
    output({ agent: agentName, diff: diffStr, identical: false }, raw);
  } else {
    process.stdout.write(diffStr);
  }
}

/**
 * List all agents
 */
function cmdAgentList(cwd, raw) {
  const { agentsDir } = resolveBgsdPaths();
  const agents = scanAgents(agentsDir);
  
  output({ agents }, raw);
}

/**
 * List all global agents with scope (global / local-override) and drift annotations
 * Local overrides are read from .opencode/agents/ relative to cwd
 */
function cmdAgentListLocal(cwd, raw) {
  const { agentsDir } = resolveBgsdPaths();
  const localAgentsDir = path.join(cwd, '.opencode', 'agents');
  
  // Scan global agents
  const globalAgents = scanAgents(agentsDir);
  
  // Build map of local override files (by agent name, without .md extension)
  const localOverrides = new Map();
  if (fs.existsSync(localAgentsDir)) {
    const localFiles = fs.readdirSync(localAgentsDir).filter(f => f.endsWith('.md'));
    for (const file of localFiles) {
      const name = file.replace('.md', '');
      const filePath = path.join(localAgentsDir, file);
      const content = safeReadFile(filePath);
      localOverrides.set(name, content || '');
    }
  }
  
  // Build result array — one entry per global agent
  const agents = globalAgents.map(agent => {
    const hasLocal = localOverrides.has(agent.name);
    let scope = 'global';
    let drift = null;
    
    if (hasLocal) {
      scope = 'local-override';
      // Compare global vs local content for drift detection
      const globalFilePath = path.join(agentsDir, agent.name + '.md');
      const globalContent = safeReadFile(globalFilePath) || '';
      const localContent = localOverrides.get(agent.name);
      
      if (globalContent === localContent) {
        drift = 'in-sync';
      } else {
        drift = 'drifted';
      }
    }
    
    return {
      name: agent.name,
      scope,
      drift,
    };
  });
  
  if (raw) {
    output({ agents }, raw);
    return;
  }
  
  // Human-readable columnar table output
  const nameWidth = Math.max(4, ...agents.map(a => a.name.length)) + 2;
  const scopeWidth = Math.max(5, 'local-override'.length) + 2;
  
  const header = 'Name'.padEnd(nameWidth) + 'Scope'.padEnd(scopeWidth) + 'Drift';
  
  const rows = agents.map(a => {
    const driftDisplay = a.drift === 'in-sync' ? '✓' : a.drift === 'drifted' ? 'Δ' : '';
    return a.name.padEnd(nameWidth) + a.scope.padEnd(scopeWidth) + driftDisplay;
  });
  
  console.log(header);
  for (const row of rows) {
    console.log(row);
  }
}

module.exports = {
  cmdAgentAudit,
  cmdAgentList,
  cmdAgentListLocal,
  cmdAgentValidateContracts,
  cmdAgentOverride,
  cmdAgentDiff,
  cmdAgentSync,
  // Exported for testing
  parseRaciMatrix,
  findClosestAgent,
  injectNameField,
  // Phase 129: Foundation utilities
  validateAgentFrontmatter,
  sanitizeAgentContent,
  generateUnifiedDiff,
};
