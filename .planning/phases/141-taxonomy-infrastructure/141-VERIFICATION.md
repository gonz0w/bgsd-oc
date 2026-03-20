---
phase: "141"
verified: "2026-03-19"
status: "gaps_found"
score: 86
gaps:
  - id: "TAX-07-incomplete"
    severity: "warning"
    description: "TAX-07 (consequence-framed options) not fully implemented — OPTION_TEMPLATES is empty (only commented examples), no actual templates with outcome trade-off hints"
    requirement: "TAX-07"
    impact: "Option templates lack consequence-framed hints. Infrastructure exists (diversity dimensions tracked) but no populated templates."
    remediation: "Add pre-authored OPTION_TEMPLATES with consequence-framed hints for key question types."
---

# Phase 141 Verification: Taxonomy & Infrastructure

## Goal Achievement

**Goal:** Question taxonomy infrastructure — enum, template library, option generation rules, decision routing

**Status:** `gaps_found` — Infrastructure mostly complete, one warning gap identified.

---

## Goal Achievement — Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | TAXONOMY enum has exactly 7 types: BINARY, SINGLE_CHOICE, MULTI_CHOICE, RANKING, FILTERING, EXPLORATION, CLARIFICATION | ✓ VERIFIED | `questions.js` lines 10-18: confirmed via runtime check |
| 2 | OPTION_RULES enforces MIN 3/MAX 5 options, diversity dimensions, formatting parity, escape hatch | ✓ VERIFIED | `questions.js` lines 23-30: MIN_OPTIONS=3, MAX_OPTIONS=5, DIVERSITY_DIMENSIONS=['certainty','scope','approach','priority'], ESCAPE_HATCH='Something else' |
| 3 | Escape hatch is "Something else" at position last | ✓ VERIFIED | OPTION_RULES.ESCAPE_HATCH='Something else', ESCAPE_HATCH_POSITION='last' |
| 4 | Option templates are data structures only (no function logic) | ✓ VERIFIED | OPTION_TEMPLATES is a plain object at line 37, functions are separate |
| 5 | questionTemplate(id, type, context) is a function exported from prompts.js | ✓ VERIFIED | `prompts.js` line 374 exports questionTemplate |
| 6 | Templates contain only options array (no question text) | ✓ VERIFIED | questionTemplate returns { templateId, options, typeHint, escapeHatch } — question text stays in workflow |
| 7 | Mutual exclusivity signaled via typeHint | ✓ VERIFIED | getTypeHint() returns "Pick one" (SINGLE_CHOICE/BINARY) or "Select all that apply" (MULTI_CHOICE) — `prompts.js` lines 351-359 |
| 8 | Consequence-framed options include trade-off hints | ✗ NOT VERIFIED | OPTION_TEMPLATES is empty (commented examples only). Runtime generation produces generic labels like "Option 1". No consequence-framed hints present. |
| 9 | resolveQuestionType registered in DECISION_REGISTRY with 'question-routing' category | ✓ VERIFIED | `decision-rules.js` lines 649-659, registry entry id='resolve-question-type' |
| 10 | resolveOptionGeneration registered in DECISION_REGISTRY with 'question-routing' category | ✓ VERIFIED | `decision-rules.js` lines 660-669, registry entry id='resolve-option-generation' |
| 11 | Both decision functions return HIGH confidence | ✓ VERIFIED | resolveQuestionType returns confidence:'HIGH', resolveOptionGeneration returns confidence:'HIGH' |
| 12 | Functions follow pure-function contract: (state) => { value, confidence, rule_id } | ✓ VERIFIED | Both functions return expected structure |

---

## Required Artifacts

| Artifact | Path | Status | Level 1 (exists) | Level 2 (substantive) | Level 3 (wired) |
|----------|------|--------|-------------------|------------------------|-----------------|
| questions.js | `src/lib/questions.js` | ✓ VERIFIED | EXISTS | 299 lines, real implementation | Exported and imported by prompts.js and decision-rules.js |
| TAXONOMY enum | `src/lib/questions.js` | ✓ VERIFIED | EXISTS | 7 type definitions | Used in decision-rules.js and prompts.js |
| OPTION_RULES | `src/lib/questions.js` | ✓ VERIFIED | EXISTS | All required fields present | Referenced by prompts.js |
| OPTION_TEMPLATES | `src/lib/questions.js` | ⚠️ THIN | EXISTS | Empty object (only commented examples) | Referenced by decision-rules.js for lookup |
| getQuestionTemplate() | `src/lib/questions.js` | ✓ VERIFIED | EXISTS | 25 lines, tone support, fallback to null | Called by prompts.js questionTemplate() |
| generateRuntimeOptions() | `src/lib/questions.js` | ✓ VERIFIED | EXISTS | 50 lines, diversity constraints | Called by prompts.js questionTemplate() fallback |
| prompts.js questionTemplate() | `src/lib/prompts.js` | ✓ VERIFIED | EXISTS | 22 lines, graceful fallback | Exported and used by workflows |
| getTypeHint() | `src/lib/prompts.js` | ✓ VERIFIED | EXISTS | 9 lines, correct type mapping | Used by questionTemplate() |
| decision-rules.js | `src/lib/decision-rules.js` | ✓ VERIFIED | EXISTS | 878 lines, full implementation | Imported by bin/bgsd-tools.cjs |
| resolveQuestionType | `src/lib/decision-rules.js` | ✓ VERIFIED | EXISTS | 32 lines, questionTypeMap + fallback | Registered in DECISION_REGISTRY |
| resolveOptionGeneration | `src/lib/decision-rules.js` | ✓ VERIFIED | EXISTS | 18 lines, template lookup + runtime fallback | Registered in DECISION_REGISTRY |

---

## Key Link Verification

| Link | Source | Target | Status | Evidence |
|------|--------|--------|--------|----------|
| TAXONOMY export | questions.js | prompts.js | ✓ WIRED | `prompts.js` line 13: `const { ..., TAXONOMY } = require('./questions')` |
| TAXONOMY export | questions.js | decision-rules.js | ✓ WIRED | `decision-rules.js` line 696: `const { TAXONOMY, OPTION_TEMPLATES } = require('./questions')` |
| OPTION_RULES export | questions.js | prompts.js | ✓ WIRED | `prompts.js` line 13 imports OPTION_RULES |
| getQuestionTemplate call | prompts.js | questions.js | ✓ WIRED | `prompts.js` line 324: `getQuestionTemplate(id, context)` |
| generateRuntimeOptions call | prompts.js | questions.js | ✓ WIRED | `prompts.js` line 337: `generateRuntimeOptions(type, context)` |
| DECISION_REGISTRY entry | resolveQuestionType | DECISION_REGISTRY | ✓ WIRED | `decision-rules.js` lines 649-659 |
| DECISION_REGISTRY entry | resolveOptionGeneration | DECISION_REGISTRY | ✓ WIRED | `decision-rules.js` lines 660-669 |
| questionTemplate export | prompts.js | module.exports | ✓ WIRED | `prompts.js` line 374 |

---

## Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| TAX-01: TAXONOMY enum with 7 types | ✓ VERIFIED | questions.js lines 10-18 |
| TAX-02: questionTemplate(id, type, context) centralizes templates | ✓ VERIFIED | prompts.js lines 323-344 |
| TAX-03: Option generation rules (MIN 3, MAX 5, diversity, escape hatch) | ✓ VERIFIED | OPTION_RULES lines 23-30 |
| TAX-04: resolveQuestionType in DECISION_REGISTRY | ✓ VERIFIED | decision-rules.js lines 649-659, 704-735 |
| TAX-05: resolveOptionGeneration in DECISION_REGISTRY | ✓ VERIFIED | decision-rules.js lines 660-669, 743-761 |
| TAX-06: Mutual exclusivity signaling ("Pick one" / "Select all that apply") | ✓ VERIFIED | getTypeHint() lines 351-359 |
| TAX-07: Consequence-framed option hints | ✗ NOT VERIFIED | OPTION_TEMPLATES is empty (only commented examples); no actual templates with trade-off hints |

---

## Anti-Patterns Found

| Category | Severity | Location | Description |
|----------|----------|----------|-------------|
| Empty template registry | ℹ️ Info | questions.js line 37 | OPTION_TEMPLATES is an empty object with commented examples only. Not an error — templates can be added later. |

**No critical or blocking anti-patterns detected.**

---

## Human Verification Required

| Item | Reason | Status |
|------|--------|--------|
| typeHint display in actual prompts | Visual appearance of "Pick one" vs "Select all that apply" in CLI prompts | Needs human check when workflows use questionTemplate() |

**Automated verification complete. Human check needed for visual appearance of type hints in actual prompt output.**

---

## Gap Summary

### Warning: TAX-07 (Consequence-framed options)

**What:** Option templates do not include outcome trade-off hints (consequence-framed options).

**Current state:**
- OPTION_TEMPLATES registry is empty (only commented structural examples)
- Runtime option generation produces generic labels like "Option 1", "Rank 1", "filter-0"
- No consequence-framed hints such as "This will speed up delivery but reduce robustness" or "Choose this if you want to minimize risk"

**Why this is a warning (not blocker):**
- TAX-07 is a "should" requirement (MEDIUM priority), not a "must"
- The infrastructure exists: diversity dimension tracking via `diversity: { certainty, scope, approach, priority }`
- The pattern is established: commented examples show the intended structure
- Future phases (142-143) handle workflow migration and can populate templates

**Remediation:**
- Add pre-authored OPTION_TEMPLATES with consequence-framed labels for key question types
- Example structure (from commented code):
  ```javascript
  'goal-clarity': {
    question: 'What level of goal clarity do you need?',
    options: [
      { id: 'fuzzy', label: 'Fuzzy — direction only', diversity: { certainty: 0.2 } },
      { id: 'medium', label: 'Medium — target without deadline', diversity: { certainty: 0.5 } },
      { id: 'precise', label: 'Precise — target with deadline', diversity: { certainty: 0.8 } }
    ]
  }
  ```
- Consequence-framed version would add hint text like "Fuzzy: fast to start, harder to measure success"

---

## Verification Commands Run

```bash
# questions.js structure
node -e "const q = require('./src/lib/questions.js'); ..."

# prompts.js questionTemplate
node -e "const p = require('./src/lib/prompts.js'); ..."

# decision-rules.js functions
node -e "const dr = require('./src/lib/decision-rules.js'); ..."

# typeHint signaling
node -e "const p = require('./src/lib/prompts.js'); 
  console.log('BINARY:', p.questionTemplate('test','BINARY',{}).typeHint);
  console.log('SINGLE_CHOICE:', p.questionTemplate('test','SINGLE_CHOICE',{}).typeHint);
  console.log('MULTI_CHOICE:', p.questionTemplate('test','MULTI_CHOICE',{}).typeHint);"
```

---

## Final Verdict

**Phase 141 status: gaps_found**

The taxonomy infrastructure is substantially complete with all must-have requirements verified:

- ✓ TAX-01 through TAX-06: fully implemented and verified
- ⚠️ TAX-07: infrastructure present, templates not populated (warning gap)

**Next steps:** Consider adding pre-authored OPTION_TEMPLATES with consequence-framed hints in a future maintenance pass, or as part of Phase 142+ workflow migration work.
