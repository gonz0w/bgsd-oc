# PITFALLS — v10.0 Agent Intelligence & UX

**Question:** What pitfalls should be avoided when adding agent intelligence and UX improvements to bGSD?

---

## Risk Register

| ID | Pitfall | Impact | Prevention |
|----|---------|--------|------------|
| AGNT-01 | Task decomposition produces flat list without dependencies | Plans fail due to ordering issues | Build dependency detection into decomposition |
| AGNT-02 | Planner produces tasks too large for execution | Tasks time out, context blows up | Enforce 15-60 min sizing heuristic |
| AGNT-03 | Verification catches false positives | Wasted investigation time | Tune regression detection, allow overrides |
| AGNT-04 | Executor recovery makes wrong decisions | Worse outcomes than failing fast | Human checkpoint for major decisions |
| AGNT-05 | Multi-agent handoff loses context | Agents work with incomplete info | Structured context transfer protocol |
| UX-01 | Rich formatting breaks in CI/non-TTY | Log parsing fails | Always have plain fallback |
| UX-02 | Interactive prompts hang in non-TTY | Workflows block | Detect TTY, use non-interactive fallback |
| UX-03 | Error messages too generic | Users can't debug issues | Include context: file, line, suggestion |
| UX-04 | New dependencies bloat bundle | Slower startup | Use inline utilities, lazy load |

---

## Critical Pitfalls

### 1) Task decomposition without dependencies (AGNT-01)
- **What goes wrong:** Tasks execute in wrong order, dependencies missing
- **Controls:** Build dependency graph into decomposition phase
- **Detection:** Verify dependency edges before execution

### 2) Non-interactive hang (UX-02)
- **What goes wrong:** inquirer prompts hang when stdin not TTY
- **Controls:** Check `process.stdin.isTTY` before using interactive mode
- **Detection:** Test all interactive workflows with CI/non-TTY

### 3) Bundle bloat (UX-04)
- **What goes wrong:** New dependencies increase bundle size
- **Controls:** Prefer inline utilities, lazy loading
- **Detection:** Track bundle size delta per PR

---

## Phase Warning Mapping

| Pitfall | Phase | Detection |
|---------|-------|-----------|
| Task dependencies | Planning Intelligence | Manual review |
| Task sizing | Planning Intelligence | Test execution |
| Regression false positives | Verification Intelligence | User feedback |
| Recovery decisions | Execution Intelligence | Checkpoint review |
| Handoff context | Multi-Agent | Integration tests |
| TTY formatting | Rich Output | CI run |
| Interactive prompts | Interactive Workflows | Non-TTY test |
| Error context | Error Handling | User feedback |
| Bundle size | All | Build check |

---

## Source Notes

- Task decomposition: https://ronniehuss.co.uk/building-ai-multiplied-teams-plan-and-execute-agents/
- Planner-Worker pattern: https://atoms.dev/insights/the-planner-executor-agent-pattern/
- inquirer TTY: https://www.npmjs.com/package/inquirer

---

*Pitfall research for: v10.0 Agent Intelligence & UX*
*Researched: 2026-03-10*
