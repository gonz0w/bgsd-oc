# Agent Overlap Report - Phase 86

**Generated:** 2026-03-10
**Command:** `bgsd-tools verify:verify agents --check-overlap`

---

## Summary

| Metric | Value |
|--------|-------|
| Total Agents | 10 |
| Overlap Pairs Found | 45 |
| Status | **Zero capability conflict** |

---

## Agent Inventory

| Agent | Tools | Capabilities |
|-------|-------|--------------|
| bgsd-codebase-mapper | 5 | 2 |
| bgsd-debugger | 7 | 6 |
| bgsd-executor | 6 | 8 |
| bgsd-github-ci | 6 | 5 |
| bgsd-phase-researcher | 6 | 3 |
| bgsd-plan-checker | 4 | 2 |
| bgsd-planner | 6 | 9 |
| bgsd-project-researcher | 6 | 3 |
| bgsd-roadmapper | 5 | 3 |
| bgsd-verifier | 5 | 4 |

---

## Overlap Analysis

### Common Tools (Expected Overlap)

All agents share basic file operation tools:
- **read** - Required for reading context files
- **bash** - Required for executing commands
- **grep** - Required for searching content
- **glob** - Required for finding files

This is **not a conflict** - these are foundational capabilities required by all agents.

### Common Capabilities (Expected Overlap)

All agents share:
- **project-context** - Required for project-specific conventions
- **structured-returns** - Required for standardized output format

This is **not a conflict** - these are foundational skills required by all agents.

### Primary Responsibility Overlap Check

| Agent Pair | Common Tools | Common Capabilities | Primary Responsibility Overlap |
|------------|-------------|-------------------|------------------------------|
| bgsd-planner ↔ bgsd-executor | read, write, bash, grep, glob | project-context, tdd-execution, structured-returns | **NO** - Planner creates plans, Executor implements |
| bgsd-verifier ↔ bgsd-plan-checker | read, bash, glob, grep | project-context, structured-returns | **NO** - Verifier checks code, Plan-checker validates plans |
| bgsd-phase-researcher ↔ bgsd-project-researcher | read, write, bash, grep, glob, webfetch | project-context, research-patterns, structured-returns | **NO** - Phase researcher does phase research, Project researcher does ecosystem research |

---

## Conclusion

**Zero capability conflict detected.**

The overlap in tools and foundational skills is expected and necessary - all agents need basic file operations and project context. The key insight is:

> **Each agent has a distinct PRIMARY RESPONSIBILITY despite sharing foundational tools/skills.**

- bgsd-planner: Creates executable phase plans
- bgsd-executor: Executes plans with atomic commits
- bgsd-verifier: Verifies goal achievement after execution
- bgsd-plan-checker: Validates plans before execution
- bgsd-debugger: Investigates bugs using scientific method
- bgsd-github-ci: Handles CI/CD pipeline
- bgsd-phase-researcher: Researches phase implementation
- bgsd-project-researcher: Researches ecosystem for roadmap
- bgsd-codebase-mapper: Maps codebase structure
- bgsd-roadmapper: Creates project roadmaps

---

## Verification Command

To re-run validation:
```bash
node bin/bgsd-tools.cjs verify:verify agents --check-overlap
```

---
*Report generated: 2026-03-10*
*Per CONTEXT.md decision: Overlaps reported for manual review - none require action*
