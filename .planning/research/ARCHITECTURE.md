# Architecture Research — v11.0 Natural Interface & Insights

**Research mode:** Ecosystem -> Architecture Integration  
**Scope:** How natural language parsing and visualization integrate with existing bGSD CLI architecture  
**Question:** How do natural language parsing and visualization integrate with existing bGSD architecture? What new modules/components are needed? What's the build/deploy impact?  
**Date:** 2026-03-11  
**Overall confidence:** HIGH

---

## Executive Recommendation

Adopt a **pattern-first intent parser + ASCII visualization layer** that extends existing infrastructure (format.js, state.js, router) without adding external dependencies.

**Key insight:** The single-file constraint and zero-dependency philosophy mean:
- Pattern matching over ML/NLP libraries
- Inline ASCII rendering over visualization libraries  
- Command mapping to existing CLI (not parallel command set)

---

## Integration Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLI Input Layer                               │
│  ┌─────────────────┐    ┌─────────────────────────────────┐    │
│  │ Standard Args   │    │  Natural Language Input        │    │
│  │ (existing)      │    │  (NEW: nlp.js parser)         │    │
│  └────────┬────────┘    └───────────────┬─────────────────┘    │
│           │                              │                      │
│           └──────────────┬───────────────┘                      │
│                          ↓                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Command Router (existing)                    │   │
│  │         + Natural Language Routing (NEW)                 │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           ↓                                      │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────┐    │
│  │ Format Output  │  │  Visualization │  │  Analytics      │    │
│  │ (format.js)    │  │  (viz.js NEW) │  │  (metrics.js)  │    │
│  └────────────────┘  └────────────────┘  └─────────────────┘    │
│           │                  │                    │              │
│           └──────────────────┼────────────────────┘              │
│                              ↓                                   │
│                      [stdout JSON/TTY]
└─────────────────────────────────────────────────────────────────┘
```

---

## New Modules Required

### Module Breakdown

| File | Type | Purpose | Estimated Size |
|------|------|---------|----------------|
| `src/lib/nlp.js` | NEW | Intent recognition, entity extraction, command mapping | ~5KB |
| `src/lib/viz.js` | NEW | ASCII charts, sparklines, dashboards | ~8KB |
| `src/lib/metrics.js` | NEW | Velocity, burndown, completion computation | ~4KB |
| `src/commands/natural.js` | NEW | `bgsd:natural` command handler | ~3KB |
| `src/commands/insights.js` | NEW | `bgsd:insights` analytics commands | ~4KB |
| `src/router.js` | MODIFIED | Add new command routes | ~1KB |

---

## Integration Points

### With Existing Modules

| Module | Integration | Approach |
|--------|-------------|----------|
| `format.js` | viz.js uses progressBar, color, table | Extend, don't replace |
| `src/lib/state.js` | metrics.js reads phase/milestone data | Compute from STATE.md |
| `src/lib/roadmap.js` | metrics.js computes burndown | Analyze roadmap phases |
| `src/router.js` | natural.js routes to existing commands | Command mapping table |
| `src/commands/` | natural.js delegates to | Execute via router |

### Data Flow

```
[User Input: "show my progress"]
    │
    ▼
[nlp.parseIntent("show my progress")]
    │ → Intent: "show-progress", confidence: 0.85
    │ → Entities: { user: "my" }
    │
    ▼
[nlp.extractCommand(intent, entities)]
    │ → { command: "session:progress", params: {} }
    │
    ▼
[Execute session:progress] → [format.js] → [stdout]
```

---

## Architectural Patterns

### Pattern 1: Pattern-First Intent Parsing

**What:** Deterministic intent recognition using regex patterns and keyword matching.

**When to use:** CLI commands with bounded vocabulary, structured planning domain.

**Trade-offs:**
- ✅ Zero dependencies, fast, deterministic, works offline
- ❌ Limited vocabulary, pattern maintenance burden

```javascript
// src/lib/nlp.js
const INTENT_PATTERNS = {
  'create-phase': /create|add|new\s+phase/i,
  'show-progress': /progress|status|how\s+(much|far)/i,
  'plan-task': /plan|task|add\s+todo/i,
  'velocity': /velocity|speed|how\s+fast/i,
  'burndown': /burndown|remaining|forecast/i,
};

function parseIntent(input) {
  const scores = [];
  for (const [intent, pattern] of Object.entries(INTENT_PATTERNS)) {
    const match = input.match(pattern);
    if (match) {
      scores.push({ intent, confidence: match[0].length / input.length });
    }
  }
  return scores.sort((a, b) => b.confidence - a.confidence)[0] || null;
}

function extractEntities(input) {
  // Extract phase numbers: "phase 3", "phase 2.1"
  const phaseMatch = input.match(/phase\s+(\d+\.?\d*)/i);
  // Extract dates: "this week", "last month"  
  const dateMatch = input.match(/(this|last|past)\s+(week|month|day)/i);
  return { phase: phaseMatch?.[1], dateRange: dateMatch?.[0] };
}
```

### Pattern 2: ASCII Visualization

**What:** Render charts using Unicode box-drawing characters, graceful degradation.

**When to use:** Terminal-based tools needing visual data representation.

**Trade-offs:**
- ✅ Zero dependencies, works everywhere
- ❌ Limited visual fidelity

```javascript
// src/lib/viz.js
function renderSparkline(data, width = 20) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const chars = ' ▁▂▃▄▅▆▇█';
  
  return data.map(v => {
    const idx = Math.floor(((v - min) / range) * (chars.length - 1));
    return chars[idx];
  }).join('');
}

function renderBarChart(data, options = {}) {
  const { width = 40, colorFn = (v) => '' } = options;
  const max = Math.max(...Object.values(data));
  
  return Object.entries(data).map(([label, value]) => {
    const barLen = Math.round((value / max) * width);
    const bar = '█'.repeat(barLen);
    return `${label.padEnd(15)} ${colorFn(bar)} ${value}`;
  }).join('\n');
}
```

### Pattern 3: Command Mapping

**What:** Map natural language to existing CLI commands with confidence threshold.

**When to use:** Integrating NLP without parallel command structure.

```javascript
const COMMAND_MAP = {
  'show-progress': {
    command: 'session:progress',
    confidence: 0.6,
  },
  'create-phase': {
    command: 'plan:phase add',
    confidence: 0.7,
  },
  'velocity': {
    command: 'util:velocity',
    confidence: 0.7,
  },
};
```

---

## Build & Deploy Impact

### Build Order

1. **Create `src/lib/nlp.js`** — Intent parsing layer
2. **Create `src/lib/metrics.js`** — Analytics computation  
3. **Create `src/lib/viz.js`** — ASCII visualization
4. **Create `src/commands/natural.js`** — Natural language command
5. **Create `src/commands/insights.js`** — Analytics commands
6. **Update `src/router.js`** — Add routes
7. **Run `npm run build`** — Verify < 1550KB

### Bundle Size Impact

| Component | Estimated Size |
|-----------|----------------|
| Current bundle | ~1163KB |
| NLP module | ~5KB |
| Viz module | ~8KB |
| Metrics module | ~4KB |
| Command handlers | ~7KB |
| **Total new** | ~24KB |
| **Projected total** | ~1187KB |

**Conclusion:** Well within 1550KB budget. No external dependencies added.

### Single-File Compatibility

- All modules use CommonJS (matching existing src/)
- No ESM-specific imports
- Inline ASCII rendering (no npm dependencies)
- Pattern matching uses native RegExp

---

## Anti-Patterns to Avoid

| Anti-Pattern | Why Wrong | Correct Approach |
|--------------|------------|------------------|
| Heavy NLP library (node-nlp) | Adds 100KB+, overkill | Pattern-first regex matching |
| External API for parsing | Latency, cost, offline breaks | Local pattern matching |
| Full TUI library (blessed) | 50-100KB dependency | Inline ASCII rendering |
| Parallel command set | Duplication, confusion | Map to existing commands |

---

## Sources

1. **Pattern-first parsing:** https://dev.to/daniel_romitelli_44e77dc6/search-that-refuses-to-think-the-pattern-first-query-parser-i-use-for-fast-intent-entity-107l
2. **CLI NLP approaches:** https://github.com/shreshthgoyal/naturalshell
3. **ASCII visualization:** https://github.com/kroitor/asciichart
4. **CLI charts:** https://www.npmjs.com/package/simple-ascii-chart
5. **Terminal gauges:** https://www.npmjs.com/package/gauge

---

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Intent parsing approach | HIGH | Pattern-first is proven, zero-dep |
| Visualization approach | HIGH | ASCII rendering is simple, proven |
| Bundle size | HIGH | 24KB estimate well within budget |
| Integration pattern | HIGH | Maps to existing command structure |
| Offline capability | HIGH | No external dependencies |

---

*Architecture research for: v11.0 Natural Interface & Insights*
*Researched: 2026-03-11*
