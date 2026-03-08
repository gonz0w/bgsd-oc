#!/usr/bin/env node

import {
  readFileSync, writeFileSync, mkdirSync, cpSync,
  readdirSync, existsSync, statSync, unlinkSync,
  rmSync, symlinkSync, lstatSync
} from "fs"
import { execSync } from "child_process"
import { join, dirname, basename } from "path"
import { homedir } from "os"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

const DEST = join(homedir(), ".config", "opencode", "get-shit-done")
const CMD_DIR = join(homedir(), ".config", "opencode", "commands")
const AGENT_DIR = join(homedir(), ".config", "opencode", "agents")
const PLUGIN_DIR = join(homedir(), ".config", "opencode", "plugins")
const SKILL_DIR = join(homedir(), ".config", "opencode", "skills")
const SRC = __dirname
const OC_SYMLINK = join(homedir(), ".config", "oc")
const OPENCODE_DIR = join(homedir(), ".config", "opencode")

// --- Argument parsing ---

const args = process.argv.slice(2)
const hasFlag = (flag) => args.includes(flag)

if (hasFlag("--help") || hasFlag("-h")) {
  console.log(`
bGSD (Get Stuff Done) — AI Project Planning for OpenCode

Usage:
  npx get-shit-done-oc              Install bGSD plugin and commands
  npx get-shit-done-oc --uninstall  Remove all bGSD files
  npx get-shit-done-oc --help       Show this help

What gets installed:
  ~/.config/opencode/get-shit-done/    Core CLI, workflows, templates, references
  ~/.config/opencode/commands/bgsd-*   40 slash commands
  ~/.config/opencode/agents/gsd-*      9 specialized agents
  ~/.config/opencode/skills/           Reusable skill modules for agents
  ~/.config/opencode/plugins/bgsd.js   Plugin hooks (session, env, compaction)

Learn more: https://github.com/gonz0w/bgsd-oc
`)
  process.exit(0)
}

// --- Uninstall ---

if (hasFlag("--uninstall")) {
  console.log("Uninstalling bGSD...")

  // Remove bgsd-*.md from commands
  if (existsSync(CMD_DIR)) {
    for (const f of readdirSync(CMD_DIR)) {
      if (f.startsWith("bgsd-") && f.endsWith(".md")) {
        unlinkSync(join(CMD_DIR, f))
      }
    }
  }

  // Remove gsd-*.md from agents
  if (existsSync(AGENT_DIR)) {
    for (const f of readdirSync(AGENT_DIR)) {
      if (f.startsWith("gsd-") && f.endsWith(".md")) {
        unlinkSync(join(AGENT_DIR, f))
      }
    }
  }

  // Remove skill directories
  if (existsSync(SKILL_DIR)) {
    for (const d of readdirSync(SKILL_DIR)) {
      const skillPath = join(SKILL_DIR, d)
      if (statSync(skillPath).isDirectory()) {
        rmSync(skillPath, { recursive: true, force: true })
      }
    }
  }

  // Remove plugin
  const pluginPath = join(PLUGIN_DIR, "bgsd.js")
  if (existsSync(pluginPath)) {
    unlinkSync(pluginPath)
  }

  // Remove get-shit-done directory
  if (existsSync(DEST)) {
    rmSync(DEST, { recursive: true, force: true })
  }

  console.log("bGSD uninstalled successfully.")
  process.exit(0)
}

// --- Install ---

console.log("Installing bGSD...")
console.log(`  Source: ${SRC}`)
console.log(`  Dest:   ${DEST}`)
console.log("")

// Create directories
for (const dir of [DEST, CMD_DIR, AGENT_DIR, PLUGIN_DIR, SKILL_DIR]) {
  mkdirSync(dir, { recursive: true })
}

// Create ~/.config/oc symlink if it doesn't exist
// This works around the Anthropic auth plugin mangling "opencode" → "Claude" in prompts
try {
  if (existsSync(OPENCODE_DIR)) {
    if (existsSync(OC_SYMLINK) || lstatSync(OC_SYMLINK).isSymbolicLink()) {
      // Already exists — skip
    }
  }
} catch {
  // Symlink doesn't exist — create it
  try {
    symlinkSync(OPENCODE_DIR, OC_SYMLINK)
    console.log(`  Created symlink: ${OC_SYMLINK} → ${OPENCODE_DIR}`)
  } catch (e) {
    console.warn(`  Warning: Could not create ${OC_SYMLINK} symlink: ${e.message}`)
  }
}

// Read manifest
const manifestPath = join(SRC, "bin", "manifest.json")
if (!existsSync(manifestPath)) {
  console.error("ERROR: bin/manifest.json not found. Package may be corrupted.")
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"))

/**
 * Determine destination path for a manifest file entry.
 * Mirrors deploy.sh dest_for_file() logic.
 */
function destForFile(file) {
  if (/^commands\/bgsd-.*\.md$/.test(file)) {
    return join(CMD_DIR, basename(file))
  }
  if (/^agents\/gsd-.*\.md$/.test(file)) {
    return join(AGENT_DIR, basename(file))
  }
  if (/^skills\//.test(file)) {
    return join(SKILL_DIR, file.replace(/^skills\//, ''))
  }
  return join(DEST, file)
}

// Copy each file from manifest
let added = 0
let updated = 0

for (const file of manifest.files) {
  const srcPath = join(SRC, file)
  if (!existsSync(srcPath)) {
    console.warn(`  ⚠ Manifest lists ${file} but source not found — skipping`)
    continue
  }

  const dstPath = destForFile(file)
  mkdirSync(dirname(dstPath), { recursive: true })

  if (existsSync(dstPath)) {
    updated++
  } else {
    added++
  }

  cpSync(srcPath, dstPath)
}

// Copy plugin.js to plugins/bgsd.js
const pluginSrc = join(SRC, "plugin.js")
const pluginDst = join(PLUGIN_DIR, "bgsd.js")
if (existsSync(pluginSrc)) {
  cpSync(pluginSrc, pluginDst)
  console.log("  Installed plugin: plugins/bgsd.js")
}

// Substitute __OPENCODE_CONFIG__ placeholders
// Use ~/.config/oc symlink path (avoids Anthropic auth plugin mangling)
const OPENCODE_CFG = OC_SYMLINK

/**
 * Recursively substitute placeholders in all .md files in a directory.
 */
function substituteInDir(dir) {
  if (!existsSync(dir)) return
  const entries = readdirSync(dir, { recursive: true })
  for (const entry of entries) {
    const fullPath = join(dir, entry)
    try {
      if (!statSync(fullPath).isFile()) continue
    } catch {
      continue
    }
    if (!fullPath.endsWith(".md")) continue
    try {
      const content = readFileSync(fullPath, "utf-8")
      if (content.includes("__OPENCODE_CONFIG__")) {
        writeFileSync(fullPath, content.replaceAll("__OPENCODE_CONFIG__", OPENCODE_CFG))
      }
    } catch {
      // Skip files that can't be read/written
    }
  }
}

console.log("Substituting path placeholders...")
substituteInDir(DEST)
substituteInDir(CMD_DIR)
substituteInDir(AGENT_DIR)
substituteInDir(SKILL_DIR)
console.log(`  Path placeholders resolved to: ${OPENCODE_CFG}`)

// Smoke test
console.log("")
console.log("Running smoke test...")
try {
  const smokeResult = execSync(`node "${join(DEST, "bin", "gsd-tools.cjs")}" util:current-timestamp --raw`, {
    encoding: "utf-8",
    timeout: 5000,
  }).trim()
  console.log(`  ✅ Smoke test passed: ${smokeResult}`)
} catch (err) {
  console.error("  ❌ Smoke test FAILED — deployed artifact does not execute correctly.")
  console.error(`  Error: ${err.message}`)
  console.error("  Run 'npx get-shit-done-oc --uninstall' to clean up, then try again.")
  process.exit(1)
}

// Summary
let cmdCount = 0
let agentCount = 0
try {
  cmdCount = readdirSync(CMD_DIR).filter(f => f.startsWith("bgsd-") && f.endsWith(".md")).length
} catch { /* empty */ }
try {
  agentCount = readdirSync(AGENT_DIR).filter(f => f.startsWith("gsd-") && f.endsWith(".md")).length
} catch { /* empty */ }

let skillCount = 0
try {
  if (existsSync(SKILL_DIR)) {
    for (const d of readdirSync(SKILL_DIR)) {
      if (existsSync(join(SKILL_DIR, d, 'SKILL.md'))) skillCount++
    }
  }
} catch { /* empty */ }

console.log("")
console.log(`  Sync: ${added} added, ${updated} updated`)
console.log(`  Commands deployed: ${cmdCount}`)
console.log(`  Agents deployed:   ${agentCount}`)
console.log(`  Skills deployed:   ${skillCount}`)
console.log("")
console.log("Installed successfully.")
console.log("Restart OpenCode to pick up the changes, then use /bgsd-help to get started.")
