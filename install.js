#!/usr/bin/env node

import {
  readFileSync, writeFileSync, mkdirSync, cpSync,
  readdirSync, existsSync, statSync, unlinkSync,
  rmSync
} from "fs"
import { execSync } from "child_process"
import { join, dirname, basename } from "path"
import { homedir } from "os"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

const DEST = join(homedir(), ".config", "opencode", "bgsd-oc")
const CMD_DIR = join(homedir(), ".config", "opencode", "commands")
const AGENT_DIR = join(homedir(), ".config", "opencode", "agents")
const PLUGIN_DIR = join(homedir(), ".config", "opencode", "plugin")
const SKILL_DIR = join(homedir(), ".config", "opencode", "skills")
const SRC = __dirname
const OPENCODE_DIR = join(homedir(), ".config", "opencode")

// --- Argument parsing ---

const args = process.argv.slice(2)
const hasFlag = (flag) => args.includes(flag)

if (hasFlag("--help") || hasFlag("-h")) {
  console.log(`
bGSD (Get Stuff Done) — AI Project Planning for OpenCode

Usage:
  npx bgsd-oc              Install bGSD plugin and commands
  npx bgsd-oc --uninstall  Remove all bGSD files
  npx bgsd-oc --help       Show this help

What gets installed:
  ~/.config/opencode/bgsd-oc/          Core CLI, workflows, templates, references
  ~/.config/opencode/commands/bgsd-*   Canonical and compatibility slash commands
  ~/.config/opencode/agents/bgsd-*     10 specialized agents
  ~/.config/opencode/skills/           Reusable skill modules for agents
  ~/.config/opencode/plugin/bgsd.js    Plugin hooks (session, env, compaction)

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

  // Remove bgsd-*.md and legacy gsd-*.md from agents
  if (existsSync(AGENT_DIR)) {
    for (const f of readdirSync(AGENT_DIR)) {
      if ((f.startsWith("bgsd-") || f.startsWith("gsd-")) && f.endsWith(".md")) {
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

  // Remove plugin (current and legacy paths)
  const pluginPath = join(PLUGIN_DIR, "bgsd.js")
  if (existsSync(pluginPath)) {
    unlinkSync(pluginPath)
  }
  // Also clean up old plugins/ (plural) path from prior installs
  const oldPluginPath = join(homedir(), ".config", "opencode", "plugins", "bgsd.js")
  if (existsSync(oldPluginPath)) {
    unlinkSync(oldPluginPath)
  }

  // Remove bgsd-oc directory (and legacy get-shit-done if it exists)
  if (existsSync(DEST)) {
    rmSync(DEST, { recursive: true, force: true })
  }
  const OLD_DEST = join(homedir(), ".config", "opencode", "get-shit-done")
  if (existsSync(OLD_DEST)) {
    rmSync(OLD_DEST, { recursive: true, force: true })
  }

  console.log("bGSD uninstalled successfully.")
  process.exit(0)
}

// --- Migration from get-shit-done to bgsd-oc ---

const OLD_INSTALL = join(homedir(), ".config", "opencode", "get-shit-done")
if (existsSync(OLD_INSTALL) && !existsSync(DEST)) {
  console.log("Migrating existing installation...")
  console.log(`  Old: ${OLD_INSTALL}`)
  console.log(`  New: ${DEST}`)
  cpSync(OLD_INSTALL, DEST, { recursive: true })
  rmSync(OLD_INSTALL, { recursive: true, force: true })
  console.log("  Migration complete.")
  console.log("")
}

// Migrate old agent files: gsd-*.md -> bgsd-*.md
if (existsSync(AGENT_DIR)) {
  for (const f of readdirSync(AGENT_DIR)) {
    if (f.startsWith("gsd-") && f.endsWith(".md")) {
      const newName = f.replace(/^gsd-/, "bgsd-")
      const oldPath = join(AGENT_DIR, f)
      const newPath = join(AGENT_DIR, newName)
      cpSync(oldPath, newPath)
      unlinkSync(oldPath)
      console.log(`  Migrated agent: ${f} -> ${newName}`)
    }
  }
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

// Read manifest
const manifestPath = join(SRC, "bin", "manifest.json")
if (!existsSync(manifestPath)) {
  console.error("ERROR: bin/manifest.json not found. Package may be corrupted.")
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"))

/**
 * Determine destination path for a manifest file entry.
 * Mirrors deploy.sh dest_for_file() logic so canonical and compatibility wrappers stay aligned.
 */
function destForFile(file) {
  if (/^commands\/bgsd-.*\.md$/.test(file)) {
    return join(CMD_DIR, basename(file))
  }
  if (/^agents\/bgsd-.*\.md$/.test(file)) {
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

// Clean up old gsd-*.md agent files that now have bgsd-*.md replacements
if (existsSync(AGENT_DIR)) {
  for (const f of readdirSync(AGENT_DIR)) {
    if (f.startsWith("gsd-") && f.endsWith(".md")) {
      const newName = f.replace(/^gsd-/, "bgsd-")
      if (existsSync(join(AGENT_DIR, newName))) {
        unlinkSync(join(AGENT_DIR, f))
        console.log(`  Cleaned up old agent: ${f}`)
      }
    }
  }
}

// Copy plugin.js to plugin/bgsd.js (OpenCode auto-loads from plugin/ singular)
const pluginSrc = join(SRC, "plugin.js")
const pluginDst = join(PLUGIN_DIR, "bgsd.js")
if (existsSync(pluginSrc)) {
  cpSync(pluginSrc, pluginDst)
  console.log("  Installed plugin: plugin/bgsd.js")
}

// Clean up stale plugin from old plugins/ (plural) path
const oldPluginDst = join(homedir(), ".config", "opencode", "plugins", "bgsd.js")
if (existsSync(oldPluginDst)) {
  unlinkSync(oldPluginDst)
  console.log("  Cleaned up stale: plugins/bgsd.js (old path)")
}

// Substitute __OPENCODE_CONFIG__ placeholders
const OPENCODE_CFG = OPENCODE_DIR

/**
 * Recursively substitute placeholders in all .md files in a directory.
 */
function substituteInDir(dir) {
  let entries
  try {
    entries = readdirSync(dir, { recursive: true })
  } catch (e) {
    if (e.code === 'ENOENT') return
    throw e
  }
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
  const smokeResult = execSync(`node "${join(DEST, "bin", "bgsd-tools.cjs")}" util:current-timestamp --raw`, {
    encoding: "utf-8",
    timeout: 5000,
  }).trim()
  console.log(`  ✅ Smoke test passed: ${smokeResult}`)
} catch (err) {
  console.error("  ❌ Smoke test FAILED — deployed artifact does not execute correctly.")
  console.error(`  Error: ${err.message}`)
  console.error("  Run 'npx bgsd-oc --uninstall' to clean up, then try again.")
  process.exit(1)
}

// Summary
let cmdCount = 0
let agentCount = 0
try {
  cmdCount = readdirSync(CMD_DIR).filter(f => f.startsWith("bgsd-") && f.endsWith(".md")).length
} catch { /* empty */ }
try {
  agentCount = readdirSync(AGENT_DIR).filter(f => f.startsWith("bgsd-") && f.endsWith(".md")).length
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
