'use strict';

const fs = require('fs');
const path = require('path');

function cloneFinding(finding, extra) {
  return { ...finding, ...extra };
}

function applyMechanicalFixes(cwd, findings) {
  const byPath = new Map();
  const applied = [];
  const failed = [];
  const summaries = [];

  for (const finding of findings || []) {
    const filePath = finding.path;
    if (!filePath || !finding.fix || !finding.fix.mechanical) {
      failed.push(cloneFinding(finding, { fix_status: 'failed', fix_error: 'Finding is not a mechanical fix candidate.' }));
      continue;
    }
    const key = `${filePath}:${finding.fix.line}`;
    if (byPath.has(key)) {
      failed.push(cloneFinding(finding, { fix_status: 'failed', fix_error: 'Conflicting mechanical fixes target the same line.' }));
      continue;
    }
    byPath.set(key, finding);
  }

  const grouped = new Map();
  for (const finding of byPath.values()) {
    const current = grouped.get(finding.path) || [];
    current.push(finding);
    grouped.set(finding.path, current);
  }

  for (const [filePath, fileFindings] of grouped.entries()) {
    const absolutePath = path.join(cwd, filePath);
    if (!fs.existsSync(absolutePath)) {
      for (const finding of fileFindings) {
        failed.push(cloneFinding(finding, { fix_status: 'failed', fix_error: 'Target file no longer exists.' }));
      }
      continue;
    }

    const original = fs.readFileSync(absolutePath, 'utf-8');
    const hadTrailingNewline = original.endsWith('\n');
    const lines = original.split('\n');
    const pending = [...fileFindings].sort((left, right) => right.fix.line - left.fix.line);
    let fileChanged = false;

    for (const finding of pending) {
      const lineIndex = finding.fix.line - 1;
      const currentLine = lines[lineIndex];
      if (currentLine === undefined) {
        failed.push(cloneFinding(finding, { fix_status: 'failed', fix_error: 'Target line is no longer present.' }));
        continue;
      }
      if (currentLine !== finding.fix.expected) {
        failed.push(cloneFinding(finding, { fix_status: 'failed', fix_error: 'Patch validation failed because the current line no longer matches the expected text.' }));
        continue;
      }

      if (finding.fix.kind === 'line-delete') {
        lines.splice(lineIndex, 1);
      } else if (finding.fix.kind === 'line-replace') {
        lines.splice(lineIndex, 1, finding.fix.replacement);
      } else {
        failed.push(cloneFinding(finding, { fix_status: 'failed', fix_error: `Unsupported fix kind: ${finding.fix.kind}` }));
        continue;
      }

      fileChanged = true;
      applied.push(cloneFinding(finding, { fix_status: 'applied' }));
      summaries.push({
        path: filePath,
        line: finding.line,
        rule_id: finding.rule_id,
        summary: finding.fix.summary || 'Applied mechanical fix',
      });
    }

    if (fileChanged) {
      const nextContent = lines.join('\n') + (hadTrailingNewline ? '\n' : '');
      fs.writeFileSync(absolutePath, nextContent, 'utf-8');
    }
  }

  return { applied, failed, summaries };
}

module.exports = {
  applyMechanicalFixes,
};
