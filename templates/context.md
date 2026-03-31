# Phase Context Template

Template for `.planning/phases/XX-name/{phase_num}-CONTEXT.md` - captures implementation decisions for a phase.

**Purpose:** Document decisions that downstream agents need. Researcher uses this to know WHAT to investigate. Planner uses this to know WHAT choices are locked vs flexible.

**Key principle:** Categories are NOT predefined. They emerge from what was actually discussed for THIS phase. A CLI phase has CLI-relevant sections, a UI phase has UI-relevant sections.

**Downstream consumers:**
- `bgsd-phase-researcher` — Reads decisions to focus research (e.g., "card layout" → research card component patterns)
- `bgsd-planner` — Reads decisions to create specific tasks (e.g., "infinite scroll" → task includes virtualization)

---

## File Template

```markdown
# Phase [X]: [Name] - Context

**Gathered:** [date]
**Status:** Ready for planning

<phase_intent>
## Phase Intent

- **Local Purpose:** [One concise statement of the phase-local purpose. Keep it local to this phase.]
- **Expected User Change:** [Observable before/after claim in plain language. Include 1-3 concrete examples that make the change testable or reviewable.]
- **Non-Goals:**
  - [Concrete out-of-scope example 1]
  - [Concrete out-of-scope example 2]
  - [Optional concrete out-of-scope example 3]

</phase_intent>

<domain>
## Phase Boundary

[Clear statement of what this phase delivers — the scope anchor. This comes from ROADMAP.md and is fixed. Discussion clarifies implementation within this boundary.]

</domain>

<decisions>
## Implementation Decisions

### [Area 1 that was discussed]
- [Specific decision made]
- [Another decision if applicable]

### [Area 2 that was discussed]
- [Specific decision made]

### [Area 3 that was discussed]
- [Specific decision made]

### Agent's Discretion
[Areas where user explicitly said "you decide" — the agent has flexibility here during planning/implementation]

</decisions>

<specifics>
## Specific Ideas

[Any particular references, examples, or "I want it like X" moments from discussion. Product references, specific behaviors, interaction patterns.]

[If none: "No specific requirements — open to standard approaches"]

</specifics>

<deferred>
## Deferred Ideas

[Ideas that came up during discussion but belong in other phases. Captured here so they're not lost, but explicitly out of scope for this phase.]

[If none: "None — discussion stayed within phase scope"]

</deferred>

---

*Phase: XX-name*
*Context gathered: [date]*
```

<good_examples>

**Example 1: Visual feature (Post Feed)**

```markdown
# Phase 3: Post Feed - Context

**Gathered:** 2025-01-20
**Status:** Ready for planning

<phase_intent>
## Phase Intent

- **Local Purpose:** Make the feed immediately useful as a reading surface for followed content.
- **Expected User Change:** Before: users had no single place to read recent posts from followed people. After: users can open one feed and quickly scan recent posts with clear metadata.
  - Users can see author, timestamp, post body, and engagement counts in one scrollable view
  - Users can understand when new posts arrived without losing their current reading position
- **Non-Goals:**
  - Creating a new post from this surface
  - Commenting, bookmarking, or reacting from the feed

</phase_intent>

<domain>
## Phase Boundary

Display posts from followed users in a scrollable feed. Users can view posts and see engagement counts. Creating posts and interactions are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Layout style
- Card-based layout, not timeline or list
- Each card shows: author avatar, name, timestamp, full post content, reaction counts
- Cards have subtle shadows, rounded corners — modern feel

### Loading behavior
- Infinite scroll, not pagination
- Pull-to-refresh on mobile
- New posts indicator at top ("3 new posts") rather than auto-inserting

### Empty state
- Friendly illustration + "Follow people to see posts here"
- Suggest 3-5 accounts to follow based on interests

### Agent's Discretion
- Loading skeleton design
- Exact spacing and typography
- Error state handling

</decisions>

<specifics>
## Specific Ideas

- "I like how Twitter shows the new posts indicator without disrupting your scroll position"
- Cards should feel like Linear's issue cards — clean, not cluttered

</specifics>

<deferred>
## Deferred Ideas

- Commenting on posts — Phase 5
- Bookmarking posts — add to backlog

</deferred>

---

*Phase: 03-post-feed*
*Context gathered: 2025-01-20*
```

**Example 2: CLI tool (Database backup)**

```markdown
# Phase 2: Backup Command - Context

**Gathered:** 2025-01-20
**Status:** Ready for planning

<phase_intent>
## Phase Intent

- **Local Purpose:** Give operators one reliable command to create backups without needing manual multi-step scripts.
- **Expected User Change:** Before: operators had to assemble backup steps manually and guess the right invocation. After: operators can run one documented backup command and understand where the backup went.
  - Operators can choose local file or S3 output from the command surface
  - Operators can tell whether the run succeeded, failed, or retried from the command output
- **Non-Goals:**
  - Restore workflows
  - Scheduled backup orchestration
  - Long-term retention policy management

</phase_intent>

<domain>
## Phase Boundary

CLI command to backup database to local file or S3. Supports full and incremental backups. Restore command is a separate phase.

</domain>

<decisions>
## Implementation Decisions

### Output format
- JSON for programmatic use, table format for humans
- Default to table, --json flag for JSON
- Verbose mode (-v) shows progress, silent by default

### Flag design
- Short flags for common options: -o (output), -v (verbose), -f (force)
- Long flags for clarity: --incremental, --compress, --encrypt
- Required: database connection string (positional or --db)

### Error recovery
- Retry 3 times on network failure, then fail with clear message
- --no-retry flag to fail fast
- Partial backups are deleted on failure (no corrupt files)

### Agent's Discretion
- Exact progress bar implementation
- Compression algorithm choice
- Temp file handling

</decisions>

<specifics>
## Specific Ideas

- "I want it to feel like pg_dump — familiar to database people"
- Should work in CI pipelines (exit codes, no interactive prompts)

</specifics>

<deferred>
## Deferred Ideas

- Scheduled backups — separate phase
- Backup rotation/retention — add to backlog

</deferred>

---

*Phase: 02-backup-command*
*Context gathered: 2025-01-20*
```

**Example 3: Organization task (Photo library)**

```markdown
# Phase 1: Photo Organization - Context

**Gathered:** 2025-01-20
**Status:** Ready for planning

<phase_intent>
## Phase Intent

- **Local Purpose:** Turn an unstructured photo dump into a browseable library with predictable grouping and naming.
- **Expected User Change:** Before: users had to hunt through inconsistent folders and duplicate files. After: users can browse photos by time-based folders and understand how duplicates were handled.
  - Users can locate photos by year and month without scanning every folder
  - Users can review duplicate decisions without losing source files
- **Non-Goals:**
  - Face recognition or people clustering
  - Full-text or semantic search
  - Cloud sync behavior

</phase_intent>

<domain>
## Phase Boundary

Organize existing photo library into structured folders. Handle duplicates and apply consistent naming. Tagging and search are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Grouping criteria
- Primary grouping by year, then by month
- Events detected by time clustering (photos within 2 hours = same event)
- Event folders named by date + location if available

### Duplicate handling
- Keep highest resolution version
- Move duplicates to _duplicates folder (don't delete)
- Log all duplicate decisions for review

### Naming convention
- Format: YYYY-MM-DD_HH-MM-SS_originalname.ext
- Preserve original filename as suffix for searchability
- Handle name collisions with incrementing suffix

### Agent's Discretion
- Exact clustering algorithm
- How to handle photos with no EXIF data
- Folder emoji usage

</decisions>

<specifics>
## Specific Ideas

- "I want to be able to find photos by roughly when they were taken"
- Don't delete anything — worst case, move to a review folder

</specifics>

<deferred>
## Deferred Ideas

- Face detection grouping — future phase
- Cloud sync — out of scope for now

</deferred>

---

*Phase: 01-photo-organization*
*Context gathered: 2025-01-20*
```

</good_examples>

<guidelines>
**This template captures DECISIONS for downstream agents.**

Every fresh phase context should also carry one lightweight `Phase Intent` block inside `CONTEXT.md` with exactly these fields:
- `Local Purpose`
- `Expected User Change`
- `Non-Goals`

Rules for that block:
- Keep it embedded in `CONTEXT.md` — do not create a separate top-level phase intent file.
- `Expected User Change` must be an observable before/after-style claim, not generic discussion prose.
- `Expected User Change` should include 1-3 concrete examples so downstream verification can prove or disprove it.
- `Non-Goals` should include 1-3 concrete examples of adjacent work the phase is explicitly not solving.

The output should answer: "What does the researcher need to investigate? What choices are locked for the planner?"

**Good content (concrete decisions):**
- "Card-based layout, not timeline"
- "Retry 3 times on network failure, then fail"
- "Group by year, then by month"
- "JSON for programmatic use, table for humans"

**Bad content (too vague):**
- "Should feel modern and clean"
- "Good user experience"
- "Fast and responsive"
- "Easy to use"

**After creation:**
- File lives in phase directory: `.planning/phases/XX-name/{phase_num}-CONTEXT.md`
- `bgsd-phase-researcher` uses decisions to focus investigation
- `bgsd-planner` uses decisions + research to create executable tasks
- Downstream agents should NOT need to ask the user again about captured decisions
</guidelines>
