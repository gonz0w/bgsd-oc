---
phase: quick-10
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - plugin.js
  - install.js
autonomous: true
requirements: [FIX-PLUGIN-PATH]
must_haves:
  truths:
    - "GSD_HOME always resolves to ~/.config/opencode/get-shit-done/ regardless of where plugin.js is loaded from"
    - "Plugin works identically when loaded from ~/.config/opencode/plugins/bgsd.js (installed) or from local project .opencode/plugins/ (development)"
    - "install.js copies the fixed plugin.js correctly"
  artifacts:
    - path: "plugin.js"
      provides: "Fixed GSD_HOME resolution using homedir()"
      contains: "homedir"
  key_links:
    - from: "plugin.js"
      to: "shell.env hook"
      via: "GSD_HOME env var"
      pattern: "output\\.env\\.GSD_HOME"
---

<objective>
Fix plugin.js to always resolve GSD_HOME to the user's home config directory (~/.config/opencode/get-shit-done/) instead of using a relative path from __dirname.

Purpose: The current plugin.js uses `join(__dirname, "..", "get-shit-done")` which works when the plugin is installed at `~/.config/opencode/plugins/bgsd.js` but breaks when OpenCode loads the plugin from a local project's `.opencode/plugins/` directory — in that case GSD_HOME would incorrectly point to `.opencode/get-shit-done/` in the project directory instead of the home config.

Output: Fixed plugin.js that always resolves GSD_HOME to `~/.config/opencode/get-shit-done/`
</objective>

<context>
@plugin.js
@install.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix GSD_HOME resolution in plugin.js</name>
  <files>plugin.js</files>
  <action>
Replace the relative `__dirname`-based path resolution with an absolute path using `homedir()` from the `os` module.

Current (broken for local .opencode/ loading):
```js
const __dirname = dirname(fileURLToPath(import.meta.url))
const gsdHome = join(__dirname, "..", "get-shit-done")
```

Replace with:
```js
import { homedir } from "os"
```
(add to imports at top)

And change the gsdHome computation inside `BgsdPlugin` to:
```js
const gsdHome = join(homedir(), ".config", "opencode", "get-shit-done")
```

Remove the `__dirname` line since it's no longer needed. Remove `dirname` and `fileURLToPath` imports since they're no longer used.

The final import block should be:
```js
import { readFileSync } from "fs"
import { join } from "path"
import { homedir } from "os"
```

This matches the exact same path used in:
- `install.js` line 15: `const DEST = join(homedir(), ".config", "opencode", "get-shit-done")`
- `src/commands/agent.js` fallback: `path.join(process.env.HOME, ".config", "oc", "get-shit-done")`
- `deploy.sh` line 5: `DEST="$HOME/.config/opencode/get-shit-done"`

Using `homedir()` (not `process.env.HOME`) because it's more reliable cross-platform and is already the pattern used in `install.js`.
  </action>
  <verify>
Run: `node -e "import('./plugin.js').then(m => m.BgsdPlugin({ directory: '/tmp' }).then(hooks => { const out = { env: {} }; hooks['shell.env']({}, out); console.log(out.env.GSD_HOME) }))"`

The output must be an absolute path ending in `/.config/opencode/get-shit-done` under the user's home directory, NOT a relative or project-local path.

Also verify no syntax errors: `node -c plugin.js` (or equivalent ESM check).
  </verify>
  <done>
GSD_HOME always resolves to `~/.config/opencode/get-shit-done/` regardless of where plugin.js is loaded from. The `homedir()` import from `os` is used instead of `__dirname` relative resolution.
  </done>
</task>

<task type="auto">
  <name>Task 2: Verify install.js copies correct plugin and run tests</name>
  <files>install.js</files>
  <action>
No changes needed to install.js — it already copies plugin.js verbatim to `~/.config/opencode/plugins/bgsd.js` (lines 162-168). The fix in Task 1 automatically propagates through the install flow.

Verify the fix doesn't break the existing test suite:
1. Run `npm test` to confirm no regressions
2. Verify the plugin exports correctly by importing it
3. Confirm all three hooks (session.created, shell.env, experimental.session.compacting) still work

If any tests reference the old __dirname pattern in plugin.js, update them to match the new homedir() pattern.
  </action>
  <verify>
Run: `npm test` — all existing tests pass (no regressions from plugin change).
Run: `node -e "import('./plugin.js').then(m => console.log('Plugin exports:', Object.keys(m)))"` — confirms clean import.
  </verify>
  <done>
Test suite passes. Plugin imports cleanly. install.js flow unchanged and still copies the fixed plugin.js.
  </done>
</task>

</tasks>

<verification>
1. `node -e "import('./plugin.js').then(m => m.BgsdPlugin({ directory: '/tmp' }).then(hooks => { const out = { env: {} }; hooks['shell.env']({}, out); console.log('GSD_HOME:', out.env.GSD_HOME) }))"` — prints absolute home-based path
2. `npm test` — no regressions
3. Manual inspection: plugin.js uses `homedir()` from `os`, not `__dirname` relative resolution
</verification>

<success_criteria>
- GSD_HOME resolves to `~/.config/opencode/get-shit-done/` regardless of plugin load location
- No `__dirname`, `dirname`, or `fileURLToPath` in plugin.js (no longer needed)
- `homedir()` from `os` used for reliable cross-platform home dir resolution
- All existing tests pass
</success_criteria>
