var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/plugin/parsers/state.js
import { readFileSync } from "fs";
import { join as join3 } from "path";
function extractField(content, fieldName) {
  const pattern = new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*(.+)`, "i");
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}
function extractSection(content, sectionName) {
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`##\\s*${escaped}\\s*\\n([\\s\\S]*?)(?=\\n##|$)`, "i");
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}
function extractProgress(content) {
  const match = content.match(/\[[\u2588\u2591]+\]\s*(\d+)%/);
  return match ? parseInt(match[1], 10) : null;
}
function parseState(cwd) {
  const resolvedCwd = cwd || process.cwd();
  if (_cache.has(resolvedCwd)) {
    return _cache.get(resolvedCwd);
  }
  const statePath = join3(resolvedCwd, ".planning", "STATE.md");
  let raw;
  try {
    raw = readFileSync(statePath, "utf-8");
  } catch {
    return null;
  }
  if (!raw || raw.trim().length === 0) {
    return null;
  }
  const result = Object.freeze({
    raw,
    phase: extractField(raw, "Phase"),
    currentPlan: extractField(raw, "Current Plan"),
    status: extractField(raw, "Status"),
    lastActivity: extractField(raw, "Last Activity"),
    progress: extractProgress(raw),
    getField(name) {
      return extractField(raw, name);
    },
    getSection(name) {
      return extractSection(raw, name);
    }
  });
  _cache.set(resolvedCwd, result);
  return result;
}
function invalidateState(cwd) {
  if (cwd) {
    _cache.delete(cwd);
  } else {
    _cache.clear();
  }
}
var _cache;
var init_state = __esm({
  "src/plugin/parsers/state.js"() {
    _cache = /* @__PURE__ */ new Map();
  }
});

// src/plugin/parsers/roadmap.js
import { readFileSync as readFileSync2 } from "fs";
import { join as join4 } from "path";
function parseMilestones(content) {
  const milestones = [];
  const pattern = /[-*]\s*(?:✅|🔵|🔲)\s*\*\*v(\d+(?:\.\d+)*)\s+([^*]+)\*\*([^\n]*)/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const status = match[0].includes("\u2705") ? "complete" : match[0].includes("\u{1F535}") ? "active" : "pending";
    const rangeMatch = match[0].match(/Phases?\s+(\d+)\s*[-–]\s*(\d+)/i);
    const phases = rangeMatch ? { start: parseInt(rangeMatch[1], 10), end: parseInt(rangeMatch[2], 10) } : null;
    milestones.push(Object.freeze({
      name: match[2].trim(),
      version: "v" + match[1],
      status,
      phases
    }));
  }
  return milestones;
}
function parsePhases(content) {
  const phases = [];
  const pattern = /#{2,4}\s*Phase\s+(\d+(?:\.\d+)?)\s*:\s*([^\n]+)/gi;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const number = match[1];
    const name = match[2].trim();
    const sectionStart = match.index;
    const restOfContent = content.slice(sectionStart);
    const nextHeader = restOfContent.match(/\n#{2,4}\s+Phase\s+\d/i);
    const sectionEnd = nextHeader ? sectionStart + nextHeader.index : content.length;
    const section = content.slice(sectionStart, sectionEnd).trim();
    const goalMatch = section.match(/\*\*Goal:?\*\*:?\s*([^\n]+)/i);
    const goal = goalMatch ? goalMatch[1].trim() : null;
    const plansMatch = section.match(/\*\*Plans:?\*\*:?\s*(?:(\d+)\/)?(\d+)\s*plan/i);
    const planCount = plansMatch ? parseInt(plansMatch[2], 10) : 0;
    const escaped = number.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const checkboxPattern = new RegExp(`-\\s*\\[x\\]\\s*.*Phase\\s+${escaped}`, "i");
    const status = checkboxPattern.test(content) ? "complete" : "incomplete";
    phases.push(Object.freeze({
      number,
      name,
      status,
      planCount,
      goal,
      section
    }));
  }
  return phases;
}
function parseProgressTable(content) {
  const progress = [];
  const tableMatch = content.match(/\|[^\n]*Phase[^\n]*\|[^\n]*Plans?[^\n]*\|[^\n]*Status[^\n]*\|[^\n]*\n\|[-|\s]+\n((?:\|[^\n]+\n?)*)/i);
  if (!tableMatch) return progress;
  const rows = tableMatch[1].trim().split("\n");
  for (const row of rows) {
    const cells = row.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length >= 3) {
      const plansParts = cells[1].match(/(\d+)\/(\d+)/);
      progress.push(Object.freeze({
        phase: cells[0],
        milestone: null,
        // Can be derived from position if needed
        plansComplete: plansParts ? parseInt(plansParts[1], 10) : 0,
        plansTotal: plansParts ? parseInt(plansParts[2], 10) : 0,
        status: cells[2],
        completed: cells.length >= 4 ? cells[3] || null : null
      }));
    }
  }
  return progress;
}
function parseRoadmap(cwd) {
  const resolvedCwd = cwd || process.cwd();
  if (_cache2.has(resolvedCwd)) {
    return _cache2.get(resolvedCwd);
  }
  const roadmapPath = join4(resolvedCwd, ".planning", "ROADMAP.md");
  let raw;
  try {
    raw = readFileSync2(roadmapPath, "utf-8");
  } catch {
    return null;
  }
  if (!raw || raw.trim().length === 0) {
    return null;
  }
  const milestones = parseMilestones(raw);
  const phases = parsePhases(raw);
  const progress = parseProgressTable(raw);
  const result = Object.freeze({
    raw,
    milestones,
    phases,
    progress,
    getPhase(num) {
      const numStr = String(num);
      const found = phases.find((p) => p.number === numStr);
      if (!found) return null;
      const section = found.section;
      const dependsMatch = section.match(/\*\*Depends on:?\*\*:?\s*([^\n]+)/i);
      const dependsOn = dependsMatch ? dependsMatch[1].trim() : null;
      const reqMatch = section.match(/\*\*Requirements:?\*\*:?\s*([^\n]+)/i);
      const requirements = reqMatch ? reqMatch[1].trim() : null;
      const criteriaMatch = section.match(/\*\*Success Criteria\*\*[^\n]*:\s*\n((?:\s*\d+\.\s*[^\n]+\n?)+)/i);
      const successCriteria = criteriaMatch ? criteriaMatch[1].trim().split("\n").map((l) => l.replace(/^\s*\d+\.\s*/, "").trim()).filter(Boolean) : [];
      const plansMatch = section.match(/\*\*Plans:?\*\*:?\s*(?:(\d+)\/)?(\d+)\s*plan/i);
      const plans = plansMatch ? {
        completed: plansMatch[1] ? parseInt(plansMatch[1], 10) : 0,
        total: parseInt(plansMatch[2], 10)
      } : null;
      return Object.freeze({
        number: found.number,
        name: found.name,
        goal: found.goal,
        dependsOn,
        requirements,
        successCriteria,
        plans
      });
    },
    getMilestone(name) {
      return milestones.find(
        (m) => m.name.toLowerCase().includes(name.toLowerCase()) || m.version.toLowerCase() === name.toLowerCase()
      ) || null;
    },
    get currentMilestone() {
      return milestones.find((m) => m.status === "active") || null;
    }
  });
  _cache2.set(resolvedCwd, result);
  return result;
}
function invalidateRoadmap(cwd) {
  if (cwd) {
    _cache2.delete(cwd);
  } else {
    _cache2.clear();
  }
}
var _cache2;
var init_roadmap = __esm({
  "src/plugin/parsers/roadmap.js"() {
    _cache2 = /* @__PURE__ */ new Map();
  }
});

// src/plugin/parsers/plan.js
import { readFileSync as readFileSync3, readdirSync } from "fs";
import { join as join5 } from "path";
function extractFrontmatter(content) {
  if (!content || typeof content !== "string") return {};
  if (!content.startsWith("---\n")) return {};
  const frontmatter = {};
  const match = content.match(FM_DELIMITERS);
  if (!match) return frontmatter;
  const yaml = match[1];
  const lines = yaml.split("\n");
  let stack = [{ obj: frontmatter, key: null, indent: -1 }];
  for (const line of lines) {
    if (line.trim() === "") continue;
    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1].length : 0;
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const current = stack[stack.length - 1];
    const keyMatch = line.match(FM_KEY_VALUE);
    if (keyMatch) {
      const key = keyMatch[2];
      const value = keyMatch[3].trim();
      if (value === "" || value === "[") {
        current.obj[key] = value === "[" ? [] : {};
        current.key = null;
        stack.push({ obj: current.obj[key], key: null, indent });
      } else if (value.startsWith("[") && value.endsWith("]")) {
        current.obj[key] = value.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
        current.key = null;
      } else {
        current.obj[key] = value.replace(/^["']|["']$/g, "");
        current.key = null;
      }
    } else if (line.trim().startsWith("- ")) {
      const itemValue = line.trim().slice(2).replace(/^["']|["']$/g, "");
      if (typeof current.obj === "object" && !Array.isArray(current.obj) && Object.keys(current.obj).length === 0) {
        const parent = stack.length > 1 ? stack[stack.length - 2] : null;
        if (parent) {
          for (const k of Object.keys(parent.obj)) {
            if (parent.obj[k] === current.obj) {
              parent.obj[k] = [itemValue];
              current.obj = parent.obj[k];
              break;
            }
          }
        }
      } else if (Array.isArray(current.obj)) {
        current.obj.push(itemValue);
      }
    }
  }
  return frontmatter;
}
function extractXmlSection(content, tagName) {
  const pattern = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`);
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}
function extractTasks(content) {
  const tasksSection = extractXmlSection(content, "tasks");
  if (!tasksSection) return [];
  const tasks = [];
  const taskPattern = /<task\s+([^>]*)>([\s\S]*?)<\/task>/g;
  let match;
  while ((match = taskPattern.exec(tasksSection)) !== null) {
    const attrs = match[1];
    const body = match[2];
    const typeMatch = attrs.match(/type="([^"]+)"/);
    const type = typeMatch ? typeMatch[1] : "auto";
    const nameMatch = body.match(/<name>([\s\S]*?)<\/name>/);
    const filesMatch = body.match(/<files>([\s\S]*?)<\/files>/);
    const actionMatch = body.match(/<action>([\s\S]*?)<\/action>/);
    const verifyMatch = body.match(/<verify>([\s\S]*?)<\/verify>/);
    const doneMatch = body.match(/<done>([\s\S]*?)<\/done>/);
    tasks.push(Object.freeze({
      type,
      name: nameMatch ? nameMatch[1].trim() : null,
      files: filesMatch ? filesMatch[1].trim().split(",").map((f) => f.trim()).filter(Boolean) : [],
      action: actionMatch ? actionMatch[1].trim() : null,
      verify: verifyMatch ? verifyMatch[1].trim() : null,
      done: doneMatch ? doneMatch[1].trim() : null
    }));
  }
  return tasks;
}
function parsePlan(planPath) {
  if (_planCache.has(planPath)) {
    return _planCache.get(planPath);
  }
  let raw;
  try {
    raw = readFileSync3(planPath, "utf-8");
  } catch {
    return null;
  }
  if (!raw || raw.trim().length === 0) {
    return null;
  }
  const frontmatter = extractFrontmatter(raw);
  const tasks = extractTasks(raw);
  const result = Object.freeze({
    raw,
    path: planPath,
    frontmatter: Object.freeze(frontmatter),
    objective: extractXmlSection(raw, "objective"),
    context: extractXmlSection(raw, "context"),
    tasks,
    verification: extractXmlSection(raw, "verification"),
    successCriteria: extractXmlSection(raw, "success_criteria"),
    output: extractXmlSection(raw, "output")
  });
  _planCache.set(planPath, result);
  return result;
}
function parsePlans(phaseNum, cwd) {
  const resolvedCwd = cwd || process.cwd();
  const cacheKey = `${resolvedCwd}:${phaseNum}`;
  if (_plansCache.has(cacheKey)) {
    return _plansCache.get(cacheKey);
  }
  const numStr = String(phaseNum).padStart(2, "0");
  const phasesDir = join5(resolvedCwd, ".planning", "phases");
  let phaseDir = null;
  try {
    const entries = readdirSync(phasesDir);
    const dirName = entries.find((d) => d.startsWith(numStr + "-") || d === numStr);
    if (dirName) {
      phaseDir = join5(phasesDir, dirName);
    }
  } catch {
    return Object.freeze([]);
  }
  if (!phaseDir) {
    return Object.freeze([]);
  }
  let planFiles;
  try {
    const files = readdirSync(phaseDir);
    planFiles = files.filter((f) => f.endsWith("-PLAN.md") || f === "PLAN.md").sort();
  } catch {
    return Object.freeze([]);
  }
  const plans = planFiles.map((f) => parsePlan(join5(phaseDir, f))).filter(Boolean);
  const frozen = Object.freeze(plans);
  _plansCache.set(cacheKey, frozen);
  return frozen;
}
function invalidatePlans(cwd) {
  if (cwd) {
    for (const key of _plansCache.keys()) {
      if (key.startsWith(cwd + ":")) {
        _plansCache.delete(key);
      }
    }
    for (const key of _planCache.keys()) {
      if (key.startsWith(cwd)) {
        _planCache.delete(key);
      }
    }
  } else {
    _planCache.clear();
    _plansCache.clear();
  }
}
var _planCache, _plansCache, FM_DELIMITERS, FM_KEY_VALUE;
var init_plan = __esm({
  "src/plugin/parsers/plan.js"() {
    _planCache = /* @__PURE__ */ new Map();
    _plansCache = /* @__PURE__ */ new Map();
    FM_DELIMITERS = /^---\n([\s\S]+?)\n---/;
    FM_KEY_VALUE = /^(\s*)([a-zA-Z0-9_-]+):\s*(.*)/;
  }
});

// src/plugin/parsers/config.js
import { readFileSync as readFileSync4 } from "fs";
import { join as join6 } from "path";
function parseConfig(cwd) {
  const resolvedCwd = cwd || process.cwd();
  if (_cache3.has(resolvedCwd)) {
    return _cache3.get(resolvedCwd);
  }
  const configPath = join6(resolvedCwd, ".planning", "config.json");
  let parsed = {};
  try {
    const raw = readFileSync4(configPath, "utf-8");
    parsed = JSON.parse(raw);
  } catch {
    const defaults = Object.freeze({ ...CONFIG_DEFAULTS });
    _cache3.set(resolvedCwd, defaults);
    return defaults;
  }
  const result = {};
  for (const [key, defaultValue] of Object.entries(CONFIG_DEFAULTS)) {
    if (parsed[key] !== void 0) {
      if (key === "parallelization") {
        if (typeof parsed[key] === "boolean") {
          result[key] = parsed[key];
        } else if (typeof parsed[key] === "object" && parsed[key] !== null && "enabled" in parsed[key]) {
          result[key] = parsed[key].enabled;
        } else {
          result[key] = defaultValue;
        }
      } else if (NESTED_OBJECT_KEYS.has(key)) {
        if (typeof parsed[key] === "object" && parsed[key] !== null) {
          result[key] = Object.freeze({ ...defaultValue, ...parsed[key] });
        } else {
          result[key] = defaultValue;
        }
      } else {
        result[key] = parsed[key];
      }
    } else if (parsed.workflow && ["research", "plan_checker", "verifier"].includes(key)) {
      const nestedKey = key === "plan_checker" ? "plan_check" : key;
      if (parsed.workflow[nestedKey] !== void 0) {
        result[key] = parsed.workflow[nestedKey];
      } else if (parsed.workflow[key] !== void 0) {
        result[key] = parsed.workflow[key];
      } else {
        result[key] = defaultValue;
      }
    } else {
      result[key] = defaultValue;
    }
  }
  const frozen = Object.freeze(result);
  _cache3.set(resolvedCwd, frozen);
  return frozen;
}
function invalidateConfig(cwd) {
  if (cwd) {
    _cache3.delete(cwd);
  } else {
    _cache3.clear();
  }
}
var _cache3, CONFIG_DEFAULTS, NESTED_OBJECT_KEYS;
var init_config = __esm({
  "src/plugin/parsers/config.js"() {
    _cache3 = /* @__PURE__ */ new Map();
    CONFIG_DEFAULTS = Object.freeze({
      mode: "interactive",
      depth: "standard",
      model_profile: "balanced",
      commit_docs: true,
      branching_strategy: "none",
      phase_branch_template: "phase-{number}-{name}",
      milestone_branch_template: "{version}",
      parallelization: false,
      research: true,
      plan_checker: true,
      verifier: true,
      staleness_threshold: 2,
      // Phase 75: Event-driven state sync settings
      idle_validation: Object.freeze({
        enabled: true,
        cooldown_seconds: 5,
        staleness_threshold_hours: 2
      }),
      notifications: Object.freeze({
        enabled: true,
        os_notifications: true,
        dnd_mode: false,
        rate_limit_per_minute: 5,
        sound: false
      }),
      stuck_detection: Object.freeze({
        error_threshold: 3,
        spinning_threshold: 5
      }),
      file_watcher: Object.freeze({
        debounce_ms: 200,
        max_watched_paths: 500
      }),
      // Phase 76: Advisory guardrails settings
      advisory_guardrails: Object.freeze({
        enabled: true,
        conventions: true,
        planning_protection: true,
        test_suggestions: true,
        convention_confidence_threshold: 70,
        dedup_threshold: 3,
        test_debounce_ms: 500
      })
    });
    NESTED_OBJECT_KEYS = /* @__PURE__ */ new Set([
      "idle_validation",
      "notifications",
      "stuck_detection",
      "file_watcher",
      "advisory_guardrails"
    ]);
  }
});

// src/plugin/parsers/project.js
import { readFileSync as readFileSync5 } from "fs";
import { join as join7 } from "path";
function parseProject(cwd) {
  const resolvedCwd = cwd || process.cwd();
  if (_cache4.has(resolvedCwd)) {
    return _cache4.get(resolvedCwd);
  }
  const projectPath = join7(resolvedCwd, ".planning", "PROJECT.md");
  let raw;
  try {
    raw = readFileSync5(projectPath, "utf-8");
  } catch {
    return null;
  }
  if (!raw || raw.trim().length === 0) {
    return null;
  }
  const coreValueMatch = raw.match(/##\s*Core\s+Value\s*\n+([^\n]+)/i) || raw.match(/\*\*Core\s+[Vv]alue:?\*\*:?\s*([^\n]+)/i);
  const coreValue = coreValueMatch ? coreValueMatch[1].trim() : null;
  const techStackMatch = raw.match(/Tech\s+stack:\s*([^\n]+)/i) || raw.match(/\*\*Tech:?\*\*:?\s*([^\n]+)/i);
  const techStack = techStackMatch ? techStackMatch[1].trim() : null;
  const milestoneMatch = raw.match(/##\s*Current\s+Milestone:\s*([^\n]+)/i);
  const currentMilestone = milestoneMatch ? milestoneMatch[1].trim() : null;
  const result = Object.freeze({
    raw,
    coreValue,
    techStack,
    currentMilestone
  });
  _cache4.set(resolvedCwd, result);
  return result;
}
function invalidateProject(cwd) {
  if (cwd) {
    _cache4.delete(cwd);
  } else {
    _cache4.clear();
  }
}
var _cache4;
var init_project = __esm({
  "src/plugin/parsers/project.js"() {
    _cache4 = /* @__PURE__ */ new Map();
  }
});

// src/plugin/parsers/intent.js
import { readFileSync as readFileSync6 } from "fs";
import { join as join8 } from "path";
function parseIntent(cwd) {
  const resolvedCwd = cwd || process.cwd();
  if (_cache5.has(resolvedCwd)) {
    return _cache5.get(resolvedCwd);
  }
  const intentPath = join8(resolvedCwd, ".planning", "INTENT.md");
  let raw;
  try {
    raw = readFileSync6(intentPath, "utf-8");
  } catch {
    return null;
  }
  if (!raw || raw.trim().length === 0) {
    return null;
  }
  const objectiveMatch = raw.match(/<objective>([\s\S]*?)<\/objective>/);
  const objective = objectiveMatch ? objectiveMatch[1].trim() : null;
  const outcomesMatch = raw.match(/<outcomes>([\s\S]*?)<\/outcomes>/);
  const outcomes = [];
  if (outcomesMatch) {
    const outcomesContent = outcomesMatch[1];
    const entryPattern = /-\s*(DO-\d+)\s*(?:\[P\d+\])?\s*:\s*([^\n]+)/g;
    let match;
    while ((match = entryPattern.exec(outcomesContent)) !== null) {
      outcomes.push(Object.freeze({
        id: match[1],
        text: match[2].trim()
      }));
    }
  }
  const result = Object.freeze({
    raw,
    objective,
    outcomes: Object.freeze(outcomes)
  });
  _cache5.set(resolvedCwd, result);
  return result;
}
function invalidateIntent(cwd) {
  if (cwd) {
    _cache5.delete(cwd);
  } else {
    _cache5.clear();
  }
}
var _cache5;
var init_intent = __esm({
  "src/plugin/parsers/intent.js"() {
    _cache5 = /* @__PURE__ */ new Map();
  }
});

// src/plugin/parsers/index.js
var parsers_exports = {};
__export(parsers_exports, {
  invalidateAll: () => invalidateAll,
  invalidateConfig: () => invalidateConfig,
  invalidateIntent: () => invalidateIntent,
  invalidatePlans: () => invalidatePlans,
  invalidateProject: () => invalidateProject,
  invalidateRoadmap: () => invalidateRoadmap,
  invalidateState: () => invalidateState,
  parseConfig: () => parseConfig,
  parseIntent: () => parseIntent,
  parsePlan: () => parsePlan,
  parsePlans: () => parsePlans,
  parseProject: () => parseProject,
  parseRoadmap: () => parseRoadmap,
  parseState: () => parseState
});
function invalidateAll(cwd) {
  invalidateState(cwd);
  invalidateRoadmap(cwd);
  invalidatePlans(cwd);
  invalidateConfig(cwd);
  invalidateProject(cwd);
  invalidateIntent(cwd);
}
var init_parsers = __esm({
  "src/plugin/parsers/index.js"() {
    init_state();
    init_roadmap();
    init_plan();
    init_config();
    init_project();
    init_intent();
    init_state();
    init_roadmap();
    init_plan();
    init_config();
    init_project();
    init_intent();
  }
});

// src/lib/decision-rules.js
var require_decision_rules = __commonJS({
  "src/lib/decision-rules.js"(exports, module) {
    function resolveContextGate(state) {
      const present = Boolean(state && state.context_present);
      return { value: present, confidence: "HIGH", rule_id: "context-gate" };
    }
    function resolveProgressRoute(state) {
      const {
        plan_count = 0,
        summary_count = 0,
        uat_gap_count = 0,
        current_phase,
        highest_phase,
        roadmap_exists = false,
        project_exists = false,
        state_exists = false
      } = state || {};
      if (!state_exists && !roadmap_exists && !project_exists) {
        return { value: "no-project", confidence: "HIGH", rule_id: "progress-route" };
      }
      if (!state_exists) {
        return { value: "no-state", confidence: "HIGH", rule_id: "progress-route" };
      }
      if (!roadmap_exists && project_exists) {
        return { value: "F", confidence: "HIGH", rule_id: "progress-route" };
      }
      if (uat_gap_count > 0) {
        return { value: "E", confidence: "HIGH", rule_id: "progress-route" };
      }
      if (summary_count < plan_count) {
        return { value: "A", confidence: "HIGH", rule_id: "progress-route" };
      }
      if (summary_count === plan_count && plan_count > 0) {
        return current_phase < highest_phase ? { value: "C", confidence: "HIGH", rule_id: "progress-route" } : { value: "D", confidence: "HIGH", rule_id: "progress-route" };
      }
      if (plan_count === 0) {
        return { value: "B", confidence: "HIGH", rule_id: "progress-route" };
      }
      return { value: "F", confidence: "MEDIUM", rule_id: "progress-route" };
    }
    function resolveResumeRoute(state) {
      const {
        has_state = false,
        has_roadmap = false,
        has_plans = false,
        has_incomplete_plans = false,
        has_blockers = false,
        phase_complete = false
      } = state || {};
      if (!has_state) {
        return { value: "initialize", confidence: "HIGH", rule_id: "resume-route" };
      }
      if (has_blockers) {
        return { value: "resolve-blockers", confidence: "HIGH", rule_id: "resume-route" };
      }
      if (has_incomplete_plans) {
        return { value: "continue-execution", confidence: "HIGH", rule_id: "resume-route" };
      }
      if (phase_complete && has_roadmap) {
        return { value: "next-phase", confidence: "HIGH", rule_id: "resume-route" };
      }
      if (has_plans && !has_incomplete_plans) {
        return { value: "verify-or-advance", confidence: "MEDIUM", rule_id: "resume-route" };
      }
      if (!has_plans && has_roadmap) {
        return { value: "plan-phase", confidence: "HIGH", rule_id: "resume-route" };
      }
      return { value: "review-state", confidence: "MEDIUM", rule_id: "resume-route" };
    }
    function resolveExecutionPattern(state) {
      const { task_types = [] } = state || {};
      const hasDecisionCheckpoints = task_types.some(
        (t) => typeof t === "string" && t.startsWith("checkpoint:decision")
      );
      const hasOtherCheckpoints = task_types.some(
        (t) => typeof t === "string" && t.startsWith("checkpoint:") && !t.startsWith("checkpoint:decision")
      );
      if (hasDecisionCheckpoints) {
        return { value: "C", confidence: "HIGH", rule_id: "execution-pattern" };
      }
      if (hasOtherCheckpoints) {
        return { value: "B", confidence: "HIGH", rule_id: "execution-pattern" };
      }
      return { value: "A", confidence: "HIGH", rule_id: "execution-pattern" };
    }
    function resolveContextBudgetGate(state) {
      const { warning = false, mode = "interactive" } = state || {};
      if (!warning) {
        return { value: "proceed", confidence: "HIGH", rule_id: "context-budget-gate" };
      }
      if (mode === "yolo") {
        return { value: "warn", confidence: "HIGH", rule_id: "context-budget-gate" };
      }
      return { value: "stop", confidence: "HIGH", rule_id: "context-budget-gate" };
    }
    function resolvePreviousCheckGate(state) {
      const {
        has_previous_summary = false,
        has_unresolved_issues = false,
        has_blockers = false
      } = state || {};
      if (!has_previous_summary) {
        return { value: "proceed", confidence: "HIGH", rule_id: "previous-check-gate" };
      }
      if (has_blockers) {
        return { value: "block", confidence: "HIGH", rule_id: "previous-check-gate" };
      }
      if (has_unresolved_issues) {
        return { value: "warn", confidence: "HIGH", rule_id: "previous-check-gate" };
      }
      return { value: "proceed", confidence: "HIGH", rule_id: "previous-check-gate" };
    }
    function resolveCiGate(state) {
      const {
        ci_enabled = false,
        has_test_command = false,
        tests_passing = true
      } = state || {};
      if (!ci_enabled) {
        return { value: "skip", confidence: "HIGH", rule_id: "ci-gate" };
      }
      if (!has_test_command) {
        return { value: "warn", confidence: "HIGH", rule_id: "ci-gate" };
      }
      if (!tests_passing) {
        return { value: "warn", confidence: "HIGH", rule_id: "ci-gate" };
      }
      return { value: "run", confidence: "HIGH", rule_id: "ci-gate" };
    }
    function resolvePlanExistenceRoute(state) {
      const {
        plan_count = 0,
        has_research = false,
        has_context = false
      } = state || {};
      if (plan_count > 0) {
        return { value: "has-plans", confidence: "HIGH", rule_id: "plan-existence-route" };
      }
      if (has_research || has_context) {
        return { value: "needs-planning", confidence: "HIGH", rule_id: "plan-existence-route" };
      }
      return { value: "needs-research", confidence: "HIGH", rule_id: "plan-existence-route" };
    }
    function resolveBranchHandling(state) {
      const {
        branching_strategy = "none",
        has_branch = false,
        branch_behind = false
      } = state || {};
      if (branching_strategy === "none") {
        return { value: "skip", confidence: "HIGH", rule_id: "branch-handling" };
      }
      if (!has_branch) {
        return { value: "create", confidence: "MEDIUM", rule_id: "branch-handling" };
      }
      if (branch_behind) {
        return { value: "update", confidence: "MEDIUM", rule_id: "branch-handling" };
      }
      return { value: "use-existing", confidence: "MEDIUM", rule_id: "branch-handling" };
    }
    function resolveAutoAdvance(state) {
      const {
        auto_advance_config = false,
        auto_flag = false
      } = state || {};
      const shouldAdvance = Boolean(auto_advance_config || auto_flag);
      return { value: shouldAdvance, confidence: "HIGH", rule_id: "auto-advance" };
    }
    function resolvePhaseArgParse(state) {
      const { raw_arg } = state || {};
      if (raw_arg === void 0 || raw_arg === null || raw_arg === "") {
        return { value: null, confidence: "HIGH", rule_id: "phase-arg-parse" };
      }
      const str = String(raw_arg).trim();
      const match = str.match(/^(?:phase\s+)?(\d+(?:\.\d+)?)/i);
      if (match) {
        const num = parseFloat(match[1]);
        if (!isNaN(num) && num > 0) {
          return { value: num, confidence: "HIGH", rule_id: "phase-arg-parse" };
        }
      }
      return { value: null, confidence: "HIGH", rule_id: "phase-arg-parse" };
    }
    function resolveDebugHandlerRoute(state) {
      const { return_type } = state || {};
      if (!return_type || typeof return_type !== "string") {
        return { value: "manual", confidence: "MEDIUM", rule_id: "debug-handler-route" };
      }
      const type = return_type.toLowerCase();
      if (type === "fix" || type === "auto-fix") {
        return { value: "fix", confidence: "MEDIUM", rule_id: "debug-handler-route" };
      }
      if (type === "plan" || type === "needs-plan") {
        return { value: "plan", confidence: "MEDIUM", rule_id: "debug-handler-route" };
      }
      if (type === "continue" || type === "resolved") {
        return { value: "continue", confidence: "MEDIUM", rule_id: "debug-handler-route" };
      }
      return { value: "manual", confidence: "MEDIUM", rule_id: "debug-handler-route" };
    }
    var DECISION_REGISTRY = [
      {
        id: "context-gate",
        name: "Context Gate Check",
        category: "state-assessment",
        description: "Checks if bgsd-context is present (enricher loaded)",
        inputs: ["context_present"],
        outputs: ["boolean"],
        confidence_range: ["HIGH"],
        resolve: resolveContextGate
      },
      {
        id: "progress-route",
        name: "Progress Workflow Route Selection",
        category: "workflow-routing",
        description: "Determines which route (A-F) the progress workflow should take",
        inputs: ["plan_count", "summary_count", "uat_gap_count", "current_phase", "highest_phase", "roadmap_exists", "project_exists", "state_exists"],
        outputs: ["route_letter"],
        confidence_range: ["HIGH", "MEDIUM"],
        resolve: resolveProgressRoute
      },
      {
        id: "resume-route",
        name: "Resume Project Next-Action",
        category: "workflow-routing",
        description: "Determines the next action when resuming a project",
        inputs: ["has_state", "has_roadmap", "has_plans", "has_incomplete_plans", "has_blockers", "phase_complete"],
        outputs: ["action_string"],
        confidence_range: ["HIGH", "MEDIUM"],
        resolve: resolveResumeRoute
      },
      {
        id: "execution-pattern",
        name: "Execution Pattern Selection",
        category: "execution-mode",
        description: "Determines execute-plan Pattern A/B/C based on task types",
        inputs: ["task_types"],
        outputs: ["pattern_letter"],
        confidence_range: ["HIGH"],
        resolve: resolveExecutionPattern
      },
      {
        id: "context-budget-gate",
        name: "Context Budget Warning Gate",
        category: "state-assessment",
        description: "Checks if plan execution should proceed based on context budget",
        inputs: ["warning", "mode"],
        outputs: ["proceed_warn_stop"],
        confidence_range: ["HIGH"],
        resolve: resolveContextBudgetGate
      },
      {
        id: "previous-check-gate",
        name: "Previous Summary Blocker Check",
        category: "state-assessment",
        description: "Checks if previous SUMMARY has unresolved issues or blockers",
        inputs: ["has_previous_summary", "has_unresolved_issues", "has_blockers"],
        outputs: ["proceed_warn_block"],
        confidence_range: ["HIGH"],
        resolve: resolvePreviousCheckGate
      },
      {
        id: "ci-gate",
        name: "CI Quality Gate Check",
        category: "execution-mode",
        description: "Determines whether to run CI, skip, or warn about configuration",
        inputs: ["ci_enabled", "has_test_command", "tests_passing"],
        outputs: ["run_skip_warn"],
        confidence_range: ["HIGH"],
        resolve: resolveCiGate
      },
      {
        id: "plan-existence-route",
        name: "Plan Existence Route",
        category: "workflow-routing",
        description: "Determines if a phase has plans or needs planning/research",
        inputs: ["plan_count", "has_research", "has_context"],
        outputs: ["routing_advice"],
        confidence_range: ["HIGH"],
        resolve: resolvePlanExistenceRoute
      },
      {
        id: "branch-handling",
        name: "Branch Merge Strategy",
        category: "configuration",
        description: "Determines branch handling strategy based on config and state",
        inputs: ["branching_strategy", "has_branch", "branch_behind"],
        outputs: ["strategy"],
        confidence_range: ["HIGH", "MEDIUM"],
        resolve: resolveBranchHandling
      },
      {
        id: "auto-advance",
        name: "Auto-Advance Config Check",
        category: "configuration",
        description: "Determines if plan should auto-advance to next plan after completion",
        inputs: ["auto_advance_config", "auto_flag"],
        outputs: ["boolean"],
        confidence_range: ["HIGH"],
        resolve: resolveAutoAdvance
      },
      {
        id: "phase-arg-parse",
        name: "Phase Argument Parser",
        category: "argument-parsing",
        description: "Parses a raw argument string into a phase number",
        inputs: ["raw_arg"],
        outputs: ["number_or_null"],
        confidence_range: ["HIGH"],
        resolve: resolvePhaseArgParse
      },
      {
        id: "debug-handler-route",
        name: "Debug Return Handler Route",
        category: "workflow-routing",
        description: "Determines action based on debug return type (fix/plan/manual/continue)",
        inputs: ["return_type"],
        outputs: ["action_string"],
        confidence_range: ["MEDIUM"],
        resolve: resolveDebugHandlerRoute
      }
    ];
    function evaluateDecisions2(command, state) {
      if (!state || typeof state !== "object") return {};
      const results = {};
      const stateKeys = new Set(Object.keys(state));
      for (const rule of DECISION_REGISTRY) {
        const hasInput = rule.inputs.some((input) => stateKeys.has(input));
        if (hasInput) {
          try {
            results[rule.id] = rule.resolve(state);
          } catch (_e) {
            results[rule.id] = { value: null, confidence: "LOW", rule_id: rule.id, error: true };
          }
        }
      }
      return results;
    }
    module.exports = {
      // Individual decision functions
      resolveContextGate,
      resolveProgressRoute,
      resolveResumeRoute,
      resolveExecutionPattern,
      resolveContextBudgetGate,
      resolvePreviousCheckGate,
      resolveCiGate,
      resolvePlanExistenceRoute,
      resolveBranchHandling,
      resolveAutoAdvance,
      resolvePhaseArgParse,
      resolveDebugHandlerRoute,
      // Registry and aggregator
      DECISION_REGISTRY,
      evaluateDecisions: evaluateDecisions2
    };
  }
});

// src/plugin/index.js
import { join as join16 } from "path";
import { homedir as homedir7 } from "os";

// src/plugin/safe-hook.js
import { homedir } from "os";
import { join as join2 } from "path";
import { randomBytes as randomBytes2 } from "crypto";

// src/plugin/logger.js
import { existsSync, mkdirSync, statSync, fstatSync, appendFileSync, copyFileSync, writeFileSync, openSync, ftruncateSync, closeSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
var MAX_LOG_SIZE = 512 * 1024;
function createLogger(logDir) {
  const logPath = join(logDir, "bgsd-plugin.log");
  const rotatedPath = logPath + ".1";
  function ensureDir() {
    try {
      if (!existsSync(logDir)) {
        mkdirSync(logDir, { recursive: true });
      }
    } catch {
    }
  }
  function rotate() {
    try {
      const fd = openSync(logPath, "r+");
      const stat = fstatSync(fd);
      if (stat.size >= MAX_LOG_SIZE) {
        try {
          copyFileSync(logPath, rotatedPath);
        } catch {
        }
        try {
          ftruncateSync(fd, 0);
        } catch {
        }
      }
      closeSync(fd);
    } catch {
    }
  }
  function write(level, message, correlationId, extra) {
    try {
      ensureDir();
      rotate();
      const timestamp = (/* @__PURE__ */ new Date()).toISOString();
      const corrPart = correlationId ? ` [${correlationId}]` : "";
      let line = `[${timestamp}] [${level}]${corrPart} ${message}
`;
      if (extra) {
        if (extra.stack) {
          line += `  Stack: ${extra.stack}
`;
        }
        if (extra.hookName) {
          line += `  Hook: ${extra.hookName}
`;
        }
        if (extra.elapsed) {
          line += `  Elapsed: ${extra.elapsed}ms
`;
        }
      }
      appendFileSync(logPath, line);
      if (level === "ERROR") {
        process.stderr.write(`[bGSD]${corrPart} ${message}
`);
      }
    } catch {
      try {
        process.stderr.write(`[bGSD] Logger write failed: ${message}
`);
      } catch {
      }
    }
  }
  return { write };
}

// src/plugin/safe-hook.js
function safeHook(name, fn, options = {}) {
  const { timeout = 5e3 } = options;
  let consecutiveFailures = 0;
  let disabled = false;
  let logger = null;
  function getLogger() {
    if (!logger) {
      const logDir = join2(homedir(), ".config", "opencode");
      logger = createLogger(logDir);
    }
    return logger;
  }
  function generateCorrelationId() {
    return randomBytes2(4).toString("hex");
  }
  function withTimeout(promise, ms) {
    return new Promise((resolve2, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Hook "${name}" timed out after ${ms}ms`));
      }, ms);
      promise.then((result) => {
        clearTimeout(timer);
        resolve2(result);
      }).catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
  return async function wrappedHook(input, output) {
    if (disabled) {
      return;
    }
    if (process.env.BGSD_DEBUG === "1") {
      return fn(input, output);
    }
    const correlationId = generateCorrelationId();
    const startTime = Date.now();
    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await withTimeout(fn(input, output), timeout);
        consecutiveFailures = 0;
        const elapsed = Date.now() - startTime;
        if (elapsed > 500) {
          getLogger().write("WARN", `Slow hook: ${name} took ${elapsed}ms`, correlationId, {
            hookName: name,
            elapsed
          });
        }
        return result;
      } catch (err) {
        lastError = err;
      }
    }
    consecutiveFailures++;
    const errorMessage = `Hook "${name}" failed: ${lastError.message}`;
    getLogger().write("ERROR", errorMessage, correlationId, {
      hookName: name,
      stack: lastError.stack
    });
    console.log(`[bGSD] Hook failed: ${name} [${correlationId}]`);
    if (consecutiveFailures >= 3) {
      disabled = true;
      console.log(`[bGSD] Hook ${name} disabled after repeated failures`);
      getLogger().write("ERROR", `Circuit breaker tripped: hook "${name}" disabled after ${consecutiveFailures} consecutive failures`, correlationId, {
        hookName: name
      });
    }
  };
}

// src/plugin/tool-registry.js
var TOOL_NAME_PATTERN = /^bgsd_[a-z][a-z0-9_]*$/;
var BGSD_PREFIX = "bgsd_";
function createToolRegistry(safeHookFn) {
  const registry = /* @__PURE__ */ new Map();
  function registerTool(name, definition) {
    let normalized = name;
    if (!normalized.startsWith(BGSD_PREFIX)) {
      normalized = BGSD_PREFIX + normalized;
    }
    if (!TOOL_NAME_PATTERN.test(normalized)) {
      throw new Error(`Tool name must be snake_case: ${normalized}`);
    }
    if (registry.has(normalized)) {
      console.warn(`[bGSD] Tool '${normalized}' already registered \u2014 overwriting`);
    }
    const wrappedDefinition = { ...definition };
    if (typeof wrappedDefinition.execute === "function") {
      wrappedDefinition.execute = safeHookFn("tool:" + normalized, wrappedDefinition.execute);
    }
    registry.set(normalized, {
      name: normalized,
      ...wrappedDefinition
    });
    return normalized;
  }
  function getTools2() {
    const tools = {};
    for (const [name, def] of registry) {
      tools[name] = def;
    }
    return tools;
  }
  return { registerTool, getTools: getTools2 };
}

// src/plugin/project-state.js
init_state();
init_roadmap();
init_plan();
init_config();
init_project();
init_intent();
function getProjectState(cwd) {
  const resolvedCwd = cwd || process.cwd();
  const state = parseState(resolvedCwd);
  if (!state) {
    return null;
  }
  const roadmap = parseRoadmap(resolvedCwd);
  const config = parseConfig(resolvedCwd);
  const project = parseProject(resolvedCwd);
  const intent = parseIntent(resolvedCwd);
  let phaseNum = null;
  if (state.phase) {
    const phaseMatch = state.phase.match(/^(\d+)/);
    if (phaseMatch) {
      phaseNum = parseInt(phaseMatch[1], 10);
    }
  }
  let currentPhase = null;
  if (phaseNum && roadmap) {
    currentPhase = roadmap.getPhase(phaseNum);
  }
  const currentMilestone = roadmap ? roadmap.currentMilestone : null;
  let plans = Object.freeze([]);
  if (phaseNum) {
    plans = parsePlans(phaseNum, resolvedCwd);
  }
  return Object.freeze({
    state,
    roadmap,
    config,
    project,
    intent,
    plans,
    currentPhase,
    currentMilestone
  });
}

// src/plugin/token-budget.js
var TOKEN_BUDGET = 500;
function countTokens(text) {
  if (!text || typeof text !== "string") return 0;
  return Math.ceil(text.length / 4);
}

// src/plugin/context-builder.js
function buildTrajectoryBlock(state, plans) {
  try {
    const parts = [];
    if (state && state.phase) {
      const phaseMatch = state.phase.match(/^(\d+)/);
      if (phaseMatch) {
        parts.push(`Current: Phase ${phaseMatch[1]}`);
      }
    }
    if (plans && plans.length > 0) {
      const completedPlans = [];
      const executedPlans = [];
      for (const plan of plans) {
        if (plan.executed || plan.completed) {
          completedPlans.push(plan.frontmatter?.plan || "?");
        }
        if (plan.executed) {
          executedPlans.push(plan.frontmatter?.plan || "?");
        }
      }
      if (completedPlans.length > 0) {
        parts.push(`Completed: ${completedPlans.join(", ")}`);
      }
      if (executedPlans.length > 0) {
        parts.push(`Executed: ${executedPlans.join(", ")}`);
      }
    }
    if (parts.length === 0) return null;
    return `<trajectory>
${parts.join("\n")}
</trajectory>`;
  } catch {
    return null;
  }
}
function buildSacredBlock(intent, roadmap) {
  try {
    const parts = [];
    if (intent && intent.objective) {
      parts.push(`Objective: ${intent.objective}`);
    }
    if (intent && intent.items && intent.items.length > 0) {
      const keyItems = intent.items.slice(0, 3);
      for (const item of keyItems) {
        if (item.id && item.id.startsWith("DO-")) {
          parts.push(`${item.id}: ${item.text || item.description || ""}`);
        }
      }
    }
    if (roadmap && roadmap.currentMilestone) {
      const ms = roadmap.currentMilestone;
      parts.push(`Milestone: ${ms.version || ms.name || "Current"}`);
      if (ms.status) {
        parts.push(`Status: ${ms.status}`);
      }
    }
    if (roadmap && roadmap.phases) {
      const currentPhase = roadmap.phases.find((p) => p.status === "current");
      if (currentPhase) {
        parts.push(`Phase: ${currentPhase.num}: ${currentPhase.name}`);
      }
    }
    if (parts.length === 0) return null;
    return `<sacred>
${parts.join("\n")}
</sacred>`;
  } catch {
    return null;
  }
}
function buildSystemPrompt(cwd) {
  let projectState;
  try {
    projectState = getProjectState(cwd);
  } catch {
    return "<bgsd>Failed to load project state. Run /bgsd-health to diagnose.</bgsd>";
  }
  if (!projectState) {
    return "<bgsd>No active project. Run /bgsd-new-project to start.</bgsd>";
  }
  const { state, roadmap, currentPhase, currentMilestone, plans } = projectState;
  if (!state || !state.phase) {
    return "<bgsd>Failed to load project state. Run /bgsd-health to diagnose.</bgsd>";
  }
  const phaseMatch = state.phase.match(/^(\d+)\s*(?:—|-|–)\s*(.+)/);
  const phaseNum = phaseMatch ? phaseMatch[1] : state.phase;
  const phaseName = phaseMatch ? phaseMatch[2].trim() : "";
  let planInfo = "";
  if (state.currentPlan && state.currentPlan !== "Not started") {
    const currentPlanMatch = state.currentPlan.match(/(\d+)/);
    const planNum = currentPlanMatch ? currentPlanMatch[1].padStart(2, "0") : null;
    if (planNum && plans.length > 0) {
      const plan = plans.find(
        (p) => p.frontmatter && p.frontmatter.plan === planNum
      );
      if (plan) {
        const totalTasks = plan.tasks ? plan.tasks.length : 0;
        planInfo = ` | Plan: P${planNum} (${totalTasks} tasks)`;
      } else {
        planInfo = ` | Plan: P${planNum}`;
      }
    } else {
      planInfo = ` | Plan: ${state.currentPlan}`;
    }
  } else {
    planInfo = " | Ready to plan";
  }
  let milestoneInfo = "";
  if (currentMilestone && roadmap) {
    const milestonePhases = currentMilestone.phases;
    if (milestonePhases) {
      const totalPhases = milestonePhases.end - milestonePhases.start + 1;
      const currentPhaseNum = parseInt(phaseNum, 10);
      const phasePosition = currentPhaseNum - milestonePhases.start + 1;
      milestoneInfo = ` | ${currentMilestone.version} ${phasePosition}/${totalPhases} phases`;
    } else {
      milestoneInfo = ` | ${currentMilestone.version}`;
    }
  }
  let goalLine = "";
  if (currentPhase && currentPhase.goal) {
    goalLine = `
Goal: ${currentPhase.goal}`;
  }
  let blockerLine = "";
  if (state.raw) {
    const blockersSection = state.getSection("Blockers/Concerns");
    if (blockersSection) {
      const blockerLines = blockersSection.split("\n").map((l) => l.replace(/^-\s*/, "").trim()).filter((l) => l && l !== "None" && l !== "None." && !l.startsWith("None \u2014"));
      if (blockerLines.length > 0) {
        blockerLine = `
Blocker: ${blockerLines[0]}`;
      }
    }
  }
  const prompt = `<bgsd>
Phase ${phaseNum}: ${phaseName}${planInfo}${milestoneInfo}${goalLine}${blockerLine}
</bgsd>`;
  const tokenCount = countTokens(prompt);
  if (tokenCount > TOKEN_BUDGET) {
    console.warn(`[bGSD] System prompt injection exceeds budget: ${tokenCount} tokens (budget: ${TOKEN_BUDGET})`);
  }
  return prompt;
}
function buildCompactionContext(cwd) {
  let projectState;
  try {
    projectState = getProjectState(cwd);
  } catch {
    return "<project-error>Failed to load project state for compaction. Run /bgsd-health to diagnose.</project-error>";
  }
  if (!projectState) {
    return null;
  }
  const { state, project, intent, plans, currentPhase, roadmap } = projectState;
  const blocks = [];
  try {
    const sacredBlock = buildSacredBlock(intent, roadmap);
    if (sacredBlock) {
      blocks.push(sacredBlock);
    }
  } catch {
  }
  try {
    if (project) {
      const parts = [];
      if (project.coreValue) parts.push(`Core value: ${project.coreValue}`);
      if (project.techStack) parts.push(`Tech: ${project.techStack}`);
      if (parts.length > 0) {
        blocks.push(`<project>
${parts.join("\n")}
</project>`);
      }
    }
  } catch {
  }
  try {
    if (state && state.phase) {
      const phaseMatch = state.phase.match(/^(\d+)\s*(?:—|-|–)\s*(.+)/);
      const phaseNum = phaseMatch ? phaseMatch[1] : state.phase;
      const phaseName = phaseMatch ? phaseMatch[2].trim() : "";
      let taskLine = `Phase ${phaseNum}: ${phaseName}`;
      if (state.currentPlan && plans && plans.length > 0) {
        const planNumMatch = state.currentPlan.match(/(\d+)/);
        const planNum = planNumMatch ? planNumMatch[1].padStart(2, "0") : null;
        if (planNum) {
          const plan = plans.find((p) => p.frontmatter && p.frontmatter.plan === planNum);
          if (plan && plan.tasks && plan.tasks.length > 0) {
            const totalTasks = plan.tasks.length;
            taskLine += ` \u2014 Plan P${planNum}, ${totalTasks} tasks`;
            const firstTask = plan.tasks[0];
            if (firstTask.name) {
              taskLine += `
Current: ${firstTask.name}`;
            }
            if (firstTask.files && firstTask.files.length > 0) {
              taskLine += `
Files: ${firstTask.files.join(", ")}`;
            }
          } else {
            taskLine += ` \u2014 Plan P${planNum}`;
          }
        }
      }
      blocks.push(`<task-state>
${taskLine}
</task-state>`);
    }
  } catch {
  }
  try {
    if (state && state.raw) {
      const decisionsSection = state.getSection("Decisions");
      if (decisionsSection) {
        const decisionLines = decisionsSection.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("- "));
        if (decisionLines.length > 0) {
          const last3 = decisionLines.slice(-3);
          blocks.push(`<decisions>
${last3.join("\n")}
</decisions>`);
        }
      }
    }
  } catch {
  }
  try {
    if (intent && intent.objective) {
      blocks.push(`<intent>
Objective: ${intent.objective}
</intent>`);
    }
  } catch {
  }
  try {
    if (state && state.raw) {
      const sessionSection = state.getSection("Session Continuity");
      if (sessionSection) {
        const stoppedAt = sessionSection.match(/\*\*Stopped at:\*\*\s*(.+)/i);
        const nextStep = sessionSection.match(/\*\*Next step:\*\*\s*(.+)/i);
        const parts = [];
        if (stoppedAt) parts.push(`Stopped at: ${stoppedAt[1].trim()}`);
        if (nextStep) parts.push(`Next step: ${nextStep[1].trim()}`);
        if (parts.length > 0) {
          blocks.push(`<session>
${parts.join("\n")}
</session>`);
        }
      }
    }
  } catch {
  }
  try {
    const trajectoryBlock = buildTrajectoryBlock(state, plans);
    if (trajectoryBlock) {
      blocks.push(trajectoryBlock);
    }
  } catch {
  }
  if (blocks.length === 0) {
    return null;
  }
  return blocks.join("\n\n");
}

// src/plugin/command-enricher.js
init_parsers();
var import_decision_rules = __toESM(require_decision_rules());
import { readdirSync as readdirSync2, existsSync as existsSync2, readFileSync as readFileSync7 } from "fs";
import { join as join9 } from "path";
function enrichCommand(input, output, cwd) {
  if (!input || !output) return;
  const command = input.command || input.parts && input.parts[0] || "";
  if (!command.startsWith("bgsd-")) return;
  const resolvedCwd = cwd || process.cwd();
  let projectState;
  try {
    projectState = getProjectState(resolvedCwd);
  } catch (err) {
    if (output.parts) {
      output.parts.unshift({
        type: "text",
        text: '<bgsd-context>\n{"error": "Failed to load project state. Run /bgsd-health to diagnose."}\n</bgsd-context>'
      });
    }
    return;
  }
  if (!projectState) {
    if (command !== "bgsd-new-project" && command !== "bgsd-help") {
      if (output.parts) {
        output.parts.unshift({
          type: "text",
          text: '<bgsd-context>\n{"error": "No .planning/ directory found. Run /bgsd-new-project to initialize."}\n</bgsd-context>'
        });
      }
    }
    return;
  }
  const { state, config, roadmap, currentPhase, currentMilestone } = projectState;
  const enrichment = {
    // Paths
    planning_dir: ".planning",
    state_path: ".planning/STATE.md",
    roadmap_path: ".planning/ROADMAP.md",
    config_path: ".planning/config.json",
    // Config flags
    commit_docs: config ? config.commit_docs : true,
    branching_strategy: config ? config.branching_strategy || "none" : "none",
    verifier_enabled: config ? config.verifier : true,
    research_enabled: config ? config.research : true,
    // Milestone
    milestone: currentMilestone ? currentMilestone.version : null,
    milestone_name: currentMilestone ? currentMilestone.name : null
  };
  const phaseNum = detectPhaseArg(input.parts);
  let effectivePhaseNum = phaseNum;
  if (phaseNum) {
    const phaseDir = resolvePhaseDir(phaseNum, resolvedCwd);
    if (phaseDir) {
      enrichment.phase_dir = phaseDir;
      enrichment.phase_number = String(phaseNum);
      if (roadmap) {
        const phase = roadmap.getPhase(phaseNum);
        if (phase) {
          enrichment.phase_name = phase.name;
          enrichment.phase_slug = `${String(phaseNum).padStart(2, "0")}-${toSlug(phase.name)}`;
          if (phase.goal) enrichment.phase_goal = phase.goal;
        }
      }
      try {
        const plans = parsePlans(phaseNum, resolvedCwd);
        if (plans && plans.length > 0) {
          enrichment.plans = plans.map((p) => p.path ? p.path.split("/").pop() : null).filter(Boolean);
          const phaseDirFull = join9(resolvedCwd, phaseDir);
          const summaryFiles = listSummaryFiles(phaseDirFull);
          enrichment.incomplete_plans = enrichment.plans.filter((planFile) => {
            const summaryFile = planFile.replace("-PLAN.md", "-SUMMARY.md");
            return !summaryFiles.includes(summaryFile);
          });
        }
      } catch {
      }
    }
  } else if (state && state.phase) {
    const currentPhaseMatch = state.phase.match(/^(\d+)/);
    if (currentPhaseMatch) {
      const curPhaseNum = parseInt(currentPhaseMatch[1], 10);
      effectivePhaseNum = curPhaseNum;
      enrichment.phase_number = String(curPhaseNum);
      if (currentPhase) {
        enrichment.phase_name = currentPhase.name;
      }
      const phaseDir = resolvePhaseDir(curPhaseNum, resolvedCwd);
      if (phaseDir) {
        enrichment.phase_dir = phaseDir;
      }
    }
  }
  try {
    if (enrichment.phase_dir) {
      const phaseDirFull = join9(resolvedCwd, enrichment.phase_dir);
      if (!enrichment.plans) {
        const plans = parsePlans(effectivePhaseNum, resolvedCwd);
        if (plans && plans.length > 0) {
          enrichment.plans = plans.map((p) => p.path ? p.path.split("/").pop() : null).filter(Boolean);
          const summaryFiles2 = listSummaryFiles(phaseDirFull);
          enrichment.incomplete_plans = enrichment.plans.filter((planFile) => {
            const summaryFile = planFile.replace("-PLAN.md", "-SUMMARY.md");
            return !summaryFiles2.includes(summaryFile);
          });
        }
      }
      enrichment.plan_count = enrichment.plans ? enrichment.plans.length : 0;
      const summaryFiles = listSummaryFiles(phaseDirFull);
      enrichment.summary_count = summaryFiles.length;
      try {
        const allFiles = readdirSync2(phaseDirFull);
        const uatFiles = allFiles.filter((f) => f.endsWith("-UAT.md"));
        let uatGapCount = 0;
        for (const uf of uatFiles) {
          try {
            const content = readFileSync7(join9(phaseDirFull, uf), "utf-8");
            if (content.includes("status: diagnosed")) uatGapCount++;
          } catch {
          }
        }
        enrichment.uat_gap_count = uatGapCount;
      } catch {
        enrichment.uat_gap_count = 0;
      }
    }
  } catch {
  }
  try {
    if (enrichment.phase_dir && effectivePhaseNum) {
      const paddedPhase = String(effectivePhaseNum).padStart(4, "0");
      enrichment.has_research = existsSync2(join9(resolvedCwd, enrichment.phase_dir, paddedPhase + "-RESEARCH.md"));
      enrichment.has_context = existsSync2(join9(resolvedCwd, enrichment.phase_dir, paddedPhase + "-CONTEXT.md"));
    }
  } catch {
  }
  try {
    if (enrichment.incomplete_plans && enrichment.incomplete_plans.length > 0 && effectivePhaseNum) {
      const plans = parsePlans(effectivePhaseNum, resolvedCwd);
      if (plans && plans.length > 0) {
        const firstIncompleteName = enrichment.incomplete_plans[0];
        const incompletePlan = plans.find((p) => p.path && p.path.endsWith(firstIncompleteName));
        if (incompletePlan && incompletePlan.tasks) {
          enrichment.task_types = incompletePlan.tasks.map((t) => t.type).filter(Boolean);
        }
      }
    }
  } catch {
  }
  try {
    enrichment.state_exists = existsSync2(join9(resolvedCwd, ".planning/STATE.md"));
    enrichment.project_exists = existsSync2(join9(resolvedCwd, ".planning/PROJECT.md"));
    enrichment.roadmap_exists = existsSync2(join9(resolvedCwd, ".planning/ROADMAP.md"));
  } catch {
  }
  try {
    if (effectivePhaseNum) {
      enrichment.current_phase = effectivePhaseNum;
    }
    if (roadmap && roadmap.phases && roadmap.phases.length > 0) {
      enrichment.highest_phase = Math.max(...roadmap.phases.map((p) => parseFloat(p.number)).filter((n) => !isNaN(n)));
    } else {
      enrichment.highest_phase = null;
    }
  } catch {
    enrichment.highest_phase = null;
  }
  try {
    if (enrichment.phase_dir) {
      const phaseDirFull = join9(resolvedCwd, enrichment.phase_dir);
      const summaryFiles = listSummaryFiles(phaseDirFull);
      enrichment.has_previous_summary = summaryFiles.length > 0;
      if (summaryFiles.length > 0) {
        const lastSummary = summaryFiles.sort().pop();
        const content = readFileSync7(join9(phaseDirFull, lastSummary), "utf-8");
        enrichment.has_unresolved_issues = content.includes("unresolved") || content.includes("Unresolved");
        enrichment.has_blockers = content.includes("blocker") || content.includes("Blocker");
      } else {
        enrichment.has_unresolved_issues = false;
        enrichment.has_blockers = false;
      }
    }
  } catch {
  }
  try {
    enrichment.ci_enabled = config ? Boolean(config.ci) : false;
    enrichment.has_test_command = Boolean(config && config.test_command);
  } catch {
  }
  try {
    const decisions = (0, import_decision_rules.evaluateDecisions)(command, enrichment);
    if (decisions && Object.keys(decisions).length > 0) {
      enrichment.decisions = decisions;
    }
  } catch {
  }
  if (output.parts) {
    output.parts.unshift({
      type: "text",
      text: `<bgsd-context>
${JSON.stringify(enrichment, null, 2)}
</bgsd-context>`
    });
  }
}
function detectPhaseArg(parts) {
  if (!parts || !Array.isArray(parts)) return null;
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (typeof part === "string") {
      const match = part.match(/^(\d{1,3})$/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
  }
  return null;
}
function resolvePhaseDir(phaseNum, cwd) {
  const numStr = String(phaseNum).padStart(2, "0");
  const phasesDir = join9(cwd, ".planning", "phases");
  try {
    const entries = readdirSync2(phasesDir);
    const dirName = entries.find((d) => d.startsWith(numStr + "-") || d === numStr);
    if (dirName) {
      return `.planning/phases/${dirName}`;
    }
  } catch {
  }
  return null;
}
function listSummaryFiles(phaseDir) {
  try {
    if (!existsSync2(phaseDir)) return [];
    const files = readdirSync2(phaseDir);
    return files.filter((f) => f.endsWith("-SUMMARY.md"));
  } catch {
    return [];
  }
}
function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// src/plugin/tools/bgsd-status.js
var bgsd_status = {
  description: "Get current bGSD execution state \u2014 phase, plan, tasks, progress, blockers.\n\nCall this to understand where the project is right now. Returns structured JSON with the current phase number and name, active plan, full task list with completion statuses, progress percentage, and any blockers.\n\nRequires an active bGSD project (.planning/ directory).",
  args: {},
  async execute(args, context) {
    try {
      const projectDir = context?.directory || process.cwd();
      const projectState = getProjectState(projectDir);
      if (!projectState) {
        return JSON.stringify({
          status: "no_project",
          message: "No .planning/ directory found. Run /bgsd-new-project to initialize a project."
        });
      }
      const { state, plans } = projectState;
      let phase = null;
      if (state.phase) {
        const phaseMatch = state.phase.match(/^(\d+)\s*[—\-]\s*(.+)/);
        if (phaseMatch) {
          phase = { number: phaseMatch[1], name: phaseMatch[2].trim() };
        } else {
          const numOnly = state.phase.match(/^(\d+)/);
          phase = numOnly ? { number: numOnly[1], name: null } : null;
        }
      }
      let plan = null;
      if (state.currentPlan && state.currentPlan !== "Not started") {
        plan = { id: state.currentPlan, status: state.status || "in_progress" };
      }
      let blockers = [];
      const blockersSection = state.getSection("Blockers/Concerns");
      if (blockersSection) {
        blockers = blockersSection.split("\n").map((line) => line.replace(/^[-*]\s*/, "").trim()).filter((line) => line.length > 0 && line.toLowerCase() !== "none");
      }
      const tasks = [];
      for (const p of plans) {
        const planId = p.frontmatter.plan ? "P" + String(p.frontmatter.plan).padStart(2, "0") : null;
        for (let i = 0; i < p.tasks.length; i++) {
          const t = p.tasks[i];
          tasks.push({
            plan: planId,
            task: i + 1,
            name: t.name || null,
            files: t.files || [],
            status: "pending"
          });
        }
      }
      const result = {
        phase,
        plan,
        progress: state.progress !== null ? state.progress : null,
        tasks,
        blockers
      };
      return JSON.stringify(result);
    } catch (err) {
      return JSON.stringify({
        error: "runtime_error",
        message: "Failed to read project state: " + err.message
      });
    }
  }
};

// src/plugin/tools/bgsd-plan.js
import { z } from "zod";
init_roadmap();
init_plan();
var bgsd_plan = {
  description: "Get roadmap overview or detailed phase information.\n\nTwo modes:\n- No args: returns all phases with status, goal, and plan count (roadmap summary)\n- With phase number: returns detailed phase info (goal, requirements, success criteria, dependencies) plus plan contents (tasks, objectives) if plans exist\n\nUse no-args mode to understand project structure. Use phase mode to dive into specific phase details.",
  args: {
    phase: z.coerce.number().optional().describe("Phase number to get details for. Omit for roadmap overview.")
  },
  async execute(args, context) {
    try {
      const projectDir = context?.directory || process.cwd();
      const projectState = getProjectState(projectDir);
      if (!projectState) {
        return JSON.stringify({
          status: "no_project",
          message: "No .planning/ directory found. Run /bgsd-new-project to initialize a project."
        });
      }
      const { roadmap } = projectState;
      if (!roadmap) {
        return JSON.stringify({
          error: "runtime_error",
          message: "ROADMAP.md could not be parsed. Run /bgsd-health to diagnose."
        });
      }
      if (args.phase !== void 0 && args.phase !== null && isNaN(Number(args.phase))) {
        return JSON.stringify({
          error: "validation_error",
          message: "Invalid input: expected number, received NaN"
        });
      }
      if (args.phase === void 0 || args.phase === null) {
        const phases = roadmap.phases.map((p) => ({
          number: p.number,
          name: p.name,
          status: p.status,
          goal: p.goal,
          planCount: p.planCount
        }));
        const currentMilestone = roadmap.currentMilestone ? { name: roadmap.currentMilestone.name, version: roadmap.currentMilestone.version, status: roadmap.currentMilestone.status } : null;
        return JSON.stringify({ phases, currentMilestone });
      }
      const phaseDetail = roadmap.getPhase(args.phase);
      if (!phaseDetail) {
        return JSON.stringify({
          error: "validation_error",
          message: `Phase ${args.phase} not found in roadmap. Call bgsd_plan with no args to see available phases.`
        });
      }
      const plans = parsePlans(args.phase, projectDir);
      const planData = plans.map((p) => ({
        plan: p.frontmatter.plan || null,
        wave: p.frontmatter.wave || null,
        objective: p.objective || null,
        tasks: p.tasks.map((t) => ({
          name: t.name,
          type: t.type,
          files: t.files
        })),
        requirements: p.frontmatter.requirements || []
      }));
      return JSON.stringify({
        phase: {
          number: phaseDetail.number,
          name: phaseDetail.name,
          goal: phaseDetail.goal,
          dependsOn: phaseDetail.dependsOn,
          requirements: phaseDetail.requirements,
          successCriteria: phaseDetail.successCriteria,
          plans: planData
        }
      });
    } catch (err) {
      return JSON.stringify({
        error: "runtime_error",
        message: "Failed to read roadmap data: " + err.message
      });
    }
  }
};

// src/plugin/tools/bgsd-context.js
import { z as z2 } from "zod";
var bgsd_context = {
  description: "Get task-scoped context for the current or specified task.\n\nReturns file paths, line ranges, and summaries relevant to a specific task \u2014 not actual file contents (use the Read tool for that).\n\nDefaults to the current task from STATE.md. Pass a task number to get context for a different task in the current plan.",
  args: {
    task: z2.coerce.number().optional().describe("Task number within current plan. Defaults to current task.")
  },
  async execute(args, context) {
    try {
      const projectDir = context?.directory || process.cwd();
      const projectState = getProjectState(projectDir);
      if (!projectState) {
        return JSON.stringify({
          status: "no_project",
          message: "No .planning/ directory found. Run /bgsd-new-project to initialize a project."
        });
      }
      const { plans } = projectState;
      if (!plans || plans.length === 0) {
        return JSON.stringify({
          error: "validation_error",
          message: "No plans found for current phase. Run /bgsd-plan-phase to create plans."
        });
      }
      let currentPlan = plans[0];
      if (projectState.state.currentPlan) {
        const planNum = projectState.state.currentPlan.match(/(\d+)/);
        if (planNum) {
          const found = plans.find(
            (p) => p.frontmatter.plan === planNum[1] || p.frontmatter.plan === parseInt(planNum[1], 10)
          );
          if (found) currentPlan = found;
        }
      }
      const planId = currentPlan.frontmatter.plan ? "P" + String(currentPlan.frontmatter.plan).padStart(2, "0") : null;
      if (args.task !== void 0 && args.task !== null && isNaN(Number(args.task))) {
        return JSON.stringify({
          error: "validation_error",
          message: "Invalid input: expected number, received NaN"
        });
      }
      const taskNumber = args.task;
      const taskIndex = taskNumber ? taskNumber - 1 : 0;
      const totalTasks = currentPlan.tasks.length;
      if (taskIndex < 0 || taskIndex >= totalTasks) {
        return JSON.stringify({
          error: "validation_error",
          message: `Task ${taskNumber} not found. Current plan has ${totalTasks} task${totalTasks !== 1 ? "s" : ""}.`
        });
      }
      const task = currentPlan.tasks[taskIndex];
      return JSON.stringify({
        task: {
          number: taskIndex + 1,
          name: task.name || null,
          files: task.files || [],
          action: task.action || null,
          done: task.done || null
        },
        plan: {
          id: planId,
          objective: currentPlan.objective || null,
          verification: currentPlan.verification || null,
          filesModified: currentPlan.frontmatter.files_modified || []
        }
      });
    } catch (err) {
      return JSON.stringify({
        error: "runtime_error",
        message: "Failed to read task context: " + err.message
      });
    }
  }
};

// src/plugin/tools/bgsd-validate.js
var bgsd_validate = {
  description: "Validate bGSD project state, roadmap, plans, and requirement traceability.\n\nRuns comprehensive checks across all planning files. Auto-fixes trivial formatting issues (like progress bar mismatches). Reports remaining issues categorized by severity: error (must fix), warning (should fix), info (note).\n\nReturns all issues found. An empty issues array means everything is valid.",
  args: {},
  async execute(args, context) {
    try {
      const projectDir = context?.directory || process.cwd();
      const projectState = getProjectState(projectDir);
      if (!projectState) {
        return JSON.stringify({
          status: "no_project",
          message: "No .planning/ directory found. Run /bgsd-new-project to initialize a project."
        });
      }
      const { state, roadmap, plans } = projectState;
      const issues = [];
      if (!state.phase) {
        issues.push({ severity: "error", check: "state_phase", message: "STATE.md missing **Phase:** field" });
      } else if (roadmap) {
        const phaseMatch = state.phase.match(/^(\d+)/);
        if (phaseMatch) {
          const phaseNum = phaseMatch[1];
          const found = roadmap.phases.find((p) => p.number === phaseNum);
          if (!found) {
            issues.push({ severity: "error", check: "state_phase", message: `STATE.md phase ${phaseNum} not found in ROADMAP.md` });
          }
        }
      }
      if (!state.currentPlan) {
        issues.push({ severity: "warning", check: "state_plan", message: "STATE.md missing **Current Plan:** field" });
      }
      if (state.progress === null) {
        issues.push({ severity: "warning", check: "state_progress", message: "STATE.md missing progress bar or percentage" });
      } else if (state.progress < 0 || state.progress > 100) {
        issues.push({ severity: "error", check: "state_progress", message: `STATE.md progress ${state.progress}% out of range (0-100)` });
      }
      if (!state.lastActivity) {
        issues.push({ severity: "warning", check: "state_activity", message: "STATE.md missing **Last Activity:** field" });
      } else {
        const dateTest = Date.parse(state.lastActivity);
        if (isNaN(dateTest)) {
          issues.push({ severity: "warning", check: "state_activity", message: `STATE.md Last Activity date invalid: ${state.lastActivity}` });
        }
      }
      if (!roadmap) {
        issues.push({ severity: "error", check: "roadmap_exists", message: "ROADMAP.md could not be parsed" });
      } else {
        for (const phase of roadmap.phases) {
          if (!phase.goal) {
            issues.push({ severity: "warning", check: "roadmap_goals", message: `Phase ${phase.number} (${phase.name}) missing goal` });
          }
        }
        const phaseNums = roadmap.phases.map((p) => parseInt(p.number, 10)).sort((a, b) => a - b);
        for (let i = 1; i < phaseNums.length; i++) {
          const gap = phaseNums[i] - phaseNums[i - 1];
          if (gap > 1) {
            issues.push({ severity: "info", check: "roadmap_sequence", message: `Phase number gap: ${phaseNums[i - 1]} to ${phaseNums[i]}` });
          }
        }
        const currentMilestone = roadmap.currentMilestone;
        if (currentMilestone && currentMilestone.phases) {
          const milestonePhases = roadmap.phases.filter((p) => {
            const num = parseInt(p.number, 10);
            return num >= currentMilestone.phases.start && num <= currentMilestone.phases.end;
          });
          const hasIncomplete = milestonePhases.some((p) => p.status !== "complete");
          if (!hasIncomplete && milestonePhases.length > 0) {
            issues.push({ severity: "info", check: "roadmap_milestone", message: "Current milestone has no incomplete phases \u2014 may need to advance" });
          }
        }
      }
      if (plans && plans.length > 0) {
        for (const plan of plans) {
          const planId = plan.frontmatter.plan ? `P${String(plan.frontmatter.plan).padStart(2, "0")}` : "unknown";
          const fm = plan.frontmatter;
          if (!fm.phase) {
            issues.push({ severity: "error", check: "plan_frontmatter", message: `${planId}: missing 'phase' in frontmatter` });
          }
          if (!fm.plan) {
            issues.push({ severity: "error", check: "plan_frontmatter", message: `${planId}: missing 'plan' in frontmatter` });
          }
          if (!fm.type) {
            issues.push({ severity: "warning", check: "plan_frontmatter", message: `${planId}: missing 'type' in frontmatter` });
          }
          for (let i = 0; i < plan.tasks.length; i++) {
            const task = plan.tasks[i];
            if (!task.name) {
              issues.push({ severity: "warning", check: "plan_tasks", message: `${planId} Task ${i + 1}: missing name` });
            }
            if (!task.action) {
              issues.push({ severity: "warning", check: "plan_tasks", message: `${planId} Task ${i + 1}: missing action element` });
            }
          }
        }
      }
      if (roadmap && plans && plans.length > 0) {
        const planReqIds = /* @__PURE__ */ new Set();
        for (const plan of plans) {
          const reqs = plan.frontmatter.requirements;
          if (Array.isArray(reqs)) {
            for (const r of reqs) planReqIds.add(r);
          }
        }
        if (state.phase) {
          const phaseMatch = state.phase.match(/^(\d+)/);
          if (phaseMatch) {
            const phaseDetail = roadmap.getPhase(parseInt(phaseMatch[1], 10));
            if (phaseDetail && phaseDetail.requirements) {
              const roadmapReqs = phaseDetail.requirements.split(",").map((r) => r.trim()).filter((r) => r.length > 0);
              for (const req of roadmapReqs) {
                if (!planReqIds.has(req)) {
                  issues.push({ severity: "warning", check: "req_traceability", message: `Requirement ${req} in roadmap not covered by any plan` });
                }
              }
              const roadmapReqSet = new Set(roadmapReqs);
              for (const req of planReqIds) {
                if (!roadmapReqSet.has(req)) {
                  issues.push({ severity: "info", check: "req_traceability", message: `Requirement ${req} in plans but not in roadmap phase requirements` });
                }
              }
            }
          }
        }
      }
      if (state.progress !== null && state.raw) {
        const barMatch = state.raw.match(/[\u2588\u2591]+\]\s*(\d+)%/);
        if (barMatch) {
          const bar = barMatch[0];
          const pct = parseInt(barMatch[1], 10);
          const filledMatch = bar.match(/\u2588/g);
          const filled = filledMatch ? filledMatch.length : 0;
          const totalMatch = bar.match(/[\u2588\u2591]/g);
          const total = totalMatch ? totalMatch.length : 0;
          const expectedFilled = Math.round(pct / 100 * total);
          if (filled !== expectedFilled) {
            issues.push({ severity: "info", check: "state_progress_bar", message: `Progress bar visual (${filled}/${total} filled) doesn't match ${pct}% \u2014 could be auto-fixed` });
          }
        }
      }
      const errors = issues.filter((i) => i.severity === "error").length;
      const warnings = issues.filter((i) => i.severity === "warning").length;
      const info = issues.filter((i) => i.severity === "info").length;
      return JSON.stringify({
        valid: errors === 0,
        issues,
        summary: { errors, warnings, info }
      });
    } catch (err) {
      return JSON.stringify({
        error: "runtime_error",
        message: "Failed to validate project: " + err.message
      });
    }
  }
};

// src/plugin/tools/bgsd-progress.js
import { z as z3 } from "zod";
init_state();
init_plan();
import { readFileSync as readFileSync8, writeFileSync as writeFileSync2, mkdirSync as mkdirSync2, rmdirSync, existsSync as existsSync3, statSync as statSync2 } from "fs";
import { join as join10 } from "path";
var LOCK_STALE_MS = 1e4;
var VALID_ACTIONS = ["complete-task", "uncomplete-task", "add-blocker", "remove-blocker", "record-decision", "advance"];
var bgsd_progress = {
  description: "Update bGSD project progress \u2014 mark tasks complete, add/remove blockers, record decisions, advance plan.\n\nSingle tool with an action parameter:\n- complete-task: Mark the next pending task as complete\n- uncomplete-task: Un-complete the last completed task\n- add-blocker: Add a blocker to STATE.md\n- remove-blocker: Remove a blocker by index\n- record-decision: Record a decision to STATE.md\n- advance: Advance to next plan (when current plan is complete)\n\nUpdates files on disk (STATE.md, PLAN.md). Does NOT create git commits \u2014 the agent handles commits separately.\n\nReturns updated state snapshot after the change.",
  args: {
    action: z3.enum(VALID_ACTIONS).describe("The progress action to perform"),
    value: z3.string().optional().describe("Value for the action: blocker text for add-blocker, blocker index (1-based) for remove-blocker, decision text for record-decision. Not needed for complete-task, uncomplete-task, advance.")
  },
  async execute(args, context) {
    const projectDir = context?.directory || process.cwd();
    const lockDir = join10(projectDir, ".planning", ".lock");
    try {
      if (!args.action || !VALID_ACTIONS.includes(args.action)) {
        return JSON.stringify({
          error: "validation_error",
          message: `Invalid option: expected one of ${VALID_ACTIONS.map((a) => `"${a}"`).join("|")}`
        });
      }
      const projectState = getProjectState(projectDir);
      if (!projectState) {
        return JSON.stringify({
          status: "no_project",
          message: "No .planning/ directory found. Run /bgsd-new-project to initialize a project."
        });
      }
      if ((args.action === "add-blocker" || args.action === "record-decision") && !args.value) {
        return JSON.stringify({
          error: "validation_error",
          message: `Action '${args.action}' requires a 'value' parameter.`
        });
      }
      if (args.action === "remove-blocker" && !args.value) {
        return JSON.stringify({
          error: "validation_error",
          message: "Action 'remove-blocker' requires a 'value' parameter (blocker index, 1-based)."
        });
      }
      try {
        mkdirSync2(lockDir);
      } catch (lockErr) {
        if (lockErr.code === "EEXIST") {
          try {
            const lockStat = statSync2(lockDir);
            const age = Date.now() - lockStat.mtimeMs;
            if (age > LOCK_STALE_MS) {
              rmdirSync(lockDir);
              mkdirSync2(lockDir);
            } else {
              return JSON.stringify({
                error: "runtime_error",
                message: "Another operation in progress. Try again."
              });
            }
          } catch {
            return JSON.stringify({
              error: "runtime_error",
              message: "Failed to check lock status. Try again."
            });
          }
        } else {
          throw lockErr;
        }
      }
      try {
        const statePath = join10(projectDir, ".planning", "STATE.md");
        let content = readFileSync8(statePath, "utf-8");
        const { state } = projectState;
        let actionResult = null;
        switch (args.action) {
          case "complete-task": {
            const currentProgress = state.progress !== null ? state.progress : 0;
            const step = 10;
            const newProgress = Math.min(100, currentProgress + step);
            content = updateProgress(content, newProgress);
            actionResult = `Progress updated to ${newProgress}%`;
            break;
          }
          case "uncomplete-task": {
            const currentProgress = state.progress !== null ? state.progress : 0;
            const step = 10;
            const newProgress = Math.max(0, currentProgress - step);
            content = updateProgress(content, newProgress);
            actionResult = `Progress reverted to ${newProgress}%`;
            break;
          }
          case "add-blocker": {
            content = addBlocker(content, args.value);
            actionResult = `Blocker added: ${args.value}`;
            break;
          }
          case "remove-blocker": {
            const idx = parseInt(args.value, 10);
            if (isNaN(idx) || idx < 1) {
              return JSON.stringify({
                error: "validation_error",
                message: "remove-blocker value must be a positive integer (1-based index)."
              });
            }
            const result = removeBlocker(content, idx);
            if (result.error) {
              return JSON.stringify({
                error: "validation_error",
                message: result.error
              });
            }
            content = result.content;
            actionResult = `Blocker ${idx} removed`;
            break;
          }
          case "record-decision": {
            content = recordDecision(content, args.value, state.phase);
            actionResult = `Decision recorded: ${args.value}`;
            break;
          }
          case "advance": {
            const result = advancePlan(content, state.currentPlan);
            content = result.content;
            actionResult = result.message;
            break;
          }
        }
        writeFileSync2(statePath, content, "utf-8");
        try {
          rmdirSync(lockDir);
        } catch {
        }
        invalidateState(projectDir);
        invalidatePlans(projectDir);
        const freshState = getProjectState(projectDir);
        const fresh = freshState ? freshState.state : null;
        return JSON.stringify({
          success: true,
          action: args.action,
          result: actionResult,
          state: {
            phase: fresh ? fresh.phase : null,
            plan: fresh ? fresh.currentPlan : null,
            progress: fresh ? fresh.progress : null,
            status: fresh ? fresh.status : null
          }
        });
      } finally {
        try {
          rmdirSync(lockDir);
        } catch {
        }
      }
    } catch (err) {
      try {
        rmdirSync(lockDir);
      } catch {
      }
      return JSON.stringify({
        error: "runtime_error",
        message: "Failed to update progress: " + err.message
      });
    }
  }
};
function updateProgress(content, newPercent) {
  const barLength = 10;
  const filled = Math.round(newPercent / 100 * barLength);
  const empty = barLength - filled;
  const newBar = "\u2588".repeat(filled) + "\u2591".repeat(empty);
  const progressLine = `**Progress:** [${newBar}] ${newPercent}%`;
  const replaced = content.replace(
    /\*\*Progress:\*\*\s*\[[\u2588\u2591]+\]\s*\d+%/,
    progressLine
  );
  return replaced;
}
function addBlocker(content, blockerText) {
  const sectionPattern = /(### Blockers\/Concerns\s*\n)([\s\S]*?)(\n###|\n## |$)/;
  const match = content.match(sectionPattern);
  if (!match) {
    return content + "\n### Blockers/Concerns\n\n- " + blockerText + "\n";
  }
  const header = match[1];
  let body = match[2];
  const after = match[3];
  if (body.trim().toLowerCase() === "none" || body.trim() === "") {
    body = "\n- " + blockerText + "\n";
  } else {
    body = body.trimEnd() + "\n- " + blockerText + "\n";
  }
  return content.replace(sectionPattern, header + body + after);
}
function removeBlocker(content, index) {
  const sectionPattern = /(### Blockers\/Concerns\s*\n)([\s\S]*?)(\n###|\n## |$)/;
  const match = content.match(sectionPattern);
  if (!match) {
    return { error: "No Blockers/Concerns section found in STATE.md" };
  }
  const header = match[1];
  const body = match[2];
  const after = match[3];
  const lines = body.split("\n").filter((l) => l.match(/^[-*]\s+/));
  if (index > lines.length || index < 1) {
    return { error: `Blocker index ${index} out of range. Found ${lines.length} blocker(s).` };
  }
  lines.splice(index - 1, 1);
  let newBody;
  if (lines.length === 0) {
    newBody = "\nNone\n";
  } else {
    newBody = "\n" + lines.join("\n") + "\n";
  }
  return { content: content.replace(sectionPattern, header + newBody + after) };
}
function recordDecision(content, decisionText, phase) {
  const phaseTag = phase ? phase.match(/^(\d+)/)?.[1] || "?" : "?";
  const entry = `- [Phase ${phaseTag}]: ${decisionText}`;
  const sectionPattern = /(### Decisions\s*\n)([\s\S]*?)(\n###|\n## |$)/;
  const match = content.match(sectionPattern);
  if (!match) {
    return content + "\n### Decisions\n\n" + entry + "\n";
  }
  const header = match[1];
  let body = match[2];
  const after = match[3];
  body = body.trimEnd() + "\n" + entry + "\n";
  return content.replace(sectionPattern, header + body + after);
}
function advancePlan(content, currentPlan) {
  if (!currentPlan) {
    return { content, message: "No current plan to advance from" };
  }
  const planNumMatch = currentPlan.match(/(\d+)\s*(?:pending|$)/i) || currentPlan.match(/(\d+)/);
  if (!planNumMatch) {
    return { content, message: `Could not parse plan number from: ${currentPlan}` };
  }
  const currentNum = parseInt(planNumMatch[1], 10);
  const nextNum = currentNum + 1;
  const nextPlanStr = `Plan ${String(currentNum).padStart(2, "0")} complete, Plan ${String(nextNum).padStart(2, "0")} pending`;
  const updated = content.replace(
    /\*\*Current Plan:\*\*\s*[^\n]+/,
    `**Current Plan:** ${nextPlanStr}`
  );
  return { content: updated, message: `Advanced to Plan ${String(nextNum).padStart(2, "0")}` };
}

// src/plugin/tools/index.js
function getTools(registry) {
  registry.registerTool("status", bgsd_status);
  registry.registerTool("plan", bgsd_plan);
  registry.registerTool("context", bgsd_context);
  registry.registerTool("validate", bgsd_validate);
  registry.registerTool("progress", bgsd_progress);
  return registry.getTools();
}

// src/plugin/notification.js
import { homedir as homedir2 } from "os";
import { join as join11 } from "path";
function createNotifier($, directory) {
  const MAX_HISTORY = 20;
  const DEFAULT_RATE_LIMIT = 5;
  const DEDUP_WINDOW_MS = 5e3;
  const history = [];
  let pendingContext = [];
  let dndMode = false;
  let dndSuppressedCount = 0;
  let rateLimitTimestamps = [];
  let rateLimitPerMinute = DEFAULT_RATE_LIMIT;
  const recentKeys = /* @__PURE__ */ new Map();
  let logger = null;
  function getLogger() {
    if (!logger) {
      const logDir = join11(homedir2(), ".config", "opencode");
      logger = createLogger(logDir);
    }
    return logger;
  }
  async function sendOsNotification(message) {
    if (!$) return;
    try {
      const safeMsg = String(message).replace(/["`$\\]/g, "\\$&");
      if (process.platform === "darwin") {
        await $`osascript -e ${'display notification "' + safeMsg + '" with title "bGSD"'}`.quiet();
      } else {
        await $`notify-send "bGSD" ${safeMsg}`.quiet();
      }
    } catch (err) {
      getLogger().write("WARN", `OS notification failed: ${err.message}`);
    }
  }
  function isDuplicate(notification) {
    const key = `${notification.type}:${notification.message}`;
    const now = Date.now();
    const lastSeen = recentKeys.get(key);
    if (lastSeen && now - lastSeen < DEDUP_WINDOW_MS) {
      return true;
    }
    recentKeys.set(key, now);
    for (const [k, ts] of recentKeys) {
      if (now - ts > DEDUP_WINDOW_MS) {
        recentKeys.delete(k);
      }
    }
    return false;
  }
  function checkRateLimit() {
    const now = Date.now();
    const windowStart = now - 6e4;
    rateLimitTimestamps = rateLimitTimestamps.filter((ts) => ts > windowStart);
    if (rateLimitTimestamps.length >= rateLimitPerMinute) {
      return false;
    }
    rateLimitTimestamps.push(now);
    return true;
  }
  async function notify(notification) {
    const { type, severity, message, action } = notification;
    const timestamp = Date.now();
    const entry = { type, severity, message, action, timestamp };
    history.push(entry);
    if (history.length > MAX_HISTORY) {
      history.shift();
    }
    if (isDuplicate(notification)) {
      return;
    }
    if (!checkRateLimit()) {
      getLogger().write("WARN", `Rate limit exceeded, dropping notification: ${type}`);
      return;
    }
    if (dndMode && severity !== "critical") {
      dndSuppressedCount++;
      return;
    }
    if (severity === "critical" || severity === "warning") {
      await sendOsNotification(message);
    }
    pendingContext.push({ type, severity, message, timestamp });
  }
  function drainPendingContext() {
    const items = [...pendingContext];
    pendingContext = [];
    return items;
  }
  function getHistory() {
    return [...history];
  }
  function setDnd(enabled) {
    dndMode = !!enabled;
    if (!enabled) {
      const count = dndSuppressedCount;
      dndSuppressedCount = 0;
      if (count > 0) {
        pendingContext.push({
          type: "dnd-summary",
          severity: "info",
          message: `${count} notification${count === 1 ? "" : "s"} suppressed during DND. Use /bgsd-notifications to review.`,
          timestamp: Date.now()
        });
      }
      return count;
    }
  }
  function resetCounters() {
    rateLimitTimestamps = [];
  }
  function setRateLimit(limit) {
    if (typeof limit === "number" && limit > 0) {
      rateLimitPerMinute = limit;
    }
  }
  return {
    notify,
    drainPendingContext,
    getHistory,
    setDnd,
    resetCounters,
    setRateLimit
  };
}

// src/plugin/file-watcher.js
init_parsers();
import { watch } from "fs";
import { existsSync as existsSync4 } from "fs";
import { join as join12 } from "path";
import { homedir as homedir3 } from "os";
function createFileWatcher(cwd, options = {}) {
  const { debounceMs = 200, maxWatchedPaths = 500 } = options;
  const planningDir = join12(cwd, ".planning");
  let controller = null;
  let watching = false;
  let debounceTimer = null;
  let pendingPaths = /* @__PURE__ */ new Set();
  let eventCount = 0;
  let capWarned = false;
  const selfWrites = /* @__PURE__ */ new Set();
  const selfWriteTimers = /* @__PURE__ */ new Map();
  let logger = null;
  function getLogger() {
    if (!logger) {
      const logDir = join12(homedir3(), ".config", "opencode");
      logger = createLogger(logDir);
    }
    return logger;
  }
  function processPendingEvents() {
    if (pendingPaths.size === 0) return;
    const paths = [...pendingPaths];
    pendingPaths.clear();
    const externalPaths = paths.filter((p) => !selfWrites.has(p));
    if (externalPaths.length > 0) {
      invalidateAll(cwd);
    }
  }
  function onWatchEvent(eventType, filename) {
    if (!filename) return;
    const fullPath = join12(planningDir, filename);
    eventCount++;
    if (!capWarned && eventCount > maxWatchedPaths) {
      capWarned = true;
      getLogger().write("WARN", `File watcher: event count (${eventCount}) exceeds cap (${maxWatchedPaths}). Possible excessive file activity.`);
    }
    if (selfWrites.has(fullPath)) {
      return;
    }
    pendingPaths.add(fullPath);
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(processPendingEvents, debounceMs);
  }
  function start() {
    if (watching) return;
    if (!existsSync4(planningDir)) {
      getLogger().write("INFO", `File watcher: .planning/ not found at ${cwd}, skipping watch`);
      return;
    }
    try {
      controller = new AbortController();
      watch(planningDir, { recursive: true, signal: controller.signal }, onWatchEvent);
      watching = true;
      eventCount = 0;
      capWarned = false;
    } catch (err) {
      getLogger().write("ERROR", `File watcher: failed to start: ${err.message}`);
      watching = false;
      controller = null;
    }
  }
  function stop() {
    if (controller) {
      try {
        controller.abort();
      } catch {
      }
      controller = null;
    }
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    for (const timer of selfWriteTimers.values()) {
      clearTimeout(timer);
    }
    selfWriteTimers.clear();
    selfWrites.clear();
    pendingPaths.clear();
    watching = false;
  }
  function trackSelfWrite(filePath) {
    selfWrites.add(filePath);
    const existing = selfWriteTimers.get(filePath);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      selfWrites.delete(filePath);
      selfWriteTimers.delete(filePath);
    }, 200);
    selfWriteTimers.set(filePath, timer);
  }
  function isWatching() {
    return watching;
  }
  return {
    start,
    stop,
    trackSelfWrite,
    isWatching
  };
}

// src/plugin/idle-validator.js
import { existsSync as existsSync5, readFileSync as readFileSync9, writeFileSync as writeFileSync3 } from "fs";
import { join as join13 } from "path";
import { execSync } from "child_process";
import { homedir as homedir4 } from "os";
init_state();
init_roadmap();
init_config();
function createIdleValidator(cwd, notifier, fileWatcher, config) {
  const planningDir = join13(cwd, ".planning");
  let lastValidation = 0;
  let lastAutoFix = 0;
  let validating = false;
  const cooldownMs = (config.idle_validation?.cooldown_seconds || 5) * 1e3;
  const stalenessHours = config.idle_validation?.staleness_threshold_hours || 2;
  const enabled = config.idle_validation?.enabled !== false;
  let logger = null;
  function getLogger() {
    if (!logger) {
      const logDir = join13(homedir4(), ".config", "opencode");
      logger = createLogger(logDir);
    }
    return logger;
  }
  function readStateMd() {
    try {
      return readFileSync9(join13(planningDir, "STATE.md"), "utf-8");
    } catch {
      return null;
    }
  }
  function readRoadmapMd() {
    try {
      return readFileSync9(join13(planningDir, "ROADMAP.md"), "utf-8");
    } catch {
      return null;
    }
  }
  function writeTracked(filePath, content) {
    fileWatcher.trackSelfWrite(filePath);
    writeFileSync3(filePath, content);
  }
  function getLastGitTimestamp() {
    try {
      const output = execSync("git log -1 --format=%ct", {
        cwd,
        encoding: "utf-8",
        timeout: 3e3,
        stdio: ["pipe", "pipe", "pipe"]
      });
      return parseInt(output.trim(), 10) || null;
    } catch {
      return null;
    }
  }
  function fixProgressBar(raw, pct) {
    const barMatch = raw.match(/\[([\u2588\u2591]+)\]\s*(\d+)%/);
    if (!barMatch) return null;
    const bar = barMatch[1];
    const total = bar.length;
    const filled = (bar.match(/\u2588/g) || []).length;
    const expectedFilled = Math.round(pct / 100 * total);
    if (filled === expectedFilled) return null;
    const newBar = "\u2588".repeat(expectedFilled) + "\u2591".repeat(total - expectedFilled);
    return raw.replace(barMatch[0], `[${newBar}] ${pct}%`);
  }
  async function onIdle() {
    try {
      if (!enabled) return;
      if (!existsSync5(planningDir)) return;
      if (Date.now() - lastValidation < cooldownMs) return;
      if (lastAutoFix > lastValidation) return;
      if (validating) return;
      invalidateState(cwd);
      const state = parseState(cwd);
      if (state) {
        const status = (state.status || "").toLowerCase();
        if (status.includes("executing") || status.includes("in progress")) {
          const lastGit = getLastGitTimestamp();
          if (lastGit) {
            const hoursAgo = (Date.now() / 1e3 - lastGit) / 3600;
            if (hoursAgo < stalenessHours) {
              return;
            }
          } else {
            return;
          }
        }
      }
      validating = true;
      let anyFix = false;
      invalidateRoadmap(cwd);
      const roadmap = parseRoadmap(cwd);
      const stateRaw = readStateMd();
      if (state && roadmap && stateRaw) {
        const phaseMatch = state.phase ? state.phase.match(/^(\d+)/) : null;
        if (phaseMatch) {
          const phaseNum = parseInt(phaseMatch[1], 10);
          const rPhase = roadmap.getPhase(phaseNum);
          if (!rPhase) {
            getLogger().write("WARN", `Idle validation: STATE.md phase ${phaseNum} not found in ROADMAP.md`);
          }
          if (rPhase && rPhase.status === "complete") {
            const nextPhase = roadmap.phases.find((p) => {
              const pNum = parseInt(p.number, 10);
              return pNum > phaseNum && p.status !== "complete";
            });
            if (nextPhase) {
              await notifier.notify({
                type: "phase-complete",
                severity: "warning",
                message: `Phase ${phaseNum} complete! Next: Phase ${nextPhase.number} (${nextPhase.name})`,
                action: `Next: /bgsd-plan-phase ${nextPhase.number}`
              });
            }
          }
        }
        if (state.progress !== null) {
          const fixed = fixProgressBar(stateRaw, state.progress);
          if (fixed) {
            const statePath = join13(planningDir, "STATE.md");
            writeTracked(statePath, fixed);
            invalidateState(cwd);
            anyFix = true;
            getLogger().write("INFO", `Idle validation: fixed progress bar visual`);
          }
        }
      }
      invalidateConfig(cwd);
      const freshConfig = parseConfig(cwd);
      if (freshConfig) {
        const configPath = join13(planningDir, "config.json");
        if (existsSync5(configPath)) {
          try {
            const raw = readFileSync9(configPath, "utf-8");
            JSON.parse(raw);
          } catch {
            const defaults = {
              mode: "interactive",
              depth: "standard",
              model_profile: "balanced",
              commit_docs: true
            };
            writeTracked(configPath, JSON.stringify(defaults, null, 2) + "\n");
            invalidateConfig(cwd);
            anyFix = true;
            getLogger().write("WARN", `Idle validation: auto-fixed corrupt config.json with defaults`);
          }
        }
      }
      if (state && stateRaw) {
        const status = (state.status || "").toLowerCase();
        if (status.includes("executing") || status.includes("in progress")) {
          const lastGit = getLastGitTimestamp();
          if (lastGit) {
            const hoursAgo = (Date.now() / 1e3 - lastGit) / 3600;
            if (hoursAgo >= stalenessHours) {
              const statePath = join13(planningDir, "STATE.md");
              const updatedRaw = stateRaw.replace(
                /\*\*Status:\*\*\s*.+/i,
                "**Status:** Paused (auto-detected stale)"
              );
              if (updatedRaw !== stateRaw) {
                writeTracked(statePath, updatedRaw);
                invalidateState(cwd);
                anyFix = true;
                getLogger().write("INFO", `Idle validation: auto-fixed stale status (${hoursAgo.toFixed(1)}h idle)`);
              }
            }
          }
        }
      }
      if (anyFix) {
        lastAutoFix = Date.now();
        await notifier.notify({
          type: "state-sync",
          severity: "info",
          message: "State synced"
        });
      }
      validating = false;
      lastValidation = Date.now();
    } catch (err) {
      validating = false;
      lastValidation = Date.now();
      getLogger().write("ERROR", `Idle validation error: ${err.message}`);
    }
  }
  function onUserInput() {
    lastAutoFix = 0;
  }
  return {
    onIdle,
    onUserInput
  };
}

// src/plugin/stuck-detector.js
import { homedir as homedir5 } from "os";
import { join as join14 } from "path";
function createStuckDetector(notifier, config) {
  const errorThreshold = config.stuck_detection?.error_threshold || 3;
  const spinningThreshold = config.stuck_detection?.spinning_threshold || 5;
  const errorStreaks = /* @__PURE__ */ new Map();
  let escalationLevel = 0;
  const recentCalls = [];
  const MAX_RECENT_CALLS = 50;
  let logger = null;
  function getLogger() {
    if (!logger) {
      const logDir = join14(homedir5(), ".config", "opencode");
      logger = createLogger(logDir);
    }
    return logger;
  }
  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0;
    }
    return hash.toString(36);
  }
  function detectSpinning() {
    if (recentCalls.length < spinningThreshold * 2) return null;
    for (let seqLen = spinningThreshold; seqLen >= 2; seqLen--) {
      if (recentCalls.length < seqLen * 2) continue;
      const lastCalls = recentCalls.slice(-seqLen * 2);
      const seq1 = lastCalls.slice(0, seqLen).map((c) => c.key).join("|");
      const seq2 = lastCalls.slice(seqLen).map((c) => c.key).join("|");
      if (seq1 === seq2) {
        let repeatCount = 2;
        for (let i = 3; i <= Math.floor(recentCalls.length / seqLen); i++) {
          const start = recentCalls.length - seqLen * i;
          if (start < 0) break;
          const seqN = recentCalls.slice(start, start + seqLen).map((c) => c.key).join("|");
          if (seqN === seq2) {
            repeatCount = i;
          } else {
            break;
          }
        }
        return { length: seqLen, repeatCount };
      }
    }
    return null;
  }
  async function trackToolCall(input) {
    try {
      const toolName = input.tool || "unknown";
      const error = input.error || null;
      const argsStr = JSON.stringify(input.args || {});
      const argsHash = simpleHash(argsStr);
      const callKey = `${toolName}:${argsHash}`;
      recentCalls.push({ key: callKey, tool: toolName });
      if (recentCalls.length > MAX_RECENT_CALLS) {
        recentCalls.shift();
      }
      if (error) {
        const errorKey = `${toolName}:${error}`;
        const count = (errorStreaks.get(errorKey) || 0) + 1;
        errorStreaks.set(errorKey, count);
        if (count >= errorThreshold) {
          escalationLevel++;
          const escalated = escalationLevel >= 2;
          const prefix = escalated ? "ESCALATED \u2014 " : "";
          await notifier.notify({
            type: "stuck-error",
            severity: "critical",
            message: `${prefix}Stuck: ${toolName} failed ${count}x \u2014 "${error}"`,
            action: "Consider pausing for user input"
          });
          getLogger().write("WARN", `Stuck detection: ${toolName} error loop (${count}x): ${error}`);
        }
      } else {
        errorStreaks.clear();
      }
      const spinning = detectSpinning();
      if (spinning && spinning.length >= spinningThreshold) {
        await notifier.notify({
          type: "stuck-spinning",
          severity: "warning",
          message: `Spinning: same ${spinning.length}-call sequence repeated ${spinning.repeatCount}x`,
          action: "Consider a different approach"
        });
        getLogger().write("WARN", `Stuck detection: spinning pattern (${spinning.length}-call sequence, ${spinning.repeatCount}x)`);
      }
    } catch (err) {
      getLogger().write("ERROR", `Stuck detector error: ${err.message}`);
    }
  }
  function onUserInput() {
    errorStreaks.clear();
    escalationLevel = 0;
    recentCalls.length = 0;
  }
  return {
    trackToolCall,
    onUserInput
  };
}

// src/plugin/advisory-guardrails.js
import { readFileSync as readFileSync10 } from "fs";
import { join as join15, basename, extname, isAbsolute, resolve } from "path";
import { homedir as homedir6 } from "os";
var NAMING_PATTERNS = {
  camelCase: /^[a-z][a-z0-9]*[A-Z][a-zA-Z0-9]*$/,
  PascalCase: /^[A-Z][a-zA-Z0-9]*[a-z][a-zA-Z0-9]*$/,
  snake_case: /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/,
  "kebab-case": /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/,
  UPPER_SNAKE_CASE: /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/
};
function classifyName(name) {
  if (/^[a-z][a-z0-9]*$/.test(name)) return "single-word";
  if (/^[A-Z][A-Z0-9]*$/.test(name)) return "single-word";
  for (const [pattern, regex] of Object.entries(NAMING_PATTERNS)) {
    if (regex.test(name)) return pattern;
  }
  return "mixed";
}
function splitWords(name) {
  return name.replace(/[-_]/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2").toLowerCase().split(/\s+/).filter(Boolean);
}
function toConvention(name, convention) {
  const words = splitWords(name);
  if (words.length === 0) return name;
  switch (convention) {
    case "kebab-case":
      return words.join("-");
    case "snake_case":
      return words.join("_");
    case "camelCase":
      return words[0] + words.slice(1).map((w) => w[0].toUpperCase() + w.slice(1)).join("");
    case "PascalCase":
      return words.map((w) => w[0].toUpperCase() + w.slice(1)).join("");
    case "UPPER_SNAKE_CASE":
      return words.map((w) => w.toUpperCase()).join("_");
    default:
      return name;
  }
}
var PLANNING_COMMANDS = {
  "ROADMAP.md": ["/bgsd-add-phase", "/bgsd-remove-phase", "/bgsd-insert-phase"],
  "STATE.md": ["/bgsd-progress", "/bgsd-execute-phase"],
  "PLAN.md": ["/bgsd-plan-phase"],
  "CONTEXT.md": ["/bgsd-discuss-phase"],
  "RESEARCH.md": ["/bgsd-research-phase"],
  "REQUIREMENTS.md": ["/bgsd-new-milestone"],
  "config.json": ["/bgsd-settings"],
  "SUMMARY.md": ["/bgsd-execute-phase"],
  "INTENT.md": ["/bgsd-new-project", "/bgsd-new-milestone", "/bgsd-complete-milestone"]
};
function isTestFile(filePath) {
  const lower = filePath.toLowerCase();
  return lower.includes(".test.") || lower.includes(".spec.") || lower.includes("__tests__/") || lower.includes("__tests__\\") || /[\\/]tests?[\\/]/.test(lower);
}
function loadConventionRules(cwd, confidenceThreshold) {
  try {
    const agentsPath = join15(cwd, "AGENTS.md");
    const content = readFileSync10(agentsPath, "utf-8");
    const conventionNames = ["kebab-case", "camelCase", "PascalCase", "snake_case", "UPPER_SNAKE_CASE"];
    for (const conv of conventionNames) {
      if (content.includes(conv)) {
        return { dominant: conv, confidence: 100 };
      }
    }
  } catch {
  }
  try {
    const intelPath = join15(cwd, ".planning", "codebase", "codebase-intel.json");
    const intel = JSON.parse(readFileSync10(intelPath, "utf-8"));
    if (intel.conventions?.naming?.dominant && (intel.conventions.naming.confidence || 0) >= confidenceThreshold) {
      return {
        dominant: intel.conventions.naming.dominant,
        confidence: intel.conventions.naming.confidence
      };
    }
  } catch {
  }
  return null;
}
function detectTestConfig(cwd) {
  const result = { command: null, sourceExts: /* @__PURE__ */ new Set() };
  try {
    const pkgPath = join15(cwd, "package.json");
    const pkg = JSON.parse(readFileSync10(pkgPath, "utf-8"));
    if (pkg.scripts?.test) {
      result.command = `npm test`;
    } else if (pkg.scripts?.check) {
      result.command = `npm run check`;
    }
    result.sourceExts = /* @__PURE__ */ new Set([".js", ".ts", ".cjs", ".mjs", ".jsx", ".tsx"]);
  } catch {
  }
  if (!result.command) {
    try {
      const pyProject = join15(cwd, "pyproject.toml");
      readFileSync10(pyProject, "utf-8");
      result.command = "pytest";
      result.sourceExts = /* @__PURE__ */ new Set([".py"]);
    } catch {
    }
  }
  return result;
}
var WRITE_TOOLS = /* @__PURE__ */ new Set(["write", "edit", "patch"]);
function createAdvisoryGuardrails(cwd, notifier, config) {
  const guardConfig = config.advisory_guardrails || {};
  const conventionsEnabled = guardConfig.conventions !== false;
  const planningProtectionEnabled = guardConfig.planning_protection !== false;
  const testSuggestionsEnabled = guardConfig.test_suggestions !== false;
  const dedupThreshold = guardConfig.dedup_threshold || 3;
  const testDebounceMs = guardConfig.test_debounce_ms || 500;
  const confidenceThreshold = guardConfig.convention_confidence_threshold || 70;
  let logger = null;
  function getLogger() {
    if (!logger) {
      const logDir = join15(homedir6(), ".config", "opencode");
      logger = createLogger(logDir);
    }
    return logger;
  }
  const conventionRules = conventionsEnabled ? loadConventionRules(cwd, confidenceThreshold) : null;
  const testConfig = testSuggestionsEnabled ? detectTestConfig(cwd) : { command: null, sourceExts: /* @__PURE__ */ new Set() };
  let bgsdCommandActive = false;
  const warnCounts = /* @__PURE__ */ new Map();
  let testBatchTimer = null;
  const testBatchFiles = [];
  async function flushTestBatch() {
    testBatchTimer = null;
    if (testBatchFiles.length === 0) return;
    const files = [...testBatchFiles];
    testBatchFiles.length = 0;
    const cmdStr = testConfig.command || "your test suite";
    let message;
    if (files.length === 1) {
      message = `Modified ${basename(files[0])}. Consider running: ${cmdStr}`;
    } else {
      message = `Modified ${files.length} source files. Consider running: ${cmdStr}`;
    }
    try {
      await notifier.notify({
        type: "advisory-test",
        severity: "info",
        message
      });
    } catch (err) {
      getLogger().write("ERROR", `Advisory test suggestion failed: ${err.message}`);
    }
  }
  async function onToolAfter(input) {
    if (guardConfig.enabled === false) return;
    try {
      const toolName = input?.tool;
      if (!toolName || !WRITE_TOOLS.has(toolName)) return;
      const filePath = input?.args?.filePath;
      if (!filePath) return;
      const absPath = isAbsolute(filePath) ? filePath : resolve(cwd, filePath);
      if (absPath.includes("node_modules") || !absPath.startsWith(cwd)) {
        return;
      }
      const relPath = absPath.slice(cwd.length + 1);
      if (planningProtectionEnabled && (relPath.startsWith(".planning/") || relPath.startsWith(".planning\\"))) {
        if (bgsdCommandActive) return;
        const fileBasename = basename(absPath);
        let commands = PLANNING_COMMANDS[fileBasename];
        if (!commands) {
          for (const [pattern, cmds] of Object.entries(PLANNING_COMMANDS)) {
            if (fileBasename.endsWith(pattern)) {
              commands = cmds;
              break;
            }
          }
        }
        if (commands) {
          const cmdStr = commands.join(" or ");
          await notifier.notify({
            type: "advisory-planning",
            severity: "warning",
            message: `${fileBasename} was edited directly. Use ${cmdStr} to modify this file safely.`
          });
        } else {
          await notifier.notify({
            type: "advisory-planning",
            severity: "warning",
            message: `File in .planning/ was edited directly. bGSD workflows manage these files automatically.`
          });
        }
        return;
      }
      if (conventionsEnabled && conventionRules) {
        const fileBasename = basename(absPath);
        const ext = extname(fileBasename);
        const nameWithoutExt = ext ? fileBasename.slice(0, -ext.length) : fileBasename;
        const classification = classifyName(nameWithoutExt);
        if (classification !== "single-word" && classification !== "mixed") {
          if (classification !== conventionRules.dominant) {
            const count = (warnCounts.get("convention") || 0) + 1;
            warnCounts.set("convention", count);
            if (count <= dedupThreshold) {
              const suggested = toConvention(nameWithoutExt, conventionRules.dominant) + ext;
              await notifier.notify({
                type: "advisory-convention",
                severity: "warning",
                message: `File uses ${classification} naming (${fileBasename}). Project convention is ${conventionRules.dominant}. Consider renaming to ${suggested}.`
              });
            } else if (count % 5 === 0) {
              await notifier.notify({
                type: "advisory-convention",
                severity: "warning",
                message: `${count} convention violations detected. Project convention is ${conventionRules.dominant}.`
              });
            }
          }
        }
      }
      if (testSuggestionsEnabled && testConfig.command) {
        if (isTestFile(absPath)) return;
        const ext = extname(absPath);
        if (testConfig.sourceExts.has(ext)) {
          testBatchFiles.push(relPath);
          if (testBatchTimer) {
            clearTimeout(testBatchTimer);
          }
          testBatchTimer = setTimeout(flushTestBatch, testDebounceMs);
        }
      }
    } catch (err) {
      getLogger().write("ERROR", `Advisory guardrails error: ${err.message}`);
    }
  }
  function setBgsdCommandActive() {
    bgsdCommandActive = true;
  }
  function clearBgsdCommandActive() {
    bgsdCommandActive = false;
  }
  return {
    onToolAfter,
    setBgsdCommandActive,
    clearBgsdCommandActive
  };
}

// src/plugin/index.js
init_config();
init_state();
init_roadmap();
init_plan();
init_config();
init_project();
init_intent();
init_parsers();
var BgsdPlugin = async ({ directory, $ }) => {
  const bgsdHome = join16(homedir7(), ".config", "opencode", "bgsd-oc");
  const registry = createToolRegistry(safeHook);
  const projectDir = directory || process.cwd();
  const config = parseConfig(projectDir);
  const notifier = createNotifier($, projectDir);
  const fileWatcher = createFileWatcher(projectDir, {
    debounceMs: config.file_watcher?.debounce_ms || 200,
    maxPaths: config.file_watcher?.max_watched_paths || 500
  });
  const idleValidator = createIdleValidator(projectDir, notifier, fileWatcher, config);
  const stuckDetector = createStuckDetector(notifier, config);
  const guardrails = createAdvisoryGuardrails(projectDir, notifier, config);
  fileWatcher.start();
  const shellEnv = safeHook("shell.env", async (input, output) => {
    if (!output || !output.env) return;
    output.env.BGSD_HOME = bgsdHome;
  });
  const compacting = safeHook("compacting", async (input, output) => {
    const projectDir2 = directory || process.cwd();
    const ctx = buildCompactionContext(projectDir2);
    if (ctx && output && output.context) {
      output.context.push(ctx);
    }
  });
  const systemTransform = safeHook("system.transform", async (input, output) => {
    const sysDir = directory || process.cwd();
    const prompt = buildSystemPrompt(sysDir);
    if (prompt && output && output.system) {
      output.system.push(prompt);
    }
    const pending = notifier.drainPendingContext();
    if (pending.length > 0 && output && output.system) {
      const xml = pending.map(
        (n) => `<bgsd-notification type="${n.type}" severity="${n.severity}">${n.message}${n.action ? ` Action: ${n.action}` : ""}</bgsd-notification>`
      ).join("\n");
      output.system.push(xml);
    }
  });
  const commandEnrich = safeHook("command.enrich", async (input, output) => {
    const cmdDir = directory || process.cwd();
    if (input?.command && input.command.startsWith("bgsd-")) {
      guardrails.setBgsdCommandActive();
    }
    enrichCommand(input, output, cmdDir);
  });
  const eventHandler = safeHook("event", async ({ event }) => {
    if (event.type === "session.idle") {
      await idleValidator.onIdle();
      guardrails.clearBgsdCommandActive();
    }
    if (event.type === "file.watcher.updated") {
      const { invalidateAll: invalidateAll2 } = await Promise.resolve().then(() => (init_parsers(), parsers_exports));
      invalidateAll2(projectDir);
    }
  });
  const toolAfter = safeHook("tool.execute.after", async (input) => {
    stuckDetector.trackToolCall(input);
    await guardrails.onToolAfter(input);
  });
  return {
    "shell.env": shellEnv,
    "experimental.session.compacting": compacting,
    "experimental.chat.system.transform": systemTransform,
    "command.execute.before": commandEnrich,
    "event": eventHandler,
    "tool.execute.after": toolAfter,
    tool: getTools(registry)
  };
};
export {
  BgsdPlugin,
  buildCompactionContext,
  buildSystemPrompt,
  createAdvisoryGuardrails,
  createFileWatcher,
  createIdleValidator,
  createNotifier,
  createStuckDetector,
  createToolRegistry,
  enrichCommand,
  getProjectState,
  invalidateAll,
  invalidateConfig,
  invalidateIntent,
  invalidatePlans,
  invalidateProject,
  invalidateRoadmap,
  invalidateState,
  parseConfig,
  parseIntent,
  parsePlan,
  parsePlans,
  parseProject,
  parseRoadmap,
  parseState,
  safeHook
};
