---
name: research-patterns
description: Research methodology for phase and project researchers — RAG tool selection strategy, source verification protocol, confidence assessment, and citation requirements for producing reliable research documents.
type: shared
agents: [phase-researcher, project-researcher]
---

## Purpose

Provides the systematic research methodology shared by both researcher agents. Ensures consistent tool selection (which RAG tool to use when), source verification (how to trust findings), and confidence assessment (how to rate claims). Without this protocol, researchers risk presenting unverified claims as fact or missing authoritative sources.

## Placeholders

| Placeholder | Description | Example |
|---|---|---|

## Content

### Tool Selection Strategy (RAG Tiers)

Research tools are used in priority order. Higher-priority tools produce higher-confidence findings.

| Priority | Tool | Best For | Trust Level |
|---|---|---|---|
| 1st | Context7 | Library APIs, features, configuration, versions | HIGH |
| 2nd | WebFetch | Official docs/READMEs not in Context7, changelogs | HIGH-MEDIUM |
| 3rd | WebSearch / Brave Search | Ecosystem discovery, community patterns, pitfalls | Needs verification |

**Context7 flow:**
1. `resolve-library-id` with library name
2. `query-docs` with resolved ID and specific query

Always resolve first — don't guess library IDs. Use specific queries rather than broad ones.

**WebSearch tips:** Include current year in queries. Use multiple query variations. Cross-verify findings with authoritative sources. Mark WebSearch-only findings as LOW confidence.

**Brave Search** (enhanced): If available, use Brave Search for higher quality results with less SEO spam:
```bash
node $BGSD_HOME/bin/bgsd-tools.cjs util:websearch "your query" --limit 10
```

### Source Verification Protocol

Every WebSearch finding must be verified before stating with confidence:

```
For each finding:
1. Can I verify with Context7?       -> YES: HIGH confidence
2. Can I verify with official docs?   -> YES: MEDIUM confidence
3. Do multiple sources agree?         -> YES: Increase one level
4. None of the above                  -> LOW confidence, flag for validation
```

Never present LOW confidence findings as authoritative. "I couldn't find X" is valuable — it tells us to investigate differently.

### Confidence Levels

| Level | Sources Required | Usage |
|---|---|---|
| HIGH | Context7, official docs, official releases | State as fact |
| MEDIUM | WebSearch verified with official source, multiple credible sources | State with attribution |
| LOW | WebSearch only, single source, unverified | Flag as needing validation |

**Source priority:** Context7 > Official Docs > Official GitHub > Verified WebSearch > Unverified WebSearch

### Research Philosophy

**Training data is hypothesis, not fact.** AI training is 6-18 months stale. Knowledge may be outdated, incomplete, or wrong.

Discipline:
1. **Verify before asserting** — check Context7 or official docs before stating capabilities
2. **Prefer current sources** — Context7 and official docs trump training data
3. **Flag uncertainty** — LOW confidence when only training data supports a claim
4. **Be prescriptive** — "Use X" not "Consider X or Y." Opinionated recommendations.

**Research is investigation, not confirmation.** Don't start with a hypothesis and find supporting evidence. Gather evidence, form conclusions from evidence.

### Common Research Pitfalls

**Configuration scope blindness:** Assuming global config means no project-scoping exists. Prevention: Verify ALL scopes.

**Deprecated features:** Old docs leading to "feature doesn't exist" conclusions. Prevention: Check current docs, changelog, version numbers.

**Negative claims without evidence:** Making "X is not possible" statements without official verification. Prevention: "Didn't find it" does not equal "doesn't exist."

**Single source reliance:** One source for critical claims. Prevention: Require official docs + release notes + additional source.

### Pre-Submission Checklist

- [ ] All domains investigated (stack, patterns, pitfalls)
- [ ] Negative claims verified with official docs
- [ ] Multiple sources cross-referenced for critical claims
- [ ] URLs provided for authoritative sources
- [ ] Publication dates checked (prefer recent/current)
- [ ] Confidence levels assigned honestly
- [ ] "What might I have missed?" review completed

## Cross-references

- <skill:structured-returns section="phase-researcher" /> — Phase researcher return format
- <skill:structured-returns section="project-researcher" /> — Project researcher return format

## Examples

**Good confidence progression:**
```
Claim: "React Server Components require React 18+"
  Source 1: Context7 (/vercel/next.js) — confirmed RSC requires React 18
  Source 2: React official blog — RSC introduced in React 18
  Confidence: HIGH (two primary sources agree)
```

**Proper uncertainty handling:**
```
Claim: "Library X supports feature Y"
  Source 1: Stack Overflow answer (2023)
  Source 2: Context7 — library not found
  Source 3: Official docs — no mention of feature Y
  Confidence: LOW — only community source supports this claim
  Action: Flag for validation, do not state as fact
```
