#!/usr/bin/env node
'use strict';

const CWD = process.cwd();

console.log('=== Comprehensive bGSD Command Test Suite ===\n');
console.log('Testing all commands in both JSON and formatted modes\n');

let passed = 0;
let failed = 0;

function test(name, fn, opts = {}) {
  const modes = opts.modes || ['json', 'pretty'];
  
  for (const mode of modes) {
    try {
      global._gsdOutputMode = mode;
      const originalExit = process.exit;
      process.exit = () => {};
      process.exitCode = undefined;
      fn(mode);
      process.exit = originalExit;
      console.log('✓ ' + name + ' [' + mode + ']');
      passed++;
    } catch (e) {
      console.log('✗ ' + name + ' [' + mode + ']: ' + e.message);
      failed++;
    }
  }
}

function testCommand(name, fn) {
  test(name, fn, { modes: ['json', 'pretty'] });
}

function testJsonOnly(name, fn) {
  test(name, fn, { modes: ['json'] });
}

console.log('\n--- util namespace ---');
testCommand('util:current-timestamp', () => require('./src/commands/misc').cmdCurrentTimestamp(CWD, [], false));
testCommand('util:config-get', () => require('./src/commands/misc').cmdConfigGet(CWD, 'runtime', false));
testCommand('util:config-set', () => require('./src/commands/misc').cmdConfigSet(CWD, 'test.key', 'test-value', false));
testCommand('util:settings', () => require('./src/commands/misc').cmdSettingsList(CWD, false));
testCommand('util:list-todos', () => require('./src/commands/misc').cmdListTodos(CWD, [], false));
testCommand('util:progress', () => require('./src/commands/misc').cmdProgressRender(CWD, 'json', false));
testJsonOnly('util:env:scan', () => require('./src/commands/env').cmdEnvScan(CWD, [], false));
testJsonOnly('util:env:status', () => require('./src/commands/env').cmdEnvStatus(CWD, [], false));
testCommand('util:frontmatter:get', () => require('./src/commands/misc').cmdFrontmatterGet(CWD, '.planning/STATE.md', null, false));
testJsonOnly('util:memory:list', () => require('./src/commands/memory').cmdMemoryList(CWD, {}, false));

console.log('\n--- verify namespace ---');
testJsonOnly('verify:state', () => require('./src/commands/state').cmdStateLoad(CWD, false));
testJsonOnly('verify:plan-structure', () => require('./src/commands/verify').cmdVerifyPlanStructure(CWD, '102-01', false));
testJsonOnly('verify:phase-completeness', () => require('./src/commands/verify').cmdVerifyPhaseCompleteness(CWD, '102', false));
testJsonOnly('verify:requirements', () => require('./src/commands/verify').cmdVerifyRequirements(CWD, [], false));
testJsonOnly('verify:references', () => require('./src/commands/verify').cmdVerifyReferences(CWD, '102-01', false));
testJsonOnly('verify:commits', () => require('./src/commands/verify').cmdVerifyCommits(CWD, [], false));
testJsonOnly('verify:artifacts', () => require('./src/commands/verify').cmdVerifyArtifacts(CWD, '102-01', false));
testJsonOnly('verify:key-links', () => require('./src/commands/verify').cmdVerifyKeyLinks(CWD, '102-01', false));
testJsonOnly('verify:deliverables', () => require('./src/commands/verify').cmdVerifyDeliverables(CWD, [], false));
testJsonOnly('verify:assertions-list', () => require('./src/commands/verify').cmdAssertionsList(CWD, [], false));
testJsonOnly('verify:validate:consistency', () => require('./src/commands/verify').cmdValidateConsistency(CWD, [], false));
testJsonOnly('verify:validate:health', () => require('./src/commands/verify').cmdValidateHealth(CWD, [], false));
testJsonOnly('verify:validate:roadmap', () => require('./src/commands/verify').cmdValidateRoadmap(CWD, [], false));
testJsonOnly('verify:analyze-plan', () => require('./src/commands/verify').cmdAnalyzePlan(CWD, '102-01', false));
testJsonOnly('verify:regression', () => require('./src/commands/verify').cmdVerifyRegression(CWD, { auto: false }, false));
testJsonOnly('verify:quality', () => require('./src/commands/verify').cmdVerifyQuality(CWD, { phase: '102' }, false));
testJsonOnly('verify:plan-wave', () => require('./src/commands/verify').cmdVerifyPlanWave(CWD, '102-01', false));
testJsonOnly('verify:plan-deps', () => require('./src/commands/verify').cmdVerifyPlanDeps(CWD, '102-01', false));
testJsonOnly('verify:token-budget', () => require('./src/commands/features').cmdTokenBudget(CWD, false));

console.log('\n--- plan namespace ---');
testJsonOnly('plan:get-phase', () => require('./src/commands/roadmap').cmdRoadmapGetPhase(CWD, '102', false));
testJsonOnly('plan:roadmap:analyze', () => require('./src/commands/roadmap').cmdRoadmapAnalyze(CWD, [], false));
testJsonOnly('plan:phases-list', () => require('./src/commands/phase').cmdPhasesList(CWD, [], false));
testJsonOnly('plan:phase-next-decimal', () => require('./src/commands/phase').cmdPhaseNextDecimal(CWD, '102', false));
testJsonOnly('plan:intent:show', () => require('./src/commands/intent').cmdIntentShow(CWD, [], false));
testJsonOnly('plan:intent:validate', () => require('./src/commands/intent').cmdIntentValidate(CWD, [], false));
testJsonOnly('plan:intent:trace', () => require('./src/commands/intent').cmdIntentTrace(CWD, [], false));
testJsonOnly('plan:intent:drift', () => require('./src/commands/intent').cmdIntentDrift(CWD, [], false));

console.log('\n--- execute namespace ---');
testCommand('execute:velocity', () => require('./src/commands/features').cmdVelocity(CWD, false));
testCommand('execute:session-summary', () => require('./src/commands/features').cmdSessionSummary(CWD, false));
testJsonOnly('execute:session-diff', () => require('./src/commands/features').cmdSessionDiff(CWD, [], false));
testJsonOnly('execute:test-run', () => require('./src/commands/features').cmdTestRun(CWD, [], false));
testJsonOnly('execute:rollback-info', () => require('./src/commands/features').cmdRollbackInfo(CWD, [], false));
testJsonOnly('execute:validate-config', () => require('./src/commands/features').cmdValidateConfig(CWD, [], false));
testJsonOnly('execute:search-decisions', () => require('./src/commands/features').cmdSearchDecisions(CWD, 'test', false));
testJsonOnly('execute:codebase-impact', () => require('./src/commands/features').cmdCodebaseImpact(CWD, [], false));
testJsonOnly('execute:trace-requirement', () => require('./src/commands/features').cmdTraceRequirement(CWD, 'VIS-07', false));
testJsonOnly('execute:quick-task-summary', () => require('./src/commands/features').cmdQuickTaskSummary(CWD, [], false));
testJsonOnly('execute:test-coverage', () => require('./src/commands/features').cmdTestCoverage(CWD, [], false));
testJsonOnly('execute:audit-orphans', () => require('./src/commands/features').cmdAuditOrphans(CWD, [], false));
testJsonOnly('execute:trajectory:list', () => require('./src/commands/trajectory').cmdTrajectoryList(CWD, [], false));
testJsonOnly('execute:trajectory:dead-ends', () => require('./src/commands/trajectory').cmdTrajectoryDeadEnds(CWD, [], false));

console.log('\n--- milestone namespace ---');
testCommand('milestone:summary', () => require('./src/commands/milestone').cmdMilestoneSummary(CWD, [], false));
testJsonOnly('milestone:info', () => require('./src/commands/milestone').cmdMilestoneInfo(CWD, false));

console.log('\n--- research namespace ---');
testJsonOnly('research:capabilities', () => require('./src/commands/research').cmdResearchCapabilities(CWD, [], false));
testJsonOnly('research:yt-search', () => require('./src/commands/research').cmdResearchYtSearch(CWD, ['test'], false));

console.log('\n--- cache namespace ---');
testJsonOnly('cache:clear', () => require('./src/commands/cache').cmdCacheClear(CWD, [], false));
testJsonOnly('cache:status', () => require('./src/commands/cache').cmdCacheStatus(CWD, [], false));
testJsonOnly('cache:warm', () => require('./src/commands/cache').cmdCacheWarm(CWD, [], false));
testJsonOnly('cache:research-stats', () => require('./src/commands/cache').cmdCacheResearchStats(CWD, [], false));
testJsonOnly('cache:research-clear', () => require('./src/commands/cache').cmdCacheResearchClear(CWD, [], false));

console.log('\n--- init namespace ---');
testJsonOnly('init:new-project', () => require('./src/commands/init').cmdInitNewProject(CWD, [], false));
testJsonOnly('init:new-milestone', () => require('./src/commands/init').cmdInitNewMilestone(CWD, [], false));
testJsonOnly('init:resume', () => require('./src/commands/init').cmdInitResume(CWD, [], false));
testJsonOnly('init:todos', () => require('./src/commands/init').cmdInitTodos(CWD, [], false));
testJsonOnly('init:milestone-op', () => require('./src/commands/init').cmdInitMilestoneOp(CWD, [], false));
testJsonOnly('init:map-codebase', () => require('./src/commands/init').cmdInitMapCodebase(CWD, [], false));
testJsonOnly('init:progress', () => require('./src/commands/init').cmdInitProgress(CWD, [], false));
testJsonOnly('init:memory', () => require('./src/commands/init').cmdInitMemory(CWD, [], false));

console.log('\n--- state commands ---');
testJsonOnly('state:load', () => require('./src/commands/state').cmdStateLoad(CWD, false));
testJsonOnly('state:get', () => require('./src/commands/state').cmdStateGet(CWD, 'phase', false));
testJsonOnly('state:validate', () => require('./src/commands/state').cmdStateValidate(CWD, {}, false));

console.log('\n--- agent commands ---');
testJsonOnly('agent:list', () => require('./src/commands/agent').cmdAgentList(CWD, [], false));
testJsonOnly('agent:validate-contracts', () => require('./src/commands/agent').cmdAgentValidateContracts(CWD, [], false));

console.log('\n--- codebase commands ---');
testJsonOnly('codebase:map', () => require('./src/commands/codebase').cmdCodebaseRepoMap(CWD, [], false));
testJsonOnly('codebase:analyze', () => require('./src/commands/codebase').cmdCodebaseAnalyze(CWD, [], false));

console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
process.exit(0);
