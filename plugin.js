// src/plugin/index.js
import { readFileSync as readFileSync7 } from "fs";
import { join as join9 } from "path";
import { homedir as homedir2 } from "os";

// src/plugin/safe-hook.js
import { homedir } from "os";
import { join as join2 } from "path";
import { randomBytes as randomBytes2 } from "crypto";

// src/plugin/logger.js
import { existsSync, mkdirSync, statSync, appendFileSync, copyFileSync, writeFileSync } from "fs";
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
      const stat = statSync(logPath);
      if (stat.size >= MAX_LOG_SIZE) {
        copyFileSync(logPath, rotatedPath);
        writeFileSync(logPath, "");
      }
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
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Hook "${name}" timed out after ${ms}ms`));
      }, ms);
      promise.then((result) => {
        clearTimeout(timer);
        resolve(result);
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
        await withTimeout(fn(input, output), timeout);
        consecutiveFailures = 0;
        const elapsed = Date.now() - startTime;
        if (elapsed > 500) {
          getLogger().write("WARN", `Slow hook: ${name} took ${elapsed}ms`, correlationId, {
            hookName: name,
            elapsed
          });
        }
        return;
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
  function getTools() {
    const tools = {};
    for (const [name, def] of registry) {
      tools[name] = def;
    }
    return tools;
  }
  return { registerTool, getTools };
}

// src/plugin/parsers/state.js
import { readFileSync } from "fs";
import { join as join3 } from "path";
var _cache = /* @__PURE__ */ new Map();
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

// src/plugin/parsers/roadmap.js
import { readFileSync as readFileSync2 } from "fs";
import { join as join4 } from "path";
var _cache2 = /* @__PURE__ */ new Map();
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
    const escaped = number.replace(/\./g, "\\.");
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

// src/plugin/parsers/plan.js
import { readFileSync as readFileSync3, readdirSync } from "fs";
import { join as join5 } from "path";
var _planCache = /* @__PURE__ */ new Map();
var _plansCache = /* @__PURE__ */ new Map();
var FM_DELIMITERS = /^---\n([\s\S]+?)\n---/;
var FM_KEY_VALUE = /^(\s*)([a-zA-Z0-9_-]+):\s*(.*)/;
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

// src/plugin/parsers/config.js
import { readFileSync as readFileSync4 } from "fs";
import { join as join6 } from "path";
var _cache3 = /* @__PURE__ */ new Map();
var CONFIG_DEFAULTS = Object.freeze({
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
  staleness_threshold: 2
});
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

// src/plugin/parsers/project.js
import { readFileSync as readFileSync5 } from "fs";
import { join as join7 } from "path";
var _cache4 = /* @__PURE__ */ new Map();
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

// src/plugin/parsers/intent.js
import { readFileSync as readFileSync6 } from "fs";
import { join as join8 } from "path";
var _cache5 = /* @__PURE__ */ new Map();
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

// src/plugin/project-state.js
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

// src/plugin/parsers/index.js
function invalidateAll(cwd) {
  invalidateState(cwd);
  invalidateRoadmap(cwd);
  invalidatePlans(cwd);
  invalidateConfig(cwd);
  invalidateProject(cwd);
  invalidateIntent(cwd);
}

// src/plugin/index.js
var BgsdPlugin = async ({ directory }) => {
  const bgsdHome = join9(homedir2(), ".config", "opencode", "bgsd-oc");
  const registry = createToolRegistry(safeHook);
  const sessionCreated = safeHook("session.created", async (input, output) => {
    console.log("[bGSD] Planning plugin available. Use /bgsd-help to get started.");
  });
  const shellEnv = safeHook("shell.env", async (input, output) => {
    if (!output || !output.env) return;
    output.env.BGSD_HOME = bgsdHome;
  });
  const compacting = safeHook("compacting", async (input, output) => {
    const projectDir = directory || input?.cwd;
    const statePath = join9(projectDir, ".planning", "STATE.md");
    const stateContent = readFileSync7(statePath, "utf-8");
    if (output && output.context) {
      output.context.push(
        `## bGSD Project State (preserved across compaction)
${stateContent}`
      );
    }
  });
  const systemTransform = safeHook("system.transform", async (input, output) => {
    const projectDir = directory || process.cwd();
    const prompt = buildSystemPrompt(projectDir);
    if (prompt && output && output.system) {
      output.system.push(prompt);
    }
  });
  return {
    "session.created": sessionCreated,
    "shell.env": shellEnv,
    "experimental.session.compacting": compacting,
    "experimental.chat.system.transform": systemTransform
    // tool: registry.getTools(),  // Uncomment in Phase 74 when tools exist
  };
};
export {
  BgsdPlugin,
  buildSystemPrompt,
  createToolRegistry,
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
