#!/usr/bin/env node

const esbuild = require('esbuild');
const fs = require('fs');
const { execSync } = require('child_process');

/**
 * Esbuild plugin to strip shebang lines from source files.
 * The banner option adds the canonical shebang to the output,
 * so we need to remove any existing shebangs from source to avoid duplicates.
 */
const stripShebangPlugin = {
  name: 'strip-shebang',
  setup(build) {
    build.onLoad({ filter: /\.c?js$/ }, async (args) => {
      let contents = fs.readFileSync(args.path, 'utf-8');
      if (contents.startsWith('#!')) {
        contents = contents.replace(/^#!.*\n/, '');
      }
      return { contents, loader: 'js' };
    });
  },
};

async function build() {
  const start = Date.now();

  const result = await esbuild.build({
    entryPoints: ['src/index.js'],
    outfile: 'bin/gsd-tools.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    external: ['node:*', 'child_process', 'fs', 'path', 'os', 'crypto', 'util', 'stream', 'events', 'buffer', 'url', 'querystring', 'http', 'https', 'net', 'tls', 'zlib'],  // Bundle npm deps (tokenx), externalize Node.js built-ins only
    banner: {
      js: '#!/usr/bin/env node',
    },
    minify: false,  // Keep readable for debugging
    sourcemap: false,
    plugins: [stripShebangPlugin],
    metafile: true,
  });

  const elapsed = Date.now() - start;
  console.log(`Built bin/gsd-tools.cjs in ${elapsed}ms`);

  // Smoke test
  try {
    const result = execSync('node bin/gsd-tools.cjs util:current-timestamp --raw', {
      encoding: 'utf-8',
      timeout: 5000,
    });
    console.log(`Smoke test passed: ${result.trim()}`);
  } catch (err) {
    console.error('Smoke test FAILED:', err.message);
    process.exit(1);
  }

  // Bundle size tracking
  const BUNDLE_BUDGET_KB = 1500;
  const bundlePath = 'bin/gsd-tools.cjs';
  const stat = fs.statSync(bundlePath);
  const sizeKB = Math.round(stat.size / 1024);
  const withinBudget = sizeKB <= BUNDLE_BUDGET_KB;

  console.log(`Bundle size: ${sizeKB}KB / ${BUNDLE_BUDGET_KB}KB budget${withinBudget ? '' : ' ⚠ OVER BUDGET'}`);

  // Write size record
  const baselinesDir = '.planning/baselines';
  if (!fs.existsSync(baselinesDir)) {
    fs.mkdirSync(baselinesDir, { recursive: true });
  }
  const sizeRecord = {
    timestamp: new Date().toISOString(),
    bundle_size_bytes: stat.size,
    bundle_size_kb: sizeKB,
    budget_kb: BUNDLE_BUDGET_KB,
    within_budget: withinBudget,
  };
  fs.writeFileSync(
    `${baselinesDir}/bundle-size.json`,
    JSON.stringify(sizeRecord, null, 2) + '\n'
  );

  if (!withinBudget) {
    console.error(`ERROR: Bundle size ${sizeKB}KB exceeds budget of ${BUNDLE_BUDGET_KB}KB`);
    process.exit(1);
  }

  // --- Metafile analysis: per-module byte attribution ---
  const outputKey = Object.keys(result.metafile.outputs).find(k => k.endsWith('bin/gsd-tools.cjs'));
  if (outputKey && result.metafile.outputs[outputKey].inputs) {
    const inputs = result.metafile.outputs[outputKey].inputs;

    // Build per-module map
    const modules = {};
    for (const [filePath, info] of Object.entries(inputs)) {
      modules[filePath] = {
        bytes: info.bytesInOutput,
        kb: Math.round(info.bytesInOutput / 1024),
      };
    }

    // Group by directory prefix
    const groups = {};
    for (const [filePath, info] of Object.entries(inputs)) {
      // Determine group: for node_modules use package name, for src use first two segments
      let group;
      if (filePath.startsWith('node_modules/')) {
        const parts = filePath.split('/');
        // Handle scoped packages (@org/pkg)
        group = parts[1].startsWith('@')
          ? `node_modules/${parts[1]}/${parts[2]}/`
          : `node_modules/${parts[1]}/`;
      } else if (filePath.startsWith('src/')) {
        const parts = filePath.split('/');
        group = parts.length > 2 ? `${parts[0]}/${parts[1]}/` : 'src/';
      } else {
        group = 'other/';
      }

      if (!groups[group]) {
        groups[group] = { bytes: 0, file_count: 0 };
      }
      groups[group].bytes += info.bytesInOutput;
      groups[group].file_count += 1;
    }

    // Add KB to groups
    for (const g of Object.values(groups)) {
      g.kb = Math.round(g.bytes / 1024);
    }

    // Sort groups by total size descending
    const sortedGroups = Object.entries(groups).sort((a, b) => b[1].bytes - a[1].bytes);

    // Sort modules by size descending for per-group display
    const sortedModules = Object.entries(modules).sort((a, b) => b[1].bytes - a[1].bytes);

    // Console output
    console.log('\nModule analysis:');
    for (const [groupName, groupInfo] of sortedGroups) {
      console.log(`  ${groupName.padEnd(30)} ${groupInfo.kb}KB (${groupInfo.file_count} files)`);
      // Show files in this group, sorted by size
      const groupFiles = sortedModules
        .filter(([fp]) => {
          if (groupName === 'other/') {
            return !fp.startsWith('src/') && !fp.startsWith('node_modules/');
          }
          if (groupName === 'src/') {
            // Root src files only (e.g., src/index.js, src/router.js) — not subdirectories
            return fp.startsWith('src/') && fp.split('/').length === 2;
          }
          return fp.startsWith(groupName);
        });
      for (const [fp, info] of groupFiles) {
        const shortName = fp.split('/').pop();
        console.log(`    ${shortName.padEnd(28)} ${info.kb}KB`);
      }
    }

    // Warn about large source files
    for (const [fp, info] of sortedModules) {
      if (info.bytes > 50 * 1024) {
        console.warn(`⚠ Large source file: ${fp} (${info.kb}KB in output)`);
      }
    }

    // Write build-analysis.json
    const analysisData = {
      timestamp: new Date().toISOString(),
      bundle_size_kb: sizeKB,
      modules,
      groups: Object.fromEntries(sortedGroups.map(([name, info]) => [name, { bytes: info.bytes, kb: info.kb, file_count: info.file_count }])),
    };
    fs.writeFileSync(
      `${baselinesDir}/build-analysis.json`,
      JSON.stringify(analysisData, null, 2) + '\n'
    );
    console.log(`\nWrote ${baselinesDir}/build-analysis.json`);

    // Write raw metafile for ad-hoc analysis
    fs.writeFileSync('/tmp/gsd-metafile.json', JSON.stringify(result.metafile, null, 2));
    console.log('Wrote /tmp/gsd-metafile.json');
  }

  // --- Manifest generation: list all deployable files ---
  const path = require('path');
  const manifestFiles = [];

  /**
   * Recursively collect files from a directory matching an optional filter.
   * @param {string} dir - Directory to scan (relative to project root)
   * @param {function} [filter] - Optional predicate on filename
   */
  function collectFiles(dir, filter) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { recursive: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      // Skip directories (readdirSync with recursive returns dirs too)
      if (!fs.statSync(fullPath).isFile()) continue;
      const relPath = fullPath.split(path.sep).join('/');
      if (!filter || filter(path.basename(entry))) {
        manifestFiles.push(relPath);
      }
    }
  }

  // bin/ — all files
  collectFiles('bin', () => true);
  // workflows/ — all .md files
  collectFiles('workflows', (name) => name.endsWith('.md'));
  // templates/ — all .md files
  collectFiles('templates', (name) => name.endsWith('.md'));
  // references/ — all .md files
  collectFiles('references', (name) => name.endsWith('.md'));
  // src/ — all files
  collectFiles('src', () => true);
  // commands/ — bgsd-*.md files
  collectFiles('commands', (name) => name.startsWith('bgsd-') && name.endsWith('.md'));
  // agents/ — gsd-*.md files
  collectFiles('agents', (name) => name.startsWith('gsd-') && name.endsWith('.md'));
  // VERSION file
  if (fs.existsSync('VERSION')) {
    manifestFiles.push('VERSION');
  }

  // Sort for stable output
  manifestFiles.sort();

  const manifest = {
    generated: new Date().toISOString(),
    files: manifestFiles,
  };
  fs.writeFileSync('bin/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\nManifest: ${manifestFiles.length} files`);
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
