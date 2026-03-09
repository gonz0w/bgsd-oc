// src/plugin/index.js
import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
var BgsdPlugin = async ({ directory }) => {
  const gsdHome = join(homedir(), ".config", "opencode", "get-shit-done");
  return {
    "session.created": async (input, output) => {
      console.log("[bGSD] Planning plugin available. Use /bgsd-help to get started.");
    },
    "shell.env": async (input, output) => {
      if (!output || !output.env) return;
      output.env.GSD_HOME = gsdHome;
    },
    "experimental.session.compacting": async (input, output) => {
      try {
        const projectDir = directory || input?.cwd;
        const statePath = join(projectDir, ".planning", "STATE.md");
        const stateContent = readFileSync(statePath, "utf-8");
        if (output && output.context) {
          output.context.push(
            `## bGSD Project State (preserved across compaction)
${stateContent}`
          );
        }
      } catch {
      }
    }
  };
};
export {
  BgsdPlugin
};
