// ─── Scaffold Generation Commands ────────────────────────────────────────────
// plan:generate  — produces a pre-filled PLAN.md scaffold from roadmap data
// verify:generate — produces a pre-filled VERIFICATION.md scaffold from roadmap data
// Phase 136: Scaffold Infrastructure

'use strict';

const fs = require('fs');
const path = require('path');
const { output } = require('../lib/output');
const { findPhaseInternal, getRoadmapPhaseInternal, cachedReadFile } = require('../lib/helpers');
const { extractFrontmatter } = require('../lib/frontmatter');
const { createPlanMetadataContext } = require('../lib/plan-metadata');
const {
  DATA_MARKER,
  JUDGMENT_MARKER,
  DATA_END,
  JUDGMENT_END,
  markSection,
  mergeScaffold,
  formatFrontmatter,
} = require('../lib/scaffold');

// ─── PLAN_JUDGMENT_SECTIONS ────────────────────────────────────────────────────

/** Headings that contain LLM-fills content in a generated PLAN.md scaffold */
const PLAN_JUDGMENT_SECTIONS = ['Must-Haves', 'Tasks', 'Verification'];

// ─── VERIFY_JUDGMENT_SECTIONS ─────────────────────────────────────────────────

/** Headings that contain LLM-fills content in a generated VERIFICATION.md scaffold */
const VERIFY_JUDGMENT_SECTIONS = ['Gaps Summary', 'Result', 'Anti-Patterns Found', 'Human Verification Required'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse REQUIREMENTS.md to extract requirement descriptions and completion status.
 * @param {string} cwd
 * @returns {Map<string, {description: string, complete: boolean}>}
 */
function parseRequirements(cwd) {
  const reqPath = path.join(cwd, '.planning', 'REQUIREMENTS.md');
  const reqs = new Map();
  try {
    const content = cachedReadFile(reqPath);
    if (!content) return reqs;
    // Match lines like: - [ ] **SCAF-01:** description  (colon inside the bold markers)
    const reqRegex = /- \[([ x])\] \*\*([A-Z]+-\d+):\*\*\s*(.+)/g;
    let m;
    while ((m = reqRegex.exec(content)) !== null) {
      reqs.set(m[2], {
        description: m[3].trim(),
        complete: m[1] === 'x',
      });
    }
  } catch (e) {
    // Silent — REQUIREMENTS.md optional
  }
  return reqs;
}

/**
 * Parse roadmap phase section for: goal, requirements IDs, success criteria, depends_on.
 * @param {string} cwd
 * @param {string} phaseNum
 * @returns {{goal: string|null, requirements: string[], success_criteria: string[], depends_on: string, phase_name: string}}
 */
function getRoadmapPhaseData(cwd, phaseNum) {
  const roadmapData = getRoadmapPhaseInternal(cwd, phaseNum);
  if (!roadmapData) return { goal: null, requirements: [], success_criteria: [], depends_on: '', phase_name: '' };

  const section = roadmapData.section || '';

  // Extract requirements from "**Requirements:** SCAF-01, SCAF-02" pattern
  const reqMatch = section.match(/\*\*Requirements?\*\*:?\s*([^\n]+)/i);
  const requirements = reqMatch
    ? reqMatch[1].split(/[,\s]+/).map(r => r.trim()).filter(r => /^[A-Z]+-\d+$/.test(r))
    : [];

  // Extract success criteria (numbered list)
  const criteriaMatch = section.match(/\*\*Success Criteria\*\*[^\n]*:?\s*\n((?:\s*\d+\.\s*[^\n]+\n?)+)/i);
  const success_criteria = criteriaMatch
    ? criteriaMatch[1].trim().split('\n').map(line => line.replace(/^\s*\d+\.\s*/, '').trim()).filter(Boolean)
    : [];

  // Extract depends_on
  const depsMatch = section.match(/\*\*(?:Depends[- ]?[Oo]n|Dependencies)\*\*:?\s*([^\n]+)/i);
  const depends_on = depsMatch ? depsMatch[1].trim() : '';

  return {
    goal: roadmapData.goal,
    phase_name: roadmapData.phase_name,
    requirements,
    success_criteria,
    depends_on,
  };
}

/**
 * Auto-detect next plan number from existing files in the phase directory.
 * @param {string} phaseDir - Absolute path to the phase directory
 * @param {string} paddedPhase - Zero-padded phase number
 * @returns {string} Next plan number as 2-digit zero-padded string
 */
function detectNextPlanNumber(phaseDir, paddedPhase) {
  try {
    const files = fs.readdirSync(phaseDir);
    const planNums = files
      .map(f => {
        const m = f.match(/^(?:\d+-)?(\d+)-PLAN\.md$/);
        return m ? parseInt(m[1], 10) : null;
      })
      .filter(n => n !== null);
    if (planNums.length === 0) return '01';
    return String(Math.max(...planNums) + 1).padStart(2, '0');
  } catch (e) {
    return '01';
  }
}

function extractLegacyMustHavesFromBody(planContent) {
  const truths = [];
  const artifacts = [];
  const key_links = [];
  const yamlBlockMatch = planContent.match(/```yaml\s*\nmust_haves:\s*\n([\s\S]*?)```/);
  if (yamlBlockMatch) {
    const block = yamlBlockMatch[1];
    // Extract truths
    const truthsSection = block.match(/truths:\s*\n((?:\s+-[^\n]+\n?)*)/);
    if (truthsSection) {
      const lines = truthsSection[1].match(/^\s+-\s+"?([^"\n]+)"?/gm) || [];
      lines.forEach(l => truths.push(l.replace(/^\s+-\s+"?/, '').replace(/"$/, '').trim()));
    }

    // Extract artifacts (path + provides)
    const artifactsSection = block.match(/artifacts:\s*\n((?:\s+[\s\S]*?)(?=\s{4}key_links:|$))/);
    if (artifactsSection) {
      const pathMatches = artifactsSection[1].match(/path:\s*"?([^"\n]+)"?/g) || [];
      const providesMatches = artifactsSection[1].match(/provides:\s*"?([^"\n]+)"?/g) || [];
      pathMatches.forEach((pm, i) => {
        const p = pm.replace(/path:\s*"?/, '').replace(/"$/, '').trim();
        const prov = providesMatches[i]
          ? providesMatches[i].replace(/provides:\s*"?/, '').replace(/"$/, '').trim()
          : '';
        if (p) artifacts.push({ path: p, provides: prov });
      });
    }

    // Extract key_links (from + to + via)
    const linksSection = block.match(/key_links:\s*\n((?:\s+[\s\S]*?)$)/);
    if (linksSection) {
      const fromMatches = linksSection[1].match(/from:\s*"?([^"\n]+)"?/g) || [];
      const toMatches = linksSection[1].match(/to:\s*"?([^"\n]+)"?/g) || [];
      const viaMatches = linksSection[1].match(/via:\s*"?([^"\n]+)"?/g) || [];
      fromMatches.forEach((fm2, i) => {
        const f = fm2.replace(/from:\s*"?/, '').replace(/"$/, '').trim();
        const t = toMatches[i] ? toMatches[i].replace(/to:\s*"?/, '').replace(/"$/, '').trim() : '';
        const v = viaMatches[i] ? viaMatches[i].replace(/via:\s*"?/, '').replace(/"$/, '').trim() : '';
        if (f) key_links.push({ from: f, to: t, via: v });
      });
    }
  }

  return { truths, artifacts, key_links };
}

/**
 * Extract must_haves from normalized frontmatter metadata, with legacy body fallback.
 */
function extractMustHaves(planContent, planMetadata) {
  if (!planContent) return { truths: [], artifacts: [], key_links: [] };

  const normalized = planMetadata?.mustHaves;
  const truths = normalized?.truths?.items.map(item => item.text) || [];
  const artifacts = normalized?.artifacts?.items.map(item => ({
    path: item.path,
    provides: item.provides || '',
  })) || [];
  const key_links = normalized?.keyLinks?.items.map(item => ({
    from: item.from,
    to: item.to,
    via: item.via || '',
    pattern: item.pattern || null,
  })) || [];

  if (truths.length > 0 || artifacts.length > 0 || key_links.length > 0) {
    return { truths, artifacts, key_links };
  }

  return extractLegacyMustHavesFromBody(planContent);
}

// ─── cmdPlanGenerate ──────────────────────────────────────────────────────────

/**
 * Generate a pre-filled PLAN.md scaffold for a phase.
 * Data sections (Objective, Context, Requirements) are pre-filled from ROADMAP.md.
 * Judgment sections (Must-Haves, Tasks, Verification) have TODO markers.
 * Re-running on an existing file preserves LLM-written judgment sections.
 *
 * @param {string} cwd
 * @param {object} args - Parsed argument object
 * @param {boolean} raw
 */
function cmdPlanGenerate(cwd, args, raw) {
  try {
    const phaseArg = args['phase'];
    if (!phaseArg) {
      output({ error: 'Missing required argument: --phase <N>', fallback: true }, raw);
      return;
    }

    // Resolve phase directory
    const phaseInfo = findPhaseInternal(cwd, phaseArg);
    if (!phaseInfo || !phaseInfo.found) {
      output({ error: `Phase ${phaseArg} not found`, fallback: true }, raw);
      return;
    }

    const paddedPhase = phaseInfo.phase_number;
    const phaseDir = path.join(cwd, phaseInfo.directory);

    // Auto-detect plan number or use provided
    const planArg = args['plan'] ? String(args['plan']).padStart(2, '0') : detectNextPlanNumber(phaseDir, paddedPhase);

    const planType = args['type'] || 'standard';
    const waveArg = args['wave'] || '1';

    // Get roadmap data
    const roadmap = getRoadmapPhaseData(cwd, phaseArg);
    const reqMap = parseRequirements(cwd);

    // Build requirements section
    const reqLines = roadmap.requirements.map(reqId => {
      const reqInfo = reqMap.get(reqId);
      return reqInfo ? `- **${reqId}:** ${reqInfo.description}` : `- **${reqId}**`;
    });

    // Build context references
    const contextRefs = [
      `@.planning/ROADMAP.md`,
      `@.planning/STATE.md`,
    ];
    // Add previous plan summaries if they exist
    try {
      const phaseFiles = fs.readdirSync(phaseDir);
      const summaryFiles = phaseFiles
        .filter(f => f.match(/^\d+-\d+-SUMMARY\.md$/) || f.match(/^SUMMARY\.md$/))
        .sort();
      for (const sf of summaryFiles) {
        contextRefs.push(`@${phaseInfo.directory}/${sf}`);
      }
    } catch (e) { /* phase dir may not exist yet */ }

    // Build depends_on from roadmap
    let dependsOnArr = [];
    if (roadmap.depends_on && roadmap.depends_on !== 'Nothing' && roadmap.depends_on.toLowerCase() !== 'none') {
      // Extract plan IDs like "136-01"
      const planIdMatches = roadmap.depends_on.match(/\d+-\d+/g) || [];
      dependsOnArr = planIdMatches;
    }

    // Frontmatter
    const frontmatter = {
      phase: paddedPhase,
      plan: planArg,
      title: `TODO: Plan ${planArg} title`,
      type: planType,
      requirements: roadmap.requirements,
      depends_on: dependsOnArr,
      files_modified: [],
      estimated_tasks: 2,
      wave: waveArg,
    };

    // Build scaffold sections
    const objectiveContent = markSection(
      roadmap.goal
        ? `This plan contributes to: ${roadmap.goal}\n\nTODO: Describe what specifically this plan accomplishes within that goal.`
        : `TODO: Describe the specific objective of this plan.`,
      'data'
    );

    const contextContent = markSection(
      contextRefs.join('\n'),
      'data'
    );

    const requirementsContent = markSection(
      reqLines.length > 0
        ? reqLines.join('\n')
        : `TODO: List requirement IDs addressed by this plan.`,
      'data'
    );

    const mustHavesContent = markSection(
      `TODO: Define observable truths (what must be true when complete), required artifacts (files created/modified), and key links (wiring connections between components).

\`\`\`yaml
must_haves:
  truths:
    - "TODO: observable truth 1"
  artifacts:
    - path: "TODO: file path"
      provides: "TODO: what this artifact provides"
  key_links:
    - from: "TODO: source"
      to: "TODO: target"
      via: "TODO: how connected"
\`\`\``,
      'judgment'
    );

    const tasksContent = markSection(
      `TODO: Break down the work into 2-4 concrete tasks with clear files, actions, and done criteria.

### Task 1: TODO

- **Type:** auto
- **Files:**
  - \`TODO: file path\` (create|modify)

- **Action:**

  TODO: Describe what to implement.

- **Verify:** TODO: Describe how to verify the task is complete.

- **Done:** TODO: Describe the done state.`,
      'judgment'
    );

    const verificationContent = markSection(
      `TODO: Describe how to verify this plan is complete. Include commands to run, files to check, and expected outputs.`,
      'judgment'
    );

    // Success criteria — data portion pre-filled, judgment for plan-specific additions
    const scLines = roadmap.success_criteria.length > 0
      ? roadmap.success_criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')
      : 'TODO: Define success criteria for this plan.';
    const successCriteriaContent = markSection(
      `From ROADMAP.md phase success criteria:\n\n${scLines}`,
      'data'
    );

    // Assemble the full scaffold
    const fmYaml = formatFrontmatter(frontmatter);
    const planTitle = `Plan ${planArg}: TODO`;

    const freshScaffold = `---\n${fmYaml}\n---\n\n# ${planTitle}\n\n## Objective\n\n${objectiveContent}\n\n## Context\n\n${contextContent}\n\n## Requirements\n\n${requirementsContent}\n\n## Must-Haves\n\n${mustHavesContent}\n\n## Tasks\n\n${tasksContent}\n\n## Verification\n\n${verificationContent}\n\n## Success Criteria\n\n${successCriteriaContent}\n`;

    // Idempotent merge
    const outFileName = `${paddedPhase}-${planArg}-PLAN.md`;
    const outPath = path.join(phaseDir, outFileName);

    let existingContent = null;
    try {
      if (fs.existsSync(outPath)) {
        existingContent = fs.readFileSync(outPath, 'utf8');
      }
    } catch (e) { /* fine */ }

    const finalContent = mergeScaffold(existingContent, freshScaffold, PLAN_JUDGMENT_SECTIONS);

    // Ensure phase dir exists
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(outPath, finalContent, 'utf8');

    // Count data/judgment sections (use regex with g flag for global match)
    const dataSectionCount = (finalContent.match(/<!-- data -->/g) || []).length;
    const judgmentSectionCount = (finalContent.match(/<!-- judgment -->/g) || []).length;

    output({
      created: true,
      path: outPath,
      phase: paddedPhase,
      plan: planArg,
      sections: { data: dataSectionCount, judgment: judgmentSectionCount },
    }, raw);

  } catch (e) {
    output({ error: `plan:generate failed: ${e.message}`, fallback: true }, raw);
  }
}

// ─── cmdVerifyGenerate ────────────────────────────────────────────────────────

/**
 * Generate a pre-filled VERIFICATION.md scaffold for a phase.
 * Data sections (Observable Truths, Requirements Coverage) are pre-filled.
 * Judgment sections (Gaps Summary, Result) have TODO markers.
 * Re-running on an existing file preserves LLM-written judgment sections.
 *
 * @param {string} cwd
 * @param {object} args - Parsed argument object
 * @param {boolean} raw
 */
function cmdVerifyGenerate(cwd, args, raw) {
  try {
    const phaseArg = args['phase'];
    if (!phaseArg) {
      output({ error: 'Missing required argument: --phase <N>', fallback: true }, raw);
      return;
    }

    // Resolve phase directory
    const phaseInfo = findPhaseInternal(cwd, phaseArg);
    if (!phaseInfo || !phaseInfo.found) {
      output({ error: `Phase ${phaseArg} not found`, fallback: true }, raw);
      return;
    }

    const paddedPhase = phaseInfo.phase_number;
    const phaseDir = path.join(cwd, phaseInfo.directory);

    // Get roadmap data
    const roadmap = getRoadmapPhaseData(cwd, phaseArg);
    const reqMap = parseRequirements(cwd);

    // Collect must_haves from all PLAN.md files in the phase directory
    const allTruths = [];
    const allArtifacts = [];
    const allKeyLinks = [];
    const metadataContext = createPlanMetadataContext({ cwd });

    try {
      const planFiles = metadataContext.listPhasePlans(phaseArg);
      for (const planMetadata of planFiles) {
        const content = cachedReadFile(path.join(cwd, planMetadata.relativePath));
        if (!content) continue;
        const mh = extractMustHaves(content, planMetadata);
        allTruths.push(...mh.truths);
        allArtifacts.push(...mh.artifacts);
        allKeyLinks.push(...mh.key_links);
      }
    } catch (e) { /* phase dir may be empty */ }

    // Also add success criteria as truths
    const criteriaAsTruths = roadmap.success_criteria;
    const combinedTruths = [...criteriaAsTruths, ...allTruths].filter(Boolean);

    // Build Observable Truths table
    const truthRows = combinedTruths.length > 0
      ? combinedTruths.map((t, i) => `| ${i + 1} | ${t} | pending | |`).join('\n')
      : '| 1 | TODO: Add success criteria | pending | |';

    const observableTruthsContent = `| # | Truth | Status | Notes |\n|---|-------|--------|-------|\n${truthRows}`;

    // Build Required Artifacts table
    const artifactRows = allArtifacts.length > 0
      ? allArtifacts.map(a => `| ${a.path || 'TODO'} | ${a.provides || ''} | pending | |`).join('\n')
      : '| TODO: path | TODO: provides | pending | |';

    const requiredArtifactsContent = `| Path | Provides | Status | Notes |\n|------|----------|--------|-------|\n${artifactRows}`;

    // Build Key Links table
    const keyLinkRows = allKeyLinks.length > 0
      ? allKeyLinks.map(l => `| ${l.from || 'TODO'} | ${l.to || 'TODO'} | ${l.via || ''} | pending | |`).join('\n')
      : '| TODO: from | TODO: to | TODO: via | pending | |';

    const keyLinksContent = `| From | To | Via | Status | Notes |\n|------|----|-----|--------|-------|\n${keyLinkRows}`;

    // Build Requirements Coverage table
    const reqRows = roadmap.requirements.length > 0
      ? roadmap.requirements.map(reqId => {
          const reqInfo = reqMap.get(reqId);
          const desc = reqInfo ? reqInfo.description.substring(0, 80) : 'Unknown requirement';
          const status = reqInfo && reqInfo.complete ? 'complete' : 'pending';
          return `| ${reqId} | ${desc} | ${status} | |`;
        }).join('\n')
      : '| TODO | TODO | pending | |';

    const requirementsCoverageContent = `| Req ID | Description | Status | Notes |\n|--------|-------------|--------|-------|\n${reqRows}`;

    // Total must-haves count for score field
    const mustHavesCount = combinedTruths.length + allArtifacts.length + allKeyLinks.length;

    // Frontmatter
    const frontmatter = {
      phase: paddedPhase,
      name: roadmap.phase_name || `Phase ${paddedPhase}`,
      verified: new Date().toISOString().split('T')[0],
      status: 'pending',
      score: `0/${mustHavesCount} must-haves verified`,
    };

    // Assemble sections with markers
    const goalAchievementContent = `### Observable Truths\n\n${markSection(observableTruthsContent, 'data')}\n\n### Required Artifacts\n\n${markSection(requiredArtifactsContent, 'data')}\n\n### Key Link Verification\n\n${markSection(keyLinksContent, 'data')}`;

    const requirementsCoverageSection = markSection(requirementsCoverageContent, 'data');

    const gapsSummaryContent = markSection(
      `TODO: List any gaps found during verification. For each gap:\n- What was expected\n- What was found\n- Severity (blocking/non-blocking)`,
      'judgment'
    );

    const resultContent = markSection(
      `TODO: Determine overall result:\n- **passed** — all must-haves verified, no blocking gaps\n- **gaps_found** — blocking gaps found, needs gap-closure plan\n- **human_needed** — some items require human verification`,
      'judgment'
    );

    // Assemble full verification scaffold
    const fmYaml = formatFrontmatter(frontmatter);

    const freshScaffold = `---\n${fmYaml}\n---\n\n# Verification: Phase ${paddedPhase} — ${roadmap.phase_name || 'Scaffold Infrastructure'}\n\n## Goal Achievement\n\n${goalAchievementContent}\n\n## Requirements Coverage\n\n${requirementsCoverageSection}\n\n## Gaps Summary\n\n${gapsSummaryContent}\n\n## Result\n\n${resultContent}\n`;

    // Idempotent merge
    const outFileName = `${paddedPhase}-VERIFICATION.md`;
    const outPath = path.join(phaseDir, outFileName);

    let existingContent = null;
    try {
      if (fs.existsSync(outPath)) {
        existingContent = fs.readFileSync(outPath, 'utf8');
      }
    } catch (e) { /* fine */ }

    const finalContent = mergeScaffold(existingContent, freshScaffold, VERIFY_JUDGMENT_SECTIONS);

    // Ensure phase dir exists
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(outPath, finalContent, 'utf8');

    // Count sections (use regex with g flag for global match)
    const dataSectionCount = (finalContent.match(/<!-- data -->/g) || []).length;
    const judgmentSectionCount = (finalContent.match(/<!-- judgment -->/g) || []).length;

    output({
      created: true,
      path: outPath,
      phase: paddedPhase,
      criteria_count: combinedTruths.length,
      requirement_count: roadmap.requirements.length,
      sections: { data: dataSectionCount, judgment: judgmentSectionCount },
    }, raw);

  } catch (e) {
    output({ error: `verify:generate failed: ${e.message}`, fallback: true }, raw);
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  cmdPlanGenerate,
  cmdVerifyGenerate,
  PLAN_JUDGMENT_SECTIONS,
  VERIFY_JUDGMENT_SECTIONS,
};
