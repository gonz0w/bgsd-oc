'use strict';

const fs = require('fs');
const path = require('path');
const { output, error, debugLog } = require('../../lib/output');
const { safeReadFile, cachedReadFile, getRuntimeFreshness } = require('../../lib/helpers');
const { extractFrontmatter } = require('../../lib/frontmatter');
const { banner, sectionHeader, formatTable, summaryLine, color, SYMBOLS, colorByPercent, progressBar, box } = require('../../lib/format');
const { createPlanMetadataContext } = require('../../lib/plan-metadata');
const { buildDefaultConfig, isPlainObject } = require('../../lib/config-contract');
const { MODEL_SETTING_PROFILES, VALID_MODEL_OVERRIDE_AGENTS } = require('../../lib/constants');
const { resolveVerificationRouting } = require('../../lib/decision-rules');

function getMissingMetadataMessage(sectionName) {
  return `must_haves.${sectionName} metadata missing from frontmatter`;
}

function getInconclusiveMetadataMessage(sectionName) {
  return `must_haves.${sectionName} metadata was present but yielded no actionable entries`;
}

function getPlanMetadataContext(cwd) {
  return createPlanMetadataContext({ cwd });
}

function extractCanonicalTddDecision(content) {
  if (!content || typeof content !== 'string') return null;
  const match = content.match(/^>\s*\*\*TDD Decision:\*\*\s*(Selected|Skipped)\b/im);
  return match ? match[1].toLowerCase() : null;
}

function validateModelSettingsContract(rawConfig) {
  const issues = [];
  const modelSettings = rawConfig && isPlainObject(rawConfig.model_settings) ? rawConfig.model_settings : null;
  if (!modelSettings) return issues;

  if (Object.prototype.hasOwnProperty.call(modelSettings, 'default_profile')) {
    const defaultProfile = typeof modelSettings.default_profile === 'string' ? modelSettings.default_profile.trim() : '';
    if (!defaultProfile || !MODEL_SETTING_PROFILES.includes(defaultProfile)) {
      issues.push({
        code: 'W004',
        message: `config.json: model_settings.default_profile must be one of ${MODEL_SETTING_PROFILES.join(', ')}`,
        fix: `Set model_settings.default_profile to one of: ${MODEL_SETTING_PROFILES.join(', ')}`,
      });
    }
  }

  if (Object.prototype.hasOwnProperty.call(modelSettings, 'profiles')) {
    if (!isPlainObject(modelSettings.profiles)) {
      issues.push({
        code: 'W005',
        message: 'config.json: model_settings.profiles must be an object keyed by quality, balanced, and budget',
        fix: 'Set model_settings.profiles to an object with quality/balanced/budget entries containing model ids',
      });
    } else {
      for (const [profileName, profileValue] of Object.entries(modelSettings.profiles)) {
        if (!MODEL_SETTING_PROFILES.includes(profileName)) {
          issues.push({
            code: 'W005',
            message: `config.json: model_settings.profiles.${profileName} is not supported`,
            fix: `Use only built-in profile keys: ${MODEL_SETTING_PROFILES.join(', ')}`,
          });
          continue;
        }

        const modelId = typeof profileValue === 'string'
          ? profileValue.trim()
          : isPlainObject(profileValue) && typeof profileValue.model === 'string'
            ? profileValue.model.trim()
            : '';
        if (!modelId) {
          issues.push({
            code: 'W005',
            message: `config.json: model_settings.profiles.${profileName} must define a non-empty model id`,
            fix: `Set model_settings.profiles.${profileName}.model to the concrete model id to use for ${profileName}`,
          });
        }
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(modelSettings, 'agent_overrides')) {
    if (!isPlainObject(modelSettings.agent_overrides)) {
      issues.push({
        code: 'W006',
        message: 'config.json: model_settings.agent_overrides must be an object keyed by canonical agent ids',
        fix: 'Set model_settings.agent_overrides to an object like { "bgsd-executor": "ollama/qwen3-coder:latest" }',
      });
    } else {
      for (const [agentId, overrideValue] of Object.entries(modelSettings.agent_overrides)) {
        if (!VALID_MODEL_OVERRIDE_AGENTS.includes(agentId)) {
          issues.push({
            code: 'W006',
            message: `config.json: model_settings.agent_overrides.${agentId} is not a recognized canonical agent id`,
            fix: `Use one of: ${VALID_MODEL_OVERRIDE_AGENTS.join(', ')}`,
          });
          continue;
        }

        if (typeof overrideValue !== 'string' || !overrideValue.trim()) {
          issues.push({
            code: 'W006',
            message: `config.json: model_settings.agent_overrides.${agentId} must be a non-empty concrete model id`,
            fix: `Set model_settings.agent_overrides.${agentId} to a non-empty model id string`,
          });
        }
      }
    }
  }

  return issues;
}

function verifyArtifactEntries(context, artifacts) {
  const results = [];
  for (const artifact of artifacts) {
    const evidence = context.workspace.get(artifact.path);
    const check = { path: artifact.path, exists: evidence.exists, issues: [], passed: false };

    if (evidence.exists) {
      const fileContent = evidence.content || '';
      const lineCount = fileContent.split('\n').length;

      if (artifact.min_lines && lineCount < artifact.min_lines) {
        check.issues.push(`Only ${lineCount} lines, need ${artifact.min_lines}`);
      }
      if (artifact.contains && !fileContent.includes(artifact.contains)) {
        check.issues.push(`Missing pattern: ${artifact.contains}`);
      }
      if (artifact.exports) {
        const exports = Array.isArray(artifact.exports) ? artifact.exports : [artifact.exports];
        for (const exp of exports) {
          if (!fileContent.includes(exp)) check.issues.push(`Missing export: ${exp}`);
        }
      }
      check.passed = check.issues.length === 0;
    } else {
      check.issues.push('File not found');
    }

    results.push(check);
  }
  return results;
}

function verifyKeyLinkEntries(context, keyLinks) {
  const results = [];
  for (const link of keyLinks) {
    const check = { from: link.from, to: link.to, via: link.via || '', verified: false, detail: '' };
    const sourceEvidence = context.workspace.get(link.from || '', { includeContent: true });
    const sourceContent = sourceEvidence.content;

    if (!sourceContent) {
      check.detail = 'Source file not found';
    } else if (link.pattern) {
      try {
        const regex = new RegExp(link.pattern);
        if (regex.test(sourceContent)) {
          check.verified = true;
          check.detail = 'Pattern found in source';
        } else {
          const targetEvidence = context.workspace.get(link.to || '', { includeContent: true });
          const targetContent = targetEvidence.content;
          if (targetContent && regex.test(targetContent)) {
            check.verified = true;
            check.detail = 'Pattern found in target';
          } else {
            check.detail = `Pattern "${link.pattern}" not found in source or target`;
          }
        }
      } catch (e) {
        debugLog('verify.keyLinks', 'read failed', e);
        check.detail = `Invalid regex pattern: ${link.pattern}`;
      }
    } else if (sourceContent.includes(link.to || '')) {
      check.verified = true;
      check.detail = 'Target referenced in source';
    } else {
      check.detail = 'Target not referenced in source';
    }

    results.push(check);
  }
  return results;
}

function evaluateMustHavesDimension(cwd, planPath) {
  const context = getPlanMetadataContext(cwd);
  const metadata = context.getPlan(planPath);
  const mustHaves = metadata.mustHaves || {};
  const artifacts = mustHaves.artifacts || { status: 'missing', items: [] };
  const keyLinks = mustHaves.keyLinks || { status: 'missing', items: [] };

  if (mustHaves.status === 'missing' || (artifacts.status === 'missing' && keyLinks.status === 'missing')) {
    return { score: null, detail: 'must_haves metadata missing', status: 'missing' };
  }

  const inconclusiveSections = [];
  if (artifacts.status === 'inconclusive') inconclusiveSections.push('artifacts');
  if (keyLinks.status === 'inconclusive') inconclusiveSections.push('key_links');
  if (inconclusiveSections.length > 0) {
    return {
      score: 0,
      detail: `must_haves metadata inconclusive: ${inconclusiveSections.join(', ')} yielded no actionable entries`,
      status: 'inconclusive',
    };
  }

  const artifactResults = verifyArtifactEntries(context, artifacts.items);
  const linkResults = verifyKeyLinkEntries(context, keyLinks.items);
  const total = artifactResults.length + linkResults.length;
  const verified = artifactResults.filter((item) => item.passed).length + linkResults.filter((item) => item.verified).length;

  if (total === 0) {
    return {
      score: 0,
      detail: 'must_haves metadata inconclusive: no actionable artifacts or key_links found',
      status: 'inconclusive',
    };
  }

  return {
    score: Math.round((verified / total) * 100),
    detail: `${verified}/${total} verified`,
    status: 'present',
  };
}

function parseTaskFiles(filesBlock) {
  if (!filesBlock) return [];
  return filesBlock
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean);
}

function parsePlanTasks(content) {
  const taskPattern = /<task([^>]*)>([\s\S]*?)<\/task>/g;
  const tasks = [];
  let taskMatch;

  while ((taskMatch = taskPattern.exec(content)) !== null) {
    const attrs = taskMatch[1] || '';
    const taskContent = taskMatch[2];
    const nameMatch = taskContent.match(/<name>([\s\S]*?)<\/name>/);
    const filesMatch = taskContent.match(/<files>([\s\S]*?)<\/files>/);
    const actionMatch = taskContent.match(/<action>([\s\S]*?)<\/action>/);
    const verifyMatch = taskContent.match(/<verify>([\s\S]*?)<\/verify>/);
    const doneMatch = taskContent.match(/<done>([\s\S]*?)<\/done>/);

    tasks.push({
      type: (attrs.match(/type=["']([^"']+)["']/) || [])[1] || 'auto',
      name: nameMatch ? nameMatch[1].trim() : 'unnamed',
      files: parseTaskFiles(filesMatch ? filesMatch[1] : ''),
      action: actionMatch ? actionMatch[1].trim() : '',
      verify: verifyMatch ? verifyMatch[1].trim() : '',
      done: doneMatch ? doneMatch[1].trim() : '',
      hasFiles: Boolean(filesMatch),
      hasAction: Boolean(actionMatch),
      hasVerify: Boolean(verifyMatch),
      hasDone: Boolean(doneMatch),
    });
  }

  return tasks;
}

function extractTaggedBlock(content, tagName) {
  if (!content || !tagName) return '';
  const match = content.match(new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return match ? match[1].trim() : '';
}

function normalizeCommandWhitespace(command) {
  return String(command || '')
    .replace(/```(?:[a-z0-9_-]+)?/gi, ' ')
    .replace(/```/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeCommand(command) {
  return normalizeCommandWhitespace(command).match(/(?:"[^"]+"|'[^']+'|`[^`]+`|\S+)/g) || [];
}

function normalizeVerificationSignature(command) {
  const normalized = normalizeCommandWhitespace(command);
  if (!normalized) return '';

  const tokens = tokenizeCommand(normalized);
  const lowered = tokens.map((token) => token.toLowerCase());

  if (lowered[0] === 'npm' && lowered[1] === 'run' && lowered[2] === 'test:file' && lowered[3] === '--') {
    return ['npm', 'run', 'test:file', '--', ...tokens.slice(4).sort()].join(' ');
  }

  if (lowered[0] === 'node' && lowered[1] === '--test') {
    const optionTokens = [];
    const fileTokens = [];
    for (let i = 2; i < tokens.length; i += 1) {
      if (tokens[i].startsWith('-')) optionTokens.push(tokens[i]);
      else fileTokens.push(tokens[i]);
    }
    return ['node', '--test', ...optionTokens, ...fileTokens.sort()].join(' ').trim();
  }

  return normalized.toLowerCase();
}

function extractTaskVerificationCommands(verifyBlock) {
  if (!verifyBlock) return [];

  const commands = [];
  const seen = new Set();
  const addCommand = (value) => {
    const normalized = normalizeCommandWhitespace(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    commands.push(normalized);
  };

  const codeMatches = [...String(verifyBlock).matchAll(/```(?:[a-z0-9_-]+)?\n([\s\S]*?)```/gi)];
  if (codeMatches.length > 0) {
    for (const match of codeMatches) {
      for (const line of match[1].split('\n').map((entry) => entry.trim()).filter(Boolean)) {
        addCommand(line);
      }
    }
    return commands;
  }

  addCommand(verifyBlock);
  return commands;
}

function extractPlanVerificationCommands(content) {
  const block = extractTaggedBlock(content, 'verification');
  if (!block) return [];

  const commands = [];
  const seen = new Set();
  const addCommand = (value) => {
    const normalized = normalizeCommandWhitespace(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    commands.push(normalized);
  };

  const codeMatches = [...block.matchAll(/```(?:[a-z0-9_-]+)?\n([\s\S]*?)```/gi)];
  for (const match of codeMatches) {
    for (const line of match[1].split('\n').map((entry) => entry.trim()).filter(Boolean)) {
      addCommand(line);
    }
  }

  for (const line of block.split('\n')) {
    const runMatch = line.trim().match(/^(?:[-*]|\d+\.)\s*Run:\s*(.+)$/i);
    if (runMatch) addCommand(runMatch[1]);
  }

  return commands;
}

function isBuildVerificationCommand(command) {
  const normalized = normalizeCommandWhitespace(command).toLowerCase();
  return /^(npm run build|pnpm build|yarn build|bun run build)(?:\s|$)/.test(normalized);
}

function isTestVerificationCommand(command) {
  const normalized = normalizeCommandWhitespace(command).toLowerCase();
  return /^(npm run test:file|npm test|pnpm test|yarn test|bun test|node --test|pytest|cargo test|go test)(?:\s|$)/.test(normalized);
}

function describeVerificationLocation(entry) {
  return entry.scope === 'plan' ? '<verification>' : `task '${entry.task}'`;
}

function walkWorkspaceFiles(rootPath, currentPath = rootPath, collected = []) {
  if (!fs.existsSync(currentPath)) return collected;
  const stat = fs.statSync(currentPath);
  if (!stat.isDirectory()) {
    collected.push(path.relative(rootPath, currentPath).replace(/\\/g, '/'));
    return collected;
  }

  for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
    if (entry.isDirectory() && ['.git', '.jj', 'node_modules'].includes(entry.name)) continue;
    walkWorkspaceFiles(rootPath, path.join(currentPath, entry.name), collected);
  }

  return collected;
}

function hasGlobSyntax(candidate) {
  return /[*?\[\]{}]/.test(candidate || '');
}

function globToRegex(pattern) {
  const normalized = pattern.replace(/\\/g, '/');
  let regex = '^';
  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    if (char === '*') {
      if (normalized[i + 1] === '*') {
        regex += '.*';
        i += 1;
      } else {
        regex += '[^/]*';
      }
    } else if (char === '?') {
      regex += '.';
    } else if ('\\.^$+()|{}'.includes(char)) {
      regex += `\\${char}`;
    } else {
      regex += char;
    }
  }
  regex += '$';
  return new RegExp(regex);
}

function matchWorkspaceGlob(cwd, pattern) {
  const matcher = globToRegex(pattern);
  return walkWorkspaceFiles(cwd).filter((candidate) => matcher.test(candidate));
}

function cleanCommandToken(token) {
  return token.replace(/^['"`]/, '').replace(/['"`,.;:)]$/, '').trim();
}

function extractCommandPathCandidates(command) {
  if (!command) return [];
  const tokens = command.match(/(?:"[^"]+"|'[^']+'|`[^`]+`|\S+)/g) || [];
  const seen = new Set();
  const paths = [];

  for (const rawToken of tokens) {
    const token = cleanCommandToken(rawToken);
    if (!token || token.startsWith('-') || token.startsWith('$') || token.startsWith('http')) continue;
    if (/^(node|nodejs|npm|pnpm|yarn|bun|npx|jj|git|bash|sh|python|python3|pytest|cargo|go|mix)$/.test(token)) continue;
    if (!(/[\\/]/.test(token) || /\.[a-z0-9]+$/i.test(token))) continue;
    if (!seen.has(token)) {
      seen.add(token);
      paths.push(token.replace(/^\.\//, ''));
    }
  }

  return paths;
}

function analyzePlanRealism(cwd, fullPath, content, tasks, filesModified) {
  const issues = [];
  const warnings = [];
  const touchedPaths = [];
  const taskFileOrder = new Map();
  const relativePlanPath = path.relative(cwd, fullPath).replace(/\\/g, '/');
  const verificationCommands = [];

  const pushPathIssue = (severity, issue) => {
    (severity === 'warning' ? warnings : issues).push(issue);
  };

  const validatePathReference = (filePath, source, taskName) => {
    if (!filePath) return;
    const normalized = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
    touchedPaths.push({ path: normalized, source, task: taskName || null });

    if (hasGlobSyntax(normalized)) {
      const matches = matchWorkspaceGlob(cwd, normalized);
      if (matches.length === 0) {
        pushPathIssue('blocker', {
          kind: 'stale-path',
          source,
          task: taskName || null,
          path: normalized,
          message: `${source} references glob ${normalized} but it matches no files in the current repo`,
        });
      }
      return;
    }

    const absolutePath = path.join(cwd, normalized);
    if (fs.existsSync(absolutePath)) return;

    const parentDir = path.dirname(absolutePath);
    if (!fs.existsSync(parentDir)) {
      pushPathIssue('blocker', {
        kind: 'stale-path',
        source,
        task: taskName || null,
        path: normalized,
        message: `${source} references ${normalized} but parent directory ${path.relative(cwd, parentDir).replace(/\\/g, '/')} does not exist`,
      });
    }
  };

  for (const filePath of filesModified) validatePathReference(filePath, 'files_modified', null);

  tasks.forEach((task, index) => {
    for (const filePath of task.files) {
      validatePathReference(filePath, 'task.files', task.name);
      const normalized = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
      if (!taskFileOrder.has(normalized)) taskFileOrder.set(normalized, index);
    }
  });

  const commandValidation = require('../../lib/commandDiscovery').validateCommandIntegrity({
    cwd,
    surfaces: [{ surface: 'plan', path: relativePlanPath, content }],
  });
  for (const commandIssue of commandValidation.issues) {
    issues.push({
      kind: commandIssue.kind,
      source: 'commands',
      task: null,
      command: commandIssue.command,
      message: commandIssue.message,
      suggestion: commandIssue.suggestion || null,
      line: commandIssue.line,
    });
  }

  tasks.forEach((task, index) => {
    extractTaskVerificationCommands(task.verify).forEach((command) => {
      verificationCommands.push({
        scope: 'task',
        task: task.name,
        command,
        signature: normalizeVerificationSignature(command),
      });
    });

    const verifyPaths = extractCommandPathCandidates(task.verify);
    for (const verifyPath of verifyPaths) {
      if (hasGlobSyntax(verifyPath)) {
        const matches = matchWorkspaceGlob(cwd, verifyPath);
        if (matches.length === 0) {
          issues.push({
            kind: 'unavailable-validation-step',
            source: 'task.verify',
            task: task.name,
            path: verifyPath,
            message: `Task verify command references ${verifyPath}, but it matches no files in the current repo`,
          });
        }
        continue;
      }

      const normalized = verifyPath.replace(/\\/g, '/').replace(/^\.\//, '');
      const absolutePath = path.join(cwd, normalized);
      if (fs.existsSync(absolutePath)) continue;

      const producerIndex = taskFileOrder.get(normalized);
      if (producerIndex !== undefined && producerIndex > index) {
        issues.push({
          kind: 'task-order-verification-hazard',
          source: 'task.verify',
          task: task.name,
          path: normalized,
          message: `Task verify command depends on ${normalized}, but that file is only created in a later task`,
          producer_task: tasks[producerIndex].name,
        });
      } else if (producerIndex === undefined) {
        issues.push({
          kind: 'unavailable-validation-step',
          source: 'task.verify',
          task: task.name,
          path: normalized,
          message: `Task verify command references ${normalized}, but the file is unavailable in the current repo or plan`,
        });
      }
    }
  });

  extractPlanVerificationCommands(content).forEach((command) => {
    verificationCommands.push({
      scope: 'plan',
      task: null,
      command,
      signature: normalizeVerificationSignature(command),
    });
  });

  const groupedVerification = new Map();
  for (const entry of verificationCommands) {
    if (!entry.signature) continue;
    if (!isBuildVerificationCommand(entry.command) && !isTestVerificationCommand(entry.command)) continue;
    const existing = groupedVerification.get(entry.signature) || [];
    existing.push(entry);
    groupedVerification.set(entry.signature, existing);
  }

  for (const entries of groupedVerification.values()) {
    if (entries.length < 2) continue;
    const locations = Array.from(new Set(entries.map(describeVerificationLocation)));
    warnings.push({
      kind: 'duplicate-verification-command',
      source: 'verification',
      command: entries[0].command,
      locations,
      message: `Verification command \`${entries[0].command}\` repeats in ${locations.join(', ')}. Task <verify> should prove only the delta for that task, while plan <verification> should add only aggregate or final proof not already covered.`,
    });
  }

  const changedPaths = Array.from(new Set([
    ...filesModified,
    ...tasks.flatMap((task) => task.files),
  ].map((entry) => String(entry || '').trim()).filter(Boolean)));
  const runtimeFreshness = getRuntimeFreshness(cwd, changedPaths);
  const buildEntries = verificationCommands.filter((entry) => isBuildVerificationCommand(entry.command));
  if (buildEntries.length > 0 && !runtimeFreshness.checked) {
    const locations = Array.from(new Set(buildEntries.map(describeVerificationLocation)));
    warnings.push({
      kind: 'unnecessary-build-verification',
      source: 'verification',
      command: buildEntries[0].command,
      locations,
      message: `Build verification appears in ${locations.join(', ')}, but the plan does not touch source files that require rebuilt runtime artifact proof. Skip the build or explain the extra signal.`,
    });
  }

  return { issues, warnings, touchedPaths };
}

function cmdVerifyPlanStructure(cwd, filePath, raw) {
  if (!filePath) { error('file path required'); }
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  const content = safeReadFile(fullPath);
  if (!content) { output({ error: 'File not found', path: filePath }, raw); return; }

  const fm = extractFrontmatter(content);
  const errors = [];
  const warnings = [];
  const planMetadata = getPlanMetadataContext(cwd).getPlan(fullPath);
  const mustHaves = planMetadata.mustHaves || { status: 'missing' };

  const required = ['phase', 'plan', 'type', 'wave', 'depends_on', 'files_modified', 'autonomous', 'must_haves'];
  for (const field of required) {
    if (fm[field] === undefined) errors.push(`Missing required frontmatter field: ${field}`);
  }

  const implementationFiles = Array.isArray(fm.files_modified)
    ? fm.files_modified.filter(file => typeof file === 'string' && file.trim() && !file.startsWith('.planning/'))
    : [];
  const routeDecision = resolveVerificationRouting({
    verifier_enabled: true,
    files_modified: fm.files_modified,
    files_modified_count: implementationFiles.length,
    verification_route: fm.verification_route,
    verification_route_reason: fm.verification_route_reason,
  });
  if (implementationFiles.length > 0 && fm.verification_route === undefined) {
    errors.push('Missing required frontmatter field: verification_route');
  }
  if (fm.verification_route !== undefined && !['skip', 'light', 'full'].includes(fm.verification_route)) {
    errors.push('verification_route must be one of: skip, light, full');
  }
  if (routeDecision.metadata?.downgrade?.missing_reason) {
    errors.push(`verification_route_reason required when lowering route below default ${routeDecision.metadata.default_route}`);
  }

  const tasks = parsePlanTasks(content);
  for (const task of tasks) {
    if (task.name === 'unnamed') errors.push('Task missing <name> element');
    if (!task.hasAction) errors.push(`Task '${task.name}' missing <action>`);
    if (!task.hasVerify) warnings.push(`Task '${task.name}' missing <verify>`);
    if (!task.hasDone) warnings.push(`Task '${task.name}' missing <done>`);
    if (!task.hasFiles) warnings.push(`Task '${task.name}' missing <files>`);
  }

  if (tasks.length === 0) warnings.push('No <task> elements found');

  if (fm.wave && parseInt(fm.wave) > 1 && (!fm.depends_on || (Array.isArray(fm.depends_on) && fm.depends_on.length === 0))) {
    warnings.push('Wave > 1 but depends_on is empty');
  }

  const hasCheckpoints = /<task\s+type=["']?checkpoint/.test(content);
  if (hasCheckpoints && fm.autonomous !== 'false' && fm.autonomous !== false) {
    errors.push('Has checkpoint tasks but autonomous is not false');
  }

  const templateCompliance = { valid: true, missing_fields: [], type_issues: [] };
  const planType = fm.type || 'execute';
  const canonicalTddDecision = extractCanonicalTddDecision(content);

  const typeRequiredFields = {
    execute: ['wave', 'depends_on', 'files_modified', 'autonomous', 'requirements', 'must_haves', 'verification_route'],
    tdd: ['wave', 'depends_on', 'files_modified', 'autonomous', 'requirements', 'verification_route'],
  };

  const requiredForType = typeRequiredFields[planType] || typeRequiredFields.execute;
  for (const field of requiredForType) {
    if (fm[field] === undefined) {
      templateCompliance.missing_fields.push(field);
    }
  }

  if (fm.requirements !== undefined) {
    const reqEmpty = (Array.isArray(fm.requirements) && fm.requirements.length === 0) ||
                     (typeof fm.requirements === 'string' && fm.requirements.trim() === '') ||
                     (typeof fm.requirements === 'object' && !Array.isArray(fm.requirements) && Object.keys(fm.requirements).length === 0);
    if (reqEmpty) {
      templateCompliance.type_issues.push('requirements is empty — every plan should map to requirements');
    }
  }
  if (routeDecision.metadata?.downgrade?.missing_reason) {
    templateCompliance.type_issues.push(`verification_route_reason required when lowering route below default ${routeDecision.metadata.default_route}`);
  }

  const metadataIssues = [];
  const artifacts = mustHaves.artifacts || { status: 'missing' };
  const keyLinks = mustHaves.keyLinks || { status: 'missing' };
  if (fm.must_haves !== undefined) {
    if (mustHaves.status === 'inconclusive') {
      metadataIssues.push('must_haves metadata is present but not verifier-consumable');
    }
    if (artifacts.status === 'inconclusive') {
      metadataIssues.push(getInconclusiveMetadataMessage('artifacts'));
    }
    if (keyLinks.status === 'inconclusive') {
      metadataIssues.push(getInconclusiveMetadataMessage('key_links'));
    }
    if (artifacts.status === 'missing' && keyLinks.status === 'missing') {
      metadataIssues.push('must_haves verifier-facing metadata needs actionable artifacts or key_links for approval');
    }
  }
  for (const issue of metadataIssues) {
    errors.push(issue);
    templateCompliance.type_issues.push(issue);
  }

  if (planType === 'tdd') {
    if (!/<feature>/.test(content)) {
      templateCompliance.type_issues.push('TDD plan missing <feature> block');
    }
  }

  if (canonicalTddDecision === 'selected' && planType !== 'tdd') {
    const message = 'TDD decision/type mismatch: `> **TDD Decision:** Selected` plans must use `type: tdd`';
    errors.push(message);
    templateCompliance.type_issues.push(message);
  }

  if (canonicalTddDecision === 'skipped' && planType === 'tdd') {
    const message = 'TDD decision/type mismatch: `> **TDD Decision:** Skipped` plans must use `type: execute`';
    errors.push(message);
    templateCompliance.type_issues.push(message);
  }

  for (const task of tasks) {
    if (!task.hasAction) templateCompliance.type_issues.push(`Task '${task.name}' missing <action>`);
    if (!task.hasVerify) templateCompliance.type_issues.push(`Task '${task.name}' missing <verify>`);
    if (!task.hasDone) templateCompliance.type_issues.push(`Task '${task.name}' missing <done>`);
  }

  if (templateCompliance.missing_fields.length > 0 || templateCompliance.type_issues.length > 0) {
    templateCompliance.valid = false;
  }

  output({
    valid: errors.length === 0,
    errors,
    warnings,
    task_count: tasks.length,
    tasks,
    frontmatter_fields: Object.keys(fm),
    template_compliance: templateCompliance,
  }, raw, errors.length === 0 ? 'valid' : 'invalid');
}

function formatVerifyRequirements(result) {
  const lines = [];
  lines.push(banner('Requirements'));
  lines.push('');

  if (result.error) {
    lines.push(box(result.error, 'warning'));
    return lines.join('\n');
  }

  const addressedPercent = result.total > 0 ? Math.round((result.addressed / result.total) * 100) : 0;
  lines.push(`  ${result.addressed}/${result.total} requirements addressed`);
  lines.push('  ' + progressBar(addressedPercent));
  lines.push('');

  if (result.unaddressed_list && result.unaddressed_list.length > 0) {
    lines.push(sectionHeader('Unaddressed'));
    lines.push('');
    const rows = result.unaddressed_list.map(u => [
      SYMBOLS.cross + ' ' + u.id,
      u.phase ? 'Phase ' + u.phase : color.dim('n/a'),
      u.reason || '',
    ]);
    lines.push(formatTable(['ID', 'Phase', 'Reason'], rows));
    lines.push('');
  }

  if (result.assertions) {
    const a = result.assertions;
    lines.push(sectionHeader('Assertions'));
    lines.push('');
    const passStr = color.green(a.verified + ' pass');
    const failStr = a.failed > 0 ? color.red(a.failed + ' fail') : color.dim(a.failed + ' fail');
    const humanStr = a.needs_human > 0 ? color.yellow(a.needs_human + ' needs human') : color.dim(a.needs_human + ' needs human');
    lines.push('  ' + passStr + ', ' + failStr + ', ' + humanStr);
    lines.push('');
  }

  if (result.addressed === result.total) {
    lines.push(summaryLine(SYMBOLS.check + ' All requirements addressed'));
  } else {
    lines.push(summaryLine(result.unaddressed + ' requirements need attention'));
  }

  return lines.join('\n');
}

function cmdVerifyRequirements(cwd, options, raw) {
  const reqPath = path.join(cwd, '.planning', 'REQUIREMENTS.md');
  const content = safeReadFile(reqPath);
  if (!content) {
    output({
      total: 0,
      addressed: 0,
      unaddressed: 0,
      unaddressed_list: [],
      error: 'REQUIREMENTS.md not found',
    }, raw, 'skip');
    return;
  }

  const reqPattern = /- \[(x| )\] \*\*(\w+-\d+)\*\*/g;
  const requirements = [];
  let match;
  while ((match = reqPattern.exec(content)) !== null) {
    requirements.push({
      id: match[2],
      checked: match[1] === 'x',
    });
  }

  const tracePattern = /\| (\w+-\d+) \| Phase (\d+)[^|\n]*\|[^|\n]*\|([^|\n]*)/g;
  const traceMap = {};
  while ((match = tracePattern.exec(content)) !== null) {
    const testCommand = match[3] ? match[3].trim() : null;
    traceMap[match[1]] = { phase: match[2], testCommand: testCommand || null };
  }

  if (Object.keys(traceMap).length === 0) {
    const simpleTracePattern = /\| (\w+-\d+) \| Phase (\d+)/g;
    while ((match = simpleTracePattern.exec(content)) !== null) {
      traceMap[match[1]] = { phase: match[2], testCommand: null };
    }
  }

  const unaddressedList = [];
  let addressedCount = 0;

  for (const req of requirements) {
    if (req.checked) {
      addressedCount++;
      continue;
    }

    const traceEntry = traceMap[req.id];
    const phase = traceEntry ? traceEntry.phase : null;
    if (phase) {
      const normalizedPhase = String(phase).replace(/^0+/, '') || '0';
      const phasesDir = path.join(cwd, '.planning', 'phases');
      let hasSummaries = false;

      try {
        const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const dirMatch = entry.name.match(/^(\d+(?:\.\d+)?)-?(.*)/);
          if (!dirMatch) continue;
          const dirPhaseNum = dirMatch[1].replace(/^0+/, '') || '0';
          if (dirPhaseNum !== normalizedPhase) continue;
          const phaseFiles = fs.readdirSync(path.join(phasesDir, entry.name));
          if (phaseFiles.some(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md')) {
            hasSummaries = true;
          }
          break;
        }
      } catch (e) {
        debugLog('verify.requirements', 'readdir failed', e);
      }

      if (hasSummaries) {
        addressedCount++;
      } else {
        unaddressedList.push({ id: req.id, phase, reason: 'Phase has no summaries' });
      }
    } else {
      unaddressedList.push({ id: req.id, phase: null, reason: 'Not in traceability table' });
    }
  }

  const testCommands = { total: 0, valid: 0, invalid: 0, coverage_percent: 0, commands: [] };
  const knownCommands = new Set(['npm', 'node', 'npx', 'mix', 'go', 'cargo', 'pytest', 'python', 'python3', 'ruby', 'bundle', 'jest', 'mocha', 'vitest']);
  for (const [reqId, entry] of Object.entries(traceMap)) {
    if (entry.testCommand) {
      testCommands.total++;
      const baseCommand = entry.testCommand.split(/\s+/)[0];
      const valid = knownCommands.has(baseCommand);
      if (valid) testCommands.valid++;
      else testCommands.invalid++;
      testCommands.commands.push({ reqId, command: entry.testCommand, valid });
    }
  }
  testCommands.coverage_percent = requirements.length > 0
    ? Math.round((testCommands.total / requirements.length) * 100)
    : 0;

  const assertionsPath = path.join(cwd, '.planning', 'ASSERTIONS.md');
  const assertionsContent = safeReadFile(assertionsPath);
  const allAssertions = assertionsContent ? parseAssertionsMd(assertionsContent) : null;

  let assertionsResult = null;

  if (allAssertions && Object.keys(allAssertions).length > 0) {
    let totalAssertions = 0;
    let verified = 0;
    let failed = 0;
    let needsHuman = 0;
    let mustHavePass = 0;
    let mustHaveFail = 0;
    const byRequirement = {};

    for (const [reqId, data] of Object.entries(allAssertions)) {
      const reqResult = { assertion_count: 0, pass: 0, fail: 0, needs_human: 0, assertions: [] };

      for (const a of data.assertions) {
        totalAssertions++;
        reqResult.assertion_count++;

        let status = 'needs_human';
        let evidence = null;

        if (a.type === 'file') {
          const filePatterns = a.assert.match(/[\w./-]+\.\w{1,10}/g) || [];
          const whenPatterns = a.when ? (a.when.match(/[\w./-]+\.\w{1,10}/g) || []) : [];
          const thenPatterns = a.then ? (a.then.match(/[\w./-]+\.\w{1,10}/g) || []) : [];
          const allPatterns = [...filePatterns, ...whenPatterns, ...thenPatterns];

          if (allPatterns.length > 0) {
            const existingFiles = allPatterns.filter(p => {
              return fs.existsSync(path.join(cwd, p)) ||
                     fs.existsSync(path.join(cwd, '.planning', p)) ||
                     fs.existsSync(path.join(cwd, 'templates', p));
            });
            if (existingFiles.length > 0) {
              status = 'pass';
              evidence = `Files found: ${existingFiles.join(', ')}`;
            } else {
              status = 'fail';
              evidence = `No matching files on disk for: ${allPatterns.join(', ')}`;
            }
          } else {
            status = 'needs_human';
            evidence = 'No file path detected in assertion text';
          }
        } else if (a.type === 'cli') {
          const whenText = (a.when || a.assert || '').toLowerCase();
          const gsdCommands = ['assertions', 'verify', 'trace-requirement', 'env', 'mcp-profile',
            'init', 'state', 'roadmap', 'phase', 'memory', 'intent', 'context-budget',
            'test-run', 'search-decisions', 'validate-dependencies', 'search-lessons',
            'codebase-impact', 'rollback-info', 'velocity', 'validate-config', 'quick-summary',
            'extract-sections', 'test-coverage', 'token-budget', 'session-diff'];
          const matchedCmd = gsdCommands.find(cmd => whenText.includes(cmd));
          if (matchedCmd) {
            status = 'pass';
            evidence = `CLI command "${matchedCmd}" exists in bgsd-tools`;
          } else {
            status = 'needs_human';
            evidence = 'Could not map assertion to a known CLI command';
          }
        }

        if (status === 'pass') {
          verified++;
          reqResult.pass++;
          if (a.priority === 'must-have') mustHavePass++;
        } else if (status === 'fail') {
          failed++;
          reqResult.fail++;
          if (a.priority === 'must-have') mustHaveFail++;
        } else {
          needsHuman++;
          reqResult.needs_human++;
        }

        const assertionEntry = {
          assert: a.assert,
          priority: a.priority,
          type: a.type || null,
          status,
          evidence,
        };

        if (status === 'fail' && a.priority === 'must-have') {
          assertionEntry.gap_description = `[${reqId}] Must-have assertion failed: ${a.assert}`;
        }

        reqResult.assertions.push(assertionEntry);
      }

      byRequirement[reqId] = reqResult;
    }

    const coveragePercent = totalAssertions > 0
      ? Math.round(((verified + failed) / totalAssertions) * 100)
      : 0;

    assertionsResult = {
      total: totalAssertions,
      verified,
      failed,
      needs_human: needsHuman,
      must_have_pass: mustHavePass,
      must_have_fail: mustHaveFail,
      coverage_percent: coveragePercent,
      by_requirement: byRequirement,
    };
  }

  const result = {
    total: requirements.length,
    addressed: addressedCount,
    unaddressed: unaddressedList.length,
    unaddressed_list: unaddressedList,
  };

  if (assertionsResult) {
    result.assertions = assertionsResult;
  }

  if (testCommands.total > 0) {
    result.test_commands = testCommands;
  }

  let rawValue;
  if (assertionsResult) {
    rawValue = `${requirements.length} reqs (${addressedCount} addressed), ${assertionsResult.total} assertions (${assertionsResult.verified} pass, ${assertionsResult.failed} fail, ${assertionsResult.needs_human} human)`;
  } else {
    rawValue = unaddressedList.length === 0 ? 'pass' : 'fail';
  }

  output(result, { formatter: formatVerifyRequirements, rawValue });
}

function parseAssertionsMd(content) {
  if (!content || typeof content !== 'string') return {};

  const result = {};
  const sections = content.split(/^## /m).slice(1);

  for (const section of sections) {
    const lines = section.split('\n');
    const heading = lines[0].trim();

    const idMatch = heading.match(/^([A-Z][\w]+-\d+)\s*:\s*(.+)/);
    if (!idMatch) continue;

    const reqId = idMatch[1];
    const description = idMatch[2].trim();
    const assertions = [];
    let current = null;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      const assertMatch = line.match(/^- assert:\s*"?([^"]*)"?\s*$/);
      if (assertMatch) {
        if (current) assertions.push(current);
        current = {
          assert: assertMatch[1].trim(),
          when: null,
          then: null,
          type: null,
          priority: 'must-have',
        };
        continue;
      }

      if (current) {
        const fieldMatch = line.match(/^\s+(when|then|type|priority):\s*"?([^"]*)"?\s*$/);
        if (fieldMatch) {
          const key = fieldMatch[1];
          const val = fieldMatch[2].trim();
          if (key === 'priority') {
            current.priority = (val === 'nice-to-have') ? 'nice-to-have' : 'must-have';
          } else {
            current[key] = val || null;
          }
        }
      }
    }
    if (current) assertions.push(current);

    result[reqId] = { description, assertions };
  }

  return result;
}

function cmdAssertionsList(cwd, options, raw) {
  const assertionsPath = path.join(cwd, '.planning', 'ASSERTIONS.md');
  const content = safeReadFile(assertionsPath);
  if (!content) {
    output({ error: 'ASSERTIONS.md not found', path: '.planning/ASSERTIONS.md' }, raw, 'ASSERTIONS.md not found');
    return;
  }

  const parsed = parseAssertionsMd(content);

  const reqId = options && options.reqId;
  const requirements = {};
  let totalAssertions = 0;
  let mustHaveCount = 0;
  let niceToHaveCount = 0;

  for (const [id, data] of Object.entries(parsed)) {
    if (reqId && id !== reqId) continue;
    const assertions = data.assertions || [];
    const must = assertions.filter(a => a.priority === 'must-have').length;
    const nice = assertions.filter(a => a.priority === 'nice-to-have').length;
    totalAssertions += assertions.length;
    mustHaveCount += must;
    niceToHaveCount += nice;
    requirements[id] = {
      description: data.description,
      assertion_count: assertions.length,
      assertions,
    };
  }

  const totalRequirements = Object.keys(requirements).length;
  const rawValue = `${totalRequirements} requirements, ${totalAssertions} assertions (${mustHaveCount} must-have, ${niceToHaveCount} nice-to-have)`;

  output({
    total_requirements: totalRequirements,
    total_assertions: totalAssertions,
    must_have_count: mustHaveCount,
    nice_to_have_count: niceToHaveCount,
    requirements,
  }, raw, rawValue);
}

function cmdAssertionsValidate(cwd, raw) {
  const assertionsPath = path.join(cwd, '.planning', 'ASSERTIONS.md');
  const content = safeReadFile(assertionsPath);
  if (!content) {
    output({ error: 'ASSERTIONS.md not found', path: '.planning/ASSERTIONS.md' }, raw, 'ASSERTIONS.md not found');
    return;
  }

  const parsed = parseAssertionsMd(content);
  const issues = [];

  const reqPath = path.join(cwd, '.planning', 'REQUIREMENTS.md');
  const reqContent = safeReadFile(reqPath);
  const reqIds = new Set();
  if (reqContent) {
    const reqPattern = /- \[(x| )\] \*\*(\w+-\d+)\*\*/g;
    let m;
    while ((m = reqPattern.exec(reqContent)) !== null) {
      reqIds.add(m[2]);
    }
  }

  const validTypes = new Set(['api', 'cli', 'file', 'behavior']);
  const validPriorities = new Set(['must-have', 'nice-to-have']);
  let totalAssertions = 0;

  for (const [reqId, data] of Object.entries(parsed)) {
    if (reqIds.size > 0 && !reqIds.has(reqId)) {
      issues.push({ reqId, issue: `Requirement ${reqId} not found in REQUIREMENTS.md`, severity: 'warning' });
    }

    const assertions = data.assertions || [];
    totalAssertions += assertions.length;

    if (assertions.length < 2) {
      issues.push({ reqId, issue: `Only ${assertions.length} assertion(s), recommended 2-5`, severity: 'info' });
    } else if (assertions.length > 5) {
      issues.push({ reqId, issue: `${assertions.length} assertions, recommended max 5`, severity: 'info' });
    }

    for (let i = 0; i < assertions.length; i++) {
      const a = assertions[i];

      if (!a.assert || !a.assert.trim()) {
        issues.push({ reqId, issue: `Assertion ${i + 1} has empty assert field`, severity: 'error' });
      }

      if (a.type && !validTypes.has(a.type)) {
        issues.push({ reqId, issue: `Assertion ${i + 1} has invalid type "${a.type}"`, severity: 'error' });
      }

      if (a.priority && !validPriorities.has(a.priority)) {
        issues.push({ reqId, issue: `Assertion ${i + 1} has invalid priority "${a.priority}"`, severity: 'error' });
      }
    }
  }

  const assertionReqCount = Object.keys(parsed).length;
  const totalReqs = reqIds.size || assertionReqCount;
  const coveragePercent = totalReqs > 0 ? Math.round((assertionReqCount / totalReqs) * 100) : 0;

  const valid = issues.filter(i => i.severity === 'error').length === 0;
  const rawValue = valid ? 'valid' : `${issues.length} issues found`;

  output({
    valid,
    issues,
    stats: {
      total_reqs: totalReqs,
      total_assertions: totalAssertions,
      reqs_with_assertions: assertionReqCount,
      coverage_percent: coveragePercent,
    },
  }, raw, rawValue);
}

function cmdVerifyDeliverables(cwd, options, raw) {
  const { execSync } = require('child_process');
  const { loadConfig } = require('../../lib/config');

  let testCommand = null;
  let framework = null;

  const config = loadConfig(cwd);
  if (config.test_commands && typeof config.test_commands === 'object') {
    const keys = Object.keys(config.test_commands);
    if (keys.length > 0) {
      framework = keys[0];
      testCommand = config.test_commands[framework];
    }
  }

  if (!testCommand) {
    if (fs.existsSync(path.join(cwd, 'package.json'))) {
      framework = 'npm';
      testCommand = 'npm test';
    } else if (fs.existsSync(path.join(cwd, 'mix.exs'))) {
      framework = 'mix';
      testCommand = 'mix test';
    } else if (fs.existsSync(path.join(cwd, 'go.mod'))) {
      framework = 'go';
      testCommand = 'go test ./...';
    }
  }

  if (!testCommand) {
    output({
      test_result: 'skip',
      tests_passed: 0,
      tests_failed: 0,
      tests_total: 0,
      framework: null,
      verdict: 'skip',
      reason: 'No test framework detected',
    }, raw, 'skip');
    return;
  }

  let testOutput = '';
  let testExitCode = 0;
  try {
    testOutput = execSync(testCommand, {
      cwd,
      encoding: 'utf-8',
      timeout: 60000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    testExitCode = err.status || 1;
    testOutput = (err.stdout || '') + '\n' + (err.stderr || '');
  }

  let testsPassed = 0;
  let testsFailed = 0;
  let testsTotal = 0;

  const passMatch = testOutput.match(/(\d+)\s+pass(?:ing|ed)?/i) || testOutput.match(/pass\s+(\d+)/i);
  const failMatch = testOutput.match(/(\d+)\s+fail(?:ing|ed|ure)?/i) || testOutput.match(/fail\s+(\d+)/i);
  const totalMatch = testOutput.match(/(?:tests?|suites?)\s+(\d+)/i) || testOutput.match(/(\d+)\s+tests?/i);

  if (passMatch) testsPassed = parseInt(passMatch[1], 10);
  if (failMatch) testsFailed = parseInt(failMatch[1], 10);
  if (totalMatch) testsTotal = parseInt(totalMatch[1], 10);

  if (testsTotal === 0 && (testsPassed > 0 || testsFailed > 0)) {
    testsTotal = testsPassed + testsFailed;
  }

  const testResult = testExitCode === 0 ? 'pass' : 'fail';

  let artifactsOk = true;
  let keyLinksOk = true;
  let artifactChecks = [];
  let keyLinkChecks = [];
  let runtimeFreshness = null;
  if (options && options.plan) {
    const planPath = path.isAbsolute(options.plan) ? options.plan : path.join(cwd, options.plan);
    const planContent = safeReadFile(planPath);
    if (planContent) {
      const frontmatter = extractFrontmatter(planContent);
      const filesModified = Array.isArray(frontmatter.files_modified)
        ? frontmatter.files_modified
        : frontmatter.files_modified
          ? [frontmatter.files_modified]
          : [];
      const context = getPlanMetadataContext(cwd);
      const metadata = context.getPlan(planPath);
      const artifacts = metadata.mustHaves?.artifacts;
      if (artifacts?.status === 'present') {
        artifactChecks = verifyArtifactEntries(context, artifacts.items);
        artifactsOk = artifactChecks.every((artifact) => artifact.passed);
      }

      const keyLinks = metadata.mustHaves?.keyLinks;
      if (keyLinks?.status === 'present') {
        keyLinkChecks = verifyKeyLinkEntries(context, keyLinks.items);
        keyLinksOk = keyLinkChecks.every((link) => link.verified);
      }

      runtimeFreshness = getRuntimeFreshness(cwd, filesModified);
    }
  }

  const runtimeOk = !runtimeFreshness || !runtimeFreshness.checked || !runtimeFreshness.stale;
  const verdict = testResult === 'pass' && artifactsOk && keyLinksOk && runtimeOk ? 'pass' : 'fail';

  output({
    test_result: testResult,
    tests_passed: testsPassed,
    tests_failed: testsFailed,
    tests_total: testsTotal,
    framework,
    artifacts_ok: artifactsOk,
    key_links_ok: keyLinksOk,
    artifact_checks: artifactChecks,
    key_link_checks: keyLinkChecks,
    runtime_freshness: runtimeFreshness,
    verdict,
  }, raw, verdict);
}

function formatVerifyQuality(result) {
  const lines = [];
  lines.push(banner('Quality'));
  lines.push('');

  const scorePct = Math.max(0, Math.min(100, result.score || 0));
  const gradeColor = colorByPercent(scorePct);
  lines.push('  ' + color.bold(gradeColor(result.grade)) + ' ' + gradeColor('(' + scorePct + '/100)'));
  lines.push('');

  const dimNames = { tests: 'Tests', must_haves: 'Must-Haves', requirements: 'Requirements', regression: 'Regression' };
  lines.push(sectionHeader('Dimensions'));
  lines.push('');

  const rows = [];
  for (const [key, dim] of Object.entries(result.dimensions || {})) {
    const name = dimNames[key] || key;
    let scoreStr;
    if (dim.score === null || dim.score === undefined) {
      scoreStr = color.dim('n/a');
    } else {
      const dimColor = colorByPercent(dim.score);
      scoreStr = dimColor(String(dim.score));
    }
    rows.push([name, scoreStr, String(dim.weight) + '%', dim.detail || '']);
  }
  lines.push(formatTable(['Dimension', 'Score', 'Weight', 'Detail'], rows));
  lines.push('');

  const trend = result.trend || 'stable';
  let trendStr;
  if (trend === 'improving') {
    trendStr = color.green('\u2191 improving');
  } else if (trend === 'declining') {
    trendStr = color.red('\u2193 declining');
  } else {
    trendStr = color.dim('\u2192 stable');
  }
  lines.push('  Trend: ' + trendStr);
  lines.push('');

  lines.push(summaryLine('Quality: ' + result.grade + ' (' + scorePct + '/100) \u2014 ' + trend));

  return lines.join('\n');
}

function cmdVerifyQuality(cwd, options, raw) {
  const { execSync } = require('child_process');
  const { loadConfig } = require('../../lib/config');

  const phaseNum = options.phase || null;
  const planPath = options.plan || null;
  const gapDetection = options.gap_detection || false;

  if (gapDetection) {
    return cmdVerifyQualityGapDetection(cwd, raw);
  }

  let testsScore = null;
  let testsDetail = 'no test framework detected';

  const config = loadConfig(cwd);
  let testCommand = null;
  let framework = null;

  if (config.test_commands && typeof config.test_commands === 'object') {
    const keys = Object.keys(config.test_commands);
    if (keys.length > 0) {
      framework = keys[0];
      testCommand = config.test_commands[framework];
    }
  }
  if (!testCommand) {
    if (fs.existsSync(path.join(cwd, 'package.json'))) {
      framework = 'npm';
      testCommand = 'npm test';
    } else if (fs.existsSync(path.join(cwd, 'mix.exs'))) {
      framework = 'mix';
      testCommand = 'mix test';
    } else if (fs.existsSync(path.join(cwd, 'go.mod'))) {
      framework = 'go';
      testCommand = 'go test ./...';
    }
  }

  if (testCommand) {
    let testExitCode = 0;
    let testOutput = '';
    try {
      testOutput = execSync(testCommand, {
        cwd,
        encoding: 'utf-8',
        timeout: 120000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      testExitCode = err.status || 1;
      testOutput = (err.stdout || '') + '\n' + (err.stderr || '');
    }

    if (testExitCode === 0) {
      testsScore = 100;
      const passMatch = testOutput.match(/(\d+)\s+pass(?:ing|ed)?/i) || testOutput.match(/pass\s+(\d+)/i);
      const count = passMatch ? passMatch[1] : '?';
      testsDetail = `all ${count} pass`;
    } else {
      testsScore = 0;
      const failMatch = testOutput.match(/(\d+)\s+fail(?:ing|ed|ure)?/i) || testOutput.match(/fail\s+(\d+)/i);
      const count = failMatch ? failMatch[1] : '?';
      testsDetail = `${count} failing`;
    }
  }

  let mustHavesScore = null;
  let mustHavesDetail = 'no plan specified';

  if (planPath) {
    const fullPlanPath = path.isAbsolute(planPath) ? planPath : path.join(cwd, planPath);
    const planContent = safeReadFile(fullPlanPath);

    if (planContent) {
      const mustHaves = evaluateMustHavesDimension(cwd, fullPlanPath);
      mustHavesScore = mustHaves.score;
      mustHavesDetail = mustHaves.detail;
    } else {
      mustHavesDetail = 'plan file not found';
    }
  }

  let reqScore = null;
  let reqDetail = 'no REQUIREMENTS.md';

  const reqPath = path.join(cwd, '.planning', 'REQUIREMENTS.md');
  const reqContent = safeReadFile(reqPath);
  if (reqContent) {
    const reqPattern = /- \[(x| )\] \*\*(\w+-\d+)\*\*/g;
    const requirements = [];
    let reqMatch;
    while ((reqMatch = reqPattern.exec(reqContent)) !== null) {
      requirements.push({ id: reqMatch[2], checked: reqMatch[1] === 'x' });
    }

    let filteredReqs = requirements;
    if (phaseNum) {
      const tracePattern = /\| (\w+-\d+) \| Phase (\d+)/g;
      const traceMap = {};
      let tm;
      while ((tm = tracePattern.exec(reqContent)) !== null) {
        traceMap[tm[1]] = tm[2];
      }
      const pn = String(parseInt(phaseNum, 10));
      filteredReqs = requirements.filter(r => {
        const mapped = traceMap[r.id];
        return mapped && String(parseInt(mapped, 10)) === pn;
      });
    }

    if (filteredReqs.length > 0) {
      const addressed = filteredReqs.filter(r => r.checked).length;
      reqScore = Math.round((addressed / filteredReqs.length) * 100);
      reqDetail = `${addressed}/${filteredReqs.length} addressed`;
    } else {
      reqDetail = phaseNum ? `no requirements mapped to phase ${phaseNum}` : 'no requirements found';
    }
  }

  let regressionScore = null;
  let regressionDetail = 'no baseline';

  const baselinePath = path.join(cwd, '.planning', 'memory', 'test-baseline.json');
  const baselineContent = safeReadFile(baselinePath);
  if (baselineContent) {
    try {
      const baseline = JSON.parse(baselineContent);
      if (baseline.tests_total !== undefined && baseline.tests_failed !== undefined) {
        regressionScore = baseline.tests_failed === 0 ? 100 : 0;
        regressionDetail = baseline.tests_failed === 0 ? 'no regressions' : `${baseline.tests_failed} regressions`;
      } else if (baseline.tests && Array.isArray(baseline.tests)) {
        const failures = baseline.tests.filter(t => t.status === 'fail').length;
        regressionScore = failures === 0 ? 100 : 0;
        regressionDetail = failures === 0 ? 'no regressions' : `${failures} regressions`;
      }
    } catch (e) {
      debugLog('verify.quality', 'baseline parse failed', e);
      regressionDetail = 'invalid baseline JSON';
    }
  }

  const dimensions = {
    tests: { score: testsScore, weight: 30, detail: testsDetail },
    must_haves: { score: mustHavesScore, weight: 30, detail: mustHavesDetail },
    requirements: { score: reqScore, weight: 20, detail: reqDetail },
    regression: { score: regressionScore, weight: 20, detail: regressionDetail },
  };

  let totalWeight = 0;
  let weightedSum = 0;
  for (const dim of Object.values(dimensions)) {
    if (dim.score !== null) {
      totalWeight += dim.weight;
      weightedSum += dim.score * dim.weight;
    }
  }

  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  let grade;
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';
  else grade = 'F';

  let planId = null;
  if (planPath) {
    const planBase = path.basename(planPath, '.md').replace(/-PLAN$/i, '');
    planId = planBase;
  }

  const memoryDir = path.join(cwd, '.planning', 'memory');
  const scoresPath = path.join(memoryDir, 'quality-scores.json');

  let scores = [];
  const scoresContent = safeReadFile(scoresPath);
  if (scoresContent) {
    try {
      scores = JSON.parse(scoresContent);
      if (!Array.isArray(scores)) scores = [];
    } catch (e) {
      debugLog('verify.quality', 'scores parse failed', e);
      scores = [];
    }
  }

  const entry = {
    phase: phaseNum || (planId ? planId.split('-')[0] : null),
    plan: planId,
    score,
    grade,
    timestamp: new Date().toISOString(),
  };
  scores.push(entry);

  try {
    if (!fs.existsSync(memoryDir)) {
      fs.mkdirSync(memoryDir, { recursive: true });
    }
    fs.writeFileSync(scoresPath, JSON.stringify(scores, null, 2), 'utf-8');
  } catch (e) {
    debugLog('verify.quality', 'write scores failed', e);
  }

  let trend = 'stable';
  if (scores.length >= 3) {
    const last3 = scores.slice(-3);
    const s = last3.map(e => e.score);
    if (s[0] < s[1] && s[1] < s[2]) trend = 'improving';
    else if (s[0] > s[1] && s[1] > s[2]) trend = 'declining';
  }

  output({
    score,
    grade,
    dimensions,
    trend,
    plan: planId,
    phase: phaseNum || (planId ? planId.split('-')[0] : null),
  }, { formatter: formatVerifyQuality });
}

function cmdVerifyQualityGapDetection(cwd, raw) {
  const { execSync } = require('child_process');
  const gaps = [];
  
  try {
    const diffStat = execSync('git diff --stat HEAD~10 --name-only', {
      cwd,
      encoding: 'utf-8',
      timeout: 10000,
    });
    const changedFiles = diffStat.split('\n').filter(f => f.trim());
    
    const sourceFiles = changedFiles.filter(f => 
      f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.jsx') || f.endsWith('.tsx')
    );
    
    for (const file of sourceFiles) {
      const content = safeReadFile(path.join(cwd, file)) || '';
      
      const functionMatches = content.match(/(?:function\s+|const\s+|let\s+|var\s+|async\s+)\s*(\w+)\s*[=\(]/g) || [];
      const functions = functionMatches.map(m => m.replace(/^(?:function\s+|const\s+|let\s+|var\s+|async\s+)\s*/, '').replace(/\s*[=\(].*$/, '')).filter(f => f.length > 0);
      
      const testFilePatterns = [
        file.replace(/\.(js|ts|jsx|tsx)$/, '.test.$1'),
        file.replace(/\.(js|ts|jsx|tsx)$/, '.spec.$1'),
        file.replace(/^src\//, 'src/__tests__/').replace(/\.(js|ts|jsx|tsx)$/, '.test.$1'),
        file.replace(/^src\//, 'src/test/').replace(/\.(js|ts|jsx|tsx)$/, '.test.$1'),
      ];
      
      const hasTest = testFilePatterns.some(p => fs.existsSync(path.join(cwd, p)));
      
      if (!hasTest && functions.length > 0) {
        gaps.push({
          file,
          type: 'no_test_file',
          functions: functions.slice(0, 5),
          description: `No test file found for ${file} (${functions.length} functions)`,
        });
      }
      
      const ifElseMatches = content.match(/if\s*\([^)]+\)\s*\{[\s\S]*?else\s*\{/g) || [];
      for (const match of ifElseMatches) {
        if (!hasTest) {
          gaps.push({
            file,
            type: 'branch_coverage',
            pattern: 'if-else without test coverage',
            description: 'Conditional branches may lack test coverage',
          });
          break;
        }
      }
    }
    
    const testFiles = changedFiles.filter(f => f.includes('.test.') || f.includes('.spec.'));
    const untestedSource = sourceFiles.filter(sf => !testFiles.some(tf => tf.includes(sf.replace(/^src\//, ''))));
    
    if (untestedSource.length > 0) {
      gaps.push({
        type: 'untested_files',
        files: untestedSource,
        description: `${untestedSource.length} source files changed without corresponding test updates`,
      });
    }
    
  } catch (e) {
    debugLog('verify.quality.gap', 'gap detection failed', e);
  }
  
  output({
    gap_detection: true,
    gaps,
    gap_count: gaps.length,
    verdict: gaps.length === 0 ? 'pass' : 'gaps_found',
    note: 'Analyzed recent git changes for test coverage gaps',
  }, raw, gaps.length === 0 ? 'pass' : 'gaps_found');
}

module.exports = {
  // Quality functions
  getMissingMetadataMessage,
  getInconclusiveMetadataMessage,
  validateModelSettingsContract,
  extractCanonicalTddDecision,
  verifyArtifactEntries,
  verifyKeyLinkEntries,
  evaluateMustHavesDimension,
  cmdVerifyPlanStructure,
  cmdVerifyDeliverables,
  cmdVerifyRequirements,
  cmdVerifyQuality,
  cmdVerifyQualityGapDetection,
  cmdAssertionsList,
  cmdAssertionsValidate,
  parseAssertionsMd,
  formatVerifyRequirements,
  formatVerifyQuality,
};
