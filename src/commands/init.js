'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { output, error, debugLog } = require('../lib/output');
const { loadConfig } = require('../lib/config');
const { safeReadFile, findPhaseInternal, resolveModelInternal, getRoadmapPhaseInternal, getMilestoneInfo, getArchivedPhaseDirs, normalizePhaseName, isValidDateString, sanitizeShellArg, pathExistsInternal, generateSlugInternal } = require('../lib/helpers');
const { extractFrontmatter } = require('../lib/frontmatter');
const { execGit } = require('../lib/git');

function cmdInitExecutePhase(cwd, phase, raw) {
  if (!phase) {
    error('phase required for init execute-phase');
  }

  const config = loadConfig(cwd);
  const phaseInfo = findPhaseInternal(cwd, phase);
  const milestone = getMilestoneInfo(cwd);

  const result = {
    // Models
    executor_model: resolveModelInternal(cwd, 'gsd-executor'),
    verifier_model: resolveModelInternal(cwd, 'gsd-verifier'),

    // Config flags
    commit_docs: config.commit_docs,
    parallelization: config.parallelization,
    branching_strategy: config.branching_strategy,
    phase_branch_template: config.phase_branch_template,
    milestone_branch_template: config.milestone_branch_template,
    verifier_enabled: config.verifier,

    // Phase info
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory || null,
    phase_number: phaseInfo?.phase_number || null,
    phase_name: phaseInfo?.phase_name || null,
    phase_slug: phaseInfo?.phase_slug || null,

    // Plan inventory
    plans: phaseInfo?.plans || [],
    summaries: phaseInfo?.summaries || [],
    incomplete_plans: phaseInfo?.incomplete_plans || [],
    plan_count: phaseInfo?.plans?.length || 0,
    incomplete_count: phaseInfo?.incomplete_plans?.length || 0,

    // Branch name (pre-computed)
    branch_name: config.branching_strategy === 'phase' && phaseInfo
      ? config.phase_branch_template
          .replace('{phase}', phaseInfo.phase_number)
          .replace('{slug}', phaseInfo.phase_slug || 'phase')
      : config.branching_strategy === 'milestone'
        ? config.milestone_branch_template
            .replace('{milestone}', milestone.version)
            .replace('{slug}', generateSlugInternal(milestone.name) || 'milestone')
        : null,

    // Milestone info
    milestone_version: milestone.version,
    milestone_name: milestone.name,
    milestone_slug: generateSlugInternal(milestone.name),

    // File existence
    state_exists: pathExistsInternal(cwd, '.planning/STATE.md'),
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
    config_exists: pathExistsInternal(cwd, '.planning/config.json'),
    // File paths
    state_path: '.planning/STATE.md',
    roadmap_path: '.planning/ROADMAP.md',
    config_path: '.planning/config.json',
  };

  if (global._gsdCompactMode) {
    const planPaths = (result.plans || []).map(p => typeof p === 'string' ? p : p.file || p);
    const compactResult = {
      phase_found: result.phase_found,
      phase_dir: result.phase_dir,
      phase_number: result.phase_number,
      phase_name: result.phase_name,
      plans: planPaths,
      incomplete_plans: (result.incomplete_plans || []).map(p => typeof p === 'string' ? p : p.file || p),
      plan_count: result.plan_count,
      incomplete_count: result.incomplete_count,
      branch_name: result.branch_name,
      verifier_enabled: result.verifier_enabled,
      _manifest: {
        files: [
          ...planPaths.map(p => ({ path: result.phase_dir ? `${result.phase_dir}/${p}` : p, required: true })),
          ...(result.state_exists ? [{ path: '.planning/STATE.md', sections: ['Current Position'], required: true }] : []),
          ...(result.roadmap_exists ? [{ path: '.planning/ROADMAP.md', sections: [`Phase ${result.phase_number || ''}`], required: true }] : []),
        ],
      },
    };
    return output(compactResult, raw);
  }

  output(result, raw);
}

function cmdInitPlanPhase(cwd, phase, raw) {
  if (!phase) {
    error('phase required for init plan-phase');
  }

  const config = loadConfig(cwd);
  const phaseInfo = findPhaseInternal(cwd, phase);

  const result = {
    // Models
    researcher_model: resolveModelInternal(cwd, 'gsd-phase-researcher'),
    planner_model: resolveModelInternal(cwd, 'gsd-planner'),
    checker_model: resolveModelInternal(cwd, 'gsd-plan-checker'),

    // Workflow flags
    research_enabled: config.research,
    plan_checker_enabled: config.plan_checker,
    commit_docs: config.commit_docs,

    // Phase info
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory || null,
    phase_number: phaseInfo?.phase_number || null,
    phase_name: phaseInfo?.phase_name || null,
    phase_slug: phaseInfo?.phase_slug || null,
    padded_phase: phaseInfo?.phase_number?.padStart(2, '0') || null,

    // Existing artifacts
    has_research: phaseInfo?.has_research || false,
    has_context: phaseInfo?.has_context || false,
    has_plans: (phaseInfo?.plans?.length || 0) > 0,
    plan_count: phaseInfo?.plans?.length || 0,

    // Environment
    planning_exists: pathExistsInternal(cwd, '.planning'),
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),

    // File paths
    state_path: '.planning/STATE.md',
    roadmap_path: '.planning/ROADMAP.md',
    requirements_path: '.planning/REQUIREMENTS.md',
  };

  if (phaseInfo?.directory) {
    // Find *-CONTEXT.md in phase directory
    const phaseDirFull = path.join(cwd, phaseInfo.directory);
    try {
      const files = fs.readdirSync(phaseDirFull);
      const contextFile = files.find(f => f.endsWith('-CONTEXT.md') || f === 'CONTEXT.md');
      if (contextFile) {
        result.context_path = path.join(phaseInfo.directory, contextFile);
      }
      const researchFile = files.find(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md');
      if (researchFile) {
        result.research_path = path.join(phaseInfo.directory, researchFile);
      }
      const verificationFile = files.find(f => f.endsWith('-VERIFICATION.md') || f === 'VERIFICATION.md');
      if (verificationFile) {
        result.verification_path = path.join(phaseInfo.directory, verificationFile);
      }
      const uatFile = files.find(f => f.endsWith('-UAT.md') || f === 'UAT.md');
      if (uatFile) {
        result.uat_path = path.join(phaseInfo.directory, uatFile);
      }
    } catch (e) { debugLog('init.planPhase', 'read phase files failed', e); }
  }

  if (global._gsdCompactMode) {
    const compactResult = {
      phase_found: result.phase_found,
      phase_dir: result.phase_dir,
      phase_number: result.phase_number,
      phase_name: result.phase_name,
      phase_slug: result.phase_slug,
      padded_phase: result.padded_phase,
      has_research: result.has_research,
      has_context: result.has_context,
      has_plans: result.has_plans,
      plan_count: result.plan_count,
      research_enabled: result.research_enabled,
      plan_checker_enabled: result.plan_checker_enabled,
    };
    if (result.context_path) compactResult.context_path = result.context_path;
    if (result.research_path) compactResult.research_path = result.research_path;
    if (result.verification_path) compactResult.verification_path = result.verification_path;
    if (result.uat_path) compactResult.uat_path = result.uat_path;

    const manifestFiles = [
      { path: '.planning/STATE.md', sections: ['Current Position', 'Accumulated Context'], required: true },
      { path: '.planning/ROADMAP.md', sections: [`Phase ${result.phase_number || ''}`], required: true },
      { path: '.planning/REQUIREMENTS.md', required: true },
    ];
    if (result.context_path) manifestFiles.push({ path: result.context_path, required: false });
    if (result.research_path) manifestFiles.push({ path: result.research_path, required: false });
    if (result.verification_path) manifestFiles.push({ path: result.verification_path, required: false });
    compactResult._manifest = { files: manifestFiles };

    return output(compactResult, raw);
  }

  output(result, raw);
}

function cmdInitNewProject(cwd, raw) {
  const config = loadConfig(cwd);

  // Detect Brave Search API key availability
  const homedir = require('os').homedir();
  const braveKeyFile = path.join(homedir, '.gsd', 'brave_api_key');
  const hasBraveSearch = !!(process.env.BRAVE_API_KEY || fs.existsSync(braveKeyFile));

  // Detect existing code
  let hasCode = false;
  let hasPackageFile = false;
  try {
    const files = execSync('find . -maxdepth 3 \\( -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.go" -o -name "*.rs" -o -name "*.swift" -o -name "*.java" \\) 2>/dev/null | grep -v node_modules | grep -v .git | head -5', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    hasCode = files.trim().length > 0;
  } catch (e) { debugLog('init.newProject', 'exec failed', e); }

  hasPackageFile = pathExistsInternal(cwd, 'package.json') ||
                   pathExistsInternal(cwd, 'requirements.txt') ||
                   pathExistsInternal(cwd, 'Cargo.toml') ||
                   pathExistsInternal(cwd, 'go.mod') ||
                   pathExistsInternal(cwd, 'Package.swift');

  const result = {
    // Models
    researcher_model: resolveModelInternal(cwd, 'gsd-project-researcher'),
    synthesizer_model: resolveModelInternal(cwd, 'gsd-research-synthesizer'),
    roadmapper_model: resolveModelInternal(cwd, 'gsd-roadmapper'),

    // Config
    commit_docs: config.commit_docs,

    // Existing state
    project_exists: pathExistsInternal(cwd, '.planning/PROJECT.md'),
    has_codebase_map: pathExistsInternal(cwd, '.planning/codebase'),
    planning_exists: pathExistsInternal(cwd, '.planning'),

    // Brownfield detection
    has_existing_code: hasCode,
    has_package_file: hasPackageFile,
    is_brownfield: hasCode || hasPackageFile,
    needs_codebase_map: (hasCode || hasPackageFile) && !pathExistsInternal(cwd, '.planning/codebase'),

    // Git state
    has_git: pathExistsInternal(cwd, '.git'),

    // Enhanced search
    brave_search_available: hasBraveSearch,

    // File paths
    project_path: '.planning/PROJECT.md',
  };

  if (global._gsdCompactMode) {
    const manifestFiles = [];
    if (result.project_exists) manifestFiles.push({ path: '.planning/PROJECT.md', required: false });
    if (pathExistsInternal(cwd, 'CLAUDE.md')) manifestFiles.push({ path: 'CLAUDE.md', required: false });

    const compactResult = {
      is_brownfield: result.is_brownfield,
      needs_codebase_map: result.needs_codebase_map,
      has_existing_code: result.has_existing_code,
      has_package_file: result.has_package_file,
      project_exists: result.project_exists,
      has_codebase_map: result.has_codebase_map,
      planning_exists: result.planning_exists,
      has_git: result.has_git,
      brave_search_available: result.brave_search_available,
      _manifest: { files: manifestFiles },
    };
    return output(compactResult, raw);
  }

  output(result, raw);
}

function cmdInitNewMilestone(cwd, raw) {
  const config = loadConfig(cwd);
  const milestone = getMilestoneInfo(cwd);

  const result = {
    // Models
    researcher_model: resolveModelInternal(cwd, 'gsd-project-researcher'),
    synthesizer_model: resolveModelInternal(cwd, 'gsd-research-synthesizer'),
    roadmapper_model: resolveModelInternal(cwd, 'gsd-roadmapper'),

    // Config
    commit_docs: config.commit_docs,
    research_enabled: config.research,

    // Current milestone
    current_milestone: milestone.version,
    current_milestone_name: milestone.name,

    // File existence
    project_exists: pathExistsInternal(cwd, '.planning/PROJECT.md'),
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
    state_exists: pathExistsInternal(cwd, '.planning/STATE.md'),

    // File paths
    project_path: '.planning/PROJECT.md',
    roadmap_path: '.planning/ROADMAP.md',
    state_path: '.planning/STATE.md',
  };

  if (global._gsdCompactMode) {
    const manifestFiles = [];
    if (result.project_exists) manifestFiles.push({ path: '.planning/PROJECT.md', required: true });
    if (result.roadmap_exists) manifestFiles.push({ path: '.planning/ROADMAP.md', sections: ['Milestones', 'Progress'], required: true });
    if (result.state_exists) manifestFiles.push({ path: '.planning/STATE.md', sections: ['Accumulated Context'], required: true });

    const compactResult = {
      current_milestone: result.current_milestone,
      current_milestone_name: result.current_milestone_name,
      project_exists: result.project_exists,
      roadmap_exists: result.roadmap_exists,
      state_exists: result.state_exists,
      research_enabled: result.research_enabled,
      _manifest: { files: manifestFiles },
    };
    return output(compactResult, raw);
  }

  output(result, raw);
}

function cmdInitQuick(cwd, description, raw) {
  const config = loadConfig(cwd);
  const now = new Date();
  const slug = description ? generateSlugInternal(description)?.substring(0, 40) : null;

  // Find next quick task number
  const quickDir = path.join(cwd, '.planning', 'quick');
  let nextNum = 1;
  try {
    const existing = fs.readdirSync(quickDir)
      .filter(f => /^\d+-/.test(f))
      .map(f => parseInt(f.split('-')[0], 10))
      .filter(n => !isNaN(n));
    if (existing.length > 0) {
      nextNum = Math.max(...existing) + 1;
    }
  } catch (e) { debugLog('init.quick', 'readdir failed', e); }

  const result = {
    // Models
    planner_model: resolveModelInternal(cwd, 'gsd-planner'),
    executor_model: resolveModelInternal(cwd, 'gsd-executor'),
    checker_model: resolveModelInternal(cwd, 'gsd-plan-checker'),
    verifier_model: resolveModelInternal(cwd, 'gsd-verifier'),

    // Config
    commit_docs: config.commit_docs,

    // Quick task info
    next_num: nextNum,
    slug: slug,
    description: description || null,

    // Timestamps
    date: now.toISOString().split('T')[0],
    timestamp: now.toISOString(),

    // Paths
    quick_dir: '.planning/quick',
    task_dir: slug ? `.planning/quick/${nextNum}-${slug}` : null,

    // File existence
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
    planning_exists: pathExistsInternal(cwd, '.planning'),

  };

  if (global._gsdCompactMode) {
    const manifestFiles = [];
    if (pathExistsInternal(cwd, '.planning/STATE.md')) manifestFiles.push({ path: '.planning/STATE.md', sections: ['Current Position'], required: false });

    const compactResult = {
      next_num: result.next_num,
      slug: result.slug,
      description: result.description,
      task_dir: result.task_dir,
      date: result.date,
      planning_exists: result.planning_exists,
      _manifest: { files: manifestFiles },
    };
    return output(compactResult, raw);
  }

  output(result, raw);
}

function cmdInitResume(cwd, raw) {
  const config = loadConfig(cwd);

  // Check for interrupted agent
  let interruptedAgentId = null;
  try {
    interruptedAgentId = fs.readFileSync(path.join(cwd, '.planning', 'current-agent-id.txt'), 'utf-8').trim();
  } catch (e) { debugLog('init.resume', 'read failed', e); }

  const result = {
    // File existence
    state_exists: pathExistsInternal(cwd, '.planning/STATE.md'),
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
    project_exists: pathExistsInternal(cwd, '.planning/PROJECT.md'),
    planning_exists: pathExistsInternal(cwd, '.planning'),

    // File paths
    state_path: '.planning/STATE.md',
    roadmap_path: '.planning/ROADMAP.md',
    project_path: '.planning/PROJECT.md',

    // Agent state
    has_interrupted_agent: !!interruptedAgentId,
    interrupted_agent_id: interruptedAgentId,

    // Config
    commit_docs: config.commit_docs,
  };

  if (global._gsdCompactMode) {
    const manifestFiles = [];
    if (result.state_exists) manifestFiles.push({ path: '.planning/STATE.md', required: true });
    if (result.roadmap_exists) manifestFiles.push({ path: '.planning/ROADMAP.md', sections: ['Progress'], required: true });

    const compactResult = {
      state_exists: result.state_exists,
      planning_exists: result.planning_exists,
      has_interrupted_agent: result.has_interrupted_agent,
      interrupted_agent_id: result.interrupted_agent_id,
      _manifest: { files: manifestFiles },
    };
    return output(compactResult, raw);
  }

  output(result, raw);
}

function cmdInitVerifyWork(cwd, phase, raw) {
  if (!phase) {
    error('phase required for init verify-work');
  }

  const config = loadConfig(cwd);
  const phaseInfo = findPhaseInternal(cwd, phase);

  const result = {
    // Models
    planner_model: resolveModelInternal(cwd, 'gsd-planner'),
    checker_model: resolveModelInternal(cwd, 'gsd-plan-checker'),

    // Config
    commit_docs: config.commit_docs,

    // Phase info
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory || null,
    phase_number: phaseInfo?.phase_number || null,
    phase_name: phaseInfo?.phase_name || null,

    // Existing artifacts
    has_verification: phaseInfo?.has_verification || false,
  };

  if (global._gsdCompactMode) {
    const manifestFiles = [];
    // Include plan and summary files from phase dir
    if (phaseInfo?.directory) {
      try {
        const phaseFiles = fs.readdirSync(path.join(cwd, phaseInfo.directory));
        phaseFiles.filter(f => f.endsWith('-PLAN.md')).forEach(f => {
          manifestFiles.push({ path: `${phaseInfo.directory}/${f}`, required: true });
        });
        phaseFiles.filter(f => f.endsWith('-SUMMARY.md')).forEach(f => {
          manifestFiles.push({ path: `${phaseInfo.directory}/${f}`, required: true });
        });
      } catch (e) { debugLog('init.verifyWork', 'manifest scan failed', e); }
    }
    if (pathExistsInternal(cwd, '.planning/ROADMAP.md')) {
      manifestFiles.push({ path: '.planning/ROADMAP.md', sections: [`Phase ${result.phase_number || ''}`], required: true });
    }

    const compactResult = {
      phase_found: result.phase_found,
      phase_dir: result.phase_dir,
      phase_number: result.phase_number,
      phase_name: result.phase_name,
      has_verification: result.has_verification,
      _manifest: { files: manifestFiles },
    };
    return output(compactResult, raw);
  }

  output(result, raw);
}

function cmdInitPhaseOp(cwd, phase, raw) {
  const config = loadConfig(cwd);
  let phaseInfo = findPhaseInternal(cwd, phase);

  // Fallback to ROADMAP.md if no directory exists (e.g., Plans: TBD)
  if (!phaseInfo) {
    const roadmapPhase = getRoadmapPhaseInternal(cwd, phase);
    if (roadmapPhase?.found) {
      const phaseName = roadmapPhase.phase_name;
      phaseInfo = {
        found: true,
        directory: null,
        phase_number: roadmapPhase.phase_number,
        phase_name: phaseName,
        phase_slug: phaseName ? phaseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : null,
        plans: [],
        summaries: [],
        incomplete_plans: [],
        has_research: false,
        has_context: false,
        has_verification: false,
      };
    }
  }

  const result = {
    // Config
    commit_docs: config.commit_docs,
    brave_search: config.brave_search,

    // Phase info
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory || null,
    phase_number: phaseInfo?.phase_number || null,
    phase_name: phaseInfo?.phase_name || null,
    phase_slug: phaseInfo?.phase_slug || null,
    padded_phase: phaseInfo?.phase_number?.padStart(2, '0') || null,

    // Existing artifacts
    has_research: phaseInfo?.has_research || false,
    has_context: phaseInfo?.has_context || false,
    has_plans: (phaseInfo?.plans?.length || 0) > 0,
    has_verification: phaseInfo?.has_verification || false,
    plan_count: phaseInfo?.plans?.length || 0,

    // File existence
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
    planning_exists: pathExistsInternal(cwd, '.planning'),

    // File paths
    state_path: '.planning/STATE.md',
    roadmap_path: '.planning/ROADMAP.md',
    requirements_path: '.planning/REQUIREMENTS.md',
  };

  if (phaseInfo?.directory) {
    const phaseDirFull = path.join(cwd, phaseInfo.directory);
    try {
      const files = fs.readdirSync(phaseDirFull);
      const contextFile = files.find(f => f.endsWith('-CONTEXT.md') || f === 'CONTEXT.md');
      if (contextFile) {
        result.context_path = path.join(phaseInfo.directory, contextFile);
      }
      const researchFile = files.find(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md');
      if (researchFile) {
        result.research_path = path.join(phaseInfo.directory, researchFile);
      }
      const verificationFile = files.find(f => f.endsWith('-VERIFICATION.md') || f === 'VERIFICATION.md');
      if (verificationFile) {
        result.verification_path = path.join(phaseInfo.directory, verificationFile);
      }
      const uatFile = files.find(f => f.endsWith('-UAT.md') || f === 'UAT.md');
      if (uatFile) {
        result.uat_path = path.join(phaseInfo.directory, uatFile);
      }
    } catch (e) { debugLog('init.phaseOp', 'read phase files failed', e); }
  }

  if (global._gsdCompactMode) {
    const compactResult = {
      phase_found: result.phase_found,
      phase_dir: result.phase_dir,
      phase_number: result.phase_number,
      phase_name: result.phase_name,
      phase_slug: result.phase_slug,
      padded_phase: result.padded_phase,
      has_research: result.has_research,
      has_context: result.has_context,
      has_plans: result.has_plans,
      has_verification: result.has_verification,
      plan_count: result.plan_count,
    };
    if (result.context_path) compactResult.context_path = result.context_path;
    if (result.research_path) compactResult.research_path = result.research_path;
    if (result.verification_path) compactResult.verification_path = result.verification_path;
    if (result.uat_path) compactResult.uat_path = result.uat_path;

    const manifestFiles = [
      { path: '.planning/STATE.md', sections: ['Current Position'], required: true },
      { path: '.planning/ROADMAP.md', sections: [`Phase ${result.phase_number || ''}`], required: true },
    ];
    if (pathExistsInternal(cwd, '.planning/REQUIREMENTS.md')) manifestFiles.push({ path: '.planning/REQUIREMENTS.md', required: false });
    if (result.context_path) manifestFiles.push({ path: result.context_path, required: false });
    if (result.research_path) manifestFiles.push({ path: result.research_path, required: false });
    compactResult._manifest = { files: manifestFiles };

    return output(compactResult, raw);
  }

  output(result, raw);
}

function cmdInitTodos(cwd, area, raw) {
  const config = loadConfig(cwd);
  const now = new Date();

  // List todos (reuse existing logic)
  const pendingDir = path.join(cwd, '.planning', 'todos', 'pending');
  let count = 0;
  const todos = [];

  try {
    const files = fs.readdirSync(pendingDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(pendingDir, file), 'utf-8');
        const createdMatch = content.match(/^created:\s*(.+)$/m);
        const titleMatch = content.match(/^title:\s*(.+)$/m);
        const areaMatch = content.match(/^area:\s*(.+)$/m);
        const todoArea = areaMatch ? areaMatch[1].trim() : 'general';

        if (area && todoArea !== area) continue;

        count++;
        todos.push({
          file,
          created: createdMatch ? createdMatch[1].trim() : 'unknown',
          title: titleMatch ? titleMatch[1].trim() : 'Untitled',
          area: todoArea,
          path: path.join('.planning', 'todos', 'pending', file),
        });
      } catch (e) { debugLog('init.todos', 'read todo file failed', e); }
    }
  } catch (e) { debugLog('init.todos', 'read pending dir failed', e); }

  const result = {
    // Config
    commit_docs: config.commit_docs,

    // Timestamps
    date: now.toISOString().split('T')[0],
    timestamp: now.toISOString(),

    // Todo inventory
    todo_count: count,
    todos,
    area_filter: area || null,

    // Paths
    pending_dir: '.planning/todos/pending',
    completed_dir: '.planning/todos/completed',

    // File existence
    planning_exists: pathExistsInternal(cwd, '.planning'),
    todos_dir_exists: pathExistsInternal(cwd, '.planning/todos'),
    pending_dir_exists: pathExistsInternal(cwd, '.planning/todos/pending'),
  };

  if (global._gsdCompactMode) {
    const manifestFiles = result.todos.map(t => ({ path: t.path, required: true }));

    const compactResult = {
      todo_count: result.todo_count,
      todos: result.todos,
      area_filter: result.area_filter,
      date: result.date,
      pending_dir_exists: result.pending_dir_exists,
      _manifest: { files: manifestFiles },
    };
    return output(compactResult, raw);
  }

  output(result, raw);
}

function cmdInitMilestoneOp(cwd, raw) {
  const config = loadConfig(cwd);
  const milestone = getMilestoneInfo(cwd);

  // Count phases
  let phaseCount = 0;
  let completedPhases = 0;
  const phasesDir = path.join(cwd, '.planning', 'phases');
  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    phaseCount = dirs.length;

    // Count phases with summaries (completed)
    for (const dir of dirs) {
      try {
        const phaseFiles = fs.readdirSync(path.join(phasesDir, dir));
        const hasSummary = phaseFiles.some(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
        if (hasSummary) completedPhases++;
      } catch (e) { debugLog('init.milestoneOp', 'readdir failed', e); }
    }
  } catch (e) { debugLog('init.milestoneOp', 'readdir failed', e); }

  // Check archive
  const archiveDir = path.join(cwd, '.planning', 'archive');
  let archivedMilestones = [];
  try {
    archivedMilestones = fs.readdirSync(archiveDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);
  } catch (e) { debugLog('init.milestoneOp', 'readdir failed', e); }

  const result = {
    // Config
    commit_docs: config.commit_docs,

    // Current milestone
    milestone_version: milestone.version,
    milestone_name: milestone.name,
    milestone_slug: generateSlugInternal(milestone.name),

    // Phase counts
    phase_count: phaseCount,
    completed_phases: completedPhases,
    all_phases_complete: phaseCount > 0 && phaseCount === completedPhases,

    // Archive
    archived_milestones: archivedMilestones,
    archive_count: archivedMilestones.length,

    // File existence
    project_exists: pathExistsInternal(cwd, '.planning/PROJECT.md'),
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
    state_exists: pathExistsInternal(cwd, '.planning/STATE.md'),
    archive_exists: pathExistsInternal(cwd, '.planning/archive'),
    phases_dir_exists: pathExistsInternal(cwd, '.planning/phases'),
  };

  if (global._gsdCompactMode) {
    const manifestFiles = [];
    if (result.roadmap_exists) manifestFiles.push({ path: '.planning/ROADMAP.md', sections: ['Milestones', 'Progress'], required: true });
    if (result.state_exists) manifestFiles.push({ path: '.planning/STATE.md', sections: ['Current Position'], required: true });

    const compactResult = {
      milestone_version: result.milestone_version,
      milestone_name: result.milestone_name,
      phase_count: result.phase_count,
      completed_phases: result.completed_phases,
      all_phases_complete: result.all_phases_complete,
      archived_milestones: result.archived_milestones,
      archive_count: result.archive_count,
      _manifest: { files: manifestFiles },
    };
    return output(compactResult, raw);
  }

  output(result, raw);
}

function cmdInitMapCodebase(cwd, raw) {
  const config = loadConfig(cwd);

  // Check for existing codebase maps
  const codebaseDir = path.join(cwd, '.planning', 'codebase');
  let existingMaps = [];
  try {
    existingMaps = fs.readdirSync(codebaseDir).filter(f => f.endsWith('.md'));
  } catch (e) { debugLog('init.mapCodebase', 'readdir failed', e); }

  const result = {
    // Models
    mapper_model: resolveModelInternal(cwd, 'gsd-codebase-mapper'),

    // Config
    commit_docs: config.commit_docs,
    search_gitignored: config.search_gitignored,
    parallelization: config.parallelization,

    // Paths
    codebase_dir: '.planning/codebase',

    // Existing maps
    existing_maps: existingMaps,
    has_maps: existingMaps.length > 0,

    // File existence
    planning_exists: pathExistsInternal(cwd, '.planning'),
    codebase_dir_exists: pathExistsInternal(cwd, '.planning/codebase'),
  };

  if (global._gsdCompactMode) {
    const manifestFiles = result.existing_maps.map(m => ({ path: `.planning/codebase/${m}`, required: false }));
    if (pathExistsInternal(cwd, '.planning/PROJECT.md')) manifestFiles.push({ path: '.planning/PROJECT.md', sections: ['Tech Stack'], required: false });

    const compactResult = {
      existing_maps: result.existing_maps,
      has_maps: result.has_maps,
      planning_exists: result.planning_exists,
      codebase_dir_exists: result.codebase_dir_exists,
      parallelization: result.parallelization,
      _manifest: { files: manifestFiles },
    };
    return output(compactResult, raw);
  }

  output(result, raw);
}

function cmdInitProgress(cwd, raw) {
  const config = loadConfig(cwd);
  const milestone = getMilestoneInfo(cwd);

  // Analyze phases — only include phases in current milestone range
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const phases = [];
  let currentPhase = null;
  let nextPhase = null;

  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();

    for (const dir of dirs) {
      const match = dir.match(/^(\d+(?:\.\d+)?)-?(.*)/);
      const phaseNumber = match ? match[1] : dir;

      // Filter to current milestone phase range if available
      if (milestone.phaseRange) {
        const num = parseInt(phaseNumber);
        if (num < milestone.phaseRange.start || num > milestone.phaseRange.end) continue;
      }
      const phaseName = match && match[2] ? match[2] : null;

      const phasePath = path.join(phasesDir, dir);
      const phaseFiles = fs.readdirSync(phasePath);

      const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
      const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
      const hasResearch = phaseFiles.some(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md');

      const status = summaries.length >= plans.length && plans.length > 0 ? 'complete' :
                     plans.length > 0 ? 'in_progress' :
                     hasResearch ? 'researched' : 'pending';

      const phaseInfo = {
        number: phaseNumber,
        name: phaseName,
        directory: path.join('.planning', 'phases', dir),
        status,
        plan_count: plans.length,
        summary_count: summaries.length,
        has_research: hasResearch,
      };

      phases.push(phaseInfo);

      // Find current (first incomplete with plans) and next (first pending)
      if (!currentPhase && (status === 'in_progress' || status === 'researched')) {
        currentPhase = phaseInfo;
      }
      if (!nextPhase && status === 'pending') {
        nextPhase = phaseInfo;
      }
    }
  } catch (e) { debugLog('init.progress', 'read phases failed', e); }

  // Check for paused work
  let pausedAt = null;
  try {
    const state = fs.readFileSync(path.join(cwd, '.planning', 'STATE.md'), 'utf-8');
    const pauseMatch = state.match(/\*\*Paused At:\*\*\s*(.+)/);
    if (pauseMatch) pausedAt = pauseMatch[1].trim();
  } catch (e) { debugLog('init.progress', 'read failed', e); }

  const result = {
    // Models
    executor_model: resolveModelInternal(cwd, 'gsd-executor'),
    planner_model: resolveModelInternal(cwd, 'gsd-planner'),

    // Config
    commit_docs: config.commit_docs,

    // Milestone
    milestone_version: milestone.version,
    milestone_name: milestone.name,

    // Phase overview
    phases,
    phase_count: phases.length,
    completed_count: phases.filter(p => p.status === 'complete').length,
    in_progress_count: phases.filter(p => p.status === 'in_progress').length,

    // Current state
    current_phase: currentPhase,
    next_phase: nextPhase,
    paused_at: pausedAt,
    has_work_in_progress: !!currentPhase,

    // File existence
    project_exists: pathExistsInternal(cwd, '.planning/PROJECT.md'),
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
    state_exists: pathExistsInternal(cwd, '.planning/STATE.md'),
    // File paths
    state_path: '.planning/STATE.md',
    roadmap_path: '.planning/ROADMAP.md',
    project_path: '.planning/PROJECT.md',
    config_path: '.planning/config.json',

    // Session diff (what changed since last session)
    session_diff: getSessionDiffSummary(cwd),
  };

  if (global._gsdCompactMode) {
    const manifestFiles = [];
    if (result.state_exists) manifestFiles.push({ path: '.planning/STATE.md', sections: ['Current Position'], required: false });
    if (result.roadmap_exists) manifestFiles.push({ path: '.planning/ROADMAP.md', sections: ['Progress'], required: false });

    const compactResult = {
      milestone_version: result.milestone_version,
      milestone_name: result.milestone_name,
      phases: result.phases,
      phase_count: result.phase_count,
      completed_count: result.completed_count,
      in_progress_count: result.in_progress_count,
      current_phase: result.current_phase,
      next_phase: result.next_phase,
      has_work_in_progress: result.has_work_in_progress,
      session_diff: result.session_diff,
      _manifest: { files: manifestFiles },
    };
    return output(compactResult, raw);
  }

  output(result, raw);
}

function getSessionDiffSummary(cwd) {
  try {
    const state = fs.readFileSync(path.join(cwd, '.planning', 'STATE.md'), 'utf-8');
    let since = null;
    const lastMatch = state.match(/\*\*Last Activity:\*\*\s*(\d{4}-\d{2}-\d{2})/);
    if (lastMatch) since = lastMatch[1];
    const sessionMatch = state.match(/\*\*Last session:\*\*\s*(\S+)/);
    if (sessionMatch && sessionMatch[1] > (since || '')) since = sessionMatch[1].split('T')[0];
    if (!since) return null;
    if (!isValidDateString(since)) {
      debugLog('feature.sessionDiff', `invalid date string rejected: ${since}`);
      return null;
    }

    const log = execSync(`git log --since=${sanitizeShellArg(since)} --oneline --no-merges -- .planning/ 2>/dev/null`, {
      cwd, encoding: 'utf-8', timeout: 5000
    }).trim();
    const commits = log ? log.split('\n').filter(Boolean) : [];
    return { since, commit_count: commits.length, recent: commits.slice(0, 5) };
  } catch (e) {
    debugLog('feature.sessionDiff', 'exec failed', e);
    return null;
  }
}

module.exports = {
  cmdInitExecutePhase,
  cmdInitPlanPhase,
  cmdInitNewProject,
  cmdInitNewMilestone,
  cmdInitQuick,
  cmdInitResume,
  cmdInitVerifyWork,
  cmdInitPhaseOp,
  cmdInitTodos,
  cmdInitMilestoneOp,
  cmdInitMapCodebase,
  cmdInitProgress,
  getSessionDiffSummary,
};
