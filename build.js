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

  await esbuild.build({
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
  });

  const elapsed = Date.now() - start;
  console.log(`Built bin/gsd-tools.cjs in ${elapsed}ms`);

  // Smoke test
  try {
    const result = execSync('node bin/gsd-tools.cjs current-timestamp --raw', {
      encoding: 'utf-8',
      timeout: 5000,
    });
    console.log(`Smoke test passed: ${result.trim()}`);
  } catch (err) {
    console.error('Smoke test FAILED:', err.message);
    process.exit(1);
  }

  // Bundle size tracking
  const BUNDLE_BUDGET_KB = 1050;
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
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
