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
    build.onLoad({ filter: /\.cjs$/ }, async (args) => {
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
    entryPoints: ['bin/gsd-tools.cjs'],
    outfile: 'bin/gsd-tools.bundle.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    packages: 'external',  // Don't bundle node built-ins
    banner: {
      js: '#!/usr/bin/env node',
    },
    minify: false,  // Keep readable for debugging
    sourcemap: false,
    plugins: [stripShebangPlugin],
  });

  const elapsed = Date.now() - start;
  console.log(`Built bin/gsd-tools.bundle.cjs in ${elapsed}ms`);

  // Smoke test
  try {
    const result = execSync('node bin/gsd-tools.bundle.cjs current-timestamp --raw', {
      encoding: 'utf-8',
      timeout: 5000,
    });
    console.log(`Smoke test passed: ${result.trim()}`);
  } catch (err) {
    console.error('Smoke test FAILED:', err.message);
    process.exit(1);
  }
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
