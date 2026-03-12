# Phase 98: NL Foundation - Research

**Researched:** 2026-03-11
**Domain:** Natural Language CLI parsing, intent classification, fuzzy matching, command resolution
**Confidence:** HIGH

## Summary

This phase implements foundational natural language processing for the bGSD CLI. Research confirms that lightweight fuzzy matching (Fuse.js) combined with a command mapping registry is the right approach for NL-01 through NL-04. The existing alias system (`jr` variable in bgsd-tools.cjs) provides a good foundation to extend. No heavy NLP libraries needed — simple pattern matching, keyword extraction, and Levenshtein distance-based fuzzy matching are sufficient for a CLI tool.

**Primary recommendation:** Implement a lightweight intent classification system using fuzzy matching (Fuse.js) and a command phrase registry. Extend the existing alias system rather than replacing it.

---

## User Constraints

None from CONTEXT.md — this is a new phase without prior context.

---

## Requirements

| ID | Requirement |
|----|-------------|
| NL-01 | Intent classification — Parse natural language input into CLI commands (plan, execute, verify, query) |
| NL-02 | Parameter extraction — Extract phase numbers, flags, targets from loose descriptions |
| NL-03 | Smart alias resolution — Map natural phrases to commands ("show progress" → `session progress`) |
| NL-04 | Fallback help — Show contextual suggestions when input is unclear |

---

## Standard Stack

### Core - Intent Classification & Fuzzy Matching
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fuse.js | ^7.x | Fuzzy string matching for command resolution | Lightweight, zero-dependency, excellent for CLI alias matching |
| commander | ^11.x | CLI parsing framework | Already used in bgsd-tools.cjs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| natural | N/A | Tokenization/stemming | Don't use — overkill for CLI |
| levenshtein-edit-distance | ^1.x | Fast string distance | Alternative to Fuse.js if needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fuse.js | levenshtein-edit-distance | Fuse.js provides better ranking/scoring, not just distance |
| Custom intent classification | NLP library (natural, compromise) | CLI doesn't need full NLP — pattern matching suffices |
| Embeddings/vectors | Sentence transformers | Overkill — requires heavy dependencies |

---

## Architecture Patterns

### Recommended Project Structure

```
src/lib/
  nl-parser.js       # NEW - Main NLP parsing entry point
  intent-classifier.js # NEW - Intent classification logic
  command-registry.js  # NEW - Command phrase to canonical mapping
  fuzzy-resolver.js   # NEW - Fuzzy matching using Fuse.js
  help-fallback.js    # NEW - Contextual suggestion generation
```

### Existing Code to Extend

The `bin/bgsd-tools.cjs` already contains:
- `jr` variable (line ~1236): Short aliases (`p` → `plan`, `e` → `execute`)
- `oT` function: Command suggestion logic with prefix/contains matching
- `Mp` variable: Command categories (workflow, planning, analysis, utility, research)

**Extend, don't replace.** Build the NL layer on top of this.

### Pattern 1: Intent Classification Flow

```javascript
// Basic intent classification
const INTENTS = {
  'plan': ['plan', 'planning', 'plan phase', 'create plan'],
  'execute': ['execute', 'run', 'execute phase', 'run phase', 'start'],
  'verify': ['verify', 'check', 'validate', 'review'],
  'query': ['query', 'search', 'find', 'look up', 'show', 'progress', 'status']
};

function classifyIntent(input) {
  const normalized = input.toLowerCase().trim();
  
  // Direct match
  for (const [intent, phrases] of Object.entries(INTENTS)) {
    if (phrases.some(p => normalized === p || normalized.startsWith(p))) {
      return { intent, confidence: 1.0 };
    }
  }
  
  // Fuzzy match with Fuse.js
  const allPhrases = Object.values(INTENTS).flat();
  const results = fuzzyResolver.resolve(normalized, allPhrases, { threshold: 0.4 });
  
  if (results.length > 0) {
    const matchedIntent = Object.entries(INTENTS).find(
      ([, phrases]) => phrases.includes(results[0].item)
    );
    return { intent: matchedIntent[0], confidence: 1 - results[0].score };
  }
  
  return { intent: null, confidence: 0 };
}
```

### Pattern 2: Parameter Extraction

```javascript
// Extract phase numbers from input
function extractPhaseNumber(input) {
  // Match patterns like "phase 5", "phase 98", "p5", "p98"
  const phaseMatch = input.match(/(?:phase|p|p\.)\s*(\d+)/i);
  if (phaseMatch) {
    return parseInt(phaseMatch[1], 10);
  }
  
  // Match standalone numbers that look like phases
  const standalone = input.match(/\b(\d{2})\b/);
  if (standalone) {
    return parseInt(standalone[1], 10);
  }
  
  return null;
}

// Extract flags from input
function extractFlags(input) {
  const flags = [];
  const flagPatterns = [
    { pattern: /--(\w+)/g, type: 'long' },
    { pattern: /-(\w)/g, type: 'short' },
    { pattern: /\b(force|verbose|debug|auto)\b/gi, type: 'keyword' }
  ];
  
  for (const { pattern, type } of flagPatterns) {
    let match;
    while ((match = pattern.exec(input)) !== null) {
      flags.push({ flag: match[0], type });
    }
  }
  
  return flags;
}
```

### Pattern 3: Smart Alias Resolution (Fuse.js)

```javascript
// Command phrase registry with Fuse.js
const COMMAND_PHRASES = [
  { phrase: 'plan phase', command: 'plan:phase' },
  { phrase: 'plan new phase', command: 'plan:phase' },
  { phrase: 'show progress', command: 'session:progress' },
  { phrase: 'how are we doing', command: 'session:progress' },
  { phrase: 'what is the status', command: 'session:progress' },
  { phrase: 'execute phase', command: 'execute:phase' },
  { phrase: 'run current phase', command: 'execute:phase' },
  { phrase: 'verify work', command: 'verify:work' },
  { phrase: 'check quality', command: 'verify:work' },
  { phrase: 'show roadmap', command: 'plan:roadmap list' },
  { phrase: 'list phases', command: 'plan:roadmap list' },
  { phrase: 'start new project', command: 'init:new-project' },
  { phrase: 'create project', command: 'init:new-project' },
  { phrase: 'show help', command: 'util:help' },
  { phrase: 'what commands exist', command: 'util:help' }
];

// Fuse.js setup with good defaults for CLI
const fuzzyResolver = new Fuse(COMMAND_PHRASES, {
  keys: ['phrase'],
  threshold: 0.4,
  distance: 100,
  includeScore: true,
  shouldSort: true
});
```

### Pattern 4: Fallback Help System

```javascript
// Contextual suggestions based on current state
function getFallbackSuggestions(input, context) {
  const suggestions = [];
  
  // If no intent detected, show categories
  if (!context.currentIntent) {
    suggestions.push(
      { type: 'category', label: 'Planning', examples: ['plan phase', 'show roadmap'] },
      { type: 'category', label: 'Execution', examples: ['execute phase', 'run current plan'] },
      { type: 'category', label: 'Verification', examples: ['verify work', 'check quality'] }
    );
  }
  
  // If partial match, show close commands
  const closeMatches = findCloseCommands(input, { threshold: 0.6 });
  if (closeMatches.length > 0) {
    suggestions.push(
      { type: 'did_you_mean', commands: closeMatches.map(m => m.phrase) }
    );
  }
  
  return suggestions;
}
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fuzzy matching | Custom Levenshtein implementation | Fuse.js | Battle-tested, optimized, handles scoring |
| CLI parsing | Custom argument parser | commander | Already in use, handles edge cases |
| Intent detection | ML-based classifier | Pattern matching + fuzzy | CLI commands are limited, no training needed |

---

## Common Pitfalls

### Pitfall 1: Over-Engineering Intent Detection
**What goes wrong:** Implementing full NLP pipeline for a CLI with 40 commands.
**Why it happens:** Misunderstanding the problem complexity.
**How to avoid:** Use simple keyword matching first, add fuzzy only for typo handling.
**Warning signs:** Dependencies like tensorflow, bert, or transformers

### Pitfall 2: Ambiguous Input Handling
**What goes wrong:** "run" could mean execute, start server, or run tests — no disambiguation.
**Why it happens:** Multiple intents map to similar phrases.
**How to avoid:** Ask for clarification when confidence < threshold, show disambiguation UI.
**Warning signs:** Always returning a command without confidence checking

### Pitfall 3: Performance Impact on Startup
**What goes wrong:** Loading Fuse.js index slows down CLI startup.
**Why it happens:** Index built on every invocation.
**How to avoid:** Lazy-load the fuzzy resolver, build index once, cache it.
**Warning signs:** Noticeable delay in `bgsd --help`

### Pitfall 4: Breaking Existing Aliases
**What goes wrong:** New NL layer conflicts with existing `p`, `e`, `v` shortcuts.
**Why it happens:** Not checking existing alias map before adding new ones.
**How to avoid:** Extend `jr` map, don't replace. Ensure `p` → `plan` still works.
**Warning signs:** Existing shortcuts stop working after NL changes

---

## Code Examples

### Example 1: Complete NL Parsing Pipeline

```javascript
// src/lib/nl-parser.js
const { Fuse } = require('fuse.js');
const COMMAND_REGISTRY = require('./command-registry');

class NLParser {
  constructor() {
    this.fuse = new Fuse(COMMAND_REGISTRY.PHRASES, {
      keys: ['phrase'],
      threshold: 0.4,
      includeScore: true
    });
  }

  parse(input) {
    const normalized = input.toLowerCase().trim();
    
    // Step 1: Check exact command matches first
    const exact = this.findExactMatch(normalized);
    if (exact) return { ...exact, confidence: 1.0 };
    
    // Step 2: Extract intent
    const intent = this.classifyIntent(normalized);
    
    // Step 3: Extract parameters
    const params = {
      phase: this.extractPhaseNumber(normalized),
      flags: this.extractFlags(normalized),
      target: this.extractTarget(normalized)
    };
    
    // Step 4: Fuzzy resolve to command
    const fuzzy = this.fuse.search(normalized);
    const command = fuzzy.length > 0 && fuzzy[0].score < 0.4
      ? fuzzy[0].item.command
      : null;
    
    // Step 5: Generate fallback if no match
    if (!command && !intent) {
      return {
        parsed: false,
        suggestions: this.getSuggestions(normalized),
        help: this.generateHelp(normalized)
      };
    }
    
    return {
      parsed: true,
      command,
      intent: intent?.intent || null,
      params,
      confidence: command ? (1 - (fuzzy[0]?.score || 0)) : 0
    };
  }

  findExactMatch(input) {
    const entry = COMMAND_REGISTRY.PHRASES.find(
      e => e.phrase.toLowerCase() === input
    );
    return entry || null;
  }

  classifyIntent(input) {
    // Simple keyword matching for intent
    const intentPatterns = {
      plan: ['plan', 'planning', 'create', 'make'],
      execute: ['execute', 'run', 'start', 'do'],
      verify: ['verify', 'check', 'validate', 'test'],
      query: ['show', 'list', 'get', 'find', 'search', 'status']
    };

    for (const [intent, keywords] of Object.entries(intentPatterns)) {
      if (keywords.some(k => input.includes(k))) {
        return { intent, confidence: 0.8 };
      }
    }
    return null;
  }

  extractPhaseNumber(input) {
    const match = input.match(/(?:phase|p\.?)\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : null;
  }

  extractFlags(input) {
    const flags = [];
    const flagRegex = /--(\w+)|-(\w)|(force|verbose|debug|auto)/gi;
    let match;
    while ((match = flagRegex.exec(input)) !== null) {
      flags.push(match[1] || match[2] || match[3]);
    }
    return flags;
  }

  extractTarget(input) {
    // Extract remaining text after intent/command words
    const cleaned = input
      .replace(/^(plan|execute|verify|query|run|show|list|get)\s+/i, '')
      .replace(/--\S+|-.\b/g, '')
      .trim();
    return cleaned || null;
  }

  getSuggestions(input) {
    const fuzzy = this.fuse.search(input);
    return fuzzy.slice(0, 5).map(r => r.item);
  }

  generateHelp(input) {
    return `No command found for "${input}". Try:
  - "plan phase 5" to plan phase 5
  - "execute phase" to run current phase
  - "show progress" to see status
  - "help" for all commands`;
  }
}

module.exports = { NLParser };
```

### Example 2: Command Registry Structure

```javascript
// src/lib/command-registry.js
module.exports = {
  // Natural language phrases mapped to canonical commands
  PHRASES: [
    { phrase: 'plan phase', command: 'plan:phase', intent: 'plan' },
    { phrase: 'plan new phase', command: 'plan:phase', intent: 'plan' },
    { phrase: 'show progress', command: 'session:progress', intent: 'query' },
    { phrase: 'how are we doing', command: 'session:progress', intent: 'query' },
    { phrase: 'what is the status', command: 'session:progress', intent: 'query' },
    { phrase: 'execute phase', command: 'execute:phase', intent: 'execute' },
    { phrase: 'run current phase', command: 'execute:phase', intent: 'execute' },
    { phrase: 'run plan', command: 'execute:quick', intent: 'execute' },
    { phrase: 'verify work', command: 'verify:work', intent: 'verify' },
    { phrase: 'check quality', command: 'verify:work', intent: 'verify' },
    { phrase: 'show roadmap', command: 'plan:roadmap list', intent: 'query' },
    { phrase: 'list phases', command: 'plan:roadmap list', intent: 'query' },
    { phrase: 'start new project', command: 'init:new-project', intent: 'plan' },
    { phrase: 'create project', command: 'init:new-project', intent: 'plan' },
    { phrase: 'show help', command: 'util:help', intent: 'query' },
    { phrase: 'what commands exist', command: 'util:help', intent: 'query' },
    { phrase: 'new milestone', command: 'plan:milestone new', intent: 'plan' },
    { phrase: 'complete milestone', command: 'milestone:complete', intent: 'execute' }
  ],

  // Short aliases (extends existing jr map)
  ALIASES: {
    'p': 'plan',
    'pp': 'plan:phase',
    'pr': 'plan:roadmap',
    'ph': 'plan:phases',
    'pm': 'plan:milestone',
    'e': 'execute',
    'ep': 'execute:phase',
    'eq': 'execute:quick',
    'ec': 'execute:commit',
    'v': 'verify',
    'vs': 'verify:state',
    'vr': 'verify:review',
    'u': 'util',
    'uc': 'util:config-get',
    'ucs': 'util:config-set',
    'uh': 'util:history-digest',
    'up': 'util:progress',
    'i': 'init',
    'in': 'init:new-project',
    'ie': 'init:execute-phase'
  },

  // Intent keywords
  INTENTS: {
    plan: ['plan', 'planning', 'create', 'make', 'new', 'add'],
    execute: ['execute', 'run', 'start', 'do', 'go', 'begin'],
    verify: ['verify', 'check', 'validate', 'test', 'audit', 'review'],
    query: ['show', 'list', 'get', 'find', 'search', 'status', 'progress', 'help']
  }
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No NL support | Basic keyword matching + fuzzy | This phase | Enables natural language commands |
| Hardcoded aliases (`p`, `e`) | Phrase registry with fuzzy matching | This phase | Extensible alias system |
| No fallback help | Contextual suggestions on unrecognized input | This phase | Better UX for unclear commands |
| Exact string matching only | Fuse.js fuzzy matching with threshold | This phase | Handles typos gracefully |

---

## Open Questions

1. **Confidence threshold calibration:** What threshold (0.3? 0.4? 0.5?) works best for CLI typos? Need to test with real user input.

2. **Disambiguation strategy:** When multiple commands match with similar confidence, should we auto-select or ask the user?

3. **Context-aware suggestions:** Should suggestions change based on current phase/plan? (e.g., "continue" suggests current plan when in-progress)

4. **Learning from user:** Should the system remember user corrections? (e.g., user types "plan faser" → corrected to "plan phase" → remember mapping)

5. **Internationalization:** Should phrases be localizable? (e.g., "planificar" → "plan" in Spanish)

---

## Sources

### Primary (HIGH confidence)
- Fuse.js documentation: https://www.fusejs.io/ (API, options, examples)
- Commander.js documentation: https://github.com/tj/commander.js (existing CLI patterns)
- Existing bgsd-tools.cjs command handling (lines ~1236-1240)

### Secondary (MEDIUM confidence)
- Inquirer.js for reference prompt patterns (even though using commander)
- CLI best practices from various npm packages

### Tertiary (LOW confidence)
- General fuzzy matching algorithms (academic)
- NLP intent classification papers (overkill for this use case)

---

## Metadata

**Confidence breakdown:**
- Fuse.js for fuzzy matching: HIGH (well-documented, right tool)
- Pattern matching intent classification: HIGH (simple, effective for CLI)
- Parameter extraction (phase, flags): HIGH (regex patterns are reliable)
- Fallback help system: MEDIUM (needs iteration based on user feedback)
- Command registry design: HIGH (extends existing patterns)

**Research date:** 2026-03-11
**Valid until:** 2026-09-11 (6 months, revisit if requirements change significantly)
