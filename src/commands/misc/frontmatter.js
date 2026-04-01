'use strict';

const { extractFrontmatter, reconstructFrontmatter, spliceFrontmatter } = require('../../lib/frontmatter');

// Re-export frontmatter library functions
module.exports.extractFrontmatter = extractFrontmatter;
module.exports.reconstructFrontmatter = reconstructFrontmatter;
module.exports.spliceFrontmatter = spliceFrontmatter;

function extractXmlSection(content, tagName) {
  if (!content || !tagName) return null;
  const pattern = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`);
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}

function cmdFrontmatterGet(cwd, filePath, field, raw) {
  const { safeReadFile, output, error } = require('../../lib/output');
  const path = require('path');
  
  if (!filePath) { error('file path required'); }
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  const content = safeReadFile(fullPath);
  if (!content) { output({ error: 'File not found', path: filePath }, raw); return; }
  const fm = extractFrontmatter(content);
  if (field) {
    const value = fm[field];
    if (value === undefined) { output({ error: 'Field not found', field }, raw); return; }
    output({ [field]: value }, raw, JSON.stringify(value));
  } else {
    output(fm, raw);
  }
}

function cmdFrontmatterSet(cwd, filePath, field, value, raw) {
  const { output, error, debugLog } = require('../../lib/output');
  const { cachedReadFile } = require('../../lib/helpers');
  const path = require('path');
  const fs = require('fs');
  
  if (!filePath || !field || value === undefined) { error('file, field, and value required'); }
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  const content = cachedReadFile(fullPath);
  if (content === null) { output({ error: 'File not found', path: filePath }, raw); return; }
  const fm = extractFrontmatter(content);
  let parsedValue;
  try { parsedValue = JSON.parse(value); } catch (e) { debugLog('frontmatter.set', 'JSON parse value failed, using string', e); parsedValue = value; }
  fm[field] = parsedValue;
  const newContent = spliceFrontmatter(content, fm);
  fs.writeFileSync(fullPath, newContent, 'utf-8');
  output({ updated: true, field, value: parsedValue }, raw, 'true');
}

function cmdFrontmatterMerge(cwd, filePath, data, raw) {
  const { output, error, debugLog } = require('../../lib/output');
  const { cachedReadFile } = require('../../lib/helpers');
  const path = require('path');
  const fs = require('fs');
  
  if (!filePath || !data) { error('file and data required'); }
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  const content = cachedReadFile(fullPath);
  if (content === null) { output({ error: 'File not found', path: filePath }, raw); return; }
  const fm = extractFrontmatter(content);
  let mergeData;
  try { mergeData = JSON.parse(data); } catch (e) { debugLog('frontmatter.merge', 'JSON parse --data failed', e); error('Invalid JSON for --data'); return; }
  Object.assign(fm, mergeData);
  const newContent = spliceFrontmatter(content, fm);
  fs.writeFileSync(fullPath, newContent, 'utf-8');
  output({ merged: true, fields: Object.keys(mergeData) }, raw, 'true');
}

const FRONTMATTER_SCHEMAS = {
  plan: { required: ['phase', 'plan', 'type', 'wave', 'depends_on', 'files_modified', 'autonomous', 'must_haves'] },
  summary: { required: ['phase', 'plan', 'subsystem', 'tags', 'duration', 'completed'] },
  verification: { required: ['phase', 'verified', 'status', 'score'] },
};

function cmdFrontmatterValidate(cwd, filePath, schemaName, raw) {
  const { output, error } = require('../../lib/output');
  const { safeReadFile } = require('../../lib/helpers');
  const path = require('path');
  
  if (!filePath || !schemaName) { error('file and schema required'); }
  const schema = FRONTMATTER_SCHEMAS[schemaName];
  if (!schema) { error(`Unknown schema: ${schemaName}. Available: ${Object.keys(FRONTMATTER_SCHEMAS).join(', ')}`); }
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  const content = safeReadFile(fullPath);
  if (!content) { output({ error: 'File not found', path: filePath }, raw); return; }
  const fm = extractFrontmatter(content);
  const missing = schema.required.filter(f => fm[f] === undefined);
  const present = schema.required.filter(f => fm[f] !== undefined);
  output({ valid: missing.length === 0, missing, present, schema: schemaName }, raw, missing.length === 0 ? 'valid' : 'invalid');
}

function cmdValidateCommands(cwd, options = {}, raw) {
  const { validateCommandIntegrity } = require('../../lib/commandDiscovery');
  const { output } = require('../../lib/output');

  const result = validateCommandIntegrity({ cwd, ...options });

  const formattedGroups = result.groupedIssues.length === 0
    ? 'No surfaced command issues found.'
    : result.groupedIssues.map(group => {
      const details = group.issues.map(issue => {
        const parts = [`  - line ${issue.line}: [${issue.kind}] ${issue.message}`];
        if (issue.suggestion) parts.push(`    suggestion: ${issue.suggestion}`);
        return parts.join('\n');
      }).join('\n');
      return `${group.file} (${group.surface}, ${group.issueCount} issue${group.issueCount === 1 ? '' : 's'})\n${details}`;
    }).join('\n\n');

  const outputData = {
    valid: result.valid,
    surfaceCount: result.surfaceCount,
    groupedIssueCount: result.groupedIssueCount,
    issueCount: result.issueCount,
    message: result.message,
    groupedIssues: result.groupedIssues,
    issues: result.issues,
  };

  if (!result.valid) {
    process.exitCode = 1;
  }

  output(outputData, raw, `${result.message}\n\n${formattedGroups}`);

  return outputData;
}

function cmdValidateArtifacts(cwd, options = {}, raw) {
  const { validateArtifacts } = require('../../lib/commandDiscovery');
  const { output } = require('../../lib/output');

  const result = validateArtifacts(cwd);

  const formattedGroups = result.errors.length === 0
    ? 'No artifact issues found.'
    : result.errors.map(issue => `  - [${issue.file || 'unknown'}] ${issue.issue}`).join('\n');

  output({ valid: result.valid, errors: result.errors, warnings: result.warnings, formatted: formattedGroups }, raw, `${result.valid ? 'PASS' : 'FAIL'}\n\n${formattedGroups}`);
}

module.exports.cmdFrontmatterGet = cmdFrontmatterGet;
module.exports.cmdFrontmatterSet = cmdFrontmatterSet;
module.exports.cmdFrontmatterMerge = cmdFrontmatterMerge;
module.exports.cmdFrontmatterValidate = cmdFrontmatterValidate;
module.exports.extractXmlSection = extractXmlSection;
module.exports.cmdValidateCommands = cmdValidateCommands;
module.exports.cmdValidateArtifacts = cmdValidateArtifacts;
