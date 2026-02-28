# Troubleshooting

Common issues and solutions for bGSD.

---

## Installation Issues

### "command not found" for /gsd-* commands

**Cause:** OpenCode hasn't loaded the command wrappers.

**Fix:** Restart OpenCode after running `deploy.sh`. Commands are registered at `~/.config/opencode/command/`.

### deploy.sh fails with "smoke test failed"

**Cause:** The built artifact has a problem.

**Fix:**
1. Check the error message — it usually indicates a missing module or syntax error
2. Run `npm run build` and check for esbuild warnings
3. The script auto-rolls back to the previous version on failure

### Node.js version errors

**Cause:** bGSD requires Node.js >= 18.

**Fix:** Update Node.js. Check with `node --version`.

---

## Planning Issues

### Plans seem too large or too small

**Fix:** Adjust planning depth:
- Use `/gsd-discuss-phase` before planning to lock down scope
- Set `depth` in config: `"quick"`, `"standard"`, or `"deep"`
- Use `/gsd-list-phase-assumptions` to check what the AI assumes before planning

### Plan quality review keeps requesting revisions

**Cause:** The gsd-plan-checker agent finds issues requiring revision (up to 3 cycles).

**Fix:**
- This is normal — plans improve through review
- Skip review with `--skip-verify` flag: `/gsd-plan-phase 1 --skip-verify`
- Disable permanently: set `plan_checker: false` in config

### "No phase found" errors

**Cause:** Phase number doesn't exist in the roadmap or phase directory is missing.

**Fix:**
1. Check ROADMAP.md for valid phase numbers
2. Run `node bin/gsd-tools.cjs find-phase <N>` to check phase directory
3. Run `/gsd-health` to check .planning/ integrity

---

## Execution Issues

### Context window filling up

**Cause:** Long conversations accumulate too much context.

**Fix:**
```
/clear                     # Clear context
/gsd-resume-work           # Restores state from files
```

bGSD is designed for context resets. All state lives in `.planning/` files, not in conversation history.

### Execution stops mid-phase

**Cause:** Context exhaustion, agent error, or checkpoint requiring human input.

**Fix:**
1. Run `/gsd-progress` to see current state
2. Run `/gsd-resume-work` to restore context
3. Continue with `/gsd-execute-phase <N>` — it picks up where it left off

### Tests failing during execution

**Cause:** Code changes broke existing tests.

**Fix:**
- If `test_gate: true` (default), execution pauses on test failure
- The executor will attempt to fix the failure
- If stuck, check `/gsd-debug` for systematic debugging
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
node bin/gsd-tools.cjs state validate --fix    # Auto-fix unambiguous issues
```

Or run `/gsd-health --repair` for full integrity check.

### "Two sources of truth" confusion

**Cause:** STATE.md and memory files show different positions.

**Fix:** STATE.md is always authoritative. Memory files are advisory caches. Run:
```bash
node bin/gsd-tools.cjs state validate --fix
```

### Progress shows wrong phase

**Fix:**
```bash
node bin/gsd-tools.cjs state update-progress    # Recalculate from disk
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
/gsd-rollback-info <plan-id>    # Shows exact revert command
```

Each task gets its own commit, enabling precise rollback.

---

## Performance Issues

### CLI commands slow

**Fix:**
1. Check bundle size: `ls -la bin/gsd-tools.cjs` (should be ~1000KB)
2. Enable profiling: `GSD_PROFILE=1 node bin/gsd-tools.cjs <command>`
3. Check for stale codebase analysis: `node bin/gsd-tools.cjs codebase status`

### Workflows consuming too many tokens

**Fix:**
1. Check token usage: `/gsd-context-budget`
2. Use `--compact` flag for init commands
3. Set context target: `context_target_percent: 50` in config
4. Ensure agent context manifests are working (v7.0+)

---

## Configuration Issues

### Config validation errors

**Fix:**
```bash
node bin/gsd-tools.cjs validate-config    # Shows validation errors
node bin/gsd-tools.cjs config-migrate     # Add missing keys with defaults
```

### Settings not taking effect

**Cause:** Config changes require reloading.

**Fix:** Run `/gsd-settings` for interactive configuration, or verify the JSON syntax in `.planning/config.json`.

---

## Debug Mode

Enable detailed logging for any issue:

```bash
GSD_DEBUG=1 node bin/gsd-tools.cjs <command> --raw
```

This enables stderr logging for all 96 catch blocks, showing exactly where issues occur.

---

## Getting Help

- Run `/gsd-help` for the full command reference
- Run `/gsd-health` to check system integrity
- Check [GitHub Issues](https://github.com/gonz0w/bgsd-oc/issues) for known problems
- See [Architecture](architecture.md) for understanding how the system works internally

---

*For configuration options, see [Configuration](configuration.md). For the full command reference, see [Commands](commands.md).*
