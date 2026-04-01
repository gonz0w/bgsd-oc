'use strict';

const { describe, test, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { validateCommandIntegrity } = require('../src/lib/commandDiscovery');
const { runGsdToolsFull } = require('./helpers.cjs');

const ROOT = path.join(__dirname, '..');
const tempDirs = [];

function makeTempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgsd-validate-commands-'));
  tempDirs.push(dir);
  return dir;
}

function writeFile(root, relativePath, content) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

describe('validateCommandIntegrity', () => {
  test('groups actionable issues by surfaced file and semantic rule', () => {
    const result = validateCommandIntegrity({
      cwd: ROOT,
      surfaces: [
        {
          surface: 'workflow',
          path: 'workflows/gaps.md',
          content: 'Fix the gaps with `/bgsd-plan phase 159` and then `/bgsd-execute-phase 159`.',
        },
        {
          surface: 'workflow',
          path: 'workflows/legacy.md',
          content: 'Next run `/bgsd-plan-phase 159`, `gsd-tools util:validate-commands`, `/bgsd-plan discuss`, and `/bgsd-missing 1`.',
        },
        {
          surface: 'workflow',
          path: 'workflows/settings.md',
          content: 'Switch the selected project profile with `/bgsd-settings profile`.',
        },
      ],
    });

    assert.equal(result.valid, false);
    assert.equal(result.groupedIssueCount, 2);

    const kinds = new Set(result.issues.map(issue => issue.kind));
    assert.ok(kinds.has('wrong-command'));
    assert.ok(kinds.has('missing-flag'));
    assert.ok(kinds.has('legacy-command'));
    assert.ok(kinds.has('missing-argument'));
    assert.ok(kinds.has('nonexistent-command'));

    const legacyGroup = result.groupedIssues.find(group => group.file === 'workflows/legacy.md');
    assert.ok(legacyGroup, 'expected grouped report for workflows/legacy.md');
    assert.ok(
      legacyGroup.issues.some(issue => issue.kind === 'nonexistent-command' && issue.command === '/bgsd-plan-phase 159'),
      'RED: removed planning aliases are currently falling through as generic nonexistent commands'
    );
    assert.ok(
      legacyGroup.issues.some(issue => issue.kind === 'legacy-command' && issue.command === '/bgsd-plan-phase 159'),
      'removed planning aliases should now be reported as legacy surfaced guidance'
    );
  });

  test('allows reference-style placeholder and family-form commands while still failing runnable guidance mistakes', () => {
    const result = validateCommandIntegrity({
      cwd: ROOT,
      surfaces: [
        {
          surface: 'docs',
          path: 'docs/reference-index.md',
          content: 'Preferred canonical planning-family routes: `/bgsd-plan phase`, `/bgsd-plan discuss`, `/bgsd-plan research`, and `/bgsd-plan assumptions`.',
        },
        {
          surface: 'skill',
          path: 'skills/raci/SKILL.md',
          content: [
            '| Step | Accountable (A) |',
            '|------|-----------------|',
            '| phase-discussion | /bgsd-plan discuss [phase] |',
            '| phase-research | /bgsd-plan research [phase] |',
            '| plan-creation | /bgsd-plan phase [phase] |',
            '| gap-closure-planning | /bgsd-plan gaps [phase] |',
          ].join('\n'),
        },
        {
          surface: 'workflow',
          path: 'workflows/bad-runnable.md',
          content: [
            'Next run `/bgsd-plan discuss`.',
            'Fix the gaps with `/bgsd-execute-phase 159`.',
          ].join('\n'),
        },
      ],
    });

    assert.equal(result.valid, false);
    assert.ok(
      result.issues.some(issue => issue.file === 'workflows/bad-runnable.md' && issue.kind === 'missing-argument'),
      'runnable guidance should still require concrete phase arguments'
    );
    assert.ok(
      result.issues.some(issue => issue.file === 'workflows/bad-runnable.md' && issue.kind === 'missing-flag'),
      'gap-focused runnable guidance should still require --gaps-only'
    );
    assert.equal(
      result.issues.some(issue => issue.file === 'docs/reference-index.md'),
      false,
      'reference-style command family indexes should pass'
    );
    assert.equal(
      result.issues.some(issue => issue.file === 'skills/raci/SKILL.md'),
      false,
      'reference-style placeholder commands in ownership tables should pass'
    );
  });

  test('ignores slash-like config path fragments that are not commands', () => {
    const result = validateCommandIntegrity({
      cwd: ROOT,
      surfaces: [
        {
          surface: 'skill',
          path: 'skills/example.md',
          content: 'Install lives at `__OPENCODE_CONFIG__/bgsd-oc` and should not be parsed as a slash command.',
        },
      ],
    });

    assert.equal(result.valid, true);
    assert.deepEqual(result.issues, []);
  });

  test('treats frontmatter description metadata as reference-only while preserving runnable CLI enforcement', () => {
    const result = validateCommandIntegrity({
      cwd: ROOT,
      surfaces: [
        {
          surface: 'skill',
          path: 'skills/example/SKILL.md',
          content: [
            '---',
            'description: Phase parsing metadata still mentions bgsd-tools find-phase for historical context.',
            '---',
          ].join('\n'),
        },
        {
          surface: 'docs',
          path: 'docs/bad-cli.md',
          content: 'Run `gsd-tools find-phase 159` to continue.',
        },
      ],
    });

    assert.equal(result.valid, false);
    assert.equal(
      result.issues.some(issue => issue.file === 'skills/example/SKILL.md'),
      false,
      'frontmatter description metadata should be treated as reference-only'
    );
    assert.ok(
      result.issues.some(issue => issue.file === 'docs/bad-cli.md' && issue.kind === 'legacy-command'),
      'runnable CLI prose should still flag legacy binary usage'
    );
    assert.ok(
      result.issues.some(issue => issue.file === 'docs/bad-cli.md' && issue.kind === 'nonexistent-command'),
      'runnable CLI prose should still flag nonexistent command forms'
    );
  });

  test('ignores internal tag markup and workflow self-definition references', () => {
    const result = validateCommandIntegrity({
      cwd: ROOT,
      surfaces: [
        {
          surface: 'runtime',
          path: 'plugin.js',
          content: [
            'output.parts.unshift({',
            '  text: \"<bgsd-context>\\n{\\\"error\\\":\\\"Run /bgsd-new-project to initialize.\\\"}\\n</bgsd-context>\"',
            '});',
          ].join('\n'),
        },
        {
          surface: 'workflow',
          path: 'commands/bgsd-inspect.md',
          content: [
            '# /bgsd-inspect',
            '',
            '**Usage:** `/bgsd-inspect health`',
            '',
            '```',
            'Fix: Run /bgsd-inspect health to inspect current planning state',
            '```',
          ].join('\n'),
        },
        {
          surface: 'workflow',
          path: 'workflows/bad-runnable.md',
          content: 'Next run `/bgsd-plan discuss`.',
        },
      ],
    });

    assert.equal(
      result.issues.some(issue => issue.file === 'plugin.js'),
      false,
      'internal XML-style bgsd tags should not be treated as slash commands'
    );
    assert.equal(
      result.issues.some(issue => issue.file === 'commands/bgsd-inspect.md'),
      false,
      'workflow files should be able to reference their own command name as metadata/examples'
    );
    assert.ok(
      result.issues.some(issue => issue.file === 'workflows/bad-runnable.md' && issue.kind === 'missing-argument'),
      'real runnable guidance should still be validated'
    );
  });

  test('ignores descriptive bgsd-tools prose while still validating runnable CLI examples', () => {
    const result = validateCommandIntegrity({
      cwd: ROOT,
      surfaces: [
        {
          surface: 'skill',
          path: 'skills/example/SKILL.md',
          content: 'All updates use bgsd-tools CLI commands to ensure consistent format.',
        },
        {
          surface: 'docs',
          path: 'docs/bad-cli.md',
          content: 'Run `gsd-tools find-phase 159` to continue.',
        },
      ],
    });

    assert.equal(
      result.issues.some(issue => issue.file === 'skills/example/SKILL.md'),
      false,
      'descriptive prose mentioning bgsd-tools should not be parsed as a command invocation'
    );
    assert.ok(
      result.issues.some(issue => issue.file === 'docs/bad-cli.md' && issue.kind === 'legacy-command'),
      'real runnable CLI examples should still be flagged'
    );
  });

  test('util:validate-commands exits non-zero and returns grouped JSON output', () => {
    const repo = makeTempRepo();

    writeFile(repo, 'bin/manifest.json', JSON.stringify({
      files: [
        'commands/bgsd-plan.md',
        'commands/bgsd-execute-phase.md',
        'commands/bgsd-settings.md',
      ],
    }, null, 2));

    for (const commandFile of [
      'commands/bgsd-plan.md',
      'commands/bgsd-execute-phase.md',
      'commands/bgsd-settings.md',
    ]) {
      writeFile(repo, commandFile, readRepoFile(commandFile));
    }

    writeFile(
      repo,
      'workflows/bad-guidance.md',
      [
        'Use `/bgsd-plan-phase 159` to continue.',
        'Fix milestone gaps with `/bgsd-execute-phase 159`.',
        'Switch profile with `/bgsd-settings profile`.',
        'Audit with `gsd-tools fake:missing`.',
      ].join('\n')
    );

    const result = runGsdToolsFull('util:validate-commands --raw', repo);
    assert.equal(result.exitCode, 1);

    const payload = JSON.parse(result.stdout);
    assert.equal(payload.valid, false);
    assert.ok(payload.issueCount >= 4);
    assert.ok(payload.groupedIssueCount >= 1);
    assert.ok(Array.isArray(payload.groupedIssues));
    assert.ok(
      payload.groupedIssues.some(group => group.file === 'workflows/bad-guidance.md'),
      'expected grouped issue output for the invalid surfaced workflow file'
    );
  });

  test('validates node-invoked bgsd-tools examples against the shipped CLI inventory', () => {
    const result = validateCommandIntegrity({
      cwd: ROOT,
      surfaces: [
        {
          surface: 'plan',
          path: '.planning/phases/166-demo/166-01-PLAN.md',
          content: [
            '<verify>node /Users/cam/.config/opencode/bgsd-oc/bin/bgsd-tools.cjs fake:missing</verify>',
            '<verify>node bin/bgsd-tools.cjs verify:verify plan-structure .planning/phases/166-demo/166-01-PLAN.md</verify>',
          ].join('\n'),
        },
      ],
    });

    assert.equal(result.valid, false);
    assert.ok(
      result.issues.some(issue => issue.kind === 'nonexistent-command' && issue.command.includes('fake:missing')),
      'node-invoked stale CLI examples should be rejected against the shipped inventory'
    );
    assert.equal(
      result.issues.some(issue => issue.command.includes('verify:verify plan-structure')),
      false,
      'valid node-invoked bgsd-tools commands should remain allowed'
    );
  });

  test('config-migrate is absent from discovery inventory and canonical config docs', () => {
    const result = validateCommandIntegrity({
      cwd: ROOT,
      surfaces: [
        {
          surface: 'docs',
          path: 'docs/troubleshooting.md',
          content: readRepoFile('docs/troubleshooting.md'),
        },
        {
          surface: 'docs',
          path: 'docs/expert-guide.md',
          content: readRepoFile('docs/expert-guide.md'),
        },
        {
          surface: 'plan',
          path: '.planning/phases/174-greenfield-compatibility-surface-cleanup/174-01-PLAN.md',
          content: 'Validate the retired route with `node bin/bgsd-tools.cjs util:config-migrate` before continuing.',
        },
      ],
    });

    assert.equal(
      result.issues.some(issue => issue.kind === 'nonexistent-command' && issue.command.includes('util:config-migrate')),
      true,
      'command-integrity checks should reject reintroducing util:config-migrate anywhere in surfaced guidance'
    );
    assert.ok(
      result.inventories.cliCommands.every(command => !command.includes('config-migrate')),
      'discovery inventory should no longer advertise util:config-migrate'
    );
  });

  test('stale registry commands are rejected from NL fallback surfaces', () => {
    const result = validateCommandIntegrity({
      cwd: ROOT,
      surfaces: [
        {
          surface: 'runtime',
          path: 'src/lib/nl/command-registry.js',
          content: readRepoFile('src/lib/nl/command-registry.js'),
        },
        {
          surface: 'runtime',
          path: 'src/lib/nl/suggestion-engine.js',
          content: readRepoFile('src/lib/nl/suggestion-engine.js'),
        },
        {
          surface: 'runtime',
          path: 'src/lib/nl/conversational-planner.js',
          content: readRepoFile('src/lib/nl/conversational-planner.js'),
        },
        {
          surface: 'runtime',
          path: 'src/lib/nl/nl-parser.js',
          content: readRepoFile('src/lib/nl/nl-parser.js'),
        },
        {
          surface: 'runtime',
          path: 'src/lib/nl/help-fallback.js',
          content: readRepoFile('src/lib/nl/help-fallback.js'),
        },
      ],
    });

    assert.equal(result.valid, true, 'touched NL registry files should stay on canonical routed commands only');

    const staleMentions = [
      'src/lib/nl/command-registry.js',
      'src/lib/nl/help-fallback.js',
      'src/lib/nl/suggestion-engine.js',
      'src/lib/nl/conversational-planner.js',
      'src/lib/nl/nl-parser.js',
    ].map(file => ({ file, content: readRepoFile(file) }));

    for (const { file, content } of staleMentions) {
      assert.doesNotMatch(
        content,
        /execute:phase|execute:quick|verify:work|session:resume|session:pause|verify:phase|session:progress|roadmap:show|milestone:new/,
        `${file} should not preserve stale compatibility-era command names`
      );
    }

    assert.match(readRepoFile('src/lib/nl/command-registry.js'), /verify:state/, 'NL registry should keep canonical verification routing');
    assert.match(readRepoFile('src/lib/nl/command-registry.js'), /plan:milestone/, 'NL registry should keep canonical milestone routing');
  });

  test('Phase 174 canonical command guidance rejects stale surfaced docs and workflow drift', () => {
    const result = validateCommandIntegrity({
      cwd: ROOT,
      surfaces: [
        {
          surface: 'docs',
          path: 'docs/commands.md',
          content: readRepoFile('docs/commands.md'),
        },
        {
          surface: 'docs',
          path: 'docs/workflows.md',
          content: readRepoFile('docs/workflows.md'),
        },
        {
          surface: 'workflow',
          path: 'workflows/plan-phase.md',
          content: readRepoFile('workflows/plan-phase.md'),
        },
        {
          surface: 'workflow',
          path: 'workflows/discuss-phase.md',
          content: readRepoFile('workflows/discuss-phase.md'),
        },
      ],
    });

    const phase174WorkflowIssues = result.issues.filter(issue => /workflows\/(?:plan-phase|discuss-phase)\.md$/.test(issue.file));

    assert.deepEqual(
      phase174WorkflowIssues.map(issue => ({ file: issue.file, kind: issue.kind, command: issue.command })),
      [
        {
          file: 'workflows/plan-phase.md',
          kind: 'missing-argument',
          command: '/bgsd-plan phase',
        },
        {
          file: 'workflows/plan-phase.md',
          kind: 'nonexistent-command',
          command: 'node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs init:plan-phase',
        },
        {
          file: 'workflows/discuss-phase.md',
          kind: 'missing-argument',
          command: '/bgsd-plan discuss',
        },
        {
          file: 'workflows/discuss-phase.md',
          kind: 'nonexistent-command',
          command: 'node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs init:phase-op',
        },
      ],
      'RED: the Phase 174 workflow slice currently misclassifies internal fallback reconstruction as surfaced runnable guidance'
    );

    assert.equal(result.valid, true, 'Phase 174 surfaced command guidance should stay on canonical supported routes only');
    for (const surfacedFile of ['docs/commands.md', 'docs/workflows.md', 'workflows/plan-phase.md', 'workflows/discuss-phase.md']) {
      assert.equal(
        result.issues.some(issue => issue.file === surfacedFile),
        false,
        `${surfacedFile} should not reintroduce stale surfaced command guidance`
      );
    }
  });

  test('NL fallback surfaces teach only canonical routed replacements', () => {
    const fallbackContent = readRepoFile('src/lib/nl/help-fallback.js');

    const result = validateCommandIntegrity({
      cwd: ROOT,
      surfaces: [
        {
          surface: 'runtime',
          path: 'src/lib/nl/help-fallback.js',
          content: fallbackContent,
        },
      ],
    });

    assert.equal(result.valid, true, 'fallback guidance should only advertise canonical routed commands');
    assert.doesNotMatch(fallbackContent, /session:progress|roadmap:show|milestone:new/, 'fallback guidance should drop stale progress, roadmap, and milestone compatibility commands');
    assert.match(fallbackContent, /verify:state/, 'fallback guidance should keep canonical state verification');
    assert.match(fallbackContent, /plan:milestone/, 'fallback guidance should keep canonical milestone routing');
    assert.match(fallbackContent, /\/bgsd-inspect progress/, 'fallback guidance should point progress follow-ups at the inspect family');
  });
});
