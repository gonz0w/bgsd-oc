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
    outfile: 'bin/bgsd-tools.cjs',
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
  console.log(`Built bin/bgsd-tools.cjs in ${elapsed}ms`);

  // --- ESM Plugin Build ---
  const pluginStart = Date.now();
  const pluginResult = await esbuild.build({
    entryPoints: ['src/plugin/index.js'],
    outfile: 'plugin.js',
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    external: ['node:*', 'child_process', 'fs', 'path', 'os', 'crypto', 'util', 'stream', 'events', 'buffer', 'url', 'querystring', 'http', 'https', 'net', 'tls', 'zlib'],
    minify: false,
    sourcemap: false,
    metafile: true,
  });

  const pluginElapsed = Date.now() - pluginStart;
  console.log(`Built plugin.js (ESM) in ${pluginElapsed}ms`);

  // Validate ESM output — no CJS require() leaks allowed
  const pluginContent = fs.readFileSync('plugin.js', 'utf-8');
  const requireMatches = pluginContent.match(/\brequire\s*\(/g);
  if (requireMatches && requireMatches.length > 0) {
    console.error(`ERROR: ESM plugin.js contains ${requireMatches.length} require() calls — CJS leak detected`);
    process.exit(1);
  }
  console.log('ESM validation passed: 0 require() calls');

  // Verify critical exports exist in ESM output
  const requiredExports = ['BgsdPlugin', 'parseState', 'parseRoadmap', 'parsePlan', 'parseProject', 'parseIntent', 'getProjectState', 'buildSystemPrompt', 'buildCompactionContext', 'enrichCommand', 'createToolRegistry', 'safeHook', 'createNotifier', 'createFileWatcher', 'createIdleValidator', 'createStuckDetector'];
  for (const exp of requiredExports) {
    if (!pluginContent.includes(exp)) {
      console.error(`ERROR: ESM plugin missing export: ${exp}`);
      process.exit(1);
    }
  }
  console.log(`ESM export validation passed: ${requiredExports.length} critical exports verified`);

  // Validate all 5 tool names are present in plugin.js
  const expectedTools = ['bgsd_status', 'bgsd_progress', 'bgsd_context', 'bgsd_plan', 'bgsd_validate'];
  const missingTools = expectedTools.filter(name => !pluginContent.includes(name));
  if (missingTools.length > 0) {
    console.error(`ERROR: Missing tools in plugin.js: ${missingTools.join(', ')}`);
    process.exit(1);
  }
  console.log(`Tool registration validation passed: ${expectedTools.length}/${expectedTools.length} tools found in plugin.js`);

  // Validate Phase 75 event modules are present in plugin.js
  const expectedEventModules = ['createNotifier', 'createFileWatcher', 'createIdleValidator', 'createStuckDetector'];
  const missingModules = expectedEventModules.filter(name => !pluginContent.includes(name));
  if (missingModules.length > 0) {
    console.error(`ERROR: Missing event modules in plugin.js: ${missingModules.join(', ')}`);
    process.exit(1);
  }
  console.log(`Event module validation passed: ${expectedEventModules.length}/${expectedEventModules.length} modules found`);

  // Zod bundling validation — no CJS leak, patterns present
  if (pluginContent.includes('require("zod")') || pluginContent.includes("require('zod')")) {
    console.error('ERROR: plugin.js contains require("zod") — CJS leak for Zod');
    process.exit(1);
  }
  if (!pluginContent.includes('z.')) {
    console.error('ERROR: plugin.js does not contain Zod patterns (z.) — Zod may have been tree-shaken');
    process.exit(1);
  }
  console.log('Zod bundling validation passed');

  // Plugin bundle size
  const pluginStat = fs.statSync('plugin.js');
  const pluginSizeKB = Math.round(pluginStat.size / 1024);
  console.log(`Plugin size: ${pluginSizeKB}KB`);

  // Smoke test
  try {
    const result = execSync('node bin/bgsd-tools.cjs util:current-timestamp --raw', {
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
  const bundlePath = 'bin/bgsd-tools.cjs';
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
  const outputKey = Object.keys(result.metafile.outputs).find(k => k.endsWith('bin/bgsd-tools.cjs'));
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
      plugin_size_kb: pluginSizeKB,
      modules,
      groups: Object.fromEntries(sortedGroups.map(([name, info]) => [name, { bytes: info.bytes, kb: info.kb, file_count: info.file_count }])),
    };
    fs.writeFileSync(
      `${baselinesDir}/build-analysis.json`,
      JSON.stringify(analysisData, null, 2) + '\n'
    );
    console.log(`\nWrote ${baselinesDir}/build-analysis.json`);

    // Write raw metafile for ad-hoc analysis
    fs.writeFileSync('/tmp/bgsd-metafile.json', JSON.stringify(result.metafile, null, 2));
    console.log('Wrote /tmp/bgsd-metafile.json');
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
  // skills/ — all files (SKILL.md + supporting files)
  collectFiles('skills', () => true);
  // commands/ — bgsd-*.md files
  collectFiles('commands', (name) => name.startsWith('bgsd-') && name.endsWith('.md'));
  // agents/ — bgsd-*.md files
  collectFiles('agents', (name) => name.startsWith('bgsd-') && name.endsWith('.md'));
  // VERSION file
  if (fs.existsSync('VERSION')) {
    manifestFiles.push('VERSION');
  }
  // plugin.js — ESM plugin (build output)
  if (fs.existsSync('plugin.js')) {
    manifestFiles.push('plugin.js');
  }

  // --- Skills validation and index generation ---
  validateSkills(path);
  generateSkillIndex(path, fs);
  // Re-collect skills after index generation (skill-index may have been created)
  // Clear any previously collected skills entries and re-scan
  const skillsPrefix = 'skills/';
  for (let i = manifestFiles.length - 1; i >= 0; i--) {
    if (manifestFiles[i].startsWith(skillsPrefix)) {
      manifestFiles.splice(i, 1);
    }
  }
  collectFiles('skills', () => true);

  // Sort for stable output
  manifestFiles.sort();

  const manifest = {
    generated: new Date().toISOString(),
    files: manifestFiles,
  };
  fs.writeFileSync('bin/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\nManifest: ${manifestFiles.length} files`);
}

/**
 * Validate all skills in the skills/ directory.
 * Checks: SKILL.md exists, YAML frontmatter has name + description,
 * cross-references resolve, section markers match frontmatter sections.
 * Skips skill-index (auto-generated). Silently skips if skills/ doesn't exist.
 */
function validateSkills(path) {
  const skillsDir = 'skills';
  if (!fs.existsSync(skillsDir)) return;

  const entries = fs.readdirSync(skillsDir);
  const skillDirs = entries.filter(d => {
    const fullPath = path.join(skillsDir, d);
    return fs.statSync(fullPath).isDirectory() && d !== 'skill-index';
  });

  if (skillDirs.length === 0) return;

  const errors = [];
  const allSkillNames = new Set(
    entries.filter(d => fs.statSync(path.join(skillsDir, d)).isDirectory())
  );

  let validatedCount = 0;
  for (const dir of skillDirs) {
    const skillMd = path.join(skillsDir, dir, 'SKILL.md');

    // Skip empty placeholder directories (no SKILL.md yet)
    if (!fs.existsSync(skillMd)) {
      continue;
    }

    validatedCount++;
    const content = fs.readFileSync(skillMd, 'utf-8');

    // Check frontmatter has required fields
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) {
      errors.push(`${dir}: Missing YAML frontmatter`);
      continue;
    }

    const fm = fmMatch[1];
    if (!fm.includes('name:')) errors.push(`${dir}: Missing 'name' in frontmatter`);
    if (!fm.includes('description:')) errors.push(`${dir}: Missing 'description' in frontmatter`);

    // Check cross-references resolve to existing skill directories
    const crossRefs = content.match(/<skill:([a-z0-9-]+)/g) || [];
    for (const ref of crossRefs) {
      const skillName = ref.replace('<skill:', '');
      if (!allSkillNames.has(skillName)) {
        // Warn (not error) — referenced skill may be created in a later plan
        console.warn(`  ⚠ ${dir}: Cross-reference to '${skillName}' (not yet created)`);
      }
    }

    // Check that section markers exist for any sections listed in frontmatter
    const sectionsMatch = fm.match(/sections:\s*\[([^\]]+)\]/);
    if (sectionsMatch) {
      const sections = sectionsMatch[1].split(',').map(s => s.trim());
      for (const section of sections) {
        const marker = `<!-- section: ${section} -->`;
        if (!content.includes(marker)) {
          errors.push(`${dir}: Missing section marker '${marker}' for declared section '${section}'`);
        }
      }
    }
  }

  if (errors.length > 0) {
    console.error('Skill validation errors:');
    errors.forEach(e => console.error(`  ❌ ${e}`));
    process.exit(1);
  }

  if (validatedCount > 0) {
    console.log(`Skills validated: ${validatedCount} skills, 0 errors`);
  }
}

/**
 * Auto-generate skills/skill-index/SKILL.md from scanning all other skills.
 * Silently skips if skills/ directory doesn't exist.
 */
function generateSkillIndex(path, fs) {
  const skillsDir = 'skills';
  if (!fs.existsSync(skillsDir)) return;

  const entries = fs.readdirSync(skillsDir);
  const skillDirs = entries.filter(d => {
    return d !== 'skill-index' && fs.statSync(path.join(skillsDir, d)).isDirectory();
  });

  if (skillDirs.length === 0) return;

  // Collect skill metadata (skip dirs without SKILL.md — empty placeholders)
  const skills = [];
  for (const dir of skillDirs.sort()) {
    const skillMd = path.join(skillsDir, dir, 'SKILL.md');
    if (!fs.existsSync(skillMd)) continue;

    const content = fs.readFileSync(skillMd, 'utf-8');
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) continue;

    // Simple extraction (no YAML library — zero dependencies rule)
    const fm = fmMatch[1];
    const name = fm.match(/name:\s*(.+)/)?.[1]?.trim() || dir;
    const desc = fm.match(/description:\s*(.+)/)?.[1]?.trim() || '';
    const type = fm.match(/type:\s*(.+)/)?.[1]?.trim() || 'shared';
    const agents = fm.match(/agents:\s*\[([^\]]*)\]/)?.[1]?.trim() || 'all';

    skills.push({ name, desc, type, agents });
  }

  // No skills with SKILL.md yet — skip index generation
  if (skills.length === 0) return;

  let index = `---
name: skill-index
description: Auto-generated index of all available bGSD skills. Load this to discover what skills are available without loading their full content.
type: shared
agents: [all]
---

# Skill Index

**Generated:** ${new Date().toISOString()}
**Total skills:** ${skills.length}

| Skill | Type | Agents | Description |
|-------|------|--------|-------------|
`;

  for (const s of skills) {
    index += `| ${s.name} | ${s.type} | ${s.agents} | ${s.desc} |\n`;
  }

  // Write skill-index
  const indexDir = path.join(skillsDir, 'skill-index');
  if (!fs.existsSync(indexDir)) fs.mkdirSync(indexDir, { recursive: true });
  fs.writeFileSync(path.join(indexDir, 'SKILL.md'), index);
  console.log(`Skill index generated: ${skills.length} skills`);
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
