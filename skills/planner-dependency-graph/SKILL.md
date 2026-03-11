---
name: planner-dependency-graph
description: Dependency graph construction for planners — recording needs/creates per task, wave analysis, vertical slices vs horizontal layers, and file ownership rules for parallel execution.
type: agent-specific
agents: [planner]
sections: [building-graph, vertical-vs-horizontal, file-ownership]
---

## Purpose

Teaches the planner how to analyze task dependencies, assign execution waves for maximum parallelism, and structure plans as vertical slices rather than horizontal layers. The dependency graph determines which plans can run simultaneously and which must be sequential.

## Placeholders

| Placeholder | Description | Example |
|-------------|-------------|---------|
| (none) | This skill uses no placeholders | — |

## Content

<!-- section: building-graph -->
### Building the Dependency Graph

**For each task, record:**
- `needs`: What must exist before this runs
- `creates`: What this produces
- `has_checkpoint`: Requires user interaction?

**Example with 6 tasks:**

```
Task A (User model):    needs nothing,      creates src/models/user.ts
Task B (Product model): needs nothing,      creates src/models/product.ts
Task C (User API):      needs Task A,       creates src/api/users.ts
Task D (Product API):   needs Task B,       creates src/api/products.ts
Task E (Dashboard):     needs Task C + D,   creates src/components/Dashboard.tsx
Task F (Verify UI):     checkpoint,         needs Task E

Graph:
  A --> C --\
              --> E --> F
  B --> D --/

Wave analysis:
  Wave 1: A, B (independent roots)
  Wave 2: C, D (depend only on Wave 1)
  Wave 3: E (depends on Wave 2)
  Wave 4: F (checkpoint, depends on Wave 3)
```
<!-- /section -->

<!-- section: vertical-vs-horizontal -->
### Vertical Slices vs Horizontal Layers

**Vertical slices (PREFER):**
```
Plan 01: User feature (model + API + UI)
Plan 02: Product feature (model + API + UI)
Plan 03: Order feature (model + API + UI)
```
Result: All three run parallel (Wave 1).

**Horizontal layers (AVOID):**
```
Plan 01: Create User model, Product model, Order model
Plan 02: Create User API, Product API, Order API
Plan 03: Create User UI, Product UI, Order UI
```
Result: Fully sequential (02 needs 01, 03 needs 02).

**When vertical slices work:** Features are independent, self-contained, no cross-feature dependencies.

**When horizontal layers necessary:** Shared foundation required (auth before protected features), genuine type dependencies, infrastructure setup.
<!-- /section -->

<!-- section: file-ownership -->
### File Ownership for Parallel Execution

Exclusive file ownership prevents conflicts:

```yaml
# Plan 01 frontmatter
files_modified: [src/models/user.ts, src/api/users.ts]

# Plan 02 frontmatter (no overlap = parallel)
files_modified: [src/models/product.ts, src/api/products.ts]
```

No overlap → can run parallel. File in multiple plans → later plan depends on earlier.
<!-- /section -->

## Cross-references

- <skill:planner-scope-estimation /> — Context budget influences plan grouping

<!-- section: dependency_detection -->
### Dependency Detection Patterns

**Two complementary approaches:**

**1. File-level detection** (authoritative):
- Track which files each plan reads vs writes
- If Plan A writes `src/models/user.ts` and Plan B reads it → dependency A→B
- Confidence: 100% (observable fact)

**2. Pattern-based detection** (heuristic):
- Tests depend on source files: `tests/*.test.js` depends on `src/*.js`
- Configs depend on schemas: `config.json` depends on `schema.json`
- UI depends on models: `src/components/*.tsx` depends on `src/models/*.ts`
- Confidence: Lower, requires human review

**Confidence weighting rules:**
- File-level detection takes precedence over pattern-based
- When both conflict, prefer file-level
- Document confidence score in dependency suggestions
<!-- /section -->

<!-- section: automatic_detection -->
### Automatic Detection CLI

Use the CLI tool for automated dependency analysis:

```bash
bgsd-tools util:analyze-deps <phase-dir>
```

**Output includes:**
- Phase identifier
- Array of dependency suggestions with:
  - `from`: Source plan number
  - `to`: Dependent plan number  
  - `file`: File causing dependency
  - `confidence`: 0-100 score
  - `reason`: Human-readable explanation

**Example output:**
```json
{
  "phase": "92",
  "suggestions": [
    {
      "from": "01",
      "to": "02",
      "file": "src/models/user.ts",
      "confidence": 100,
      "reason": "Plan 01 writes, Plan 02 reads"
    }
  ]
}
```

Run during planning to validate dependency assumptions before execution.
<!-- /section -->

<!-- section: wave_computation -->
### Wave Computation Rules

Waves group independent tasks for parallel execution:

**Wave assignment algorithm:**
1. **Wave 1:** Tasks with no dependencies (no `depends_on`, no file overlaps)
2. **Wave N+1:** Tasks that depend on any task in Wave N
3. **Special handling:** Checkpoint tasks always get their own wave (wait for all prior)

**Rules:**
- Task depends on Wave N → assigned to Wave N+1 minimum
- Multiple dependencies → highest Wave N determines placement
- Checkpoint tasks → final wave after all dependencies resolve
- Circular dependency detection → error, must resolve manually

**CLI for wave validation:**
```bash
bgsd-tools verify:plan-wave <phase-dir>
```

Shows wave assignments and any file conflicts within waves.
<!-- /section -->

## Examples

See planner agent's `<dependency_graph>` section for the original comprehensive reference.
