<ui_patterns>

Visual patterns for user-facing bGSD output. Orchestrators @-reference this file.

All renderers use `format.js` primitives — never inline ANSI codes directly.

## Stage Banners

Use `banner(title)` from format.js. Renders as:

```
bGSD ▶ {TITLE}
────────────────────────────────────────────────────────────
```

Completion variant (`banner(title, { completion: true })`):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ {TITLE}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Stage names (uppercase):**
- `QUESTIONING`
- `RESEARCHING`
- `DEFINING REQUIREMENTS`
- `CREATING ROADMAP`
- `PLANNING PHASE {N}`
- `EXECUTING WAVE {N}`
- `VERIFYING`
- `PHASE {N} COMPLETE ✓`
- `MILESTONE COMPLETE 🎉`

---

## Checkpoint Boxes

Use `box(content, type)` from format.js. Types: `info`, `warning`, `error`, `success`.

```
──────────────────────────────────────────────────────────────
ERROR: {description}
──────────────────────────────────────────────────────────────
```

For checkpoint prompts, append action hint:

```
→ Type "approved" or describe issues
```

**Types:**
- `CHECKPOINT: Verification Required` → `→ Type "approved" or describe issues`
- `CHECKPOINT: Decision Required` → `→ Select: option-a / option-b`
- `CHECKPOINT: Action Required` → `→ Type "done" when complete`

---

## Status Symbols

Use `SYMBOLS` from format.js. Never hardcode Unicode:

```
✓  Complete / Passed / Verified    SYMBOLS.check
✗  Failed / Missing / Blocked      SYMBOLS.cross
▶  In Progress                     SYMBOLS.progress
○  Pending                         SYMBOLS.pending
⚠  Warning                        SYMBOLS.warning
→  Action hint / next step         SYMBOLS.arrow
•  Bullet item                     SYMBOLS.bullet
─  Horizontal rule                 SYMBOLS.dash
━  Heavy horizontal rule           SYMBOLS.heavyDash
```

Special (direct, not in SYMBOLS):
- `⚡` Auto-approved
- `🎉` Milestone complete (banner only)

---

## Progress Display

Use `progressBar(percent, width)` from format.js:

```
 47% [███████████░░░░░░░░░]
```

Task/plan counts inline — no separate lines:

```
Tasks: 2/4 complete    Plans: 3/5 complete
```

---

## Tables

Use `formatTable(headers, rows, options)` from format.js.

**PSql-style** — header + separator, no borders by default:

```
 Phase  Status  Plans  Progress
 ──────────────────────────────
 1      ✓       3/3    100%
 2      ▶       1/4     25%
 3      ○       0/2      0%
```

**Column alignment:** left for text, right for numbers.
**Truncation:** long values get `…` via `truncate()`.
**Row limit:** 10 rows default, `--all` for full list. Overflow shows `... and N more (use --all to see full list)`.

---

## Summary & Action Lines

Every command ends with:
1. `summaryLine(text)` — dim rule + bold takeaway
2. `actionHint(text)` — dim `→ next step`

One action hint per command. No more.

---

## Command Output Examples

### `init progress`

```
bGSD ▶ PROGRESS
────────────────────────────────────────────────────────────
 v6.0 UX & Developer Experience
  47% [███████████░░░░░░░░░]

 Phase  Goal                           Plans  Status
 ──────────────────────────────────────────────────────────
 30     Formatting Foundation           2/2    ✓ Complete
 31     Quality Gates & Format Testing  2/2    ✓ Complete
 32     Init & State Command Renderers  0/1    ○ Not started
 33     Verify & Codebase Renderers     0/1    ○ Not started
 34     Feature & Intent Renderers      0/1    ○ Not started
 35     Workflow Output Tightening      0/2    ○ Not started
 36     Integration & Polish            0/2    ○ Not started
────────────────────────────────────────────────────────────
3/7 phases complete — next: Phase 32
→ /bgsd-execute-phase 32
```

### `verify quality`

```
bGSD ▶ QUALITY
────────────────────────────────────────────────────────────
 Dimension     Score  Grade  Details
 ──────────────────────────────────────────────────────────
 Tests          100%  A      24/24 passing
 Must-haves      88%  B      7/8 truths verified
 Requirements    75%  C      6/8 requirements met
 Regression     100%  A      No regressions detected
────────────────────────────────────────────────────────────
Overall: B (91%) — 1 must-have unverified
→ Fix must-have in 31-01: rawValue edge case
```

**Pattern:** banner → content → summary line → action hint. Every command, same structure.

---

## Information Density Guidelines

- One line per data point — no blank lines between data rows
- Status symbols inline with data, not on separate lines
- Action hints at bottom only, one per command
- No "Starting...", "Processing...", "Done." noise — go straight to results
- Combine related data on one line when natural: `Tasks: 2/4  Files: 8  Duration: 3m`
- Tables over bullet lists when ≥3 items with consistent columns
- Dim secondary info (`color.dim()`), bold primary takeaway (`color.bold()`)

---

## Spawning Indicators

```
▶ Spawning researcher...

▶ Spawning 4 researchers in parallel...
  → Stack research
  → Features research
  → Architecture research
  → Pitfalls research

✓ Researcher complete: STACK.md written
```

---

## Next Up Block

Always at end of major completions.

```
────────────────────────────────────────────────────────────

## ▶ Next Up

**{Identifier}: {Name}** — {one-line description}

`{copy-paste command}`

<sub>`/clear` first → fresh context window</sub>

────────────────────────────────────────────────────────────

**Also available:**
- `/bgsd-alternative-1` — description
- `/bgsd-alternative-2` — description

────────────────────────────────────────────────────────────
```

---

## Anti-Patterns

- Varying box/banner widths
- Mixing banner styles (`===`, `---`, `***`)
- Skipping `bGSD ▶` prefix in banners
- Random emoji (`🚀`, `✨`, `💫`)
- Missing Next Up block after completions
- Using inline ANSI codes instead of format.js `color` utility
- Multiple action hints per command
- Verbose status messages ("Starting analysis...", "Processing files...", "Analysis complete.")
- Hardcoding Unicode symbols instead of using `SYMBOLS` constants

</ui_patterns>
