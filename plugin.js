import { readFileSync } from "fs"
import { join } from "path"
import { homedir } from "os"

/**
 * bGSD (Get Stuff Done) — OpenCode Plugin
 *
 * Provides session lifecycle integration for the bGSD planning system:
 * - Session greeting with plugin availability notice
 * - GSD_HOME environment variable injection for workflow resolution
 * - State preservation across session compaction
 *
 * Hook signature: (input, output) => Promise<void>
 * Per @opencode-ai/plugin SDK types. Guards against undefined output
 * to prevent TypeError crashes that block all shell execution.
 */
export const BgsdPlugin = async ({ directory }) => {
  const gsdHome = join(homedir(), ".config", "opencode", "get-shit-done")

  return {
    "session.created": async (input, output) => {
      console.log("[bGSD] Planning plugin available. Use /bgsd-help to get started.")
    },

    "shell.env": async (input, output) => {
      if (!output || !output.env) return
      output.env.GSD_HOME = gsdHome
    },

    "experimental.session.compacting": async (input, output) => {
      try {
        const projectDir = directory || input?.cwd
        const statePath = join(projectDir, ".planning", "STATE.md")
        const stateContent = readFileSync(statePath, "utf-8")
        if (output && output.context) {
          output.context.push(
            `## bGSD Project State (preserved across compaction)\n${stateContent}`
          )
        }
      } catch {
        // No .planning/STATE.md — project may not use bGSD. Silently skip.
      }
    },
  }
}
