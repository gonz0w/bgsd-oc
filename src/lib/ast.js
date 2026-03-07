'use strict';

const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const { LANGUAGE_MAP } = require('./codebase-intel');
const { startTimer, endTimer } = require('./profiler');

// ─── TypeScript Stripping ────────────────────────────────────────────────────

/**
 * Strip TypeScript-specific syntax to make code parseable by acorn.
 * Removes type annotations, generics, interfaces, type aliases, enums,
 * `as` casts, and other TS constructs that aren't valid JS.
 *
 * @param {string} code - TypeScript source code
 * @returns {string} Code with TS syntax stripped
 */
function stripTypeScript(code) {
  // Remove single-line type imports: import type { Foo } from 'bar';
  code = code.replace(/^\s*import\s+type\s+\{[^}]*\}\s+from\s+['"][^'"]*['"];?\s*$/gm, '');
  // Remove type-only import specifiers: import { type Foo, Bar } → import { Bar }
  code = code.replace(/\btype\s+(\w+)\s*,?\s*/g, '');

  // Remove interface declarations (multi-line)
  code = code.replace(/^\s*(?:export\s+)?interface\s+\w+(?:\s+extends\s+[^{]*)?\s*\{[^}]*\}/gm, '');
  // Remove type alias declarations
  code = code.replace(/^\s*(?:export\s+)?type\s+\w+(?:<[^>]*>)?\s*=\s*[^;]*;/gm, '');
  // Remove enum declarations (multi-line)
  code = code.replace(/^\s*(?:export\s+)?(?:const\s+)?enum\s+\w+\s*\{[^}]*\}/gm, '');
  // Remove declare statements
  code = code.replace(/^\s*declare\s+[^;{]*[;{][^}]*\}?/gm, '');

  // Remove generic type parameters from function/class declarations: <T, U extends X>
  code = code.replace(/<\s*[A-Z_]\w*(?:\s+extends\s+[^>]*)?\s*(?:,\s*[A-Z_]\w*(?:\s+extends\s+[^>]*)?\s*)*>/g, '');

  // Remove return type annotations: ): Type { or ): Type =>
  code = code.replace(/\)\s*:\s*(?:Promise\s*<[^>]*>|[\w\[\]|&<>.,\s?]+?)(?=\s*[{=>])/g, ')');

  // Remove parameter type annotations: (x: Type, y: Type)
  // Handle both simple types and complex ones like unions, arrays, generics
  code = code.replace(/(\w+)\s*:\s*(?:[\w\[\]|&<>.,\s?]+?)(?=[,\)=])/g, '$1');
  // Remove optional parameter markers: x?: Type → x
  code = code.replace(/(\w+)\?(?=\s*[,\)=:])/g, '$1');

  // Remove `as Type` casts
  code = code.replace(/\bas\s+(?:const|[\w\[\]|&<>.,\s?]+?)(?=[,;\)\]\}])/g, '');

  // Remove non-null assertions: x!.y → x.y
  code = code.replace(/(\w+)!(?=\.|\[)/g, '$1');

  // Remove type assertions with angle brackets: <Type>expression
  // But be careful not to remove JSX — only match simple casts
  code = code.replace(/<(\w+)>(?=\s*\w)/g, '');

  // Remove 'readonly' modifier
  code = code.replace(/\breadonly\s+/g, '');

  // Remove access modifiers in class bodies: public/private/protected/override
  code = code.replace(/^\s*(public|private|protected|override)\s+/gm, '');

  // Remove abstract keyword
  code = code.replace(/\babstract\s+/g, '');

  // Remove implements clause from class declarations
  code = code.replace(/\bimplements\s+[\w\s,<>]+(?=\s*\{)/g, '');

  return code;
}


// ─── Acorn AST Parsing ──────────────────────────────────────────────────────

/**
 * Parse JavaScript/TypeScript code with acorn.
 * Tries sourceType:'module' first, then falls back to 'script'.
 *
 * @param {string} code - Source code to parse
 * @returns {object|null} AST or null if parse fails
 */
function parseWithAcorn(code) {
  const baseOpts = {
    ecmaVersion: 'latest',
    allowReturnOutsideFunction: true,
    allowImportExportEverywhere: true,
  };

  try {
    return acorn.parse(code, { ...baseOpts, sourceType: 'module' });
  } catch {
    try {
      return acorn.parse(code, { ...baseOpts, sourceType: 'script' });
    } catch {
      return null;
    }
  }
}

/**
 * Extract parameter names from an array of acorn Parameter nodes.
 *
 * @param {object[]} params - Acorn parameter nodes
 * @returns {string[]} Parameter names
 */
function extractParamNames(params) {
  if (!params) return [];
  return params.map(p => {
    if (p.type === 'Identifier') return p.name;
    if (p.type === 'AssignmentPattern' && p.left && p.left.type === 'Identifier') return p.left.name;
    if (p.type === 'RestElement' && p.argument && p.argument.type === 'Identifier') return '...' + p.argument.name;
    if (p.type === 'ObjectPattern') return '{...}';
    if (p.type === 'ArrayPattern') return '[...]';
    return '?';
  });
}

/**
 * Calculate line number from character position in source code.
 *
 * @param {string} code - Source code
 * @param {number} pos - Character position
 * @returns {number} 1-based line number
 */
function posToLine(code, pos) {
  let line = 1;
  for (let i = 0; i < pos && i < code.length; i++) {
    if (code[i] === '\n') line++;
  }
  return line;
}

/**
 * Walk an acorn AST and extract function/class/method signatures.
 *
 * @param {object} ast - Acorn AST
 * @param {string} code - Original source code (for line number calculation)
 * @returns {object[]} Array of signature objects
 */
function walkAstForSignatures(ast, code) {
  const signatures = [];

  function visit(node) {
    if (!node || typeof node !== 'object') return;

    switch (node.type) {
      case 'FunctionDeclaration':
        if (node.id) {
          signatures.push({
            name: node.id.name,
            type: 'function',
            params: extractParamNames(node.params),
            line: posToLine(code, node.start),
            async: !!node.async,
            generator: !!node.generator,
          });
        }
        break;

      case 'ClassDeclaration':
        if (node.id) {
          signatures.push({
            name: node.id.name,
            type: 'class',
            params: [],
            line: posToLine(code, node.start),
            async: false,
            generator: false,
          });
          // Walk class body for methods
          if (node.body && node.body.body) {
            for (const member of node.body.body) {
              if (member.type === 'MethodDefinition' && member.key) {
                const methodName = member.key.name || member.key.value || 'anonymous';
                const fn = member.value;
                signatures.push({
                  name: `${node.id.name}.${methodName}`,
                  type: 'method',
                  params: fn ? extractParamNames(fn.params) : [],
                  line: posToLine(code, member.start),
                  async: fn ? !!fn.async : false,
                  generator: fn ? !!fn.generator : false,
                });
              }
              // Handle PropertyDefinition with arrow functions (class fields)
              if (member.type === 'PropertyDefinition' && member.key && member.value) {
                if (member.value.type === 'ArrowFunctionExpression' || member.value.type === 'FunctionExpression') {
                  const fieldName = member.key.name || member.key.value || 'anonymous';
                  signatures.push({
                    name: `${node.id.name}.${fieldName}`,
                    type: 'method',
                    params: extractParamNames(member.value.params),
                    line: posToLine(code, member.start),
                    async: !!member.value.async,
                    generator: !!member.value.generator,
                  });
                }
              }
            }
          }
        }
        break;

      case 'VariableDeclaration':
        for (const decl of node.declarations) {
          if (decl.id && decl.id.type === 'Identifier' && decl.init) {
            if (decl.init.type === 'ArrowFunctionExpression' || decl.init.type === 'FunctionExpression') {
              signatures.push({
                name: decl.id.name,
                type: 'arrow',
                params: extractParamNames(decl.init.params),
                line: posToLine(code, node.start),
                async: !!decl.init.async,
                generator: !!decl.init.generator,
              });
            }
          }
        }
        break;

      case 'ExpressionStatement':
        // Handle module.exports.foo = function() {} and exports.foo = function() {}
        if (node.expression && node.expression.type === 'AssignmentExpression') {
          const left = node.expression.left;
          const right = node.expression.right;
          if (right && (right.type === 'FunctionExpression' || right.type === 'ArrowFunctionExpression')) {
            let name = null;
            // module.exports.foo = function
            if (left.type === 'MemberExpression' && left.object) {
              if (left.object.type === 'MemberExpression' &&
                  left.object.object && left.object.object.name === 'module' &&
                  left.object.property && left.object.property.name === 'exports' &&
                  left.property) {
                name = left.property.name || left.property.value;
              }
              // exports.foo = function
              else if (left.object.name === 'exports' && left.property) {
                name = left.property.name || left.property.value;
              }
            }
            if (name) {
              signatures.push({
                name,
                type: 'function',
                params: extractParamNames(right.params),
                line: posToLine(code, node.start),
                async: !!right.async,
                generator: !!right.generator,
              });
            }
          }
        }
        break;
    }

    // Recurse into child nodes
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === 'object' && item.type) visit(item);
        }
      } else if (child && typeof child === 'object' && child.type) {
        visit(child);
      }
    }
  }

  if (ast.body) {
    for (const node of ast.body) {
      visit(node);
    }
  }

  return signatures;
}


// ─── JS Regex Fallback ──────────────────────────────────────────────────────

/**
 * Regex-based signature extraction for JS files when acorn parsing fails.
 *
 * @param {string} code - Source code
 * @returns {object[]} Array of signature objects
 */
function extractJsSignaturesRegex(code) {
  const signatures = [];
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // function declarations
    const funcMatch = line.match(/^(?:export\s+)?(?:async\s+)?function\s*\*?\s+(\w+)\s*\(([^)]*)\)/);
    if (funcMatch) {
      signatures.push({
        name: funcMatch[1],
        type: 'function',
        params: funcMatch[2] ? funcMatch[2].split(',').map(p => p.trim()).filter(Boolean) : [],
        line: lineNum,
        async: /async\s+function/.test(line),
        generator: /function\s*\*/.test(line),
      });
      continue;
    }

    // class declarations
    const classMatch = line.match(/^(?:export\s+)?class\s+(\w+)/);
    if (classMatch) {
      signatures.push({
        name: classMatch[1],
        type: 'class',
        params: [],
        line: lineNum,
        async: false,
        generator: false,
      });
      continue;
    }

    // const/let/var arrow functions
    const arrowMatch = line.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(?([^)]*)\)?\s*=>/);
    if (arrowMatch) {
      signatures.push({
        name: arrowMatch[1],
        type: 'arrow',
        params: arrowMatch[2] ? arrowMatch[2].split(',').map(p => p.trim()).filter(Boolean) : [],
        line: lineNum,
        async: /=\s*async/.test(line),
        generator: false,
      });
      continue;
    }
  }

  return signatures;
}


// ─── Export Extraction ───────────────────────────────────────────────────────

/**
 * Walk AST for ESM exports.
 *
 * @param {object} ast - Acorn AST
 * @returns {{ named: string[], default: string|null, reExports: string[] }}
 */
function walkAstForExports(ast) {
  const named = [];
  let defaultExport = null;
  const reExports = [];

  if (!ast || !ast.body) return { named, default: defaultExport, reExports };

  for (const node of ast.body) {
    switch (node.type) {
      case 'ExportNamedDeclaration':
        if (node.source) {
          // Re-export: export { foo } from './bar'
          if (node.specifiers) {
            for (const spec of node.specifiers) {
              const exportedName = spec.exported ? (spec.exported.name || spec.exported.value) : null;
              reExports.push(exportedName || 'unknown');
            }
          }
        } else if (node.declaration) {
          // export function foo / export const bar
          if (node.declaration.id) {
            named.push(node.declaration.id.name);
          } else if (node.declaration.declarations) {
            for (const decl of node.declaration.declarations) {
              if (decl.id && decl.id.type === 'Identifier') {
                named.push(decl.id.name);
              }
            }
          }
        } else if (node.specifiers) {
          // export { foo, bar }
          for (const spec of node.specifiers) {
            const exportedName = spec.exported ? (spec.exported.name || spec.exported.value) : null;
            named.push(exportedName || 'unknown');
          }
        }
        break;

      case 'ExportDefaultDeclaration':
        if (node.declaration) {
          if (node.declaration.id) {
            defaultExport = node.declaration.id.name;
          } else if (node.declaration.type === 'Identifier') {
            defaultExport = node.declaration.name;
          } else {
            defaultExport = 'anonymous';
          }
        } else {
          defaultExport = 'anonymous';
        }
        break;

      case 'ExportAllDeclaration':
        // export * from './bar'
        reExports.push('* from ' + (node.source ? node.source.value : 'unknown'));
        break;
    }
  }

  return { named, default: defaultExport, reExports };
}

/**
 * Extract CJS exports via regex scanning.
 *
 * @param {string} code - Source code
 * @returns {string[]} Array of CJS export names
 */
function extractCjsExports(code) {
  const cjsExports = [];
  const seen = new Set();

  // Strip single-line comments to avoid matching patterns in comments
  const stripped = code.replace(/\/\/[^\n]*/g, '');

  // module.exports.foo = ... or module.exports['foo'] = ...
  const moduleExportsPattern = /module\.exports\.(\w+)\s*=/g;
  let match;
  while ((match = moduleExportsPattern.exec(stripped)) !== null) {
    if (!seen.has(match[1])) {
      seen.add(match[1]);
      cjsExports.push(match[1]);
    }
  }

  // exports.foo = ...
  const exportsPattern = /(?<![.\w])exports\.(\w+)\s*=/g;
  while ((match = exportsPattern.exec(stripped)) !== null) {
    if (!seen.has(match[1])) {
      seen.add(match[1]);
      cjsExports.push(match[1]);
    }
  }

  // module.exports = { foo, bar, baz }
  const moduleExportsObj = /module\.exports\s*=\s*\{([^}]+)\}/;
  const objMatch = stripped.match(moduleExportsObj);
  if (objMatch) {
    const inner = objMatch[1];
    // Match identifiers (key names) — handles `foo,` `bar: baz,` `qux`
    const entries = inner.match(/(\w+)\s*(?:[:,}])/g);
    if (entries) {
      for (const entry of entries) {
        const name = entry.replace(/\s*[:,}]/g, '').trim();
        if (name && !seen.has(name)) {
          seen.add(name);
          cjsExports.push(name);
        }
      }
    }
  }

  return cjsExports;
}


// ─── Detector Registry (regex-based, non-JS languages) ──────────────────────

/**
 * Registry of regex-based signature/export detectors for non-JS languages.
 * Each entry maps a language name to { signatures: RegExp, exports?: RegExp }.
 * The regex must use named or positional capture groups.
 */
const DETECTOR_REGISTRY = {
  python: {
    signatures: /^(async\s+)?def\s+(\w+)\s*\(([^)]*)\)/gm,
    exports: /^(\w+)\s*=|^class\s+(\w+)/gm,
    extractSignature(match, lineNum) {
      return {
        name: match[2],
        type: match[1] ? 'function' : 'function',
        params: match[3] ? match[3].split(',').map(p => p.trim().split(':')[0].split('=')[0].trim()).filter(Boolean) : [],
        line: lineNum,
        async: !!match[1],
        generator: false,
      };
    },
  },
  go: {
    signatures: /^func\s+(?:\([\w\s*]+\)\s+)?(\w+)\s*\(([^)]*)\)/gm,
    extractSignature(match, lineNum) {
      return {
        name: match[1],
        type: 'function',
        params: match[2] ? match[2].split(',').map(p => p.trim().split(/\s+/)[0]).filter(Boolean) : [],
        line: lineNum,
        async: false,
        generator: false,
      };
    },
  },
  rust: {
    signatures: /^(pub\s+)?(async\s+)?fn\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)/gm,
    extractSignature(match, lineNum) {
      return {
        name: match[3],
        type: 'function',
        params: match[4] ? match[4].split(',').map(p => p.trim().split(':')[0].trim()).filter(Boolean) : [],
        line: lineNum,
        async: !!match[2],
        generator: false,
      };
    },
  },
  ruby: {
    signatures: /^\s*def\s+(\w+[?!=]?)\s*(\([^)]*\))?/gm,
    extractSignature(match, lineNum) {
      const params = match[2] ? match[2].replace(/[()]/g, '').split(',').map(p => p.trim()).filter(Boolean) : [];
      return {
        name: match[1],
        type: 'function',
        params,
        line: lineNum,
        async: false,
        generator: false,
      };
    },
  },
  elixir: {
    signatures: /^\s*defp?\s+(\w+)\s*(\([^)]*\))?/gm,
    extractSignature(match, lineNum) {
      const params = match[2] ? match[2].replace(/[()]/g, '').split(',').map(p => p.trim()).filter(Boolean) : [];
      return {
        name: match[1],
        type: 'function',
        params,
        line: lineNum,
        async: false,
        generator: false,
      };
    },
  },
  java: {
    signatures: /^\s*(?:public|private|protected)?\s*(?:static)?\s*[\w<>\[\]]+\s+(\w+)\s*\(([^)]*)\)/gm,
    extractSignature(match, lineNum) {
      return {
        name: match[1],
        type: 'function',
        params: match[2] ? match[2].split(',').map(p => p.trim().split(/\s+/).pop()).filter(Boolean) : [],
        line: lineNum,
        async: false,
        generator: false,
      };
    },
  },
  php: {
    signatures: /^\s*(?:public|private|protected)?\s*(?:static)?\s*function\s+(\w+)\s*\(([^)]*)\)/gm,
    extractSignature(match, lineNum) {
      return {
        name: match[1],
        type: 'function',
        params: match[2] ? match[2].split(',').map(p => p.trim().split(/\s+/).pop().replace(/^\$/, '')).filter(Boolean) : [],
        line: lineNum,
        async: false,
        generator: false,
      };
    },
  },
};


// ─── Language Detection ─────────────────────────────────────────────────────

/**
 * Detect language from file extension using LANGUAGE_MAP.
 *
 * @param {string} filePath - File path
 * @returns {string|null} Language name or null
 */
function detectLanguage(filePath) {
  const ext = path.extname(filePath);
  return LANGUAGE_MAP[ext] || null;
}

/**
 * Check if a language is JS-family (parseable by acorn).
 *
 * @param {string} language - Language name
 * @returns {boolean}
 */
function isJsFamily(language) {
  return language === 'javascript' || language === 'typescript';
}

/**
 * Check if a language needs TypeScript stripping before acorn parsing.
 *
 * @param {string} filePath - File path
 * @returns {boolean}
 */
function needsTypeStripping(filePath) {
  const ext = path.extname(filePath);
  return ext === '.ts' || ext === '.tsx' || ext === '.jsx';
}


// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Extract function/class/method signatures from a file.
 *
 * For JS/CJS/MJS: Uses acorn AST parsing with fallback to regex.
 * For TS/TSX/JSX: Strips TypeScript syntax, then parses with acorn.
 * For other languages: Uses regex-based DETECTOR_REGISTRY.
 *
 * @param {string} filePath - Absolute or relative file path
 * @param {object} [options] - Options
 * @param {string} [options.code] - Pre-read source code (avoids re-reading file)
 * @returns {{ signatures: object[], language: string|null, error?: string }}
 */
function extractSignatures(filePath, options) {
  const timer = startTimer('ast:parse:' + path.basename(filePath));
  const opts = options || {};

  let code;
  try {
    code = opts.code || fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    endTimer(timer);
    return { signatures: [], language: null, error: 'file_not_found' };
  }

  const language = detectLanguage(filePath);
  if (!language) {
    endTimer(timer);
    return { signatures: [], language: null, error: 'unknown_language' };
  }

  // JS-family: use acorn
  if (isJsFamily(language)) {
    let parseCode = code;
    if (needsTypeStripping(filePath)) {
      parseCode = stripTypeScript(code);
    }

    const ast = parseWithAcorn(parseCode);
    if (ast) {
      const signatures = walkAstForSignatures(ast, parseCode);
      endTimer(timer);
      return { signatures, language };
    }

    // Acorn failed — try regex fallback for JS
    const regexSigs = extractJsSignaturesRegex(code);
    endTimer(timer);
    return {
      signatures: regexSigs,
      language,
      error: regexSigs.length === 0 ? 'parse_failed' : undefined,
    };
  }

  // Non-JS: use DETECTOR_REGISTRY
  const detector = DETECTOR_REGISTRY[language];
  if (!detector) {
    endTimer(timer);
    return { signatures: [], language, error: 'no_detector' };
  }

  try {
    const signatures = [];
    const regex = new RegExp(detector.signatures.source, detector.signatures.flags);
    const lines = code.split('\n');
    let match;

    while ((match = regex.exec(code)) !== null) {
      // Calculate line number from match position
      let lineNum = 1;
      for (let i = 0; i < match.index; i++) {
        if (code[i] === '\n') lineNum++;
      }
      signatures.push(detector.extractSignature(match, lineNum));
    }

    endTimer(timer);
    return { signatures, language };
  } catch {
    endTimer(timer);
    return { signatures: [], language, error: 'parse_failed' };
  }
}


/**
 * Extract export surface from a file.
 *
 * For ESM: Walks AST for ExportNamedDeclaration, ExportDefaultDeclaration, ExportAllDeclaration.
 * For CJS: Regex scan for module.exports/exports patterns.
 * Returns combined result with module type detection.
 *
 * @param {string} filePath - Absolute or relative file path
 * @returns {{ named: string[], default: string|null, reExports: string[], cjsExports: string[], type: 'esm'|'cjs'|'mixed', language: string|null, error?: string }}
 */
function extractExports(filePath) {
  const timer = startTimer('ast:exports:' + path.basename(filePath));
  let code;
  try {
    code = fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    endTimer(timer);
    return { named: [], default: null, reExports: [], cjsExports: [], type: 'cjs', language: null, error: 'file_not_found' };
  }

  const language = detectLanguage(filePath);
  if (!language || !isJsFamily(language)) {
    endTimer(timer);
    return { named: [], default: null, reExports: [], cjsExports: [], type: 'cjs', language, error: 'unsupported_language' };
  }

  let parseCode = code;
  if (needsTypeStripping(filePath)) {
    parseCode = stripTypeScript(code);
  }

  // Try acorn parse for ESM exports
  const ast = parseWithAcorn(parseCode);
  let esmResult = { named: [], default: null, reExports: [] };
  if (ast) {
    esmResult = walkAstForExports(ast);
  }

  // Always scan for CJS exports too
  const cjsExports = extractCjsExports(code);

  // Determine module type
  const hasEsm = esmResult.named.length > 0 || esmResult.default !== null || esmResult.reExports.length > 0;
  const hasCjs = cjsExports.length > 0;
  let type = 'cjs';
  if (hasEsm && hasCjs) type = 'mixed';
  else if (hasEsm) type = 'esm';

  endTimer(timer);
  return {
    named: esmResult.named,
    default: esmResult.default,
    reExports: esmResult.reExports,
    cjsExports,
    type,
    language,
  };
}


// ─── Complexity Scoring ─────────────────────────────────────────────────────

/**
 * AST node types that contribute to cyclomatic complexity.
 */
const COMPLEXITY_NODES = new Set([
  'IfStatement',
  'ConditionalExpression',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'CatchClause',
  'LogicalExpression',
]);

/** SwitchCase contributes +1 for non-default cases only */
const SWITCH_CASE_NODE = 'SwitchCase';

/**
 * AST node types that represent control flow (for nesting depth tracking).
 */
const NESTING_NODES = new Set([
  'IfStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'SwitchStatement',
  'CatchClause',
]);

/**
 * Walk an AST node and compute cyclomatic complexity + max nesting depth.
 *
 * @param {object} node - AST node (function body)
 * @param {number} currentDepth - Current nesting depth
 * @returns {{ complexity: number, nesting_max: number }}
 */
function walkComplexity(node, currentDepth) {
  if (!node || typeof node !== 'object') return { complexity: 0, nesting_max: currentDepth };

  let complexity = 0;
  let maxNesting = currentDepth;

  // Count complexity contribution of this node
  if (COMPLEXITY_NODES.has(node.type)) {
    complexity += 1;
  }
  if (node.type === SWITCH_CASE_NODE && node.test !== null) {
    // Non-default SwitchCase
    complexity += 1;
  }

  // Track nesting depth for control flow nodes
  const isNesting = NESTING_NODES.has(node.type);
  const childDepth = isNesting ? currentDepth + 1 : currentDepth;
  if (childDepth > maxNesting) maxNesting = childDepth;

  // Recurse into child nodes (skip function boundaries — each function is analyzed separately)
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === 'object' && item.type) {
          // Don't recurse into nested function declarations/expressions — they're separate
          if (item.type === 'FunctionDeclaration' || item.type === 'FunctionExpression' ||
              item.type === 'ArrowFunctionExpression') continue;
          const sub = walkComplexity(item, childDepth);
          complexity += sub.complexity;
          if (sub.nesting_max > maxNesting) maxNesting = sub.nesting_max;
        }
      }
    } else if (child && typeof child === 'object' && child.type) {
      if (child.type === 'FunctionDeclaration' || child.type === 'FunctionExpression' ||
          child.type === 'ArrowFunctionExpression') continue;
      const sub = walkComplexity(child, childDepth);
      complexity += sub.complexity;
      if (sub.nesting_max > maxNesting) maxNesting = sub.nesting_max;
    }
  }

  return { complexity, nesting_max: maxNesting };
}

/**
 * Extract function body nodes from an AST for complexity analysis.
 * Returns array of { name, line, body } for each function/method.
 *
 * @param {object} ast - Acorn AST
 * @param {string} code - Source code (for line calculation)
 * @returns {{ name: string, line: number, body: object }[]}
 */
function extractFunctionBodies(ast, code) {
  const functions = [];

  function visit(node, parentClassName) {
    if (!node || typeof node !== 'object') return;

    switch (node.type) {
      case 'FunctionDeclaration':
        if (node.id && node.body) {
          functions.push({
            name: node.id.name,
            line: posToLine(code, node.start),
            body: node.body,
          });
        }
        break;

      case 'ClassDeclaration':
        if (node.id && node.body && node.body.body) {
          for (const member of node.body.body) {
            if (member.type === 'MethodDefinition' && member.key && member.value && member.value.body) {
              const methodName = member.key.name || member.key.value || 'anonymous';
              functions.push({
                name: `${node.id.name}.${methodName}`,
                line: posToLine(code, member.start),
                body: member.value.body,
              });
            }
            if (member.type === 'PropertyDefinition' && member.key && member.value) {
              if ((member.value.type === 'ArrowFunctionExpression' || member.value.type === 'FunctionExpression') && member.value.body) {
                const fieldName = member.key.name || member.key.value || 'anonymous';
                functions.push({
                  name: `${node.id.name}.${fieldName}`,
                  line: posToLine(code, member.start),
                  body: member.value.body,
                });
              }
            }
          }
        }
        // Don't recurse into class body — we've already handled methods
        return;

      case 'VariableDeclaration':
        for (const decl of node.declarations) {
          if (decl.id && decl.id.type === 'Identifier' && decl.init) {
            if ((decl.init.type === 'ArrowFunctionExpression' || decl.init.type === 'FunctionExpression') && decl.init.body) {
              functions.push({
                name: decl.id.name,
                line: posToLine(code, node.start),
                body: decl.init.body,
              });
            }
          }
        }
        break;

      case 'ExpressionStatement':
        if (node.expression && node.expression.type === 'AssignmentExpression') {
          const left = node.expression.left;
          const right = node.expression.right;
          if (right && (right.type === 'FunctionExpression' || right.type === 'ArrowFunctionExpression') && right.body) {
            let name = null;
            if (left.type === 'MemberExpression' && left.object) {
              if (left.object.type === 'MemberExpression' &&
                  left.object.object && left.object.object.name === 'module' &&
                  left.object.property && left.object.property.name === 'exports' &&
                  left.property) {
                name = left.property.name || left.property.value;
              } else if (left.object.name === 'exports' && left.property) {
                name = left.property.name || left.property.value;
              }
            }
            if (name) {
              functions.push({
                name,
                line: posToLine(code, node.start),
                body: right.body,
              });
            }
          }
        }
        break;
    }

    // Recurse into child nodes
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === 'object' && item.type) visit(item);
        }
      } else if (child && typeof child === 'object' && child.type) {
        visit(child);
      }
    }
  }

  if (ast.body) {
    for (const node of ast.body) {
      visit(node);
    }
  }

  return functions;
}

/**
 * Regex-based complexity approximation for non-JS files.
 * Counts branching keywords as a rough proxy for cyclomatic complexity.
 *
 * @param {string} code - Source code
 * @returns {number} Approximate complexity score
 */
function regexComplexity(code) {
  const patterns = [
    /\bif\b/g,
    /\belse\s+if\b/g,
    /\bfor\b/g,
    /\bwhile\b/g,
    /\bswitch\b/g,
    /\bcase\b/g,
    /\bcatch\b/g,
    /&&/g,
    /\|\|/g,
  ];
  let count = 1; // Base complexity
  for (const pattern of patterns) {
    const matches = code.match(pattern);
    if (matches) count += matches.length;
  }
  return count;
}

/**
 * Compute per-function cyclomatic complexity for a file.
 *
 * For JS/TS: Uses acorn AST to walk each function body.
 * For non-JS: Uses regex approximation returning single module-level score.
 *
 * @param {string} filePath - File path
 * @returns {{ file: string, module_complexity: number, functions: Array<{name: string, line: number, complexity: number, nesting_max: number}>, error?: string }}
 */
function computeComplexity(filePath) {
  let code;
  try {
    code = fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    return { file: filePath, module_complexity: 0, functions: [], error: 'file_not_found' };
  }

  const language = detectLanguage(filePath);
  if (!language) {
    return { file: filePath, module_complexity: 0, functions: [], error: 'unknown_language' };
  }

  // JS-family: use acorn for per-function analysis
  if (isJsFamily(language)) {
    let parseCode = code;
    if (needsTypeStripping(filePath)) {
      parseCode = stripTypeScript(code);
    }

    const ast = parseWithAcorn(parseCode);
    if (!ast) {
      // Fallback to regex for unparseable JS
      const approx = regexComplexity(code);
      return {
        file: filePath,
        module_complexity: approx,
        functions: [{ name: '<module>', line: 1, complexity: approx, nesting_max: 0 }],
        error: 'parse_failed_regex_fallback',
      };
    }

    const fnBodies = extractFunctionBodies(ast, parseCode);
    const functions = [];
    let moduleComplexity = 0;

    for (const fn of fnBodies) {
      const result = walkComplexity(fn.body, 0);
      const complexity = 1 + result.complexity; // Base 1 + branch count
      functions.push({
        name: fn.name,
        line: fn.line,
        complexity,
        nesting_max: result.nesting_max,
      });
      moduleComplexity += complexity;
    }

    return { file: filePath, module_complexity: moduleComplexity, functions };
  }

  // Non-JS: regex approximation
  const approx = regexComplexity(code);
  return {
    file: filePath,
    module_complexity: approx,
    functions: [{ name: '<module>', line: 1, complexity: approx, nesting_max: 0 }],
  };
}


// ─── Repo Map Generation ────────────────────────────────────────────────────

/**
 * Generate a compact repository map from AST signatures.
 *
 * Walks all source files, extracts signatures and exports, then builds
 * a compact text format suitable for agent context injection (~1k tokens).
 *
 * @param {string} cwd - Project root directory
 * @param {object} [options] - Options
 * @param {number} [options.tokenBudget=1000] - Target token budget (tokens ≈ chars/4)
 * @returns {{ summary: string, files_included: number, total_signatures: number, token_estimate: number }}
 */
function generateRepoMap(cwd, options) {
  const opts = options || {};
  const tokenBudget = opts.tokenBudget || 1000;
  const charBudget = tokenBudget * 4; // Rough token-to-char conversion

  const { getSourceDirs, walkSourceFiles, SKIP_DIRS, LANGUAGE_MAP } = require('./codebase-intel');

  const sourceDirs = getSourceDirs(cwd);
  const allFiles = walkSourceFiles(cwd, sourceDirs, SKIP_DIRS);

  // Filter to only source files (with known language) — skip configs, markdown, etc.
  const codeExtensions = new Set([
    '.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx',
    '.py', '.pyw', '.go', '.rs', '.rb', '.rake',
    '.java', '.kt', '.php', '.ex', '.exs',
    '.c', '.h', '.cpp', '.hpp', '.cc',
    '.swift', '.dart', '.lua', '.zig', '.nim',
  ]);

  const sourceFiles = allFiles.filter(f => {
    const ext = path.extname(f);
    if (!codeExtensions.has(ext)) return false;
    // Skip bundled/built files — they're generated and massive
    if (f.includes('bin/') || f.includes('dist/') || f.includes('build/')) return false;
    return true;
  });

  // Gather signature data for each file
  const fileData = [];
  for (const relPath of sourceFiles) {
    const absPath = path.join(cwd, relPath);
    const sigResult = extractSignatures(absPath);
    const expResult = isJsFamily(detectLanguage(absPath)) ? extractExports(absPath) : null;

    const exportNames = [];
    if (expResult) {
      if (expResult.named && expResult.named.length > 0) exportNames.push(...expResult.named);
      if (expResult.cjsExports && expResult.cjsExports.length > 0) exportNames.push(...expResult.cjsExports);
      if (expResult.default) exportNames.push('default:' + expResult.default);
    }

    const exportCount = exportNames.length;
    const signatures = sigResult.signatures || [];

    if (signatures.length === 0 && exportCount === 0) continue; // Skip empty files

    fileData.push({
      path: relPath,
      signatures,
      exportNames,
      exportCount,
      sigCount: signatures.length,
    });
  }

  // Sort by signature count descending (most important files first)
  fileData.sort((a, b) => b.sigCount - a.sigCount);

  // Build compact text, respecting char budget
  const lines = ['# Repo Map', ''];
  let totalChars = lines.join('\n').length;
  let filesIncluded = 0;
  let totalSignatures = 0;

  for (const file of fileData) {
    // Build this file's section
    const fileLines = [];
    const exportLabel = file.exportCount > 0 ? ` (${file.exportCount} exports)` : '';
    fileLines.push(`## ${file.path}${exportLabel}`);

    // Cap signatures per file based on remaining budget
    const remainingChars = charBudget * 1.2 - totalChars;
    const maxSigsPerFile = remainingChars < 2000 ? 10 : 30;
    const displaySigs = file.signatures.slice(0, maxSigsPerFile);

    for (const sig of displaySigs) {
      const prefix = sig.type === 'method' ? '    method' :
                     sig.type === 'class' ? '  class' :
                     sig.type === 'arrow' ? '  fn' : '  fn';
      const asyncMark = sig.async ? 'async ' : '';
      // Compact params: truncate if too long
      let paramsStr = sig.params.join(', ');
      if (paramsStr.length > 40) paramsStr = paramsStr.substring(0, 37) + '...';
      fileLines.push(`${prefix} ${asyncMark}${sig.name}(${paramsStr}) :${sig.line}`);
    }

    if (file.signatures.length > maxSigsPerFile) {
      fileLines.push(`  ... +${file.signatures.length - maxSigsPerFile} more`);
    }

    if (file.exportNames.length > 0) {
      let exportStr = file.exportNames.join(', ');
      if (exportStr.length > 60) exportStr = exportStr.substring(0, 57) + '...';
      fileLines.push(`  exports: ${exportStr}`);
    }

    fileLines.push('');

    const sectionText = fileLines.join('\n');
    const sectionChars = sectionText.length;

    // Check if adding this section would exceed budget (with 20% buffer for header)
    if (totalChars + sectionChars > charBudget * 1.2 && filesIncluded > 0) {
      // Budget exceeded — stop adding files
      break;
    }

    lines.push(sectionText);
    totalChars += sectionChars;
    filesIncluded++;
    totalSignatures += file.sigCount;
  }

  const summary = lines.join('\n').trim();
  const tokenEstimate = Math.ceil(summary.length / 4);

  return {
    summary,
    files_included: filesIncluded,
    total_signatures: totalSignatures,
    token_estimate: tokenEstimate,
  };
}


// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  extractSignatures,
  extractExports,
  computeComplexity,
  generateRepoMap,
};
