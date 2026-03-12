#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// Analyze JavaScript files for unreachable code patterns

function posToLine(code, pos) {
  let line = 1;
  for (let i = 0; i < pos && i < code.length; i++) {
    if (code[i] === '\n') line++;
  }
  return line;
}

function getLineContent(code, lineNum) {
  const lines = code.split('\n');
  return lines[lineNum - 1] || '';
}

// Parse JavaScript with acorn
function parseCode(code) {
  const acorn = require('acorn');
  try {
    return acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
  } catch {
    try {
      return acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script' });
    } catch {
      return null;
    }
  }
}

// Analyze for unreachable code patterns
function analyzeUnreachable(filePath, code) {
  const findings = [];
  const ast = parseCode(code);
  if (!ast) return findings;

  // Walk AST and find patterns
  function visit(node, parent) {
    if (!node || typeof node !== 'object') return;

    // Pattern 1: IfStatement with Literal false test
    if (node.type === 'IfStatement' && node.test && node.test.type === 'Literal' && node.test.value === false) {
      findings.push({
        file: filePath,
        line: posToLine(code, node.start),
        type: 'if-false',
        reason: 'if (false) - code in consequent is unreachable',
        code: getLineContent(code, posToLine(code, node.start)),
        confidence: 'high'
      });
    }

    // Pattern 2: IfStatement with Literal true test where alternate is impossible
    if (node.type === 'IfStatement' && node.test && node.test.type === 'Literal' && node.test.value === true && node.consequent) {
      // Check if consequent has return/throw - making alternate dead
      const consequentHasControl = hasUnconditionalControl(node.consequent);
      if (consequentHasControl && node.alternate) {
        findings.push({
          file: filePath,
          line: posToLine(code, node.alternate.start),
          type: 'dead-alternate',
          reason: 'if (true) with return in consequent - else branch is dead',
          code: getLineContent(code, posToLine(code, node.alternate.start)),
          confidence: 'high'
        });
      }
    }

    // Pattern 3: Logical contradictions in BinaryExpression
    if (node.type === 'BinaryExpression') {
      // Check for x === x (always true)
      if (node.operator === '===' || node.operator === '==') {
        if (isSameExpression(node.left, node.right)) {
          findings.push({
            file: filePath,
            line: posToLine(code, node.start),
            type: 'always-true',
            reason: `${node.left.name || 'x'} === ${node.right.name || 'x'} - always true`,
            code: getLineContent(code, posToLine(code, node.start)),
            confidence: 'high'
          });
        }
      }
      // Check for x != x (always false)
      if (node.operator === '!==' || node.operator === '!=') {
        if (isSameExpression(node.left, node.right)) {
          findings.push({
            file: filePath,
            line: posToLine(code, node.start),
            type: 'always-false',
            reason: `${node.left.name || 'x'} !== ${node.right.name || 'x'} - always false`,
            code: getLineContent(code, posToLine(code, node.start)),
            confidence: 'high'
          });
        }
      }
    }

    // Pattern 4: LogicalExpression with contradictions (x && !x, x || !x)
    if (node.type === 'LogicalExpression') {
      if (node.operator === '&&' && node.left && node.right) {
        // Check for x && !x pattern
        if (isNegation(node.left, node.right)) {
          findings.push({
            file: filePath,
            line: posToLine(code, node.start),
            type: 'contradiction',
            reason: 'Logical contradiction: x && !x - right side always false',
            code: getLineContent(code, posToLine(code, node.start)),
            confidence: 'high'
          });
        }
      }
      if (node.operator === '||' && node.left && node.right) {
        // Check for x || !x pattern
        if (isNegation(node.right, node.left)) {
          findings.push({
            file: filePath,
            line: posToLine(code, node.start),
            type: 'tautology',
            reason: 'Logical tautology: x || !x - always true',
            code: getLineContent(code, posToLine(code, node.start)),
            confidence: 'high'
          });
        }
      }
    }

    // Pattern 5: SwitchStatement with duplicate case values
    if (node.type === 'SwitchStatement') {
      const caseValues = [];
      const seenValues = new Map();
      if (node.cases) {
        for (const switchCase of node.cases) {
          if (switchCase.test) {
            const val = getLiteralValue(switchCase.test);
            if (val !== null) {
              if (seenValues.has(val)) {
                findings.push({
                  file: filePath,
                  line: posToLine(code, switchCase.start),
                  type: 'duplicate-case',
                  reason: `Duplicate case value '${val}' - unreachable (first at line ${seenValues.get(val)})`,
                  code: getLineContent(code, posToLine(code, switchCase.start)),
                  confidence: 'high'
                });
              } else {
                seenValues.set(val, posToLine(code, switchCase.start));
              }
            }
          }
        }
      }
    }

    // Recurse into children
    for (const key of Object.keys(node)) {
      if (['type', 'start', 'end', 'loc', 'range'].includes(key)) continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === 'object' && item.type) visit(item, node);
        }
      } else if (child && typeof child === 'object' && child.type) {
        visit(child, node);
      }
    }
  }

  // Helper functions
  function hasUnconditionalControl(node) {
    if (!node) return false;
    if (node.type === 'ReturnStatement') return true;
    if (node.type === 'ThrowStatement') return true;
    if (node.type === 'BreakStatement') return true;
    if (node.type === 'ContinueStatement') return true;
    // Check for if with return
    if (node.type === 'IfStatement' && node.consequent && node.alternate) {
      return hasUnconditionalControl(node.consequent) && hasUnconditionalControl(node.alternate);
    }
    // Check block statements
    if (node.type === 'BlockStatement' && node.body) {
      const last = node.body[node.body.length - 1];
      return hasUnconditionalControl(last);
    }
    return false;
  }

  function isSameExpression(a, b) {
    if (!a || !b) return false;
    if (a.type === 'Identifier' && b.type === 'Identifier') {
      return a.name === b.name;
    }
    if (a.type === 'Literal' && b.type === 'Literal') {
      return a.value === b.value;
    }
    return false;
  }

  function isNegation(a, b) {
    if (!a || !b) return false;
    // Check for !x pattern
    if (a.type === 'UnaryExpression' && a.operator === '!' && a.argument) {
      if (a.argument.type === 'Identifier' && b.type === 'Identifier') {
        return a.argument.name === b.name;
      }
    }
    return false;
  }

  function getLiteralValue(node) {
    if (!node) return null;
    if (node.type === 'Literal') return String(node.value);
    return null;
  }

  visit(ast, null);
  return findings;
}

// Also check for code after return/throw/break using simple pattern matching
function findPostControlUnreachable(code, filePath) {
  const findings = [];
  const lines = code.split('\n');
  let inFunction = null;
  let lastControlLine = -1;
  let controlType = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    // Track function boundaries
    if (/^(export\s+)?(async\s+)?function\s+\w+/.test(line) || /^class\s+\w+/.test(line)) {
      inFunction = lineNum;
      lastControlLine = -1;
    }
    if (/^(const|let|var)\s+\w+\s*=\s*(async\s+)?\(?/.test(line) && !line.includes('=>')) {
      inFunction = lineNum;
      lastControlLine = -1;
    }

    // Check for return/throw/break
    if (/^(return|throw)\s*;?\s*$/.test(line) || /^(return|throw)\s+/.test(line)) {
      if (inFunction) {
        lastControlLine = lineNum;
        controlType = 'return';
      }
    }
    if (/^break\s*;?\s*$/.test(line) || /^continue\s*;?\s*$/.test(line)) {
      if (inFunction) {
        lastControlLine = lineNum;
        controlType = 'break';
      }
    }

    // Check if next line has code (not just closing brace or comment)
    if (lastControlLine > 0 && lineNum === lastControlLine + 1) {
      if (line && !line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*') && line !== '}' && line !== '};') {
        findings.push({
          file: filePath,
          line: lineNum,
          type: 'after-' + controlType,
          reason: `Code immediately after ${controlType} statement - likely unreachable`,
          code: line.substring(0, 80),
          confidence: 'medium'
        });
      }
    }

    // Reset if we hit closing brace (end of function block)
    if (line === '}' && inFunction && lineNum > inFunction) {
      inFunction = null;
      lastControlLine = -1;
    }
  }

  return findings;
}

// Main
const projectRoot = '/mnt/raid/DEV/bgsd-oc';
const srcDir = path.join(projectRoot, 'src');
const unreachableReport = [];
const deadBranchesReport = [];

// Get all JS files
function getJsFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      getJsFiles(fullPath, files);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.cjs'))) {
      files.push(fullPath);
    }
  }
  return files;
}

const jsFiles = getJsFiles(srcDir);
console.log(`Analyzing ${jsFiles.length} JavaScript files...`);

for (const file of jsFiles) {
  const relPath = path.relative(projectRoot, file);
  try {
    const code = fs.readFileSync(file, 'utf-8');
    
    // AST-based analysis
    const astFindings = analyzeUnreachable(relPath, code);
    unreachableReport.push(...astFindings);

    // Pattern-based analysis
    const patternFindings = findPostControlUnreachable(code, relPath);
    unreachableReport.push(...patternFindings);
  } catch (e) {
    console.error(`Error analyzing ${relPath}: ${e.message}`);
  }
}

// Also check bin/ directory
const binDir = path.join(projectRoot, 'bin');
if (fs.existsSync(binDir)) {
  const binFiles = fs.readdirSync(binDir).filter(f => f.endsWith('.cjs'));
  for (const file of binFiles) {
    const relPath = path.join('bin', file);
    try {
      const code = fs.readFileSync(path.join(binDir, file), 'utf-8');
      const astFindings = analyzeUnreachable(relPath, code);
      unreachableReport.push(...astFindings);
    } catch (e) {
      console.error(`Error analyzing ${relPath}: ${e.message}`);
    }
  }
}

// Deduplicate findings
const seen = new Set();
const uniqueFindings = [];
for (const f of unreachableReport) {
  const key = `${f.file}:${f.line}:${f.type}`;
  if (!seen.has(key)) {
    seen.add(key);
    uniqueFindings.push(f);
  }
}

// Output results
const outputDir = path.join(projectRoot, '.planning/phases/108-dead-code-removal');
fs.mkdirSync(outputDir, { recursive: true });

const reportPath = path.join(outputDir, 'unreachable-report.json');
fs.writeFileSync(reportPath, JSON.stringify(uniqueFindings, null, 2));
console.log(`\nFound ${uniqueFindings.length} unreachable code patterns`);
console.log(`Report written to: ${reportPath}`);

// Summary by type
const byType = {};
for (const f of uniqueFindings) {
  byType[f.type] = (byType[f.type] || 0) + 1;
}
console.log('\nBy type:');
for (const [type, count] of Object.entries(byType)) {
  console.log(`  ${type}: ${count}`);
}

// Summary by confidence
const byConfidence = {};
for (const f of uniqueFindings) {
  byConfidence[f.confidence] = (byConfidence[f.confidence] || 0) + 1;
}
console.log('\nBy confidence:');
for (const [conf, count] of Object.entries(byConfidence)) {
  console.log(`  ${conf}: ${count}`);
}
