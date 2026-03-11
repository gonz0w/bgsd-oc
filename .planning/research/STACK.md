# Stack Research — v11.0 Natural Interface & Insights

## Overview
Research on stack additions needed for v11.0 (Natural Language UI & Visualization).

## Existing Stack
- Node.js >= 22.5 (for node:sqlite)
- esbuild (bundler)
- acorn (AST parsing)
- tokenx (token estimation)
- picocolors (inline, TTY-aware colors)
- inquirer ^8.x (interactive prompts - already integrated)

## Recommended Additions

### Natural Language Parsing (NEW)
| Package | Version | Purpose | Dependencies |
|---------|---------|---------|--------------|
| compromise | ^14.x | Lightweight NLP: intent extraction, entity recognition, number parsing | 0 deps, 15KB gzipped |

**Recommendation:** Use compromise for parsing loose natural language descriptions into structured CLI commands. Far lighter than full NLP suites.

**Use cases:**
- Parse "show me the progress of phase 3" → structured query
- Extract phase numbers from "what's left in milestone?"
- Intent detection for conversational planning

### Terminal Visualization (NEW)
| Package | Version | Purpose | Dependencies |
|---------|---------|---------|--------------|
| text-graph.js | ^1.x | ASCII charts, bars, sparklines (terminal + browser) | 0 deps |
| neo-blessed | ^1.1.0 | Full TUI framework (modern blessed fork) | ncurses bindings |
| blessed-contrib | ^4.x | Dashboard widgets for blessed | pairs with neo-blessed |

**Recommendation:** Start with text-graph.js for ASCII visualizations. Graduate to neo-blessed only if full TUI needed.

**Use cases:**
- Progress bars and burndown charts in terminal
- ASCII-based velocity charts
- Simple dashboard in CLI output

### Simple Widgets (Optional)
| Package | Version | Purpose | Dependencies |
|---------|---------|---------|--------------|
| console-gui-tools | ^3.x | Menus, popups, layouts | 0 deps |

**Recommendation:** Use for simpler wizard-style interfaces if neo-blessed is too complex.

### Web Dashboard (Optional Alternative)
| Package | Version | Purpose | Dependencies |
|---------|---------|---------|--------------|
| Express | ^4.x | Minimal web server for on-demand dashboard | Multiple (router, serve-static) |

**Recommendation:** Only if browser-based visualization is required. Adds server complexity.

## Integration Approach

### Embedded (Recommended)
**Approach:** ASCII-based visualization within existing CLI output
- Use `text-graph.js` for bars, sparklines, simple charts
- Add `compromise` for natural language parsing
- Keep in existing CLI workflow

**Pros:**
- Zero additional dependencies for most features
- Maintains single-file deploy capability
- Works across all terminals
- No separate server/process

### External Dashboard
**Approach:** Spawn lightweight Express server on demand, open browser
- Serve static HTML with visualizations
- Kill server on exit

**When to use:**
- Complex interactive dashboards needed
- Rich chart interactions required
- Team prefers browser over terminal

## What NOT to Add
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| langchain | 100+ MB, server-side LLM apps, wrong architecture | compromise + direct API calls |
| tensorflow.js | 50MB+ for NLP that can be simpler | compromise |
| natural | Unmaintained (3+ years), many deps | compromise |
| blessed (original) | Unmaintained since 2019 | neo-blessed |
| xterm.js | Browser terminal emulator, not TUI building | neo-blessed |
| node-nlp | Full NLP suite (15 deps), overkill | compromise |

## Integration Points
- `src/lib/nlp.js` - New: compromise wrapper for intent/entity parsing
- `src/lib/viz.js` - New: ASCII chart rendering utilities
- Extend existing `src/lib/prompts.js` with NL input support

## Confidence
- **HIGH**: compromise recommendations (Context7 verified, lightweight, active)
- **HIGH**: text-graph.js (npm verified, zero deps, terminal-compatible)
- **MEDIUM**: neo-blessed (more complex, may not be needed)

## Rationale
- Maintain single-file deploy (minimize new deps)
- Use zero-dependency libraries where possible
- Start simple (ASCII) before graduating to full TUI
- Existing inquirer is sufficient for prompts — no change needed
