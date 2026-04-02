'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
}

describe('new milestone research pipeline guidance', () => {
  test('new milestone research first path points to the shared 5-agent pipeline', () => {
    const milestone = read('workflows/new-milestone.md');
    const researchPipeline = read('skills/research-pipeline/SKILL.md');

    assert.match(milestone, /\*\*If "Research first":\*\*/);
    assert.match(milestone, /<skill:research-pipeline context="milestone"\s*\/>/i);

    assert.match(researchPipeline, /Spawning 5 researchers in parallel/i);
    assert.match(researchPipeline, /Stack, Features, Architecture, Pitfalls, Skills/);
    assert.match(researchPipeline, /Spawn 5 parallel `bgsd-project-researcher` agents/i);
    assert.match(researchPipeline, /STACK\.md/);
    assert.match(researchPipeline, /FEATURES\.md/);
    assert.match(researchPipeline, /ARCHITECTURE\.md/);
    assert.match(researchPipeline, /PITFALLS\.md/);
    assert.match(researchPipeline, /SKILLS\.md/);
    assert.match(researchPipeline, /After all 5 researchers complete, spawn synthesizer/i);
    assert.match(researchPipeline, /subagent_type="bgsd-roadmapper"/);
  });
});
