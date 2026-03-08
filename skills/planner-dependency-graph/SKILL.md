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

## Examples

See planner agent's `<dependency_graph>` section for the original comprehensive reference.
