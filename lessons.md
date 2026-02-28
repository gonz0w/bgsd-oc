# Lessons Learned

## 2026-02-28: Anthropic Auth Plugin System Prompt Mangling

**Severity:** Critical — caused days of debugging, directory confusion, broken path references

**Root Cause:**
The auth plugin (v0.0.13) performs a global text replacement on the entire system prompt before sending it to Anthropic's API. This is done because Anthropic's OAuth endpoint blocks requests containing the literal editor name.

The replacement logic in the plugin's `index.mjs`:
```javascript
// In experimental.chat.system.transform AND in the fetch() interceptor:
text.replace(/OpenCode/g, "Claude Code")
    .replace(/opencode/gi, "Claude")
```

**What Broke:**
- `/mnt/raid/DEV/gsd-opencode/` → `/mnt/raid/DEV/gsd-Claude/` in system prompt
- `~/.config/opencode/` → `~/.config/Claude/` in system prompt
- Identity string got rewritten
- AGENTS.md, agent definitions, and any instruction files loaded as system prompt had ALL instances mangled
- The AI kept referencing a non-existent `gsd-Claude` directory, creating phantom path references

**Symptoms:**
- AI consistently referenced `/mnt/raid/DEV/gsd-Claude/` despite the directory not existing
- Adding "NEVER reference gsd-Claude" to AGENTS.md made it worse (the warning itself got mangled)
- Only this project was affected (because the editor name appeared in the project directory name)
- Other projects without the editor name in their path were fine

**Resolution (2026-02-28):**
Renamed the project directory and all references from `gsd-opencode` to `bgsd-oc`. This removes the triggering substring entirely from the project path, eliminating the mangling. Also renamed the GitHub repo and updated git remote.

**Preventive Rules:**
All text that gets loaded into the system prompt (AGENTS.md, agent definitions, workflows loaded as instructions) must avoid the literal editor name strings. Use:
- Relative paths or `$PWD` instead of absolute paths containing the project name
- `__OPENCODE_CONFIG__` placeholder (already exists in deploy.sh) for config paths
- Generic terms like "this editor" or "the host editor" instead of the product name
- The abbreviated form `OC` when a short reference is needed
- Directory/repo names that don't contain the editor name substring

**Affected Files (original):**
- `AGENTS.md` (10 occurrences) — loaded as system prompt on every session
- `.planning/PROJECT.md` (3 occurrences) — loaded by workflows
- `~/.config/oc/agents/*.md` (9 files, ~43 occurrences) — loaded as subagent system prompts
- Source workflows/references (4 files) — loaded during workflow execution
- Source JS files (4 files) — runtime only, NOT prompt-facing, safe to leave

**Discovery Method:**
Reading the plugin source, specifically the `fetch()` interceptor that JSON-parses the API request body and rewrites `parsed.system` array entries.
