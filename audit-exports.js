'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── 1. Parse router dispatch table ─────────────────────────────────────────
function parseRouterDispatch() {
  const routerPath = path.join(__dirname, 'src', 'router.js');
  const routerSrc = fs.readFileSync(routerPath, 'utf-8');
  const dispatchSet = new Set();
  const re = /lazy\w+\(\)\.(\w+)/g;
  let m;
  while ((m = re.exec(routerSrc)) !== null) {
    dispatchSet.add(m[1]);
  }
  return dispatchSet;
}

// ─── 2. Parse cross-module imports ──────────────────────────────────────────
function parseCrossModuleImports() {
  const dirs = [
    path.join(__dirname, 'src', 'commands'),
    path.join(__dirname, 'src', 'lib'),
  ];
  // Map: exportName → [importing file paths]
  const crossMap = new Map();

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
    for (const file of files) {
      const filePath = path.join(dir, file);
      const src = fs.readFileSync(filePath, 'utf-8');
      // Match: const { foo, bar } = require('./sibling') or require('../lib/x')
      const reqRe = /const\s*\{([^}]+)\}\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
      let rm;
      while ((rm = reqRe.exec(src)) !== null) {
        const reqPath = rm[2];
        // Only count cross-module (not external packages)
        if (!reqPath.startsWith('.')) continue;
        const names = rm[1].split(',').map(n => n.trim()).filter(Boolean);
        for (const name of names) {
          if (!crossMap.has(name)) {
            crossMap.set(name, []);
          }
          crossMap.get(name).push(filePath);
        }
      }
    }
  }

  // Also scan recovery/ subdirectory
  const recoveryDir = path.join(__dirname, 'src', 'lib', 'recovery');
  if (fs.existsSync(recoveryDir)) {
    const files = fs.readdirSync(recoveryDir).filter(f => f.endsWith('.js'));
    for (const file of files) {
      const filePath = path.join(recoveryDir, file);
      const src = fs.readFileSync(filePath, 'utf-8');
      const reqRe = /const\s*\{([^}]+)\}\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
      let rm;
      while ((rm = reqRe.exec(src)) !== null) {
        const reqPath = rm[2];
        if (!reqPath.startsWith('.')) continue;
        const names = rm[1].split(',').map(n => n.trim()).filter(Boolean);
        for (const name of names) {
          if (!crossMap.has(name)) {
            crossMap.set(name, []);
          }
          crossMap.get(name).push(filePath);
        }
      }
    }
  }

  return crossMap;
}

// ─── 3. Run knip ────────────────────────────────────────────────────────────
function runKnip() {
  try {
    const output = execSync('npx knip --include exports,files --reporter json', {
      encoding: 'utf-8',
      cwd: __dirname,
      timeout: 60000,
    });
    return JSON.parse(output);
  } catch (err) {
    // knip exits non-zero when issues found — output is still in stdout
    if (err.stdout) {
      return JSON.parse(err.stdout);
    }
    throw new Error(`knip failed: ${err.message}`);
  }
}

// ─── 4. Classify unused exports ─────────────────────────────────────────────
function classifyExports(knipResult, routerSet, crossMap) {
  const classification = {
    router_consumed: [],
    cross_module: [],
    truly_dead: [],
    internal_helper: [],
  };

  for (const issue of knipResult.issues) {
    for (const exp of issue.exports) {
      const name = exp.name;
      const file = issue.file;

      if (routerSet.has(name)) {
        classification.router_consumed.push({
          name,
          file,
          line: exp.line,
        });
      } else if (crossMap.has(name)) {
        classification.cross_module.push({
          name,
          file,
          consumers: crossMap.get(name).map(p => path.relative(__dirname, p)),
        });
      } else {
        // Check if exported but only used internally within the same file
        const filePath = path.join(__dirname, file);
        let isInternal = false;
        try {
          const src = fs.readFileSync(filePath, 'utf-8');
          // Count occurrences of the name (excluding the export line itself)
          const lines = src.split('\n');
          let usageCount = 0;
          for (let i = 0; i < lines.length; i++) {
            if (i + 1 === exp.line) continue; // skip export line
            // Simple word-boundary check
            const wordRe = new RegExp('\\b' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
            if (wordRe.test(lines[i])) {
              usageCount++;
            }
          }
          isInternal = usageCount > 0;
        } catch (_) {
          // file read error — classify as truly dead
        }

        if (isInternal) {
          classification.internal_helper.push({
            name,
            file,
            line: exp.line,
          });
        } else {
          classification.truly_dead.push({
            name,
            file,
            line: exp.line,
          });
        }
      }
    }
  }

  return classification;
}

// ─── Main ───────────────────────────────────────────────────────────────────
function main() {
  process.stderr.write('Parsing router dispatch table...\n');
  const routerSet = parseRouterDispatch();
  process.stderr.write(`  Found ${routerSet.size} router-dispatched functions\n`);

  process.stderr.write('Parsing cross-module imports...\n');
  const crossMap = parseCrossModuleImports();
  process.stderr.write(`  Found ${crossMap.size} cross-module imported names\n`);

  process.stderr.write('Running knip...\n');
  const knipResult = runKnip();
  const totalUnused = knipResult.issues.reduce((sum, i) => sum + i.exports.length, 0);
  process.stderr.write(`  Knip reports ${totalUnused} unused exports, ${knipResult.files.length} unused files\n`);

  process.stderr.write('Classifying exports...\n');
  const classification = classifyExports(knipResult, routerSet, crossMap);

  const report = {
    generated_at: new Date().toISOString(),
    knip_total_unused: totalUnused,
    unused_files: knipResult.files,
    classification,
    summary: {
      router_consumed_count: classification.router_consumed.length,
      cross_module_count: classification.cross_module.length,
      truly_dead_count: classification.truly_dead.length,
      internal_helper_count: classification.internal_helper.length,
      unused_files_count: knipResult.files.length,
    },
  };

  // Write report
  const outDir = path.join(__dirname, '.planning', 'baselines', 'audit');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'dead-code-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');

  // Print summary
  const sep = '\u2500'.repeat(21);
  console.log('');
  console.log('Dead Code Audit Report');
  console.log(sep);
  console.log(`Knip total: ${totalUnused} unused exports, ${knipResult.files.length} unused file(s)`);
  console.log(`Router-consumed (false positives): ${classification.router_consumed.length}`);
  console.log(`Cross-module (false positives): ${classification.cross_module.length}`);
  console.log(`Internal helpers: ${classification.internal_helper.length}`);
  console.log(`Truly dead: ${classification.truly_dead.length}`);
  console.log(`Unused files: ${knipResult.files.length}`);
  console.log(`Report: .planning/baselines/audit/dead-code-report.json`);
  console.log('');
}

main();
