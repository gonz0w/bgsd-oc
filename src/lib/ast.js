'use strict';

const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const { LANGUAGE_MAP } = require('./codebase-intel');

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
  const opts = options || {};

  let code;
  try {
    code = opts.code || fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    return { signatures: [], language: null, error: 'file_not_found' };
  }

  const language = detectLanguage(filePath);
  if (!language) {
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
      return { signatures, language };
    }

    // Acorn failed — try regex fallback for JS
    const regexSigs = extractJsSignaturesRegex(code);
    return {
      signatures: regexSigs,
      language,
      error: regexSigs.length === 0 ? 'parse_failed' : undefined,
    };
  }

  // Non-JS: use DETECTOR_REGISTRY
  const detector = DETECTOR_REGISTRY[language];
  if (!detector) {
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

    return { signatures, language };
  } catch {
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
  let code;
  try {
    code = fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    return { named: [], default: null, reExports: [], cjsExports: [], type: 'cjs', language: null, error: 'file_not_found' };
  }

  const language = detectLanguage(filePath);
  if (!language || !isJsFamily(language)) {
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

  return {
    named: esmResult.named,
    default: esmResult.default,
    reExports: esmResult.reExports,
    cjsExports,
    type,
    language,
  };
}


// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  extractSignatures,
  extractExports,
  DETECTOR_REGISTRY,
  // Internal helpers exposed for testing
  stripTypeScript,
  parseWithAcorn,
  extractCjsExports,
  extractJsSignaturesRegex,
};
