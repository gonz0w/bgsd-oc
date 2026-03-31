'use strict';

const { output, error } = require('../lib/output');
const { buildReleaseBump, formatReleaseBump } = require('../lib/release/bump');
const { buildReleaseChangelog, formatReleaseChangelog } = require('../lib/release/changelog');
const { executeReleaseTag, formatReleaseTag } = require('../lib/release/mutate');
const { executeReleasePr, formatReleasePr } = require('../lib/release/pr');

const RELEASE_SUBCOMMANDS = new Set(['bump', 'changelog', 'tag', 'pr']);

function parseReleaseArgs(args) {
  const parsed = { override: null, version: null, resume: false, base: 'main', head: null };
  for (let i = 0; i < (args || []).length; i++) {
    const arg = args[i];
    if (arg === '--override' || arg === '--bump') parsed.override = args[++i] || null;
    else if (arg === '--version' || arg === '--set-version') parsed.version = args[++i] || null;
    else if (arg === '--resume') parsed.resume = true;
    else if (arg === '--base') parsed.base = args[++i] || 'main';
    else if (arg === '--head' || arg === '--branch') parsed.head = args[++i] || null;
  }
  return parsed;
}

function formatReleaseScaffold(result) {
  return [
    `${result.command} (${result.status})`,
    '- Release command surface is wired and help-visible.',
    '- Deeper release automation lands in later Phase 148 plans.',
  ].join('\n');
}

function cmdRelease(cwd, subcommand, args, raw) {
  if (!RELEASE_SUBCOMMANDS.has(subcommand)) {
    error('Unknown release subcommand. Available: bump, changelog, tag, pr');
  }

  const options = parseReleaseArgs(args || []);

  if (subcommand === 'bump') {
    output(buildReleaseBump(cwd, options), { formatter: formatReleaseBump, rawValue: raw });
    return;
  }

  if (subcommand === 'changelog') {
    output(buildReleaseChangelog(cwd, options), { formatter: formatReleaseChangelog, rawValue: raw });
    return;
  }

  if (subcommand === 'tag') {
    const result = executeReleaseTag(cwd, options);
    if (result.status !== 'ok') process.exitCode = 1;
    output(result, { formatter: formatReleaseTag, rawValue: raw });
    return;
  }

  if (subcommand === 'pr') {
    const result = executeReleasePr(cwd, options);
    if (result.status !== 'ok') process.exitCode = 1;
    output(result, { formatter: formatReleasePr, rawValue: raw });
    return;
  }

  output({
    command: `release:${subcommand}`,
    status: 'todo',
    advisory: true,
    message: 'Release command surface scaffolded for later Phase 148 plans.',
    args: args || [],
  }, { formatter: formatReleaseScaffold, rawValue: raw });
}

module.exports = {
  cmdRelease,
  parseReleaseArgs,
};
