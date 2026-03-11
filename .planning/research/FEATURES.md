# FEATURES.md — Natural Language UI & Visualization/Analytics

**Domain:** Natural Language UI + Visualization & Analytics  
**Milestone:** v11.0 Natural Interface & Insights  
**Researched:** 2026-03-11  
**Confidence:** HIGH (feature categorization), MEDIUM (complexity estimates)

---

<!-- section: compact -->
<features_compact>

**Table Stakes:**
- Intent classification and parameter extraction
- Smart alias resolution and fallback help
- Phase/task progress bars and completion visualization
- Milestone progress tracking and summary reports
- Quality score visualization

**Differentiators:**
- Conversational planning with goal descriptions
- ASCII burndown charts and velocity sparklines
- Terminal dashboard overview
- AI-powered natural language to command
- Contextual suggestions and conversational memory

**Key Dependencies:** All build on existing format.js, state parsing, and CLI infrastructure.

</features_compact>
<!-- /section -->

---

<!-- section: feature_landscape -->

## 1. Natural Language UI Features

### 1.1 Intent Parsing & Command Interpretation

| Feature | Category | Complexity | Dependencies | Notes |
|---------|----------|------------|--------------|-------|
| Intent classification | Table Stakes | Medium | Existing CLI parser | Classify input as plan/create/verify/query |
| Parameter extraction | Table Stakes | Medium | Intent classification | Extract phase numbers, flags, targets |
| Fallback to help | Table Stakes | Low | Intent classification | Show suggestions when unclear |
| Smart alias resolution | Table Stakes | Low | Existing alias system | Map "show progress" → `session progress` |
| Contextual suggestions | Differentiator | Medium | Session state | Suggest next logical commands |
| Multi-intent detection | Differentiator | High | Intent classification | Handle "plan phase 5 and verify" |

### 1.2 Conversational Planning

| Feature | Category | Complexity | Dependencies | Notes |
|---------|----------|------------|--------------|-------|
| Goal description input | Table Stakes | Medium | Planning workflows | Accept natural language goals |
| Requirement extraction | Table Stakes | Medium | Existing state files | Parse loose descriptions |
| Clarifying questions | Differentiator | High | Intent, workflows | Ask before planning |
| Voice-ready prompts | Differentiator | Medium | Prompt standardization | Voice-compatible input |
| Conversational memory | Differentiator | High | Session state, SQLite | Context across turns |

### 1.3 AI-Powered Assistance

| Feature | Category | Complexity | Dependencies | Notes |
|---------|----------|------------|--------------|-------|
| Natural language to command | Differentiator | High | AI provider | Convert descriptions to commands |
| Risk indicators | Differentiator | Medium | AI provider | Warn on destructive ops |
| Multiple AI provider support | Differentiator | High | Provider abstraction | OpenAI, Anthropic, Gemini |
| Command explanation | Differentiator | Medium | AI provider | Explain command behavior |

---

## 2. Visualization & Analytics Features

### 2.1 Progress Tracking

| Feature | Category | Complexity | Dependencies | Notes |
|---------|----------|------------|--------------|-------|
| Phase progress bars | Table Stakes | Low | format.js | Visual phase indicator |
| Task completion visualization | Table Stakes | Low | Plan/task parsing | Completed/pending/total |
| Milestone progress | Table Stakes | Medium | Milestone tracking | Completion percentage |
| Burndown charts (ASCII) | Differentiator | Medium | Historical data | Track work over time |
| Velocity sparklines | Differentiator | Medium | Historical data | Velocity trends |
| Interactive progress queries | Differentiator | High | Data aggregation | "How much left in phase 3?" |

### 2.2 Rich Reporting

| Feature | Category | Complexity | Dependencies | Notes |
|---------|----------|------------|--------------|-------|
| Milestone summary reports | Table Stakes | Low | SUMMARY parsing | Formatted summaries |
| Quality score visualization | Table Stakes | Low | Quality scoring | A-F grades with trends |
| Session velocity metrics | Differentiator | Medium | Session tracking | Tasks/session |
| Team/project insights | Differentiator | High | Multi-project | Aggregate insights |
| Trend analysis | Differentiator | High | Historical data | Pattern analysis |

### 2.3 Terminal Dashboard

| Feature | Category | Complexity | Dependencies | Notes |
|---------|----------|------------|--------------|-------|
| Dashboard overview command | Differentiator | Medium | Multiple sources | Key metrics in one view |
| Real-time updates | Differentiator | High | TTY detection | Live-updating view |
| Drill-down navigation | Differentiator | High | Dashboard | Navigate to details |
| Customizable widgets | Differentiator | Very High | Framework | User-configurable |

### 2.4 Data Visualization (ASCII/Unicode)

| Feature | Category | Complexity | Dependencies | Notes |
|---------|----------|------------|--------------|-------|
| Sparkline rendering | Differentiator | Low | Custom | Unicode trend lines |
| Bar charts (horizontal) | Differentiator | Low | Custom | ASCII comparisons |
| Tables with progress columns | Table Stakes | Low | format.js | Enhanced tables |
| Heatmaps | Differentiator | Medium | Data aggregation | Intensity patterns |
| Gantt-style timelines | Differentiator | High | Phase data | Visual timeline |

---

<!-- /section -->

<!-- section: dependencies -->

## 3. Feature Dependency Map

```
Natural Language UI
├── Intent Parsing
│   ├── Intent classification ──────┐
│   ├── Parameter extraction ──────┤
│   ├── Fallback to help ──────────┤
│   ├── Smart alias resolution ────┤
│   └── Contextual suggestions ────┤
├── Conversational Planning
│   ├── Goal description input ────┤
│   ├── Requirement extraction ────┼──► Planning Workflows
│   ├── Clarifying questions ──────┤
│   ├── Voice-ready prompts ───────┤
│   └── Conversational memory ─────┘
└── AI-Powered Assistance
    ├── Natural language to command
    ├── Risk indicators
    ├── Multiple AI provider support
    └── Command explanation

Visualization & Analytics
├── Progress Tracking
│   ├── Phase progress bars ───────┐
│   ├── Task completion ───────────┤
│   ├── Milestone progress ────────┤
│   ├── Burndown charts ───────────┤
│   ├── Velocity sparklines ───────┼──► Session/Milestone Data
│   └── Interactive queries ───────┘
├── Rich Reporting
│   ├── Milestone summaries ───────┤
│   ├── Quality visualization ──────┤
│   ├── Session velocity ───────────┤
│   ├── Team insights ──────────────┼──► Historical Data
│   └── Trend analysis ─────────────┘
├── Terminal Dashboard
│   ├── Dashboard overview ────────┤
│   ├── Real-time updates ─────────┤
│   ├── Drill-down ────────────────┤
│   └── Customizable widgets ───────┘
└── Data Visualization
    ├── Sparklines ─────────────────┐
    ├── Bar charts ─────────────────┤
    ├── Progress tables ────────────┼──► format.js (existing)
    ├── Heatmaps ──────────────────┤
    └── Gantt timelines ────────────┘
```

---

<!-- /section -->

<!-- section: anti_features -->

## 4. Anti-Features (Explicitly NOT Build)

| Anti-Feature | Reason |
|--------------|--------|
| Web-based dashboard UI | Out of scope for CLI |
| GUI/graphics dependencies | Must remain terminal-only |
| Real-time collaboration sync | Beyond CLI scope |
| External service integrations (Linear, Jira) | Defer to future |
| Vector/3D charts | Terminal limitations |
| Voice input processing | Platform-specific, defer |
| Plugin/extension system | Adds complexity, defer |

---

<!-- /section -->

<!-- section: mvp -->

## 5. MVP Recommendation

### Table Stakes (Must-Have for v11.0)

1. **Intent classification** — Parse natural language into CLI commands
2. **Parameter extraction** — Extract phase numbers, targets from descriptions
3. **Fallback to help** — Show suggestions when intent unclear
4. **Smart alias resolution** — Map conversational phrases to commands
5. **Phase progress bars** — Visual progress in current phase
6. **Task completion visualization** — Show completed/pending/total
7. **Milestone progress** — Overall completion percentage
8. **Milestone summary reports** — Formatted completion summaries
9. **Quality score visualization** — Show grades with trends
10. **Tables with progress columns** — Enhanced table formatting

### Differentiators (Nice-to-Have for v11.0)

1. **Contextual suggestions** — Suggest next commands
2. **Requirement extraction** — Parse loose descriptions
3. **Burndown charts (ASCII)** — Track remaining work over time
4. **Velocity sparklines** — Show velocity trends
5. **Sparkline rendering** — Compact trend lines
6. **Bar charts (horizontal)** — ASCII bar charts
7. **Dashboard overview command** — Single command for key metrics

---

<!-- /section -->

<!-- section: complexity -->

## 6. Implementation Complexity Summary

| Level | Count | Features |
|-------|-------|----------|
| Low | 8 | Progress bars, aliases, sparklines, bars, tables |
| Medium | 12 | Intent classification, reporting, burndown |
| High | 8 | Conversational memory, multi-provider, dashboards |
| Very High | 2 | Customizable widgets |

**Phase Structure Recommendation:**

| Phase | Focus | Key Features |
|-------|-------|--------------|
| Phase 1 | Foundation | Intent classification, parameter extraction, smart aliases, progress bars |
| Phase 2 | Core NL UI | Goal description input, requirement extraction, contextual suggestions |
| Phase 3 | Visualization | Task completion, milestone progress, quality visualization, ASCII charts |
| Phase 4 | Reporting | Milestone summaries, velocity metrics, dashboard overview |
| Phase 5 | Advanced | Burndown charts, sparklines, interactive queries |

---

<!-- /section -->

## Sources

- CLI AI tools: GCLI, clai, hai, Gemini CLI, Slashbot
- Terminal visualization: chartli, pterm, prodash, node-progress
- Project management CLIs: YouTrack CLI, GitScrum CLI, SPARK CLI, Task CLI
- NPM libraries: gauge, node-progress, xprogress, ascii-progress

---

*Confidence: HIGH for feature categorization and table-stakes. MEDIUM for complexity estimates and phase recommendations.*
