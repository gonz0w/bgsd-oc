'use strict';

const { COMMAND_HELP } = require('./lib/constants');
const { error, output } = require('./lib/output');
const { diagnoseCompileCache } = require('./lib/runtime-capabilities');
const { detectBun, getCachedBunVersion, configGet, configSet } = require('./lib/cli-tools/bun-runtime');
const { loadConfig } = require('./lib/config');
const format = require('./lib/format');
const debug = require('./lib/debug');

// ─── Runtime Detection (Phase 89: Bun runtime detection with config persistence) ────────
// Detect Bun at startup and show runtime banner.
// Uses detectBun() for effective runtime preference (env var > config).
// Caches detection result in config for faster subsequent runs.
let _runtimeDetected = null;
if (!process.env.BGSD_RUNTIME_DETECTED) {
  try {
    const bunStatus = detectBun();
    // Use effective preference from detectBun (handles env var override correctly)
    // If forced via env var or config, use that preference; otherwise default to 'auto'
    let effectivePref = 'auto';
    if (bunStatus.forced) {
      // If forced, derive preference from available flag (false = node, true = bun)
      effectivePref = bunStatus.available ? 'bun' : 'node';
    } else if (bunStatus.available) {
      effectivePref = 'bun';
    }
    _runtimeDetected = {
      preference: effectivePref,
      available: bunStatus.available,
      version: bunStatus.version || getCachedBunVersion(),
      path: bunStatus.path,
      fromConfig: bunStatus.fromConfig || false,
      forced: bunStatus.forced || false
    };
    // Mark as detected to prevent re-execution loops
    process.env.BGSD_RUNTIME_DETECTED = 'true';
  } catch (e) {
    // Silent failure - fall back to Node.js
    _runtimeDetected = { preference: 'auto', available: false, forced: false };
    process.env.BGSD_RUNTIME_DETECTED = 'true';
  }
}

/**
 * Show runtime banner at startup
 * @param {object} runtime - Runtime info from detection
 * @param {boolean} verbose - Whether to show extra details
 */
function showRuntimeBanner(runtime, verbose = false) {
  if (!runtime) return;
  if (!process.stdout.isTTY) return;
  
  const isBun = runtime.available && runtime.preference !== 'node';
  const isFallback = runtime.preference === 'node' || (runtime.preference === 'auto' && !runtime.available);
  
  if (isBun && !runtime.fromConfig) {
    // Bun detected and available (not from config forced)
    console.log('[bGSD] Running with Bun v' + runtime.version);
  } else if (isFallback && runtime.preference === 'node') {
    // User forced Node.js
    console.log('[bGSD] Falling back to Node.js');
  } else if (verbose && isBun && runtime.fromConfig) {
    // Verbose mode: show config-cached info
    console.log('[bGSD] Using Bun (cached v' + runtime.version + ')');
  }
  
  if (verbose && runtime.preference === 'auto' && !runtime.available && !isFallback) {
    console.log('[bGSD] Bun not available, using Node.js');
  }
}

// ─── Compile-cache guard (Phase 79: startup compile-cache acceleration) ────────
// This runs at CLI startup to check if compile-cache should be enabled.
// Uses BGSD_COMPILE_CACHE env var (1=enable, 0=disable, default=disabled).
// Falls back gracefully on unsupported runtimes (RUNT-03 requirement).
// Only shows diagnostic info in verbose mode (BGSD_DEBUG=1).
const _compileCacheDiag = diagnoseCompileCache({ verbose: false });

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
function lazyTrajectory() { return _modules.trajectory || (_modules.trajectory = require('./commands/trajectory')); }
function lazyGit() { return _modules.git || (_modules.git = require('./lib/git')); }
function lazyOrchestration() { return _modules.orchestration || (_modules.orchestration = require('./lib/orchestration')); }
function lazyCache() { return _modules.cache || (_modules.cache = require('./commands/cache')); }
function lazyAgent() { return _modules.agent || (_modules.agent = require('./commands/agent')); }
function lazyResearch() { return _modules.research || (_modules.research = require('./commands/research')); }
function lazyTools() { return _modules.tools || (_modules.tools = require('./commands/tools')); }
function lazyRuntime() { return _modules.runtime || (_modules.runtime = require('./commands/runtime')); }
function lazyMeasure() { return _modules.measure || (_modules.measure = require('./commands/measure')); }
function lazyRecovery() { return _modules.recovery || (_modules.recovery = require('./lib/recovery')); }
function lazyAudit() { return _modules.audit || (_modules.audit = require('./commands/audit')); }
function lazyDecisions() { return _modules.decisions || (_modules.decisions = require('./commands/decisions')); }
function lazyDb() { return _modules.db || (_modules.db = require('./lib/db')); }


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

  // ─── Debug/Trace Flags (Phase 91: Rich TTY Output & Error Handling) ───────────
  // Parse --debug and --trace flags (pass args to allow flag removal)
  debug.parseDebugFlags(args);

  // Parse color flags (--color, --no-color, --force-color)
  // Pass args array so flags can be removed before command extraction
  format.parseColorFlags(args);

  // ─── Runtime Banner ─────────────────────────────────────────────────────────
  // Show runtime info at startup (only in verbose mode or when running with Bun)
  const isVerbose = global._gsdCompactMode === false;
  const showBanner = isVerbose || (_runtimeDetected && _runtimeDetected.available);
  if (showBanner) {
    showRuntimeBanner(_runtimeDetected, isVerbose);
  }

  // Parse --manifest global flag for context manifest in compact output
  const manifestIdx = args.indexOf('--manifest');
  if (manifestIdx !== -1) {
    global._gsdManifestMode = true;
    args.splice(manifestIdx, 1);
  }

  // Parse --no-cache flag: force Map fallback for test parity verification
  const noCacheIdx = args.indexOf('--no-cache');
  if (noCacheIdx !== -1) {
    process.env.BGSD_CACHE_FORCE_MAP = '1';
    args.splice(noCacheIdx, 1);
  }

  // ─── Project-local database initialization (Phase 118: Foundation & Schema) ────
  // Eagerly initialize the project-local SQLite database on every command.
  // Per CONTEXT.md: "DB created eagerly on any command — ensure it exists at startup,
  // no first-use latency surprises."
  // This is separate from the global file-content cache (cache.js).
  try {
    const cwd = process.cwd();
    const db = lazyDb().getDb(cwd);
    // Drain any notices (first-creation, fallback mode, etc.)
    // These are stored for the plugin notification system to pick up
    const notices = db.notices;
    if (notices && notices.length > 0) {
      // Store notices for plugin system to drain via drainPendingContext()
      global._gsdDbNotices = notices;
    }
  } catch (e) {
    // Silent failure — database is a cache, not critical
    if (process.env.BGSD_DEBUG === '1') {
      console.error('[bGSD] Database initialization failed:', e.message);
    }
  }

  // Parse --exact flag: require exact command match, reject fuzzy matches
  const exactIdx = args.indexOf('--exact');
  const exactMatch = exactIdx !== -1;
  if (exactIdx !== -1) {
    args.splice(exactIdx, 1);
  }

  // Parse --defaults flag: use smart defaults for optional parameters
  const defaultsIdx = args.indexOf('--defaults');
  const useDefaults = defaultsIdx !== -1;
  if (defaultsIdx !== -1) {
    args.splice(defaultsIdx, 1);
  }

  // Smart defaults map - applied when --defaults flag is present
  const defaultsMap = {
    phase: 'next',      // Use next incomplete phase
    force: false,       // Don't force by default
    verbose: false,     // Compact output by default
    confirm: true,      // Auto-confirm by default
    recursive: false,   // Non-recursive by default
    includeArchived: false
  };

  // Store defaults flag globally for command handlers to access
  global._bgsdDefaults = useDefaults;
  global._bgsdDefaultsMap = useDefaults ? defaultsMap : null;

  const command = args[0];
  const cwd = process.cwd();

  // ─── Namespace Parsing: support namespace:command syntax ─────────────────────
  // Split on first colon only: "plan:intent" → namespace="plan", cmd="intent"
  // "plan:intent show" → namespace="plan", subcmd="intent show"
  // Also support space-separated: "init execute-phase 79" → namespace="init", subcmd="execute-phase"
  let namespace = null;
  let remainingArgs = args.slice(1);
  
  const KNOWN_NAMESPACES = ['init', 'plan', 'execute', 'verify', 'util', 'research', 'cache', 'audit', 'decisions'];
  
  if (command && command.includes(':')) {
    const colonIdx = command.indexOf(':');
    namespace = command.substring(0, colonIdx);
    const cmdPart = command.substring(colonIdx + 1);
    // Reconstruct args with the command part and remaining args
    if (cmdPart) {
      remainingArgs = [cmdPart, ...remainingArgs];
    }
  } else if (command && KNOWN_NAMESPACES.includes(command)) {
    // Space-separated: "init execute-phase 79" → treat first arg as namespace
    namespace = command;
  }

  if (!command) {
    error('Usage: bgsd-tools <namespace:command> [args] [--pretty] [--verbose]\nCommands: init:<workflow>, plan:<intent|requirements|roadmap|phases|find-phase|milestone|phase>, execute:<commit|rollback-info|session-diff|session-summary|velocity|worktree|tdd|test-run>, verify:<state|verify|assertions|search-decisions|search-lessons|review|context-budget|token-budget>, util:<config-get|config-set|env|current-timestamp|list-todos|todo|memory|mcp|classify|frontmatter|progress|websearch|history-digest|trace-requirement|codebase|cache|agent>, research:<capabilities|yt-search|yt-transcript|collect|nlm-create|nlm-add-source|nlm-ask|nlm-report>');
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

  // ─── Exact Match Mode: reject fuzzy matches ─────────────────────────────────
  // When --exact is provided, only accept exact command matches
  if (exactMatch && command) {
    const { COMMAND_HELP } = require('./lib/constants');
    const { getSimilarCommands } = require('./lib/commandDiscovery');
    
    // Check if this is an exact command in COMMAND_HELP
    const fullCommand = namespace ? `${namespace}:${remainingArgs[0] || ''}` : command;
    const exactCommands = Object.keys(COMMAND_HELP);
    
    // Check for exact match in various formats
    const isExact = 
      exactCommands.includes(fullCommand.replace(/:$/, '')) ||  // plan:phase
      exactCommands.includes(command) ||  // init:execute-phase
      exactCommands.includes(`${command} ${remainingArgs[0]}`) ||  // plan intent
      (namespace && exactCommands.includes(`${namespace}:${remainingArgs.join(' ')}`));  // util classify plan
    
    if (!isExact) {
      // Find similar commands to suggest
      const similar = getSimilarCommands(command);
      const suggestions = similar.slice(0, 5).map(s => s.command).join(', ');
      
      error(`Exact match required but command not found: ${command}

Did you mean: ${suggestions || 'no similar commands found'}?
Use without --exact for fuzzy matching.`);
    }
  }

  // ─── Namespace Routing: route commands to appropriate handlers ──────────────
  // Namespaces: init, plan, execute, verify, util
  if (namespace) {
    const subCmd = remainingArgs[0] || '';
    const restArgs = remainingArgs.slice(1);
    
    // Track command for history (Phase 97: UX Polish)
    trackCommandHistory(namespace, subCmd, restArgs);
    
    switch (namespace) {
      // init namespace
      case 'init': {
        const workflow = subCmd;
        switch (workflow) {
          case 'execute-phase':
            lazyInit().cmdInitExecutePhase(cwd, restArgs[0], raw);
            break;
          case 'plan-phase':
            lazyInit().cmdInitPlanPhase(cwd, restArgs[0], raw);
            break;
          case 'new-project':
            lazyInit().cmdInitNewProject(cwd, raw);
            break;
          case 'new-milestone':
            lazyInit().cmdInitNewMilestone(cwd, raw);
            break;
          case 'quick':
            lazyInit().cmdInitQuick(cwd, restArgs.join(' '), raw);
            break;
          case 'resume':
            lazyInit().cmdInitResume(cwd, raw);
            break;
          case 'verify-work':
            lazyInit().cmdInitVerifyWork(cwd, restArgs[0], raw);
            break;
          case 'phase-op':
            lazyInit().cmdInitPhaseOp(cwd, restArgs[0], raw);
            break;
          case 'todos':
            lazyInit().cmdInitTodos(cwd, restArgs[0], raw);
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
            lazyInit().cmdInitMemory(cwd, restArgs, raw);
            break;
          default:
            error(`Unknown init workflow: ${workflow}\nAvailable: execute-phase, plan-phase, new-project, new-milestone, quick, resume, verify-work, phase-op, todos, milestone-op, map-codebase, progress, memory`);
        }
        break;
      }

      // plan namespace
      case 'plan': {
        const subcommand = subCmd;
        if (subcommand === 'intent') {
          const intentCmd = restArgs[0];
          const intentArgs = restArgs.slice(1);
          if (intentCmd === 'create') {
            lazyIntent().cmdIntentCreate(cwd, intentArgs, raw);
          } else if (intentCmd === 'show') {
            lazyIntent().cmdIntentShow(cwd, intentArgs, raw);
          } else if (intentCmd === 'read') {
            lazyIntent().cmdIntentShow(cwd, intentArgs, true);
          } else if (intentCmd === 'update') {
            lazyIntent().cmdIntentUpdate(cwd, intentArgs, raw);
          } else if (intentCmd === 'validate') {
            lazyIntent().cmdIntentValidate(cwd, intentArgs, raw);
          } else if (intentCmd === 'trace') {
            lazyIntent().cmdIntentTrace(cwd, intentArgs, raw);
          } else if (intentCmd === 'drift') {
            lazyIntent().cmdIntentDrift(cwd, intentArgs, raw);
          } else {
            error('Unknown intent subcommand. Available: create, show, read, update, validate, trace, drift');
          }
        } else if (subcommand === 'requirements') {
          const reqCmd = restArgs[0];
          if (reqCmd === 'mark-complete') {
            lazyPhase().cmdRequirementsMarkComplete(cwd, restArgs.slice(1), raw);
          } else {
            error('Unknown requirements subcommand. Available: mark-complete');
          }
        } else if (subcommand === 'roadmap') {
          const roadCmd = restArgs[0];
          if (roadCmd === 'get-phase') {
            lazyRoadmap().cmdRoadmapGetPhase(cwd, restArgs[1], raw);
          } else if (roadCmd === 'analyze') {
            lazyRoadmap().cmdRoadmapAnalyze(cwd, raw);
          } else if (roadCmd === 'update-plan-progress') {
            lazyRoadmap().cmdRoadmapUpdatePlanProgress(cwd, restArgs[1], raw);
          } else {
            error('Unknown roadmap subcommand. Available: get-phase, analyze, update-plan-progress');
          }
        } else if (subcommand === 'phases') {
          const phaseSub = restArgs[0];
          if (phaseSub === 'list') {
            const typeIndex = restArgs.indexOf('--type');
            const phaseIndex = restArgs.indexOf('--phase');
            const options = {
              type: typeIndex !== -1 ? restArgs[typeIndex + 1] : null,
              phase: phaseIndex !== -1 ? restArgs[phaseIndex + 1] : null,
              includeArchived: restArgs.includes('--include-archived'),
            };
            lazyPhase().cmdPhasesList(cwd, options, raw);
          } else {
            error('Unknown phases subcommand. Available: list');
          }
        } else if (subcommand === 'find-phase') {
          lazyMisc().cmdFindPhase(cwd, restArgs[0], raw);
        } else if (subcommand === 'milestone') {
          const msSub = restArgs[0];
          if (msSub === 'complete') {
            const nameIndex = restArgs.indexOf('--name');
            const archivePhases = restArgs.includes('--archive-phases');
            let milestoneName = null;
            if (nameIndex !== -1) {
              const nameArgs = [];
              for (let i = nameIndex + 1; i < restArgs.length; i++) {
                if (restArgs[i].startsWith('--')) break;
                nameArgs.push(restArgs[i]);
              }
              milestoneName = nameArgs.join(' ') || null;
            }
            const forceFlag = restArgs.includes('--force');
            lazyPhase().cmdMilestoneComplete(cwd, restArgs[1], { name: milestoneName, archivePhases, force: forceFlag }, raw);
          } else if (msSub === 'summary') {
            // Pass remaining args directly to cmdMilestoneSummary
            const summaryArgs = restArgs.slice(1);
            const { cmdMilestoneSummary } = require('./commands/milestone');
            cmdMilestoneSummary(cwd, summaryArgs, raw);
          } else if (msSub === 'info') {
            const { cmdMilestoneInfo } = require('./commands/milestone');
            cmdMilestoneInfo(cwd, raw);
          } else {
            error('Unknown milestone subcommand. Available: complete, summary, info');
          }
        } else if (subcommand === 'phase') {
          const phaseSub = restArgs[0];
          if (phaseSub === 'next-decimal') {
            lazyPhase().cmdPhaseNextDecimal(cwd, restArgs[1], raw);
          } else if (phaseSub === 'add') {
            lazyPhase().cmdPhaseAdd(cwd, restArgs.slice(1).join(' '), raw);
          } else if (phaseSub === 'insert') {
            lazyPhase().cmdPhaseInsert(cwd, restArgs[1], restArgs.slice(2).join(' '), raw);
          } else if (phaseSub === 'remove') {
            const forceFlag = restArgs.includes('--force');
            lazyPhase().cmdPhaseRemove(cwd, restArgs[1], { force: forceFlag }, raw);
          } else if (phaseSub === 'complete') {
            lazyPhase().cmdPhaseComplete(cwd, restArgs[1], raw);
          } else {
            error('Unknown phase subcommand. Available: next-decimal, add, insert, remove, complete');
          }
        } else {
          error(`Unknown plan subcommand: ${subcommand}. Available: intent, requirements, roadmap, phases, find-phase, milestone, phase`);
        }
        break;
      }

      // execute namespace
      case 'execute': {
        const subcommand = subCmd;
        if (subcommand === 'commit') {
          const amend = restArgs.includes('--amend');
          const forceFlag = restArgs.includes('--force');
          const agentIdx = restArgs.indexOf('--agent');
          const agentType = agentIdx !== -1 ? restArgs[agentIdx + 1] : null;
          const tddPhaseIdx = restArgs.indexOf('--tdd-phase');
          const tddPhase = tddPhaseIdx !== -1 ? restArgs[tddPhaseIdx + 1] : null;
          const message = restArgs[0];
          const filesIndex = restArgs.indexOf('--files');
          const files = filesIndex !== -1 ? restArgs.slice(filesIndex + 1).filter(a => !a.startsWith('--')) : [];
          lazyMisc().cmdCommit(cwd, message, files, raw, amend, forceFlag, agentType, tddPhase);
        } else if (subcommand === 'rollback-info') {
          lazyFeatures().cmdRollbackInfo(cwd, restArgs[0], raw);
        } else if (subcommand === 'session-diff') {
          lazyFeatures().cmdSessionDiff(cwd, raw);
        } else if (subcommand === 'session-summary') {
          lazyFeatures().cmdSessionSummary(cwd, raw);
        } else if (subcommand === 'velocity') {
          lazyFeatures().cmdVelocity(cwd, raw);
        } else if (subcommand === 'worktree') {
          const wtSub = restArgs[0];
          if (wtSub === 'create') {
            lazyWorktree().cmdWorktreeCreate(cwd, restArgs[1], raw);
          } else if (wtSub === 'list') {
            lazyWorktree().cmdWorktreeList(cwd, raw);
          } else if (wtSub === 'remove') {
            lazyWorktree().cmdWorktreeRemove(cwd, restArgs[1], raw);
          } else if (wtSub === 'cleanup') {
            lazyWorktree().cmdWorktreeCleanup(cwd, raw);
          } else if (wtSub === 'merge') {
            lazyWorktree().cmdWorktreeMerge(cwd, restArgs[1], raw);
          } else if (wtSub === 'check-overlap') {
            lazyWorktree().cmdWorktreeCheckOverlap(cwd, restArgs[1], raw);
          } else {
            error('Unknown worktree subcommand. Available: create, list, remove, cleanup, merge, check-overlap');
          }
        } else if (subcommand === 'tdd') {
          const tddSub = restArgs[0];
          const tddTestCmdIdx = restArgs.indexOf('--test-cmd');
          const tddTestFileIdx = restArgs.indexOf('--test-file');
          const tddPhaseIdx = restArgs.indexOf('--phase');
          const tddFilesIdx = restArgs.indexOf('--files');
          const tddArgs = {
            'test-cmd': tddTestCmdIdx !== -1 ? restArgs[tddTestCmdIdx + 1] : null,
            'test-file': tddTestFileIdx !== -1 ? restArgs[tddTestFileIdx + 1] : null,
            phase: tddPhaseIdx !== -1 ? restArgs[tddPhaseIdx + 1] : null,
            files: tddFilesIdx !== -1 ? restArgs[tddFilesIdx + 1] : null,
          };
          lazyMisc().cmdTdd(cwd, tddSub, tddArgs, raw);
        } else if (subcommand === 'test-run') {
          lazyFeatures().cmdTestRun(cwd, raw);
        } else if (subcommand === 'trajectory') {
          const trajSub = restArgs[0];
          switch (trajSub) {
            case 'checkpoint': lazyTrajectory().cmdTrajectoryCheckpoint(cwd, restArgs, raw); break;
            case 'list': lazyTrajectory().cmdTrajectoryList(cwd, restArgs.slice(1), raw); break;
            case 'pivot': lazyTrajectory().cmdTrajectoryPivot(cwd, restArgs, raw); break;
            case 'compare': lazyTrajectory().cmdTrajectoryCompare(cwd, restArgs, raw); break;
            case 'choose': lazyTrajectory().cmdTrajectoryChoose(cwd, restArgs, raw); break;
            case 'dead-ends': lazyTrajectory().cmdTrajectoryDeadEnds(cwd, restArgs.slice(1), raw); break;
            default: error('Unknown trajectory subcommand: ' + trajSub + '. Available: checkpoint, list, pivot, compare, choose, dead-ends');
          }
        } else {
          error(`Unknown execute subcommand: ${subcommand}. Available: commit, rollback-info, session-diff, session-summary, velocity, worktree, tdd, test-run, trajectory`);
        }
        break;
      }

      // verify namespace
      case 'verify': {
        const subcommand = subCmd;
        if (subcommand === 'regression') {
          const beforeIdx = restArgs.indexOf('--before');
          const afterIdx = restArgs.indexOf('--after');
          const autoIdx = restArgs.indexOf('--auto');
          lazyVerify().cmdVerifyRegression(cwd, {
            before: beforeIdx !== -1 ? restArgs[beforeIdx + 1] : null,
            after: afterIdx !== -1 ? restArgs[afterIdx + 1] : null,
            auto: autoIdx !== -1,
          }, raw);
        } else if (subcommand === 'quality') {
          const planIdx = restArgs.indexOf('--plan');
          const phaseIdx = restArgs.indexOf('--phase');
          const gapDetectionIdx = restArgs.indexOf('--gap-detection');
          lazyVerify().cmdVerifyQuality(cwd, {
            plan: planIdx !== -1 ? restArgs[planIdx + 1] : null,
            phase: phaseIdx !== -1 ? restArgs[phaseIdx + 1] : null,
            gap_detection: gapDetectionIdx !== -1,
          }, raw);
        } else if (subcommand === 'review') {
          const edgeCasesIdx = restArgs.indexOf('--suggest-edge-cases');
          lazyMisc().cmdReview(cwd, restArgs, raw, {
            suggest_edge_cases: edgeCasesIdx !== -1,
          });
        } else if (subcommand === 'state') {
          const stateSub = restArgs[0];
          if (stateSub === 'update') {
            lazyState().cmdStateUpdate(cwd, restArgs[1], restArgs[2]);
          } else if (stateSub === 'get') {
            lazyState().cmdStateGet(cwd, restArgs[1], raw);
          } else if (stateSub === 'patch') {
            const patches = {};
            for (let i = 1; i < restArgs.length; i += 2) {
              const key = restArgs[i].replace(/^--/, '');
              const value = restArgs[i + 1];
              if (key && value !== undefined) {
                patches[key] = value;
              }
            }
            lazyState().cmdStatePatch(cwd, patches, raw);
          } else if (stateSub === 'advance-plan') {
            lazyState().cmdStateAdvancePlan(cwd, raw);
          } else if (stateSub === 'record-metric') {
            const phaseIdx = restArgs.indexOf('--phase');
            const planIdx = restArgs.indexOf('--plan');
            const durationIdx = restArgs.indexOf('--duration');
            const tasksIdx = restArgs.indexOf('--tasks');
            const filesIdx = restArgs.indexOf('--files');
            lazyState().cmdStateRecordMetric(cwd, {
              phase: phaseIdx !== -1 ? restArgs[phaseIdx + 1] : null,
              plan: planIdx !== -1 ? restArgs[planIdx + 1] : null,
              duration: durationIdx !== -1 ? restArgs[durationIdx + 1] : null,
              tasks: tasksIdx !== -1 ? restArgs[tasksIdx + 1] : null,
              files: filesIdx !== -1 ? restArgs[filesIdx + 1] : null,
            }, raw);
          } else if (stateSub === 'update-progress') {
            lazyState().cmdStateUpdateProgress(cwd, raw);
          } else if (stateSub === 'add-decision') {
            const phaseIdx = restArgs.indexOf('--phase');
            const summaryIdx = restArgs.indexOf('--summary');
            const rationaleIdx = restArgs.indexOf('--rationale');
            lazyState().cmdStateAddDecision(cwd, {
              phase: phaseIdx !== -1 ? restArgs[phaseIdx + 1] : null,
              summary: summaryIdx !== -1 ? restArgs[summaryIdx + 1] : null,
              rationale: rationaleIdx !== -1 ? restArgs[rationaleIdx + 1] : '',
            }, raw);
          } else if (stateSub === 'add-blocker') {
            const textIdx = restArgs.indexOf('--text');
            lazyState().cmdStateAddBlocker(cwd, textIdx !== -1 ? restArgs[textIdx + 1] : null, raw);
          } else if (stateSub === 'resolve-blocker') {
            const textIdx = restArgs.indexOf('--text');
            lazyState().cmdStateResolveBlocker(cwd, textIdx !== -1 ? restArgs[textIdx + 1] : null, raw);
          } else if (stateSub === 'record-session') {
            const stoppedIdx = restArgs.indexOf('--stopped-at');
            const resumeIdx = restArgs.indexOf('--resume-file');
            lazyState().cmdStateRecordSession(cwd, {
              stopped_at: stoppedIdx !== -1 ? restArgs[stoppedIdx + 1] : null,
              resume_file: resumeIdx !== -1 ? restArgs[resumeIdx + 1] : 'None',
            }, raw);
          } else if (stateSub === 'validate') {
            const fix = restArgs.includes('--fix');
            lazyState().cmdStateValidate(cwd, { fix }, raw);
          } else {
            lazyState().cmdStateLoad(cwd, raw);
          }
        } else if (subcommand === 'verify') {
          const verifySub = restArgs[0];
          if (verifySub === 'plan-structure') {
            lazyVerify().cmdVerifyPlanStructure(cwd, restArgs[1], raw);
          } else if (verifySub === 'phase-completeness') {
            lazyVerify().cmdVerifyPhaseCompleteness(cwd, restArgs[1], raw);
          } else if (verifySub === 'references') {
            lazyVerify().cmdVerifyReferences(cwd, restArgs[1], raw);
          } else if (verifySub === 'commits') {
            lazyVerify().cmdVerifyCommits(cwd, restArgs.slice(1), raw);
          } else if (verifySub === 'artifacts') {
            lazyVerify().cmdVerifyArtifacts(cwd, restArgs[1], raw);
          } else if (verifySub === 'key-links') {
            lazyVerify().cmdVerifyKeyLinks(cwd, restArgs[1], raw);
          } else if (verifySub === 'analyze-plan') {
            lazyVerify().cmdAnalyzePlan(cwd, restArgs[1], raw);
          } else if (verifySub === 'deliverables') {
            const planIdx = restArgs.indexOf('--plan');
            lazyVerify().cmdVerifyDeliverables(cwd, {
              plan: planIdx !== -1 ? restArgs[planIdx + 1] : null,
            }, raw);
          } else if (verifySub === 'requirements') {
            lazyVerify().cmdVerifyRequirements(cwd, {}, raw);
          } else if (verifySub === 'regression') {
            const beforeIdx = restArgs.indexOf('--before');
            const afterIdx = restArgs.indexOf('--after');
            const autoIdx = restArgs.indexOf('--auto');
            lazyVerify().cmdVerifyRegression(cwd, {
              before: beforeIdx !== -1 ? restArgs[beforeIdx + 1] : null,
              after: afterIdx !== -1 ? restArgs[afterIdx + 1] : null,
              auto: autoIdx !== -1,
            }, raw);
          } else if (verifySub === 'plan-wave') {
            lazyVerify().cmdVerifyPlanWave(cwd, restArgs[1], raw);
          } else if (verifySub === 'plan-deps') {
            lazyVerify().cmdVerifyPlanDeps(cwd, restArgs[1], raw);
          } else if (verifySub === 'quality') {
            const planIdx = restArgs.indexOf('--plan');
            const phaseIdx = restArgs.indexOf('--phase');
            lazyVerify().cmdVerifyQuality(cwd, {
              plan: planIdx !== -1 ? restArgs[planIdx + 1] : null,
              phase: phaseIdx !== -1 ? restArgs[phaseIdx + 1] : null,
            }, raw);
          } else {
            error('Unknown verify subcommand. Available: plan-structure, phase-completeness, references, commits, artifacts, key-links, analyze-plan, deliverables, requirements, regression, plan-wave, plan-deps, quality');
          }
        } else if (subcommand === 'assertions') {
          const assertSub = restArgs[0];
          if (assertSub === 'list') {
            const reqIdx = restArgs.indexOf('--req');
            lazyVerify().cmdAssertionsList(cwd, {
              reqId: reqIdx !== -1 ? restArgs[reqIdx + 1] : null,
            }, raw);
          } else if (assertSub === 'validate') {
            lazyVerify().cmdAssertionsValidate(cwd, raw);
          } else {
            error('Unknown assertions subcommand. Available: list, validate');
          }
        } else if (subcommand === 'search-decisions') {
          lazyFeatures().cmdSearchDecisions(cwd, restArgs.join(' '), raw);
        } else if (subcommand === 'search-lessons') {
          lazyFeatures().cmdSearchLessons(cwd, restArgs.join(' '), raw);
        } else if (subcommand === 'review') {
          lazyMisc().cmdReview(cwd, restArgs, raw);
        } else if (subcommand === 'context-budget') {
          const cbSub = restArgs[0];
          if (cbSub === 'baseline') {
            lazyFeatures().cmdContextBudgetBaseline(cwd, raw);
          } else if (cbSub === 'compare') {
            lazyFeatures().cmdContextBudgetCompare(cwd, restArgs[1], raw);
          } else if (cbSub === 'measure') {
            lazyFeatures().cmdContextBudgetMeasure(cwd, raw);
          } else {
            lazyFeatures().cmdContextBudget(cwd, cbSub, raw);
          }
        } else if (subcommand === 'token-budget') {
          lazyFeatures().cmdTokenBudget(cwd, raw);
        } else if (subcommand === 'summary') {
          const countCheck = (() => {
            const idx = restArgs.indexOf('--check-count');
            return idx !== -1 ? parseInt(restArgs[idx + 1], 10) : 2;
          })();
          lazyMisc().cmdVerifySummary(cwd, restArgs[0], countCheck, raw);
        } else if (subcommand === 'validate') {
          const validateSub = restArgs[0];
          if (validateSub === 'consistency') {
            lazyVerify().cmdValidateConsistency(cwd, raw);
          } else if (validateSub === 'health') {
            lazyVerify().cmdValidateHealth(cwd, { repair: restArgs.includes('--repair') }, raw);
          } else if (validateSub === 'roadmap') {
            lazyVerify().cmdValidateRoadmap(cwd, { repair: restArgs.includes('--repair') }, raw);
          } else {
            error('Unknown validate subcommand. Available: consistency, health, roadmap');
          }
        } else if (subcommand === 'validate-dependencies') {
          lazyFeatures().cmdValidateDependencies(cwd, restArgs[0], raw);
        } else if (subcommand === 'validate-config') {
          lazyFeatures().cmdValidateConfig(cwd, raw);
        } else if (subcommand === 'test-coverage') {
          lazyFeatures().cmdTestCoverage(cwd, raw);
        } else if (subcommand === 'handoff') {
          const handoffSub = restArgs[0];
          const fromIdx = restArgs.indexOf('--from');
          const toIdx = restArgs.indexOf('--to');
          const previewIdx = restArgs.indexOf('--preview');
          const validateIdx = restArgs.indexOf('--validate');
          lazyVerify().cmdVerifyHandoff(cwd, {
            subcommand: handoffSub,
            from: fromIdx !== -1 ? restArgs[fromIdx + 1] : null,
            to: toIdx !== -1 ? restArgs[toIdx + 1] : null,
            preview: previewIdx !== -1,
            validate: validateIdx !== -1 ? restArgs[validateIdx + 1] : null,
          }, raw);
        } else if (subcommand === 'agents') {
          const agentsSub = restArgs[0];
          const verifyIdx = restArgs.indexOf('--verify');
          const contractsIdx = restArgs.indexOf('--contracts');
          const checkOverlapIdx = restArgs.indexOf('--check-overlap');
          const fromIdx = restArgs.indexOf('--from');
          const toIdx = restArgs.indexOf('--to');
          lazyVerify().cmdVerifyAgents(cwd, {
            subcommand: agentsSub,
            verify: verifyIdx !== -1,
            contracts: contractsIdx !== -1,
            check_overlap: checkOverlapIdx !== -1,
            from: fromIdx !== -1 ? restArgs[fromIdx + 1] : null,
            to: toIdx !== -1 ? restArgs[toIdx + 1] : null,
          }, raw);
        } else {
          error(`Unknown verify subcommand: ${subcommand}. Available: state, verify, assertions, search-decisions, search-lessons, review, context-budget, token-budget, summary, validate, validate-dependencies, validate-config, test-coverage, handoff, agents`);
        }
        break;
      }

      // util namespace
      case 'util': {
        const subcommand = subCmd;
        if (subcommand === 'config-get') {
          lazyMisc().cmdConfigGet(cwd, restArgs[0], raw);
        } else if (subcommand === 'config-set') {
          lazyMisc().cmdConfigSet(cwd, restArgs[0], restArgs[1], raw);
        } else if (subcommand === 'settings') {
          lazyMisc().cmdSettingsList(cwd, raw);
        } else if (subcommand === 'env') {
          const envSub = restArgs[0];
          if (envSub === 'scan') {
            lazyEnv().cmdEnvScan(cwd, restArgs.slice(1), raw);
          } else if (envSub === 'status') {
            lazyEnv().cmdEnvStatus(cwd, restArgs.slice(1), raw);
          } else {
            error('Unknown env subcommand. Available: scan, status');
          }
        } else if (subcommand === 'current-timestamp') {
          lazyMisc().cmdCurrentTimestamp(restArgs[0] || 'full', raw);
        } else if (subcommand === 'list-todos') {
          lazyMisc().cmdListTodos(cwd, restArgs[0], raw);
        } else if (subcommand === 'todo') {
          const todoSub = restArgs[0];
          if (todoSub === 'complete') {
            lazyMisc().cmdTodoComplete(cwd, restArgs[1], raw);
          } else {
            error('Unknown todo subcommand. Available: complete');
          }
        } else if (subcommand === 'memory') {
          const memSub = restArgs[0];
          if (memSub === 'write') {
            const storeIdx = restArgs.indexOf('--store');
            const entryIdx = restArgs.indexOf('--entry');
            lazyMemory().cmdMemoryWrite(cwd, {
              store: storeIdx !== -1 ? restArgs[storeIdx + 1] : null,
              entry: entryIdx !== -1 ? restArgs[entryIdx + 1] : null,
            }, raw);
          } else if (memSub === 'read') {
            const storeIdx = restArgs.indexOf('--store');
            const limitIdx = restArgs.indexOf('--limit');
            const queryIdx = restArgs.indexOf('--query');
            const phaseIdx = restArgs.indexOf('--phase');
            const categoryIdx = restArgs.indexOf('--category');
            const tagsIdx = restArgs.indexOf('--tags');
            const fromIdx = restArgs.indexOf('--from');
            const toIdx = restArgs.indexOf('--to');
            const ascFlag = restArgs.includes('--asc');
            lazyMemory().cmdMemoryRead(cwd, {
              store: storeIdx !== -1 ? restArgs[storeIdx + 1] : null,
              limit: limitIdx !== -1 ? restArgs[limitIdx + 1] : null,
              query: queryIdx !== -1 ? restArgs[queryIdx + 1] : null,
              phase: phaseIdx !== -1 ? restArgs[phaseIdx + 1] : null,
              category: categoryIdx !== -1 ? restArgs[categoryIdx + 1] : null,
              tags: tagsIdx !== -1 ? restArgs[tagsIdx + 1] : null,
              from: fromIdx !== -1 ? restArgs[fromIdx + 1] : null,
              to: toIdx !== -1 ? restArgs[toIdx + 1] : null,
              asc: ascFlag,
            }, raw);
          } else if (memSub === 'list') {
            lazyMemory().cmdMemoryList(cwd, {}, raw);
          } else if (memSub === 'ensure-dir') {
            lazyMemory().cmdMemoryEnsureDir(cwd);
          } else if (memSub === 'compact') {
            const storeIdx = restArgs.indexOf('--store');
            const thresholdIdx = restArgs.indexOf('--threshold');
            const dryRun = restArgs.includes('--dry-run');
            lazyMemory().cmdMemoryCompact(cwd, {
              store: storeIdx !== -1 ? restArgs[storeIdx + 1] : null,
              threshold: thresholdIdx !== -1 ? restArgs[thresholdIdx + 1] : null,
              dryRun,
            }, raw);
          } else {
            error('Unknown memory subcommand. Available: write, read, list, ensure-dir, compact');
          }
        } else if (subcommand === 'mcp') {
          const mcpSub = restArgs[0];
          if (mcpSub === 'profile') {
            lazyMcp().cmdMcpProfile(cwd, restArgs.slice(1), raw);
          } else {
            error('Unknown mcp subcommand. Available: profile');
          }
        } else if (subcommand === 'classify') {
          const classSub = restArgs[0];
          if (classSub === 'plan') {
            lazyOrchestration().cmdClassifyPlan(cwd, restArgs.slice(1), raw);
          } else if (classSub === 'phase') {
            lazyOrchestration().cmdClassifyPhase(cwd, restArgs.slice(1), raw);
          } else {
            error('Usage: classify <plan|phase> <path-or-number>');
          }
        } else if (subcommand === 'frontmatter') {
          const fmSub = restArgs[0];
          const file = restArgs[1];
          if (fmSub === 'get') {
            const fieldIdx = restArgs.indexOf('--field');
            lazyMisc().cmdFrontmatterGet(cwd, file, fieldIdx !== -1 ? restArgs[fieldIdx + 1] : null, raw);
          } else if (fmSub === 'set') {
            const fieldIdx = restArgs.indexOf('--field');
            const valueIdx = restArgs.indexOf('--value');
            lazyMisc().cmdFrontmatterSet(cwd, file, fieldIdx !== -1 ? restArgs[fieldIdx + 1] : null, valueIdx !== -1 ? restArgs[valueIdx + 1] : undefined, raw);
          } else if (fmSub === 'merge') {
            const dataIdx = restArgs.indexOf('--data');
            lazyMisc().cmdFrontmatterMerge(cwd, file, dataIdx !== -1 ? restArgs[dataIdx + 1] : null, raw);
          } else if (fmSub === 'validate') {
            const schemaIdx = restArgs.indexOf('--schema');
            lazyMisc().cmdFrontmatterValidate(cwd, file, schemaIdx !== -1 ? restArgs[schemaIdx + 1] : null, raw);
          } else {
            error('Unknown frontmatter subcommand. Available: get, set, merge, validate');
          }
        } else if (subcommand === 'validate-commands') {
          lazyMisc().cmdValidateCommands(cwd, {}, raw);
        } else if (subcommand === 'validate-artifacts') {
          lazyMisc().cmdValidateArtifacts(cwd, {}, raw);
        } else if (subcommand === 'progress') {
          const progSub = restArgs[0] || 'json';
          lazyMisc().cmdProgressRender(cwd, progSub, raw);
        } else if (subcommand === 'websearch') {
          const query = restArgs[0];
          const limitIdx = restArgs.indexOf('--limit');
          const freshnessIdx = restArgs.indexOf('--freshness');
          await lazyMisc().cmdWebsearch(query, {
            limit: limitIdx !== -1 ? parseInt(restArgs[limitIdx + 1], 10) : 10,
            freshness: freshnessIdx !== -1 ? restArgs[freshnessIdx + 1] : null,
          }, raw);
        } else if (subcommand === 'history-digest') {
          const hdLimitIdx = restArgs.indexOf('--limit');
          const hdPhasesIdx = restArgs.indexOf('--phases');
          const hdSlim = restArgs.includes('--slim');
          const hdOptions = {
            limit: hdLimitIdx !== -1 ? parseInt(restArgs[hdLimitIdx + 1], 10) : null,
            phases: hdPhasesIdx !== -1 ? restArgs[hdPhasesIdx + 1].split(',').map(s => s.trim()) : null,
            compact: hdSlim,
          };
          lazyMisc().cmdHistoryDigest(cwd, hdOptions, raw);
        } else if (subcommand === 'trace-requirement') {
          lazyFeatures().cmdTraceRequirement(cwd, restArgs[0], raw);
        } else if (subcommand === 'analyze-deps') {
          lazyFeatures().cmdAnalyzeDeps(cwd, restArgs[0], raw);
        } else if (subcommand === 'estimate-scope') {
          lazyFeatures().cmdEstimateScope(cwd, restArgs[0], raw);
        } else if (subcommand === 'codebase') {
          const cbSub = restArgs[0];
          if (cbSub === 'analyze') {
            lazyCodebase().cmdCodebaseAnalyze(cwd, restArgs.slice(1), raw);
          } else if (cbSub === 'status') {
            lazyCodebase().cmdCodebaseStatus(cwd, restArgs.slice(1), raw);
          } else if (cbSub === 'conventions') {
            lazyCodebase().cmdCodebaseConventions(cwd, restArgs.slice(1), raw);
          } else if (cbSub === 'rules') {
            lazyCodebase().cmdCodebaseRules(cwd, restArgs.slice(1), raw);
          } else if (cbSub === 'deps') {
            lazyCodebase().cmdCodebaseDeps(cwd, restArgs.slice(1), raw);
          } else if (cbSub === 'impact') {
            lazyCodebase().cmdCodebaseImpact(cwd, restArgs.slice(1), raw);
          } else if (cbSub === 'context') {
            lazyCodebase().cmdCodebaseContext(cwd, restArgs.slice(1), raw);
          } else if (cbSub === 'lifecycle') {
            lazyCodebase().cmdCodebaseLifecycle(cwd, restArgs.slice(1), raw);
          } else if (cbSub === 'ast') {
            lazyCodebase().cmdCodebaseAst(cwd, restArgs.slice(1), raw);
          } else if (cbSub === 'exports') {
            lazyCodebase().cmdCodebaseExports(cwd, restArgs.slice(1), raw);
          } else if (cbSub === 'complexity') {
            lazyCodebase().cmdCodebaseComplexity(cwd, restArgs.slice(1), raw);
          } else if (cbSub === 'repo-map') {
            lazyCodebase().cmdCodebaseRepoMap(cwd, restArgs.slice(1), raw);
          } else {
            error('Usage: codebase <analyze|status|conventions|rules|deps|impact|context|lifecycle|ast|exports|complexity|repo-map>');
          }
        } else if (subcommand === 'cache') {
          const cacheSub = restArgs[0];
          if (cacheSub === 'status') {
            lazyCache().cmdCacheStatus(cwd, restArgs, raw);
          } else if (cacheSub === 'clear') {
            lazyCache().cmdCacheClear(cwd, restArgs, raw);
          } else if (cacheSub === 'warm') {
            lazyCache().cmdCacheWarm(cwd, restArgs, raw);
          } else {
            output({
              commands: ['status', 'clear', 'warm'],
              help: 'bgsd-tools cache <status|clear|warm> [files...]'
            }, raw, 'cache');
          }
        } else if (subcommand === 'agent') {
          const agentSub = restArgs[0];
          if (agentSub === 'audit') {
            lazyAgent().cmdAgentAudit(cwd, raw);
          } else if (agentSub === 'list') {
            lazyAgent().cmdAgentList(cwd, raw);
          } else if (agentSub === 'validate-contracts') {
            lazyAgent().cmdAgentValidateContracts(cwd, raw, restArgs.slice(1));
          } else {
            error('Unknown agent subcommand. Available: audit, list, validate-contracts');
          }
        } else if (subcommand === 'resolve-model') {
          lazyMisc().cmdResolveModel(cwd, restArgs[0], raw);
        } else if (subcommand === 'parity-check') {
          await lazyMisc().cmdParityCheck(cwd, restArgs, raw);
        } else if (subcommand === 'template') {
          const tmplSub = restArgs[0];
          if (tmplSub === 'select') {
            lazyMisc().cmdTemplateSelect(cwd, restArgs[1], raw);
          } else if (tmplSub === 'fill') {
            const templateType = restArgs[1];
            const phaseIdx = restArgs.indexOf('--phase');
            const planIdx = restArgs.indexOf('--plan');
            const nameIdx = restArgs.indexOf('--name');
            const typeIdx = restArgs.indexOf('--type');
            const waveIdx = restArgs.indexOf('--wave');
            const fieldsIdx = restArgs.indexOf('--fields');
            lazyMisc().cmdTemplateFill(cwd, templateType, {
              phase: phaseIdx !== -1 ? restArgs[phaseIdx + 1] : null,
              plan: planIdx !== -1 ? restArgs[planIdx + 1] : null,
              name: nameIdx !== -1 ? restArgs[nameIdx + 1] : null,
              type: typeIdx !== -1 ? restArgs[typeIdx + 1] : 'execute',
              wave: waveIdx !== -1 ? restArgs[waveIdx + 1] : '1',
              fields: fieldsIdx !== -1 ? JSON.parse(restArgs[fieldsIdx + 1]) : {},
            }, raw);
          } else {
            error('Unknown template subcommand. Available: select, fill');
          }
        } else if (subcommand === 'generate-slug') {
          lazyMisc().cmdGenerateSlug(restArgs[0], raw);
        } else if (subcommand === 'verify-path-exists') {
          lazyMisc().cmdVerifyPathExists(cwd, restArgs[0], raw);
        } else if (subcommand === 'config-ensure-section') {
          lazyMisc().cmdConfigEnsureSection(cwd, raw);
        } else if (subcommand === 'config-migrate') {
          lazyMisc().cmdConfigMigrate(cwd, raw);
        } else if (subcommand === 'scaffold') {
          const scaffoldType = restArgs[0];
          const phaseIdx = restArgs.indexOf('--phase');
          const nameIdx = restArgs.indexOf('--name');
          const scaffoldOptions = {
            phase: phaseIdx !== -1 ? restArgs[phaseIdx + 1] : null,
            name: nameIdx !== -1 ? restArgs.slice(nameIdx + 1).join(' ') : null,
          };
          lazyMisc().cmdScaffold(cwd, scaffoldType, scaffoldOptions, raw);
        } else if (subcommand === 'phase-plan-index') {
          lazyMisc().cmdPhasePlanIndex(cwd, restArgs[0], raw);
        } else if (subcommand === 'state-snapshot') {
          lazyMisc().cmdStateSnapshot(cwd, raw);
        } else if (subcommand === 'summary-extract') {
          const summaryPath = restArgs[0];
          const seFieldsIdx = restArgs.indexOf('--fields');
          const fields = seFieldsIdx !== -1 ? restArgs[seFieldsIdx + 1].split(',') : null;
          lazyMisc().cmdSummaryExtract(cwd, summaryPath, fields, raw);
        } else if (subcommand === 'summary-generate') {
          const sgPhase = restArgs[0];
          const sgPlan = restArgs[1];
          lazyMisc().cmdSummaryGenerate(cwd, sgPhase, sgPlan, raw);
        } else if (subcommand === 'quick-summary') {
          lazyFeatures().cmdQuickTaskSummary(cwd, raw);
        } else if (subcommand === 'extract-sections') {
          lazyFeatures().cmdExtractSections(cwd, restArgs, raw);
        } else if (subcommand === 'git') {
          const gitSub = restArgs[0];
          const gitMod = lazyGit();
          const { output: gitOutput } = require('./lib/output');
          switch (gitSub) {
            case 'log': {
              const countIdx = restArgs.indexOf('--count');
              const sinceIdx = restArgs.indexOf('--since');
              const untilIdx = restArgs.indexOf('--until');
              const authorIdx = restArgs.indexOf('--author');
              const pathIdx = restArgs.indexOf('--path');
              const gitOpts = {
                count: countIdx !== -1 ? parseInt(restArgs[countIdx + 1], 10) : 20,
                since: sinceIdx !== -1 ? restArgs[sinceIdx + 1] : undefined,
                until: untilIdx !== -1 ? restArgs[untilIdx + 1] : undefined,
                author: authorIdx !== -1 ? restArgs[authorIdx + 1] : undefined,
                path: pathIdx !== -1 ? restArgs[pathIdx + 1] : undefined,
              };
              gitOutput(gitMod.structuredLog(cwd, gitOpts), raw);
              break;
            }
            case 'diff-summary': {
              const fromIdx = restArgs.indexOf('--from');
              const toIdx = restArgs.indexOf('--to');
              const dsPathIdx = restArgs.indexOf('--path');
              gitOutput(gitMod.diffSummary(cwd, {
                from: fromIdx !== -1 ? restArgs[fromIdx + 1] : undefined,
                to: toIdx !== -1 ? restArgs[toIdx + 1] : undefined,
                path: dsPathIdx !== -1 ? restArgs[dsPathIdx + 1] : undefined,
              }), raw);
              break;
            }
            case 'blame': {
              gitOutput(gitMod.blame(cwd, restArgs[1]), raw);
              break;
            }
            case 'branch-info': {
              gitOutput(gitMod.branchInfo(cwd), raw);
              break;
            }
            case 'rewind': {
              const refIdx = restArgs.indexOf('--ref');
              const rwConfirm = restArgs.includes('--confirm');
              const rwDryRun = restArgs.includes('--dry-run');
              gitOutput(gitMod.selectiveRewind(cwd, {
                ref: refIdx !== -1 ? restArgs[refIdx + 1] : undefined,
                confirm: rwConfirm,
                dryRun: rwDryRun,
              }), raw);
              break;
            }
            case 'trajectory-branch': {
              const tbPhaseIdx = restArgs.indexOf('--phase');
              const tbSlugIdx = restArgs.indexOf('--slug');
              const tbPush = restArgs.includes('--push');
              gitOutput(gitMod.trajectoryBranch(cwd, {
                phase: tbPhaseIdx !== -1 ? restArgs[tbPhaseIdx + 1] : undefined,
                slug: tbSlugIdx !== -1 ? restArgs[tbSlugIdx + 1] : undefined,
                push: tbPush,
              }), raw);
              break;
            }
              default:
              error('Unknown git subcommand: ' + gitSub + '. Available: log, diff-summary, blame, branch-info, rewind, trajectory-branch');
          }
        } else if (subcommand === 'tools') {
          lazyTools().cmdToolsStatus(cwd, raw);
        } else if (subcommand === 'runtime') {
          const runtimeSub = restArgs[0];
          if (runtimeSub === 'benchmark') {
            const runsIdx = restArgs.indexOf('--runs');
            const runs = runsIdx !== -1 ? parseInt(restArgs[runsIdx + 1], 10) : 10;
            lazyRuntime().cmdRuntimeBenchmark(cwd, raw, { runs });
          } else {
            lazyRuntime().cmdRuntimeStatus(cwd, raw);
          }
        } else if (subcommand === 'measure') {
          // Check build-time feature flag
          if (global.BGSD_INCLUDE_BENCHMARKS === false) {
            error('Benchmarks are disabled in this build. Set INCLUDE_BENCHMARKS=true to enable.');
          }
          const binPathIdx = restArgs.indexOf('--bin');
          // --verbose is a global flag - check global._gsdCompactMode
          const isVerbose = global._gsdCompactMode === false;
          lazyMeasure().cmdMeasure(cwd, {
            verbose: isVerbose,
            binPath: binPathIdx !== -1 ? restArgs[binPathIdx + 1] : 'bin/bgsd-tools.cjs'
          }, raw);
        } else if (subcommand === 'recovery') {
          const recoverySub = restArgs[0];
          const recoveryMod = lazyRecovery();
          if (recoverySub === 'analyze') {
            // util:recovery analyze <deviation-text>
            const deviation = restArgs.slice(1).join(' ');
            const recovery = recoveryMod.createAutoRecovery();
            const classification = recovery.classifyDeviation(deviation);
            output({
              deviation,
              classification: {
                type: classification.type,
                rule: classification.rule,
                description: classification.description,
                canAutoFix: classification.strategy?.canAutoFix
              }
            }, raw);
          } else if (recoverySub === 'checkpoint') {
            // util:recovery checkpoint <task-json>
            const taskJson = restArgs.slice(1).join(' ');
            let task;
            try {
              task = taskJson ? JSON.parse(taskJson) : {};
            } catch (e) {
              // If not JSON, treat as simple task
              task = { type: taskJson || 'auto' };
            }
            const advisor = recoveryMod.createCheckpointAdvisor();
            const result = advisor.analyze(task);
            output({
              task,
              complexityScore: result.analysis.totalScore,
              breakdown: result.analysis.breakdown,
              recommendation: {
                type: result.recommendation.recommended,
                description: result.recommendation.description,
                rationale: result.recommendation.rationale
              }
            }, raw);
          } else if (recoverySub === 'stuck') {
            // util:recovery stuck <task-id>
            const taskId = restArgs[1] || 'default';
            const detector = recoveryMod.createLoopDetector();
            const status = detector.getStatus(taskId);
            output({
              taskId,
              isStuck: status.isStuck,
              attempts: status.attempts,
              retryCount: status.retryCount,
              lastError: status.lastError
            }, raw);
          } else if (!recoverySub || recoverySub === '--help' || recoverySub === '-h') {
            process.stderr.write(`Usage: bgsd-tools util:recovery <subcommand> [options]

Execution intelligence - recovery and checkpoint management.

Subcommands:
  analyze <deviation>    Classify a deviation using the 4-rule framework
  checkpoint <task-json> Analyze task complexity and recommend checkpoint type
  stuck <task-id>       Check if a task is stuck in a loop

Examples:
  bgsd-tools util:recovery analyze "Cannot read property 'foo' of undefined"
  bgsd-tools util:recovery checkpoint '{"files":["a.js","b.js"],"type":"auto","dependsOn":["t1"]}'
  bgsd-tools util:recovery stuck task-123
`);
          } else {
            error(`Unknown recovery subcommand: ${recoverySub}. Available: analyze, checkpoint, stuck`);
          }
        } else if (subcommand === 'history') {
          // util:history - Command history tracking (Phase 97: UX Polish)
          const historyMod = require('./lib/helpContext');
          const clearIdx = restArgs.indexOf('--clear');
          const limitIdx = restArgs.indexOf('--limit');
          const contextIdx = restArgs.indexOf('--context');
          const suggestIdx = restArgs.indexOf('--suggest');
          
          if (clearIdx !== -1) {
            const result = historyMod.clearHistory();
            output(result, raw);
          } else if (contextIdx !== -1) {
            const suggestions = historyMod.getContextualSuggestions();
            output(suggestions, raw);
          } else if (suggestIdx !== -1) {
            const input = restArgs[suggestIdx + 1] || '';
            const discoveryMod = require('./lib/commandDiscovery');
            const hints = discoveryMod.getAutocompleteHints(input);
            const similar = discoveryMod.getSimilarCommands(input);
            output({ hints, similar }, raw);
          } else {
            const limit = limitIdx !== -1 ? parseInt(restArgs[limitIdx + 1], 10) : 10;
            const format = restArgs.includes('--json') ? 'json' : 'text';
            
            if (format === 'json') {
              const history = historyMod.getRecentCommands(limit);
              output({ commands: history, count: history.length }, raw);
            } else {
              const outputStr = historyMod.showHistory(limit);
              output(outputStr, raw);
            }
          }
        } else if (subcommand === 'examples') {
          // util:examples - Show command examples (Phase 97: UX Polish)
          const examplesMod = require('./lib/helpExamples');
          const workflowsIdx = restArgs.indexOf('--workflows');
          const verboseIdx = restArgs.indexOf('--verbose');
          const verbose = verboseIdx !== -1;
          
          if (workflowsIdx !== -1) {
            const workflows = examplesMod.getCommonWorkflows();
            const formatted = workflows.map(w => examplesMod.formatWorkflow(w, verbose)).join('\n\n');
            output({ workflows, formatted }, raw);
            return;
          }
          
          const command = restArgs[0];
          if (!command) {
            output({
              message: 'Usage: util:examples <command> [--workflows] [--verbose]',
              examples: 'Try: util:examples plan:phase',
              workflows: examplesMod.getCommonWorkflows().slice(0, 3).map(w => ({
                name: w.name,
                steps: w.steps
              }))
            }, raw);
            return;
          }
          
          const [namespace, cmd] = command.split(':');
          const examples = examplesMod.getExamples(namespace, cmd);
          
          if (examples.length === 0) {
            output({ 
              command, 
              message: `No examples found for ${command}`,
              available: examplesMod.getCommonWorkflows().map(w => w.name)
            }, raw);
            return;
          }
          
          const formatted = examples.map(ex => examplesMod.formatExample(ex, verbose)).join('\n');
          output({ command, examples, formatted }, raw);
        } else {
          error(`Unknown util subcommand: ${subcommand}. Available: config-get, config-set, env, current-timestamp, list-todos, todo, memory, mcp, classify, frontmatter, progress, websearch, history-digest, trace-requirement, codebase, cache, agent, resolve-model, template, generate-slug, verify-path-exists, config-ensure-section, config-migrate, scaffold, phase-plan-index, state-snapshot, summary-extract, summary-generate, quick-summary, extract-sections, git, tools, runtime, measure, recovery, history, examples`);
        }
        break;
      }

      // research namespace
      case 'research': {
        if (subCmd === 'capabilities') {
          lazyResearch().cmdResearchCapabilities(cwd, restArgs, raw);
        } else if (subCmd === 'yt-search') {
          lazyResearch().cmdResearchYtSearch(cwd, restArgs, raw);
        } else if (subCmd === 'yt-transcript') {
          lazyResearch().cmdResearchYtTranscript(cwd, restArgs, raw);
        } else if (subCmd === 'collect') {
          lazyResearch().cmdResearchCollect(cwd, restArgs, raw);
        } else if (subCmd === 'nlm-create') {
          lazyResearch().cmdResearchNlmCreate(cwd, restArgs, raw);
        } else if (subCmd === 'nlm-add-source') {
          lazyResearch().cmdResearchNlmAddSource(cwd, restArgs, raw);
        } else if (subCmd === 'nlm-ask') {
          lazyResearch().cmdResearchNlmAsk(cwd, restArgs, raw);
        } else if (subCmd === 'nlm-report') {
          lazyResearch().cmdResearchNlmReport(cwd, restArgs, raw);
        } else {
          error('Unknown research subcommand. Available: capabilities, yt-search, yt-transcript, collect, nlm-create, nlm-add-source, nlm-ask, nlm-report');
        }
        break;
      }

      // cache namespace
      case 'cache': {
        if (subCmd === 'research-stats') {
          lazyCache().cmdCacheResearchStats(cwd, restArgs, raw);
        } else if (subCmd === 'research-clear') {
          lazyCache().cmdCacheResearchClear(cwd, restArgs, raw);
        } else if (subCmd === 'status') {
          lazyCache().cmdCacheStatus(cwd, restArgs, raw);
        } else if (subCmd === 'clear') {
          lazyCache().cmdCacheClear(cwd, restArgs, raw);
        } else if (subCmd === 'warm') {
          lazyCache().cmdCacheWarm(cwd, restArgs, raw);
        } else {
          error('Unknown cache subcommand. Available: research-stats, research-clear, status, clear, warm');
        }
        break;
      }

      // audit namespace
      case 'audit': {
        if (subCmd === 'scan') {
          lazyAudit().cmdAuditScan(cwd, restArgs, raw);
        } else {
          error('Unknown audit subcommand. Available: scan');
        }
        break;
      }

      // decisions namespace
      case 'decisions': {
        if (subCmd === 'list') {
          lazyDecisions().cmdDecisionsList(cwd, restArgs, raw);
        } else if (subCmd === 'inspect') {
          lazyDecisions().cmdDecisionsInspect(cwd, restArgs, raw);
        } else if (subCmd === 'evaluate') {
          lazyDecisions().cmdDecisionsEvaluate(cwd, restArgs, raw);
        } else if (subCmd === 'savings') {
          lazyDecisions().cmdDecisionsSavings(cwd, restArgs, raw);
        } else {
          error('Unknown decisions subcommand. Available: list, inspect, evaluate, savings');
        }
        break;
      }

      // Unknown namespace
      default:
        error(`Unknown namespace: ${namespace}. Available namespaces: init, plan, execute, verify, util, research, cache, audit, decisions`);
    }
    return; // Exit after handling namespaced command
  }

  // No command matched any namespace — unknown
  error(`Unknown command: ${command}. Use namespace:command syntax. Available namespaces: init, plan, execute, verify, util, research, cache, audit, decisions`);
}

// Track command execution in history (Phase 97: UX Polish)
function trackCommandHistory(namespace, command, args) {
  try {
    const { trackCommand } = require('./lib/helpContext');
    // Don't track the history command itself to avoid noise
    if (namespace === 'util' && (command === 'history' || command === 'examples')) {
      return;
    }
    trackCommand(namespace, command, args);
  } catch (e) {
    // Silent fail - don't break commands if tracking fails
  }
}

module.exports = { main };
