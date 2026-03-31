'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { validateCommandIntegrity } = require('../src/lib/commandDiscovery');

const ROOT = path.join(__dirname, '..');
function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
}

function extractAll(text, regex) {
  return Array.from(text.matchAll(regex), (match) => match[0]).join('\n\n');
}

describe('Phase 159 remaining surfaced guidance integrity', () => {
  test('exact shipped remaining surfaces keep canonical executable guidance', () => {
    const workflowsDoc = read('docs/workflows.md');
    const planPhase = read('workflows/plan-phase.md');
    const executePhase = read('workflows/execute-phase.md');
    const architecture = read('docs/architecture.md');
    const agents = read('docs/agents.md');
    const verifier = read('agents/bgsd-verifier.md');
    const constants = read('src/lib/constants.js');
    const guardrails = read('src/plugin/advisory-guardrails.js');
    const pluginBundle = read('plugin.js');

    assert.match(workflowsDoc, /`\/bgsd-plan assumptions \[phase\]`/);
    assert.match(workflowsDoc, /`\/bgsd-inspect progress`/);
    assert.match(workflowsDoc, /`\/bgsd-plan roadmap add "Description"`/);
    assert.match(workflowsDoc, /Reference-only compatibility note:/);
    assert.doesNotMatch(workflowsDoc, /\| `list-phase-assumptions\.md` \| `\/bgsd-list-assumptions` \|/);
    assert.doesNotMatch(workflowsDoc, /\| `progress\.md` \| `\/bgsd-progress` \|/);

    assert.match(planPhase, /Use \/bgsd-inspect progress to see available phases\./);
    assert.match(planPhase, /Reference-only compatibility note/);
    assert.doesNotMatch(planPhase, /Use \/bgsd-progress to see available phases\./);

    assert.match(executePhase, /Use \/bgsd-inspect progress to see available phases\./);
    assert.match(executePhase, /User runs `\/bgsd-inspect progress` or invokes transition manually\./);
    assert.doesNotMatch(executePhase, /\/bgsd-progress/);

    assert.match(architecture, /node bin\/bgsd-tools\.cjs init:plan-phase 1 --raw/);
    assert.match(architecture, /node bin\/bgsd-tools\.cjs init:execute-phase 1 --raw/);
    assert.match(architecture, /node bin\/bgsd-tools\.cjs util:cache status/);
    assert.doesNotMatch(architecture, /\bgsd-tools\s+init\s+plan-phase\b/);
    assert.doesNotMatch(architecture, /\bbgsd-tools\s+codebase\s+(context|ast|exports|complexity|repo-map)\b/);

    assert.match(agents, /`\/bgsd-plan phase \[phase\]`/);
    assert.match(agents, /`\/bgsd-execute-phase \[phase\]`/);
    assert.match(agents, /node bin\/bgsd-tools\.cjs util:agent override <agent-type>/);
    assert.doesNotMatch(agents, /gsd-tools agent (list-local|override|diff|sync)/);

    assert.match(verifier, /`\/bgsd-plan gaps \[phase\]`/);

    assert.match(constants, /Usage: bgsd-tools util:codebase context/);
    assert.match(constants, /Usage: bgsd-tools util:codebase ast/);
    assert.match(constants, /Usage: bgsd-tools util:agent <subcommand>/);
    assert.match(constants, /list-local\s+List project-local overrides/);
    assert.doesNotMatch(constants, /\bbgsd-tools\s+codebase\s+(context|ast|exports|complexity|repo-map)\b/);

    assert.match(guardrails, /'STATE\.md': \['\/bgsd-inspect progress', '\/bgsd-execute-phase'\]/);
    assert.match(guardrails, /'CONTEXT\.md': \['\/bgsd-plan discuss \[phase\]'\]/);
    assert.match(guardrails, /'RESEARCH\.md': \['\/bgsd-plan research \[phase\]'\]/);
    assert.doesNotMatch(guardrails, /\/bgsd-progress|\/bgsd-discuss-phase|\/bgsd-research-phase/);

    assert.match(pluginBundle, /Usage: bgsd-tools util:codebase context/);
    assert.match(pluginBundle, /Usage: bgsd-tools util:codebase ast/);
    assert.doesNotMatch(pluginBundle, /\bbgsd-tools\s+codebase\s+(context|ast|exports|complexity|repo-map)\b/);
  });

  test('shared validator accepts the exact shipped remaining surfaces', () => {
    const constants = read('src/lib/constants.js');
    const pluginBundle = read('plugin.js');
    const surfaces = [
      'docs/workflows.md',
      'workflows/plan-phase.md',
      'workflows/execute-phase.md',
      'docs/architecture.md',
      'docs/agents.md',
      'agents/bgsd-verifier.md',
      'src/plugin/advisory-guardrails.js',
    ].map((relativePath) => ({
      surface: relativePath.endsWith('.md') ? 'docs' : 'runtime',
      path: relativePath,
      content: read(relativePath),
    }));

    surfaces.push(
      {
        surface: 'runtime',
        path: 'src/lib/constants.js',
        content: extractAll(
          constants,
          /'util:codebase (?:context|ast|exports|complexity|repo-map)'[\s\S]*?`,/g
        ) + '\n\n' + extractAll(constants, /'util:agent'[\s\S]*?`,/g),
      },
      {
        surface: 'runtime',
        path: 'plugin.js',
        content: extractAll(
          pluginBundle,
          /"util:codebase (?:context|ast|exports|complexity|repo-map)": `[\s\S]*?`,/g
        ) + '\n\n' + extractAll(pluginBundle, /"util:agent": `[\s\S]*?`,/g),
      }
    );

    const result = validateCommandIntegrity({ cwd: ROOT, surfaces });

    assert.equal(result.valid, true, JSON.stringify(result.groupedIssues, null, 2));
    assert.equal(result.issueCount, 0);
  });
});
