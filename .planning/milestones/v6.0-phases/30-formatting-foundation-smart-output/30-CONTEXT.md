# Phase 30: Formatting Foundation & Smart Output - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a shared formatting engine and TTY-aware output mode that all command renderers depend on. This is the infrastructure layer — visual presentation, output mode switching, and reusable formatting primitives. Individual command renderers are separate phases (32-34).

**Brand rename:** The project is now **bGSD** ("better GSD"), standing for "Get Stuff Done". All references to "get shit done" across the codebase need updating.

</domain>

<decisions>
## Implementation Decisions

### Visual Branding & Style
- **Aesthetic:** Minimal and clean — sparse use of color, thin borders, whitespace. Think Linear/Vercel CLI.
- **Color palette:** Rich palette — multiple colors for different data types, headers, labels, values. Not just semantic.
- **Borders:** Horizontal rules only (━━━ lines to separate sections). No full box-drawing borders.
- **Branding:** Subtle prefix — small 'bGSD' or '▶' prefix on section headers. No big banners (except milestone completion).
- **Brand name:** "bGSD" (better GSD / Get Stuff Done). Update all "get shit done" references across codebase.

### Output Density & Structure
- **Density:** Compact but grouped — minimal blank lines, group related info, clear section breaks.
- **Tables:** Aligned columns with headers — column headers with ─── separator, aligned values (psql-style).
- **Section headers:** Inline label with separator — e.g., '━━ Progress ━━━━━━━━' (label embedded in rule).
- **Summary line:** Always — every command ends with a one-line takeaway.
- **Empty sections:** Omit entirely — if no blockers, don't show a Blockers section.
- **Numbers:** Color-coded — green for good (100%, 0 blockers), yellow for in-progress, red for problems.
- **File paths:** Dimmed/gray — visible but don't dominate output.
- **List truncation:** Truncate at 10 items with '... and N more (use --all to see full list)'.
- **Status markers:** Unicode symbols — ✓ done, ▶ in-progress, ○ pending, ✗ failed.
- **Action hints:** Always show next action at bottom of output.
- **Timestamps:** Relative time — '2h ago', 'yesterday', '3 days ago'.
- **Errors/warnings:** Colored prefix — red 'ERROR:' or yellow 'WARN:' prefix on same line.
- **Dependencies:** Arrow notation inline — 'Phase 31 → Phase 30' with phase listing.
- **Terminal width:** Detect and adapt — responsive layout based on terminal width.
- **Compact flag:** --compact strips chrome in formatted mode (TTY only, not JSON).
- **Indexing:** Show index numbers — numbered lists for reference.
- **Progress bar:** Percentage + bar — '47% [███████░░░]' with color gradient.
- **Long text in tables:** Truncate with ellipsis at column width.
- **Usage/help:** Formatted usage block — pattern, flags, example (like 'git help').

### TTY Detection & Mode Switching
- **Auto-detection:** If stdout is TTY → formatted output; if piped → JSON. Flags --raw (deprecated→removed) and --pretty override.
- **--raw deprecation:** Remove immediately in this milestone. All workflow .md files updated in this phase.
- **JSON mode:** Enriched JSON — includes extra fields agents need (paths, counts) that formatted view might omit.
- **NO_COLOR:** Respect the no-color.org standard — if NO_COLOR is set, strip all ANSI codes.
- **--compact scope:** TTY only — JSON output is always the full enriched payload.
- **Stderr:** Status messages and progress indicators go to stderr; actual data goes to stdout. Allows piping data while seeing progress.
- **Stderr in piped mode:** Always human-readable, even when stdout is JSON.
- **Color depth:** Target true color (24-bit) with graceful degradation — detect capabilities, fall back 256 → 16 → no color.
- **Debug mode:** Both --debug flag AND DEBUG=bgsd env var enable verbose output to stderr.
- **Formatter API:** Internal JS module with functions like table(), header(), bar() that command handlers import.
- **File structure:** Agent's discretion — whether formatter stays in single file or becomes separate module.

### Progress & Status Indicators
- **Progress bar colors:** Gradient by progress — red at 0% → yellow at 50% → green at 100%.
- **Scope:** Show both milestone-level progress AND current phase plan progress (two bars).
- **Pass/fail:** Green ✓ for pass, red ✗ for fail — consistent with status markers.
- **Staleness:** Subtle dim '(stale)' marker — visible but not alarming.
- **Spinners:** Animated spinner with status text for long operations (e.g., '⠋ Analyzing codebase...').
- **Timing:** Show only for slow commands (>1s).
- **Milestone completion:** Celebratory banner — special styled treatment for milestone/phase completion.
- **Remaining counts:** Show both done + remaining — '3/7 phases (4 remaining)'.
- **Velocity/forecast:** Mini visual timeline showing past velocity + projected completion.
- **Diff display:** Colored diff mode — green additions, red removals for state changes.

### Agent's Discretion
- File structure decision: whether formatter stays in gsd-tools.cjs or becomes a separate module
- Exact spinner animation choice (braille, dots, etc.)
- Specific true-color hex values for the palette
- Internal API function signatures and naming

</decisions>

<specifics>
## Specific Ideas

- Brand rename to "bGSD" / "better GSD" / "Get Stuff Done" — check all existing references across codebase
- Section headers should look like: '━━ Progress ━━━━━━━━' (inline label embedded in horizontal rule)
- Progress bars should show: '47% [███████░░░]' with color gradient from red→yellow→green
- Completion banners should feel like an achievement — celebratory but not over the top
- Velocity display as a mini visual timeline, not just text

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 30-formatting-foundation-smart-output*
*Context gathered: 2026-02-26*
