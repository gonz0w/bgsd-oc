'use strict';

const { SEVERITY } = require('../severity');

function countIdentifierUsage(source, name) {
  const matches = source.match(new RegExp(`\\b${name.replace(/[$]/g, '\\$&')}\\b`, 'g'));
  return matches ? matches.length : 0;
}

function parseImportLine(line) {
  const match = line.match(/^(\s*)import\s+(.+?)\s+from\s+(['"][^'"]+['"])\s*;?\s*$/);
  if (!match) return null;

  const indent = match[1] || '';
  const specifier = match[2].trim();
  const moduleRef = match[3];
  const result = { indent, moduleRef, defaultImport: null, namedImports: [] };

  const namedMatch = specifier.match(/^(.*?)(?:,\s*)?\{([^}]*)\}$/);
  if (namedMatch) {
    const defaultPart = namedMatch[1].trim().replace(/,$/, '').trim();
    if (defaultPart) result.defaultImport = defaultPart;
    result.namedImports = namedMatch[2]
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const aliasMatch = part.match(/^(\w+)\s+as\s+(\w+)$/);
        if (aliasMatch) return { imported: aliasMatch[1], local: aliasMatch[2], raw: part };
        return { imported: part, local: part, raw: part };
      });
    return result;
  }

  if (/^\{[^}]+\}$/.test(specifier)) {
    result.namedImports = specifier
      .replace(/^\{|\}$/g, '')
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const aliasMatch = part.match(/^(\w+)\s+as\s+(\w+)$/);
        if (aliasMatch) return { imported: aliasMatch[1], local: aliasMatch[2], raw: part };
        return { imported: part, local: part, raw: part };
      });
    return result;
  }

  if (/^[A-Za-z_$][\w$]*$/.test(specifier)) {
    result.defaultImport = specifier;
    return result;
  }

  return null;
}

function buildReplacement(parsed, unusedNames) {
  const keepDefault = parsed.defaultImport && !unusedNames.has(parsed.defaultImport);
  const keepNamed = parsed.namedImports.filter(entry => !unusedNames.has(entry.local));
  if (!keepDefault && keepNamed.length === 0) return '';

  const parts = [];
  if (keepDefault) parts.push(parsed.defaultImport);
  if (keepNamed.length > 0) parts.push(`{ ${keepNamed.map(entry => entry.raw).join(', ')} }`);
  return `${parsed.indent}import ${parts.join(', ')} from ${parsed.moduleRef};`;
}

function scan(context) {
  const findings = [];
  for (let index = 0; index < context.lines.length; index++) {
    const lineNumber = index + 1;
    if (!context.isChangedLine(lineNumber)) continue;
    const line = context.lines[index];
    const parsed = parseImportLine(line);
    if (!parsed) continue;

    const fileWithoutLine = context.lines.filter((_, lineIndex) => lineIndex !== index).join('\n');
    const unusedNames = new Set();
    if (parsed.defaultImport && countIdentifierUsage(fileWithoutLine, parsed.defaultImport) === 0) {
      unusedNames.add(parsed.defaultImport);
    }
    for (const entry of parsed.namedImports) {
      if (countIdentifierUsage(fileWithoutLine, entry.local) === 0) unusedNames.add(entry.local);
    }
    if (unusedNames.size === 0) continue;

    const replacement = buildReplacement(parsed, unusedNames);
    findings.push({
      rule_id: 'js-unused-import',
      line: lineNumber,
      category: 'maintainability',
      severity: SEVERITY.WARNING,
      confidence: 0.96,
      message: `Unused import${unusedNames.size === 1 ? '' : 's'} in changed code add noise without affecting behavior.`,
      theme: 'import-cleanup',
      suggested_fix: replacement ? 'Remove only the unused import bindings.' : 'Delete the unused import line.',
      evidence: {
        symbols: [...unusedNames],
      },
      fix: {
        kind: replacement ? 'line-replace' : 'line-delete',
        line: lineNumber,
        expected: line,
        replacement,
        mechanical: true,
        summary: replacement ? 'Remove unused import bindings' : 'Delete unused import line',
      },
    });
  }
  return findings;
}

module.exports = {
  rule_id: 'js-unused-import',
  scan,
};
