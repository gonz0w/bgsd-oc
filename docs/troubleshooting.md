# Troubleshooting

Common issues and solutions for bGSD.

---

## Installation Issues

### "command not found" for /bgsd-* commands

**Cause:** OpenCode hasn't loaded the command wrappers.

**Fix:** Restart OpenCode after running `deploy.sh`. Commands are registered at `~/.config/opencode/command/`.

### deploy.sh fails with "smoke test failed"

**Cause:** The built artifact has a problem.

**Fix:**
1. Check the error message — it usually indicates a missing module or syntax error
2. Run `npm run build` and check for esbuild warnings
3. The script auto-rolls back to the previous version on failure

### Node.js version errors

**Cause:** bGSD requires Node.js >= 22.5 for full functionality (SQLite caching). Older versions work but fall back to in-memory caching.

**Fix:** Update Node.js. Check with `node --version`. Node 22.5+ is recommended for the best experience.

---

## Planning Issues

### Plans seem too large or too small

**Fix:** Adjust planning depth:
- Use `/bgsd-plan discuss 1` before planning to lock down scope
- Set `depth` in config: `"quick"`, `"standard"`, or `"deep"`
- Use `/bgsd-plan assumptions 1` to check what the AI assumes before planning

### Plan quality review keeps requesting revisions

**Cause:** The gsd-plan-checker agent finds issues requiring revision (up to 3 cycles).

**Fix:**
- This is normal — plans improve through review
- Skip review with `--skip-verify` flag: `/bgsd-plan phase 1 --skip-verify`
- Disable permanently: set `plan_checker: false` in config

### "No phase found" errors

**Cause:** Phase number doesn't exist in the roadmap or phase directory is missing.

**Fix:**
1. Check ROADMAP.md for valid phase numbers
2. Run `node bin/bgsd-tools.cjs plan:find-phase <N>` to check phase directory
3. Run `/bgsd-inspect health` to check `.planning/` integrity

---

## Execution Issues

### Context window filling up

**Cause:** Long conversations accumulate too much context.

**Fix:**
```
/clear                     # Clear context
/bgsd-resume           # Restores state from files
```

bGSD is designed for context resets. All state lives in `.planning/` files, not in conversation history.

### Execution stops mid-phase

**Cause:** Context exhaustion, agent error, or checkpoint requiring human input.

**Fix:**
1. Run `/bgsd-inspect progress` to see current state
2. Run `/bgsd-resume` to restore context
3. Continue with `/bgsd-execute-phase <N>` — it picks up where it left off

### Tests failing during execution

**Cause:** Code changes broke existing tests.

**Fix:**
- If `test_gate: true` (default), execution pauses on test failure
- The executor will attempt to fix the failure
- If stuck, check `/bgsd-debug` for systematic debugging
- Disable test gating temporarily: set `test_gate: false` in config

### Worktree conflicts

**Cause:** Parallel plans modify the same files.

**Fix:**
1. The overlap checker warns before execution
2. Move conflicting plans to sequential waves
3. Disable worktrees: set `worktree.enabled: false` in config

---

## State Issues

### STATE.md out of sync

**Cause:** Manual edits, interrupted operations, or cross-session drift.

**Fix:**
```bash
node bin/bgsd-tools.cjs verify:state validate --fix    # Auto-fix unambiguous issues
```

Or run `/bgsd-inspect health` for an inspection-only integrity check.

### "Two sources of truth" confusion

**Cause:** STATE.md and memory files show different positions.

**Fix:** STATE.md is always authoritative. Memory files are advisory caches. Run:
```bash
node bin/bgsd-tools.cjs verify:state validate --fix
```

### Progress shows wrong phase

**Fix:**
```bash
node bin/bgsd-tools.cjs verify:state update-progress    # Recalculate from disk
```

---

## Git Issues

### Pre-commit check failures

**Cause:** Git state issues detected by safety checks.

**Common checks:**
- Dirty tree (uncommitted changes)
- Active rebase in progress
- Detached HEAD
- Shallow clone

**Fix:** Resolve the git state issue, then retry the operation.

### Rollback needed

**Fix:**
```
/bgsd-inspect rollback-info 159-08    # Shows commits and the revert command for a plan
```

Each task gets its own commit, enabling precise rollback.

---

## Performance Issues

### CLI commands slow

**Fix:**
1. Check bundle size: `ls -la bin/bgsd-tools.cjs` (should be ~1058KB)
2. Enable profiling: `GSD_PROFILE=1 node bin/bgsd-tools.cjs <command>`
3. Check for stale codebase analysis: `node bin/bgsd-tools.cjs util:codebase status`
4. Warm the SQLite cache: `node bin/bgsd-tools.cjs util:cache warm`

### SQLite caching issues

If SQLite caching issues occur on Node <22.5, bGSD falls back to in-memory Map cache automatically. No action needed — performance is slightly lower but all functionality works correctly.

To check cache status:
```bash
node bin/bgsd-tools.cjs util:cache status
```

### Workflows consuming too many tokens

**Fix:**
1. Check token usage: `/bgsd-inspect context-budget 159-09`
2. Use `--compact` flag for init commands
3. Set context target: `context_target_percent: 50` in config
4. Ensure agent context manifests are working (v7.0+)

---

## Configuration Issues

### Config validation errors

**Fix:**
```bash
node bin/bgsd-tools.cjs verify:validate-config    # Shows validation errors
node bin/bgsd-tools.cjs util:config-migrate       # Add missing keys with defaults
```

### Settings not taking effect

**Cause:** Config changes require reloading.

**Fix:** Run `/bgsd-settings` for interactive configuration, or verify the JSON syntax in `.planning/config.json`.

---

## Debug Mode

Enable detailed logging for any issue:

```bash
GSD_DEBUG=1 node bin/bgsd-tools.cjs <command> --raw
```

This enables stderr logging for all 96 catch blocks, showing exactly where issues occur.

---

## Getting Help

- Run `/bgsd-help` for the full command reference
- Run `/bgsd-inspect health` to check system integrity
- Check [GitHub Issues](https://github.com/gonz0w/bgsd-oc/issues) for known problems
- See [Architecture](architecture.md) for understanding how the system works internally

---

*For configuration options, see [Configuration](configuration.md). For the full command reference, see [Commands](commands.md).*
