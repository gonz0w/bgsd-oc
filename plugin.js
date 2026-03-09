// src/plugin/index.js
import { readFileSync } from "fs";
import { join as join3 } from "path";
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

// src/plugin/index.js
var BgsdPlugin = async ({ directory }) => {
  const gsdHome = join3(homedir2(), ".config", "opencode", "get-shit-done");
  const sessionCreated = safeHook("session.created", async (input, output) => {
    console.log("[bGSD] Planning plugin available. Use /bgsd-help to get started.");
  });
  const shellEnv = safeHook("shell.env", async (input, output) => {
    if (!output || !output.env) return;
    output.env.GSD_HOME = gsdHome;
  });
  const compacting = safeHook("compacting", async (input, output) => {
    const projectDir = directory || input?.cwd;
    const statePath = join3(projectDir, ".planning", "STATE.md");
    const stateContent = readFileSync(statePath, "utf-8");
    if (output && output.context) {
      output.context.push(
        `## bGSD Project State (preserved across compaction)
${stateContent}`
      );
    }
  });
  return {
    "session.created": sessionCreated,
    "shell.env": shellEnv,
    "experimental.session.compacting": compacting
  };
};
export {
  BgsdPlugin
};
