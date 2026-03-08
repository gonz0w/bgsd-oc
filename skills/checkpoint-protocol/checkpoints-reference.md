# Checkpoints Reference

Detailed reference material for checkpoint types, patterns, and examples. Load this when you need full checkpoint documentation beyond the SKILL.md summary.

## Golden Rules

1. Agent runs all CLI/API — never ask user to execute commands
2. Agent sets up verification environment (dev servers, databases, env vars)
3. User only does human-judgment tasks (visual checks, UX evaluation)
4. Secrets from user, automation from agent
5. Auto-mode: human-verify auto-approves, decision auto-selects first option, human-action still stops

## Checkpoint Types — Full Reference

### checkpoint:human-verify (90%)

**When:** Agent completed automated work, human confirms it works correctly.

**Use for:** Visual UI checks (layout, styling, responsiveness), interactive flows (click through wizard, test user flows), functional verification (feature works as expected), audio/video playback quality, animation smoothness, accessibility testing.

**Planning structure:**
```xml
<task type="checkpoint:human-verify" gate="blocking">
  <what-built>[What the agent automated]</what-built>
  <how-to-verify>
    [Exact steps to test — URLs, commands, expected behavior]
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>
```

**Critical pattern:** The agent MUST start the dev server (or equivalent) BEFORE the checkpoint. The human should only need to visit a URL, not run commands.

```xml
<!-- Good: agent starts server, then checkpoint -->
<task type="auto">
  <name>Start dev server for verification</name>
  <action>Run npm run dev in background</action>
</task>
<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Dashboard at http://localhost:3000/dashboard</what-built>
</task>

<!-- Bad: asking human to start server -->
<task type="checkpoint:human-verify">
  <how-to-verify>Run npm run dev, then visit localhost:3000</how-to-verify>
</task>
```

### checkpoint:decision (9%)

**When:** Human must make a choice that affects implementation direction.

**Use for:** Technology selection (which auth provider, which database), architecture decisions (monorepo vs separate repos), design choices (color scheme, layout approach), feature prioritization (which variant to build), data model decisions (schema structure).

**Planning structure:**
```xml
<task type="checkpoint:decision" gate="blocking">
  <decision>[What's being decided]</decision>
  <context>[Why this decision matters]</context>
  <options>
    <option id="option-a">
      <name>[Option name]</name>
      <pros>[Benefits]</pros>
      <cons>[Tradeoffs]</cons>
    </option>
  </options>
  <resume-signal>Select: option-a, option-b, or ...</resume-signal>
</task>
```

**Planner tip:** Front-load the recommended option as the first choice. In auto-mode, the first option is auto-selected.

### checkpoint:human-action (1% — Rare)

**When:** Action has NO CLI/API and requires human-only interaction, OR the agent hit an authentication gate during automation.

**Use ONLY for:** Email verification links, SMS 2FA codes, manual account approvals, credit card 3D Secure flows, OAuth app approvals.

**Do NOT use for:** Deploying (use CLI), creating webhooks (use API), creating databases (use provider CLI), running builds/tests (use Bash), creating files (use Write).

**Key distinction:** Auth gates are created dynamically when the agent encounters auth errors. NOT pre-planned — the agent automates first, asks for credentials only when blocked.

## Execution Protocol

When the agent encounters `type="checkpoint:*"`:

1. **Stop immediately** — do not proceed to next task
2. **Display checkpoint clearly** using the return format
3. **Wait for user response** — do not hallucinate completion
4. **Verify if possible** — check files, run tests, whatever is specified
5. **Resume execution** — continue to next task only after confirmation

## Anti-Patterns

**Asking human to automate:**
```xml
<!-- BAD -->
<task type="checkpoint:human-action">
  <action>Deploy to Vercel</action>
  <instructions>Visit vercel.com, import repo, click deploy...</instructions>
</task>
```
Why bad: Vercel has a CLI. The agent should run `vercel --yes`.

**Too many checkpoints:**
```xml
<!-- BAD: verification fatigue -->
<task type="auto">Create schema</task>
<task type="checkpoint:human-verify">Check schema</task>
<task type="auto">Create API</task>
<task type="checkpoint:human-verify">Check API</task>
```
Why bad: Combine into one checkpoint at end.

**Good pattern — single verification:**
```xml
<task type="auto">Create schema</task>
<task type="auto">Create API</task>
<task type="auto">Create UI</task>
<task type="checkpoint:human-verify">
  <what-built>Complete auth flow (schema + API + UI)</what-built>
  <how-to-verify>Test full flow: register, login, access protected page</how-to-verify>
</task>
```

## Continuation After Checkpoint

When spawned as a continuation agent (after a checkpoint was resolved):

1. Verify previous commits exist: `git log --oneline -5`
2. DO NOT redo completed tasks
3. Start from resume point in prompt
4. Handle based on checkpoint type:
   - After human-action: verify it worked, then continue
   - After human-verify: continue to next task
   - After decision: implement selected option
5. If another checkpoint hit: return with ALL completed tasks (previous + new)
