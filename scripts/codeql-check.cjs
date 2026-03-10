#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const SRC_DIR = join(import.meta.dirname, 'src');
const DB_DIR = join(import.meta.dirname, '.codeql-db');

console.log('🔍 Running local CodeQL pre-check...\n');

if (!existsSync(SRC_DIR)) {
  console.log('⚠️  No src/ directory found, skipping CodeQL check');
  process.exit(0);
}

try {
  if (existsSync(DB_DIR)) {
    rmSync(DB_DIR, { recursive: true, force: true });
  }
  mkdirSync(DB_DIR, { recursive: true });

  console.log('📦 Creating CodeQL database...');
  execSync(`codeql database create ${DB_DIR} --language=javascript --source-root=${SRC_DIR}`, {
    stdio: 'inherit',
    cwd: import.meta.dirname
  });

  console.log('\n🔬 Analyzing database...');
  const resultsFile = join(import.meta.dirname, 'codeql-results.sarif');
  try {
    execSync(`codeql database analyze ${DB_DIR} --format=sarif-latest --output=${resultsFile}`, {
      stdio: 'inherit',
      cwd: import.meta.dirname
    });

    const sarif = JSON.parse(await readFile(resultsFile, 'utf-8'));
    const alerts = sarif.runs?.[0]?.results || [];

    if (alerts.length > 0) {
      console.log(`\n⚠️  Found ${alerts.length} potential issues:\n`);
      alerts.slice(0, 10).forEach((alert, i) => {
        const loc = alert.locations?.[0]?.physicalLocation?.artifactLocation?.uri || 'unknown';
        const rule = alert.ruleId || 'unknown';
        console.log(`  ${i + 1}. [${rule}] ${loc}`);
      });
      if (alerts.length > 10) {
        console.log(`  ... and ${alerts.length - 10} more`);
      }
      console.log('\n💡 Run CI to analyze with full security queries');
      console.log('   Fix these before pushing to avoid CI iterations.\n');
      process.exit(1);
    } else {
      console.log('\n✅ No CodeQL issues found!\n');
    }
  } finally {
    if (existsSync(resultsFile)) {
      rmSync(resultsFile, { force: true });
    }
  }
} catch (error) {
  if (error.message?.includes('codeql: not found')) {
    console.log('⚠️  CodeQL not installed. Install with:');
    console.log('   https://github.com/github/codeql-cli-binaries');
    console.log('\n✅ Skipping pre-check (CodeQL not available)\n');
    process.exit(0);
  }
  console.log('⚠️  CodeQL check failed:', error.message);
  console.log('   Proceeding anyway...\n');
} finally {
  if (existsSync(DB_DIR)) {
    rmSync(DB_DIR, { recursive: true, force: true });
  }
}

function readFile(path, encoding) {
  return new Promise((resolve, reject) => {
    import('fs').then(fs => fs.readFile(path, encoding, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    }));
  });
}
