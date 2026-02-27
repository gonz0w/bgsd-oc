'use strict';

const { COMMAND_HELP } = require('./lib/constants');
const { error } = require('./lib/output');

// ─── Lazy-loaded command modules ─────────────────────────────────────────────
// Each module is loaded on first use, not at startup. This avoids parsing and
// initializing all 12 command modules when only one command runs per invocation.

const _modules = {};

function lazyState() { return _modules.state || (_modules.state = require('./commands/state')); }
function lazyRoadmap() { return _modules.roadmap || (_modules.roadmap = require('./commands/roadmap')); }
function lazyPhase() { return _modules.phase || (_modules.phase = require('./commands/phase')); }
function lazyVerify() { return _modules.verify || (_modules.verify = require('./commands/verify')); }
function lazyInit() { return _modules.init || (_modules.init = require('./commands/init')); }
function lazyFeatures() { return _modules.features || (_modules.features = require('./commands/features')); }
function lazyMisc() { return _modules.misc || (_modules.misc = require('./commands/misc')); }
function lazyMemory() { return _modules.memory || (_modules.memory = require('./commands/memory')); }
function lazyIntent() { return _modules.intent || (_modules.intent = require('./commands/intent')); }
function lazyEnv() { return _modules.env || (_modules.env = require('./commands/env')); }
function lazyMcp() { return _modules.mcp || (_modules.mcp = require('./commands/mcp')); }
function lazyWorktree() { return _modules.worktree || (_modules.worktree = require('./commands/worktree')); }
function lazyCodebase() { return _modules.codebase || (_modules.codebase = require('./commands/codebase')); }
function lazyGit() { return _modules.git || (_modules.git = require('./lib/git')); }


async function main() {
  const args = process.argv.slice(2);

  // ─── Output Mode: TTY auto-detection + --pretty override ──────────────
  // --pretty: force formatted output even when piped (e.g., | less -R)
  const prettyIdx = args.indexOf('--pretty');
  if (prettyIdx !== -1) {
    global._gsdOutputMode = 'pretty';
    args.splice(prettyIdx, 1);
  }
  // Auto-detect: TTY → formatted, piped → json
  if (global._gsdOutputMode === undefined) {
    global._gsdOutputMode = process.stdout.isTTY ? 'formatted' : 'json';
  }

  // Backward compat: accept --raw silently (no-op, auto-detection handles it)
  const rawIndex = args.indexOf('--raw');
  if (rawIndex !== -1) args.splice(rawIndex, 1);
  // Legacy: all command handlers still receive `raw` parameter.
  // In piped mode (json/no-TTY), this is true. Commands that haven't been
  // migrated to output(result, { formatter }) will use this to produce JSON.
  const raw = global._gsdOutputMode === 'json' || global._gsdOutputMode !== 'pretty' && !process.stdout.isTTY;

  // Parse --fields global flag for JSON output filtering
  const fieldsIdx = args.indexOf('--fields');
  if (fieldsIdx !== -1) {
    const fieldsValue = args[fieldsIdx + 1];
    const requestedFields = fieldsValue ? fieldsValue.split(',') : null;
    args.splice(fieldsIdx, 2); // Remove --fields and its value from args
    if (requestedFields) {
      global._gsdRequestedFields = requestedFields;
    }
  }

  // Parse --verbose global flag (default is compact mode)
  const verboseIdx = args.indexOf('--verbose');
  if (verboseIdx !== -1) {
    global._gsdCompactMode = false;
    args.splice(verboseIdx, 1);
  } else if (global._gsdCompactMode === undefined) {
    global._gsdCompactMode = true;
  }

  // Parse --compact global flag (backward-compat no-op, compact is already default)
  const compactIdx = args.indexOf('--compact');
  if (compactIdx !== -1) {
    global._gsdCompactMode = true;
    args.splice(compactIdx, 1);
  }

  // Parse --manifest global flag for context manifest in compact output
  const manifestIdx = args.indexOf('--manifest');
  if (manifestIdx !== -1) {
    global._gsdManifestMode = true;
    args.splice(manifestIdx, 1);
  }

  const command = args[0];
  const cwd = process.cwd();

  // ─── Profiler: opt-in performance timing via GSD_PROFILE=1 ────────────
  const { startTimer: profStart, endTimer: profEnd, writeBaseline, isProfilingEnabled } = require('./lib/profiler');
  const cmdTimer = profStart('command:' + (command || 'unknown'));

  if (isProfilingEnabled()) {
    const profSub = args[1] && !args[1].startsWith('-') ? args[1] : '';
    process.on('exit', () => {
      profEnd(cmdTimer);
      writeBaseline(cwd, (command || 'unknown') + (profSub ? '-' + profSub : ''));
    });
  }

  if (!command) {
    error('Usage: gsd-tools <command> [args] [--pretty] [--verbose]\nCommands: assertions, codebase, codebase-impact, commit, config-ensure-section, config-get, config-migrate, config-set, context-budget, current-timestamp, env, extract-sections, find-phase, frontmatter, generate-slug, git, history-digest, init, intent, list-todos, mcp, mcp-profile, memory, milestone, phase, phase-plan-index, phases, progress, quick-summary, requirements, resolve-model, roadmap, rollback-info, scaffold, search-decisions, search-lessons, session-diff, state, state-snapshot, summary-extract, template, test-coverage, test-run, todo, token-budget, trace-requirement, validate, validate-config, validate-dependencies, velocity, verify, verify-path-exists, verify-summary, websearch, worktree');
  }

  // --help / -h: print command help to stderr (never contaminates JSON stdout)
  if (args.includes('--help') || args.includes('-h')) {
    // Try compound key first (e.g. "intent validate"), then fall back to command
    const subForHelp = args[1] && !args[1].startsWith('-') ? args[1] : '';
    const compoundKey = subForHelp ? `${command} ${subForHelp}` : '';
    const helpKey = (compoundKey && COMMAND_HELP[compoundKey]) ? compoundKey : (command || '');
    const helpText = COMMAND_HELP[helpKey];
    if (helpText) {
      process.stderr.write(helpText + '\n');
    } else {
      process.stderr.write(`No help available for "${helpKey}". Available commands:\n`);
      process.stderr.write(Object.keys(COMMAND_HELP).sort().join(', ') + '\n');
    }
    process.exit(0);
  }

  switch (command) {
    case 'state': {
      const subcommand = args[1];
      if (subcommand === 'update') {
        lazyState().cmdStateUpdate(cwd, args[2], args[3]);
      } else if (subcommand === 'get') {
        lazyState().cmdStateGet(cwd, args[2], raw);
      } else if (subcommand === 'patch') {
        const patches = {};
        for (let i = 2; i < args.length; i += 2) {
          const key = args[i].replace(/^--/, '');
          const value = args[i + 1];
          if (key && value !== undefined) {
            patches[key] = value;
          }
        }
        lazyState().cmdStatePatch(cwd, patches, raw);
      } else if (subcommand === 'advance-plan') {
        lazyState().cmdStateAdvancePlan(cwd, raw);
      } else if (subcommand === 'record-metric') {
        const phaseIdx = args.indexOf('--phase');
        const planIdx = args.indexOf('--plan');
        const durationIdx = args.indexOf('--duration');
        const tasksIdx = args.indexOf('--tasks');
        const filesIdx = args.indexOf('--files');
        lazyState().cmdStateRecordMetric(cwd, {
          phase: phaseIdx !== -1 ? args[phaseIdx + 1] : null,
          plan: planIdx !== -1 ? args[planIdx + 1] : null,
          duration: durationIdx !== -1 ? args[durationIdx + 1] : null,
          tasks: tasksIdx !== -1 ? args[tasksIdx + 1] : null,
          files: filesIdx !== -1 ? args[filesIdx + 1] : null,
        }, raw);
      } else if (subcommand === 'update-progress') {
        lazyState().cmdStateUpdateProgress(cwd, raw);
      } else if (subcommand === 'add-decision') {
        const phaseIdx = args.indexOf('--phase');
        const summaryIdx = args.indexOf('--summary');
        const rationaleIdx = args.indexOf('--rationale');
        lazyState().cmdStateAddDecision(cwd, {
          phase: phaseIdx !== -1 ? args[phaseIdx + 1] : null,
          summary: summaryIdx !== -1 ? args[summaryIdx + 1] : null,
          rationale: rationaleIdx !== -1 ? args[rationaleIdx + 1] : '',
        }, raw);
      } else if (subcommand === 'add-blocker') {
        const textIdx = args.indexOf('--text');
        lazyState().cmdStateAddBlocker(cwd, textIdx !== -1 ? args[textIdx + 1] : null, raw);
      } else if (subcommand === 'resolve-blocker') {
        const textIdx = args.indexOf('--text');
        lazyState().cmdStateResolveBlocker(cwd, textIdx !== -1 ? args[textIdx + 1] : null, raw);
      } else if (subcommand === 'record-session') {
        const stoppedIdx = args.indexOf('--stopped-at');
        const resumeIdx = args.indexOf('--resume-file');
        lazyState().cmdStateRecordSession(cwd, {
          stopped_at: stoppedIdx !== -1 ? args[stoppedIdx + 1] : null,
          resume_file: resumeIdx !== -1 ? args[resumeIdx + 1] : 'None',
        }, raw);
      } else if (subcommand === 'validate') {
        const fix = args.includes('--fix');
        lazyState().cmdStateValidate(cwd, { fix }, raw);
      } else {
        lazyState().cmdStateLoad(cwd, raw);
      }
      break;
    }

    case 'resolve-model': {
      lazyMisc().cmdResolveModel(cwd, args[1], raw);
      break;
    }

    case 'find-phase': {
      lazyMisc().cmdFindPhase(cwd, args[1], raw);
      break;
    }

    case 'commit': {
      const amend = args.includes('--amend');
      const forceFlag = args.includes('--force');
      const message = args[1];
      // Parse --files flag (collect args after --files, stopping at other flags)
      const filesIndex = args.indexOf('--files');
      const files = filesIndex !== -1 ? args.slice(filesIndex + 1).filter(a => !a.startsWith('--')) : [];
      lazyMisc().cmdCommit(cwd, message, files, raw, amend, forceFlag);
      break;
    }

    case 'verify-summary': {
      const summaryPath = args[1];
      const countIndex = args.indexOf('--check-count');
      const checkCount = countIndex !== -1 ? parseInt(args[countIndex + 1], 10) : 2;
      lazyMisc().cmdVerifySummary(cwd, summaryPath, checkCount, raw);
      break;
    }

    case 'template': {
      const subcommand = args[1];
      if (subcommand === 'select') {
        lazyMisc().cmdTemplateSelect(cwd, args[2], raw);
      } else if (subcommand === 'fill') {
        const templateType = args[2];
        const phaseIdx = args.indexOf('--phase');
        const planIdx = args.indexOf('--plan');
        const nameIdx = args.indexOf('--name');
        const typeIdx = args.indexOf('--type');
        const waveIdx = args.indexOf('--wave');
        const fieldsIdx = args.indexOf('--fields');
        lazyMisc().cmdTemplateFill(cwd, templateType, {
          phase: phaseIdx !== -1 ? args[phaseIdx + 1] : null,
          plan: planIdx !== -1 ? args[planIdx + 1] : null,
          name: nameIdx !== -1 ? args[nameIdx + 1] : null,
          type: typeIdx !== -1 ? args[typeIdx + 1] : 'execute',
          wave: waveIdx !== -1 ? args[waveIdx + 1] : '1',
          fields: fieldsIdx !== -1 ? JSON.parse(args[fieldsIdx + 1]) : {},
        }, raw);
      } else {
        error('Unknown template subcommand. Available: select, fill');
      }
      break;
    }

    case 'frontmatter': {
      const subcommand = args[1];
      const file = args[2];
      if (subcommand === 'get') {
        const fieldIdx = args.indexOf('--field');
        lazyMisc().cmdFrontmatterGet(cwd, file, fieldIdx !== -1 ? args[fieldIdx + 1] : null, raw);
      } else if (subcommand === 'set') {
        const fieldIdx = args.indexOf('--field');
        const valueIdx = args.indexOf('--value');
        lazyMisc().cmdFrontmatterSet(cwd, file, fieldIdx !== -1 ? args[fieldIdx + 1] : null, valueIdx !== -1 ? args[valueIdx + 1] : undefined, raw);
      } else if (subcommand === 'merge') {
        const dataIdx = args.indexOf('--data');
        lazyMisc().cmdFrontmatterMerge(cwd, file, dataIdx !== -1 ? args[dataIdx + 1] : null, raw);
      } else if (subcommand === 'validate') {
        const schemaIdx = args.indexOf('--schema');
        lazyMisc().cmdFrontmatterValidate(cwd, file, schemaIdx !== -1 ? args[schemaIdx + 1] : null, raw);
      } else {
        error('Unknown frontmatter subcommand. Available: get, set, merge, validate');
      }
      break;
    }

    case 'verify': {
      const subcommand = args[1];
      if (subcommand === 'plan-structure') {
        lazyVerify().cmdVerifyPlanStructure(cwd, args[2], raw);
      } else if (subcommand === 'phase-completeness') {
        lazyVerify().cmdVerifyPhaseCompleteness(cwd, args[2], raw);
      } else if (subcommand === 'references') {
        lazyVerify().cmdVerifyReferences(cwd, args[2], raw);
      } else if (subcommand === 'commits') {
        lazyVerify().cmdVerifyCommits(cwd, args.slice(2), raw);
      } else if (subcommand === 'artifacts') {
        lazyVerify().cmdVerifyArtifacts(cwd, args[2], raw);
      } else if (subcommand === 'key-links') {
        lazyVerify().cmdVerifyKeyLinks(cwd, args[2], raw);
      } else if (subcommand === 'analyze-plan') {
        lazyVerify().cmdAnalyzePlan(cwd, args[2], raw);
      } else if (subcommand === 'deliverables') {
        const planIdx = args.indexOf('--plan');
        lazyVerify().cmdVerifyDeliverables(cwd, {
          plan: planIdx !== -1 ? args[planIdx + 1] : null,
        }, raw);
      } else if (subcommand === 'requirements') {
        lazyVerify().cmdVerifyRequirements(cwd, {}, raw);
      } else if (subcommand === 'regression') {
        const beforeIdx = args.indexOf('--before');
        const afterIdx = args.indexOf('--after');
        lazyVerify().cmdVerifyRegression(cwd, {
          before: beforeIdx !== -1 ? args[beforeIdx + 1] : null,
          after: afterIdx !== -1 ? args[afterIdx + 1] : null,
        }, raw);
      } else if (subcommand === 'plan-wave') {
        lazyVerify().cmdVerifyPlanWave(cwd, args[2], raw);
      } else if (subcommand === 'plan-deps') {
        lazyVerify().cmdVerifyPlanDeps(cwd, args[2], raw);
      } else if (subcommand === 'quality') {
        const planIdx = args.indexOf('--plan');
        const phaseIdx = args.indexOf('--phase');
        lazyVerify().cmdVerifyQuality(cwd, {
          plan: planIdx !== -1 ? args[planIdx + 1] : null,
          phase: phaseIdx !== -1 ? args[phaseIdx + 1] : null,
        }, raw);
      } else {
        error('Unknown verify subcommand. Available: plan-structure, phase-completeness, references, commits, artifacts, key-links, analyze-plan, deliverables, requirements, regression, plan-wave, plan-deps, quality');
      }
      break;
    }

    case 'generate-slug': {
      lazyMisc().cmdGenerateSlug(args[1], raw);
      break;
    }

    case 'current-timestamp': {
      lazyMisc().cmdCurrentTimestamp(args[1] || 'full', raw);
      break;
    }

    case 'list-todos': {
      lazyMisc().cmdListTodos(cwd, args[1], raw);
      break;
    }

    case 'verify-path-exists': {
      lazyMisc().cmdVerifyPathExists(cwd, args[1], raw);
      break;
    }

    case 'config-ensure-section': {
      lazyMisc().cmdConfigEnsureSection(cwd, raw);
      break;
    }

    case 'config-set': {
      lazyMisc().cmdConfigSet(cwd, args[1], args[2], raw);
      break;
    }

    case 'config-get': {
      lazyMisc().cmdConfigGet(cwd, args[1], raw);
      break;
    }

    case 'config-migrate': {
      lazyMisc().cmdConfigMigrate(cwd, raw);
      break;
    }

    case 'history-digest': {
      const hdLimitIdx = args.indexOf('--limit');
      const hdPhasesIdx = args.indexOf('--phases');
      const hdSlim = args.includes('--slim');
      const hdOptions = {
        limit: hdLimitIdx !== -1 ? parseInt(args[hdLimitIdx + 1], 10) : null,
        phases: hdPhasesIdx !== -1 ? args[hdPhasesIdx + 1].split(',').map(s => s.trim()) : null,
        compact: hdSlim,
      };
      lazyMisc().cmdHistoryDigest(cwd, hdOptions, raw);
      break;
    }

    case 'phases': {
      const subcommand = args[1];
      if (subcommand === 'list') {
        const typeIndex = args.indexOf('--type');
        const phaseIndex = args.indexOf('--phase');
        const options = {
          type: typeIndex !== -1 ? args[typeIndex + 1] : null,
          phase: phaseIndex !== -1 ? args[phaseIndex + 1] : null,
          includeArchived: args.includes('--include-archived'),
        };
        lazyPhase().cmdPhasesList(cwd, options, raw);
      } else {
        error('Unknown phases subcommand. Available: list');
      }
      break;
    }

    case 'roadmap': {
      const subcommand = args[1];
      if (subcommand === 'get-phase') {
        lazyRoadmap().cmdRoadmapGetPhase(cwd, args[2], raw);
      } else if (subcommand === 'analyze') {
        lazyRoadmap().cmdRoadmapAnalyze(cwd, raw);
      } else if (subcommand === 'update-plan-progress') {
        lazyRoadmap().cmdRoadmapUpdatePlanProgress(cwd, args[2], raw);
      } else {
        error('Unknown roadmap subcommand. Available: get-phase, analyze, update-plan-progress');
      }
      break;
    }

    case 'requirements': {
      const subcommand = args[1];
      if (subcommand === 'mark-complete') {
        lazyPhase().cmdRequirementsMarkComplete(cwd, args.slice(2), raw);
      } else {
        error('Unknown requirements subcommand. Available: mark-complete');
      }
      break;
    }

    case 'phase': {
      const subcommand = args[1];
      if (subcommand === 'next-decimal') {
        lazyPhase().cmdPhaseNextDecimal(cwd, args[2], raw);
      } else if (subcommand === 'add') {
        lazyPhase().cmdPhaseAdd(cwd, args.slice(2).join(' '), raw);
      } else if (subcommand === 'insert') {
        lazyPhase().cmdPhaseInsert(cwd, args[2], args.slice(3).join(' '), raw);
      } else if (subcommand === 'remove') {
        const forceFlag = args.includes('--force');
        lazyPhase().cmdPhaseRemove(cwd, args[2], { force: forceFlag }, raw);
      } else if (subcommand === 'complete') {
        lazyPhase().cmdPhaseComplete(cwd, args[2], raw);
      } else {
        error('Unknown phase subcommand. Available: next-decimal, add, insert, remove, complete');
      }
      break;
    }

    case 'milestone': {
      const subcommand = args[1];
      if (subcommand === 'complete') {
        const nameIndex = args.indexOf('--name');
        const archivePhases = args.includes('--archive-phases');
        // Collect --name value (everything after --name until next flag or end)
        let milestoneName = null;
        if (nameIndex !== -1) {
          const nameArgs = [];
          for (let i = nameIndex + 1; i < args.length; i++) {
            if (args[i].startsWith('--')) break;
            nameArgs.push(args[i]);
          }
          milestoneName = nameArgs.join(' ') || null;
        }
        lazyPhase().cmdMilestoneComplete(cwd, args[2], { name: milestoneName, archivePhases }, raw);
      } else {
        error('Unknown milestone subcommand. Available: complete');
      }
      break;
    }

    case 'validate': {
      const subcommand = args[1];
      if (subcommand === 'consistency') {
        lazyVerify().cmdValidateConsistency(cwd, raw);
      } else if (subcommand === 'health') {
        const repairFlag = args.includes('--repair');
        lazyVerify().cmdValidateHealth(cwd, { repair: repairFlag }, raw);
      } else {
        error('Unknown validate subcommand. Available: consistency, health');
      }
      break;
    }

    case 'progress': {
      const subcommand = args[1] || 'json';
      lazyMisc().cmdProgressRender(cwd, subcommand, raw);
      break;
    }

    case 'todo': {
      const subcommand = args[1];
      if (subcommand === 'complete') {
        lazyMisc().cmdTodoComplete(cwd, args[2], raw);
      } else {
        error('Unknown todo subcommand. Available: complete');
      }
      break;
    }

    case 'scaffold': {
      const scaffoldType = args[1];
      const phaseIndex = args.indexOf('--phase');
      const nameIndex = args.indexOf('--name');
      const scaffoldOptions = {
        phase: phaseIndex !== -1 ? args[phaseIndex + 1] : null,
        name: nameIndex !== -1 ? args.slice(nameIndex + 1).join(' ') : null,
      };
      lazyMisc().cmdScaffold(cwd, scaffoldType, scaffoldOptions, raw);
      break;
    }

    case 'init': {
      const workflow = args[1];
      switch (workflow) {
        case 'execute-phase':
          lazyInit().cmdInitExecutePhase(cwd, args[2], raw);
          break;
        case 'plan-phase':
          lazyInit().cmdInitPlanPhase(cwd, args[2], raw);
          break;
        case 'new-project':
          lazyInit().cmdInitNewProject(cwd, raw);
          break;
        case 'new-milestone':
          lazyInit().cmdInitNewMilestone(cwd, raw);
          break;
        case 'quick':
          lazyInit().cmdInitQuick(cwd, args.slice(2).join(' '), raw);
          break;
        case 'resume':
          lazyInit().cmdInitResume(cwd, raw);
          break;
        case 'verify-work':
          lazyInit().cmdInitVerifyWork(cwd, args[2], raw);
          break;
        case 'phase-op':
          lazyInit().cmdInitPhaseOp(cwd, args[2], raw);
          break;
        case 'todos':
          lazyInit().cmdInitTodos(cwd, args[2], raw);
          break;
        case 'milestone-op':
          lazyInit().cmdInitMilestoneOp(cwd, raw);
          break;
        case 'map-codebase':
          lazyInit().cmdInitMapCodebase(cwd, raw);
          break;
        case 'progress':
          lazyInit().cmdInitProgress(cwd, raw);
          break;
        case 'memory':
          lazyInit().cmdInitMemory(cwd, args.slice(2), raw);
          break;
        default:
          error(`Unknown init workflow: ${workflow}\nAvailable: execute-phase, plan-phase, new-project, new-milestone, quick, resume, verify-work, phase-op, todos, milestone-op, map-codebase, progress, memory`);
      }
      break;
    }

    case 'phase-plan-index': {
      lazyMisc().cmdPhasePlanIndex(cwd, args[1], raw);
      break;
    }

    case 'state-snapshot': {
      lazyMisc().cmdStateSnapshot(cwd, raw);
      break;
    }

    case 'summary-extract': {
      const summaryPath = args[1];
      const fieldsIndex = args.indexOf('--fields');
      const fields = fieldsIndex !== -1 ? args[fieldsIndex + 1].split(',') : null;
      lazyMisc().cmdSummaryExtract(cwd, summaryPath, fields, raw);
      break;
    }

    case 'websearch': {
      const query = args[1];
      const limitIdx = args.indexOf('--limit');
      const freshnessIdx = args.indexOf('--freshness');
      await lazyMisc().cmdWebsearch(query, {
        limit: limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 10,
        freshness: freshnessIdx !== -1 ? args[freshnessIdx + 1] : null,
      }, raw);
      break;
    }

    case 'session-diff': {
      lazyFeatures().cmdSessionDiff(cwd, raw);
      break;
    }

    case 'session-summary': {
      lazyFeatures().cmdSessionSummary(cwd, raw);
      break;
    }

    case 'context-budget': {
      const subcommand = args[1];
      if (subcommand === 'baseline') {
        lazyFeatures().cmdContextBudgetBaseline(cwd, raw);
      } else if (subcommand === 'compare') {
        lazyFeatures().cmdContextBudgetCompare(cwd, args[2], raw);
      } else if (subcommand === 'measure') {
        lazyFeatures().cmdContextBudgetMeasure(cwd, raw);
      } else {
        // Existing behavior: treat args[1] as plan/file path
        lazyFeatures().cmdContextBudget(cwd, subcommand, raw);
      }
      break;
    }

    case 'test-run': {
      lazyFeatures().cmdTestRun(cwd, raw);
      break;
    }

    case 'search-decisions': {
      lazyFeatures().cmdSearchDecisions(cwd, args.slice(1).join(' '), raw);
      break;
    }

    case 'validate-dependencies': {
      lazyFeatures().cmdValidateDependencies(cwd, args[1], raw);
      break;
    }

    case 'search-lessons': {
      lazyFeatures().cmdSearchLessons(cwd, args.slice(1).join(' '), raw);
      break;
    }

    case 'codebase': {
      const sub = args[1];
      if (sub === 'analyze') {
        lazyCodebase().cmdCodebaseAnalyze(cwd, args.slice(2), raw);
      } else if (sub === 'status') {
        lazyCodebase().cmdCodebaseStatus(cwd, args.slice(2), raw);
      } else if (sub === 'conventions') {
        lazyCodebase().cmdCodebaseConventions(cwd, args.slice(2), raw);
      } else if (sub === 'rules') {
        lazyCodebase().cmdCodebaseRules(cwd, args.slice(2), raw);
      } else if (sub === 'deps') {
        lazyCodebase().cmdCodebaseDeps(cwd, args.slice(2), raw);
      } else if (sub === 'impact') {
        lazyCodebase().cmdCodebaseImpact(cwd, args.slice(2), raw);
      } else if (sub === 'context') {
        lazyCodebase().cmdCodebaseContext(cwd, args.slice(2), raw);
      } else if (sub === 'lifecycle') {
        lazyCodebase().cmdCodebaseLifecycle(cwd, args.slice(2), raw);
      } else if (sub === 'ast') {
        lazyCodebase().cmdCodebaseAst(cwd, args.slice(2), raw);
      } else if (sub === 'exports') {
        lazyCodebase().cmdCodebaseExports(cwd, args.slice(2), raw);
      } else {
        error('Usage: codebase <analyze|status|conventions|rules|deps|impact|context|lifecycle|ast|exports>');
      }
      break;
    }

    case 'codebase-impact': {
      lazyFeatures().cmdCodebaseImpact(cwd, args.slice(1), raw);
      break;
    }

    case 'rollback-info': {
      lazyFeatures().cmdRollbackInfo(cwd, args[1], raw);
      break;
    }

    case 'velocity': {
      lazyFeatures().cmdVelocity(cwd, raw);
      break;
    }

    case 'trace-requirement': {
      lazyFeatures().cmdTraceRequirement(cwd, args[1], raw);
      break;
    }

    case 'validate-config': {
      lazyFeatures().cmdValidateConfig(cwd, raw);
      break;
    }

    case 'quick-summary': {
      lazyFeatures().cmdQuickTaskSummary(cwd, raw);
      break;
    }

    case 'extract-sections': {
      lazyFeatures().cmdExtractSections(cwd, args.slice(1), raw);
      break;
    }

    case 'test-coverage': {
      lazyFeatures().cmdTestCoverage(cwd, raw);
      break;
    }

    case 'token-budget': {
      lazyFeatures().cmdTokenBudget(cwd, raw);
      break;
    }

    case 'memory': {
      const subcommand = args[1];
      if (subcommand === 'write') {
        const storeIdx = args.indexOf('--store');
        const entryIdx = args.indexOf('--entry');
        lazyMemory().cmdMemoryWrite(cwd, {
          store: storeIdx !== -1 ? args[storeIdx + 1] : null,
          entry: entryIdx !== -1 ? args[entryIdx + 1] : null,
        }, raw);
      } else if (subcommand === 'read') {
        const storeIdx = args.indexOf('--store');
        const limitIdx = args.indexOf('--limit');
        const queryIdx = args.indexOf('--query');
        const phaseIdx = args.indexOf('--phase');
        lazyMemory().cmdMemoryRead(cwd, {
          store: storeIdx !== -1 ? args[storeIdx + 1] : null,
          limit: limitIdx !== -1 ? args[limitIdx + 1] : null,
          query: queryIdx !== -1 ? args[queryIdx + 1] : null,
          phase: phaseIdx !== -1 ? args[phaseIdx + 1] : null,
        }, raw);
      } else if (subcommand === 'list') {
        lazyMemory().cmdMemoryList(cwd, {}, raw);
      } else if (subcommand === 'ensure-dir') {
        lazyMemory().cmdMemoryEnsureDir(cwd);
      } else if (subcommand === 'compact') {
        const storeIdx = args.indexOf('--store');
        const thresholdIdx = args.indexOf('--threshold');
        const dryRun = args.includes('--dry-run');
        lazyMemory().cmdMemoryCompact(cwd, {
          store: storeIdx !== -1 ? args[storeIdx + 1] : null,
          threshold: thresholdIdx !== -1 ? args[thresholdIdx + 1] : null,
          dryRun,
        }, raw);
      } else {
        error('Unknown memory subcommand. Available: write, read, list, ensure-dir, compact');
      }
      break;
    }

    case 'intent': {
      const subcommand = args[1];
      if (subcommand === 'create') {
        lazyIntent().cmdIntentCreate(cwd, args.slice(2), raw);
      } else if (subcommand === 'show') {
        lazyIntent().cmdIntentShow(cwd, args.slice(2), raw);
      } else if (subcommand === 'read') {
        // 'read' is syntactic sugar for 'show --raw' per user decision
        lazyIntent().cmdIntentShow(cwd, args.slice(2), true);
      } else if (subcommand === 'update') {
        lazyIntent().cmdIntentUpdate(cwd, args.slice(2), raw);
      } else if (subcommand === 'validate') {
        lazyIntent().cmdIntentValidate(cwd, args.slice(2), raw);
      } else if (subcommand === 'trace') {
        lazyIntent().cmdIntentTrace(cwd, args.slice(2), raw);
      } else if (subcommand === 'drift') {
        lazyIntent().cmdIntentDrift(cwd, args.slice(2), raw);
      } else {
        error('Unknown intent subcommand. Available: create, show, read, update, validate, trace, drift');
      }
      break;
    }

    case 'env': {
      const subcommand = args[1];
      if (subcommand === 'scan') {
        lazyEnv().cmdEnvScan(cwd, args.slice(2), raw);
      } else if (subcommand === 'status') {
        lazyEnv().cmdEnvStatus(cwd, args.slice(2), raw);
      } else {
        error('Unknown env subcommand. Available: scan, status');
      }
      break;
    }

    case 'mcp-profile': {
      lazyMcp().cmdMcpProfile(cwd, args.slice(1), raw);
      break;
    }

    case 'mcp': {
      const subcommand = args[1];
      if (subcommand === 'profile') {
        lazyMcp().cmdMcpProfile(cwd, args.slice(2), raw);
      } else {
        error('Unknown mcp subcommand. Available: profile');
      }
      break;
    }

    case 'assertions': {
      const subcommand = args[1];
      if (subcommand === 'list') {
        const reqIdx = args.indexOf('--req');
        lazyVerify().cmdAssertionsList(cwd, {
          reqId: reqIdx !== -1 ? args[reqIdx + 1] : null,
        }, raw);
      } else if (subcommand === 'validate') {
        lazyVerify().cmdAssertionsValidate(cwd, raw);
      } else {
        error('Unknown assertions subcommand. Available: list, validate');
      }
      break;
    }

    case 'worktree': {
      const subcommand = args[1];
      if (subcommand === 'create') {
        lazyWorktree().cmdWorktreeCreate(cwd, args[2], raw);
      } else if (subcommand === 'list') {
        lazyWorktree().cmdWorktreeList(cwd, raw);
      } else if (subcommand === 'remove') {
        lazyWorktree().cmdWorktreeRemove(cwd, args[2], raw);
      } else if (subcommand === 'cleanup') {
        lazyWorktree().cmdWorktreeCleanup(cwd, raw);
      } else if (subcommand === 'merge') {
        lazyWorktree().cmdWorktreeMerge(cwd, args[2], raw);
      } else if (subcommand === 'check-overlap') {
        lazyWorktree().cmdWorktreeCheckOverlap(cwd, args[2], raw);
      } else {
        error('Unknown worktree subcommand. Available: create, list, remove, cleanup, merge, check-overlap');
      }
      break;
    }

    case 'git': {
      const gitSub = args[1];
      const gitMod = lazyGit();
      const { output: gitOutput } = require('./lib/output');
      switch (gitSub) {
        case 'log': {
          const countIdx = args.indexOf('--count');
          const sinceIdx = args.indexOf('--since');
          const untilIdx = args.indexOf('--until');
          const authorIdx = args.indexOf('--author');
          const pathIdx = args.indexOf('--path');
          const gitOpts = {
            count: countIdx !== -1 ? parseInt(args[countIdx + 1], 10) : 20,
            since: sinceIdx !== -1 ? args[sinceIdx + 1] : undefined,
            until: untilIdx !== -1 ? args[untilIdx + 1] : undefined,
            author: authorIdx !== -1 ? args[authorIdx + 1] : undefined,
            path: pathIdx !== -1 ? args[pathIdx + 1] : undefined,
          };
          gitOutput(gitMod.structuredLog(cwd, gitOpts), raw);
          break;
        }
        case 'diff-summary': {
          const fromIdx = args.indexOf('--from');
          const toIdx = args.indexOf('--to');
          const dsPathIdx = args.indexOf('--path');
          gitOutput(gitMod.diffSummary(cwd, {
            from: fromIdx !== -1 ? args[fromIdx + 1] : undefined,
            to: toIdx !== -1 ? args[toIdx + 1] : undefined,
            path: dsPathIdx !== -1 ? args[dsPathIdx + 1] : undefined,
          }), raw);
          break;
        }
        case 'blame': {
          gitOutput(gitMod.blame(cwd, args[2]), raw);
          break;
        }
        case 'branch-info': {
          gitOutput(gitMod.branchInfo(cwd), raw);
          break;
        }
        default:
          error('Unknown git subcommand: ' + gitSub + '. Available: log, diff-summary, blame, branch-info');
      }
      break;
    }

    default:
      error(`Unknown command: ${command}`);
  }
}

module.exports = { main };
