<purpose>
Orchestrate 4 parallel codebase mapper agents (tech, arch, quality, concerns) to write 7 structured documents to .planning/codebase/. Agents write directly; orchestrator only receives confirmations and line counts.
</purpose>

<required_reading>
Read all execution_context files before starting.
</required_reading>

<process>

<!-- section: init_context -->
<skill:bgsd-context-init />

Extract from `<bgsd-context>` JSON: `mapper_model`, `commit_docs`, `codebase_dir`, `existing_maps`, `has_maps`, `codebase_dir_exists`, `tool_availability`, `tool_availability_meta`, `capability_level` (from `handoff_tool_context.capability_level`, may be `UNKNOWN`).
<!-- /section -->

<!-- section: check_existing -->
<step name="check_existing">
If `codebase_dir_exists` is true, run `ls -la .planning/codebase/` and offer:

| Choice | Action |
|--------|--------|
| Refresh | Delete .planning/codebase/, continue to create_structure |
| Update | Ask which documents to update, continue to spawn_agents (filtered) |
| Skip | Exit workflow |

Wait for user response. If doesn't exist: continue to create_structure.
</step>
<!-- /section -->

<!-- section: create_structure -->
<step name="create_structure">
```bash
mkdir -p .planning/codebase
```

Expected output: STACK.md, INTEGRATIONS.md (tech), ARCHITECTURE.md, STRUCTURE.md (arch), CONVENTIONS.md, TESTING.md (quality), CONCERNS.md (concerns).
</step>
<!-- /section -->

<!-- section: spawn_agents -->
<step name="spawn_agents">
Spawn 4 parallel `bgsd-codebase-mapper` agents (`run_in_background=true`, NOT `Explore`). Each prompt: "Focus: {focus}. Write {docs} to .planning/codebase/. Return confirmation only."

Build `TOOL_GUIDANCE` from `tool_availability` before spawning:
```
Tool capability: {capability_level}.
{If fd available: "File discovery: fd -e ts -e tsx -e js -e jsx"}
{If ripgrep available: "Content search: rg 'pattern' --type ts"}
{If ast_grep available: "Structural code search: sg --pattern 'pattern' src/"}
{If jq available: "JSON transform: jq '<filter>' file.json"}
{If yq available: "YAML transform: yq '<expr>' file.yaml"}
{If sd available: "Text replacement: sd 'before' 'after' <files>"}
{If hyperfine available: "Benchmarking: hyperfine '<cmd1>' '<cmd2>'"}
{If neither fd nor ripgrep: "Use Glob and Grep MCP tools for file discovery and content search"}
```

```
Task(subagent_type="bgsd-codebase-mapper", model="{mapper_model}", run_in_background=true,
  description="Map tech", prompt="Focus: tech. Write STACK.md + INTEGRATIONS.md. {TOOL_GUIDANCE}")
Task(subagent_type="bgsd-codebase-mapper", model="{mapper_model}", run_in_background=true,
  description="Map arch", prompt="Focus: arch. Write ARCHITECTURE.md + STRUCTURE.md. {TOOL_GUIDANCE}")
Task(subagent_type="bgsd-codebase-mapper", model="{mapper_model}", run_in_background=true,
  description="Map quality", prompt="Focus: quality. Write CONVENTIONS.md + TESTING.md. {TOOL_GUIDANCE}")
Task(subagent_type="bgsd-codebase-mapper", model="{mapper_model}", run_in_background=true,
  description="Map concerns", prompt="Focus: concerns. Write CONCERNS.md. {TOOL_GUIDANCE}")
```
</step>
<!-- /section -->

<!-- section: collect_confirmations -->
<step name="collect_confirmations">
Wait for all 4 agents. Collect file paths and line counts. Note any failures and continue.
</step>
<!-- /section -->

<!-- section: verify_output -->
<step name="verify_output">
```bash
ls -la .planning/codebase/
wc -l .planning/codebase/*.md
```

Verify: all 7 documents exist, none empty (>20 lines each). Note any missing.
</step>
<!-- /section -->

<!-- section: scan_secrets -->
<step name="scan_for_secrets">
**CRITICAL SECURITY CHECK** before committing:

```bash
grep -E '(sk-[a-zA-Z0-9]{20,}|sk_live_[a-zA-Z0-9]+|sk_test_[a-zA-Z0-9]+|ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|glpat-[a-zA-Z0-9_-]+|AKIA[A-Z0-9]{16}|xox[baprs]-[a-zA-Z0-9-]+|-----BEGIN.*PRIVATE KEY|eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.)' .planning/codebase/*.md 2>/dev/null && SECRETS_FOUND=true || SECRETS_FOUND=false
```

If `SECRETS_FOUND=true`: alert user, show matches, pause and wait for "safe to proceed" before committing.
</step>
<!-- /section -->

<!-- section: commit -->
<step name="commit_codebase_map">
```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:commit "docs: map existing codebase" --files .planning/codebase/*.md
```
</step>
<!-- /section -->

<!-- section: offer_next -->
<step name="offer_next">
Print completion: list all 7 files with line counts (`wc -l .planning/codebase/*.md`).

Next: `/bgsd-new-project` `<sub>/clear first</sub>` | Also: re-run `/bgsd-map-codebase`, review `cat .planning/codebase/STACK.md`
</step>
<!-- /section -->

</process>

<!-- section: success_criteria -->
<success_criteria>
- [ ] .planning/codebase/ directory created
- [ ] 4 parallel bgsd-codebase-mapper agents spawned with run_in_background=true
- [ ] Agents write documents directly (orchestrator doesn't receive document contents)
- [ ] All 7 codebase documents exist
- [ ] Secret scan passes before commit
- [ ] Clear completion summary with line counts
- [ ] User offered clear next steps
</success_criteria>
<!-- /section -->
