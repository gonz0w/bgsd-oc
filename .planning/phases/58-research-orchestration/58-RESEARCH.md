# Phase 58: Research Orchestration - Research

**Researched:** 2026-03-02
**Domain:** Multi-source research pipeline orchestration, graceful degradation, agent integration
**Confidence:** HIGH

## Summary

Phase 58 builds the orchestration layer that ties together all research sources (Brave Search MCP, Context7 MCP, YouTube/yt-dlp) into a unified pipeline with 4-tier graceful degradation. The core challenge is designing a pipeline that runs in a zero-dependency Node.js CLI tool (`gsd-tools.cjs`), collects sources in parallel where possible, degrades automatically when tools are missing, and integrates transparently with existing researcher agents (`gsd-phase-researcher`, `gsd-project-researcher`).

The foundations are solid: Phase 56 built `detectCliTools()`, `detectMcpServers()`, `calculateTier()`, and the `research:capabilities` command. Phase 57 built `cmdResearchYtSearch()` and `cmdResearchYtTranscript()` with the subprocess pattern via `execFileSync`. This phase adds the orchestration command (`research:collect`) that coordinates source collection, and modifies the researcher agent workflow to conditionally inject collected sources into the research prompt.

**Primary recommendation:** Build `research:collect` as a new command in `src/commands/research.js` that: (1) detects available tools via existing `calculateTier()`, (2) collects sources from each tool using the established `execFileSync` subprocess pattern (Brave via `gsd-tools.cjs util:websearch`, Context7 via the MCP server if detected, YouTube via existing `cmdResearchYtSearch`/`cmdResearchYtTranscript`), (3) writes structured output with `<source>` XML tags for LLM consumption at Tier 2, and (4) supports `--quick` flag to skip the pipeline entirely. Modify the `workflows/research-phase.md` workflow to call `research:collect` before spawning the researcher agent, injecting collected sources into the agent prompt.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ORCH-01 | Pipeline collects sources from Brave Search, Context7, YouTube, and NotebookLM in a defined sequence with structured output | Core `research:collect` command with sequential/parallel source collection — see Architecture Patterns |
| ORCH-02 | Pipeline degrades gracefully through 4 tiers based on available tools | Reuse existing `calculateTier()` from Phase 56 — see Degradation Architecture |
| ORCH-03 | Researcher agents use new RAG pipeline when tools available, no regression when absent | Workflow modification to conditionally inject sources — see Agent Integration Pattern |
| ORCH-04 | Pipeline provides progressive output at each stage with time estimates and parallel collection | `status()` stderr messages + parallel collection via separate `execFileSync` calls — see Progressive Output Pattern |
| ORCH-05 | User can skip RAG pipeline via `--quick` flag | Flag parsing in workflow + command — see Quick Flag Pattern |
</phase_requirements>

## Standard Stack

### Core (Already in Project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `child_process` | built-in | `execFileSync` for subprocess calls | Established pattern from git.js, yt-dlp commands |
| `src/commands/research.js` | current | Research command module | Already has detectCliTools, detectMcpServers, calculateTier, yt-search, yt-transcript |
| `src/lib/output.js` | current | `output()` for JSON/formatted, `status()` for stderr progress | Standard output pattern |
| `src/lib/format.js` | current | `banner()`, `sectionHeader()`, `formatTable()`, `color` | Standard formatting |
| `src/lib/config.js` | current | `loadConfig()` for rag_enabled, rag_timeout settings | Established config pattern |
| `src/router.js` | current | Namespace routing for `research:collect` | Established routing pattern |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `src/lib/constants.js` | current | COMMAND_HELP entries, TIER_DEFINITIONS | Adding help text for new commands |
| `workflows/research-phase.md` | current | Researcher agent workflow | Modification target for agent integration |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `execFileSync` (blocking) | `child_process.exec` with promises | Would enable true parallel I/O, but project uses synchronous subprocess pattern exclusively. `execFileSync` is simpler, matches git.js/yt-dlp patterns, and avoids async complexity in the zero-dependency CLI. Pseudo-parallel via sequential calls with timing is sufficient. |
| XML tags for source structure | JSON-only output | XML tags within the output are proven to help LLMs parse multi-source context (Anthropic docs confirm this). JSON is the transport format; XML tags structure the content *within* JSON string values for agent consumption. |
| Separate orchestrator module | All code in research.js | research.js is already 993 lines. A separate `src/lib/research-pipeline.js` could be warranted if the orchestration logic exceeds ~200 lines. However, keeping it in research.js maintains the established pattern of one command module per namespace. Monitor size during implementation. |

**No new dependencies.** Everything builds on existing patterns and modules.

## Architecture Patterns

### Recommended Module Structure

```
src/
├── commands/
│   └── research.js          # Add: collectSources(), cmdResearchCollect(), formatCollect()
├── lib/
│   └── constants.js          # Add: COMMAND_HELP entries for research:collect
├── router.js                 # Add: research:collect routing
└── workflows/
    └── research-phase.md     # Modify: call research:collect before spawning researcher
```

### Pattern 1: Pipeline Orchestration (research:collect)

**What:** A single command that coordinates source collection from all available tools.
**When to use:** Called by researcher agent workflow before spawning the researcher subagent.

```javascript
// Source: Project pattern (matches cmdResearchYtSearch structure)
function cmdResearchCollect(cwd, args, raw) {
  const config = loadConfig(cwd);
  const ragEnabled = config.rag_enabled !== false;
  const quick = args.includes('--quick');
  const timeout = (config.rag_timeout || 30) * 1000;
  
  // --quick: skip pipeline entirely
  if (quick || !ragEnabled) {
    const result = {
      tier: 4,
      tier_name: 'Pure LLM',
      skipped: quick ? 'quick_flag' : 'rag_disabled',
      sources: [],
      timing: {},
    };
    output(result, { formatter: formatCollect, raw });
    return;
  }
  
  // Detect available tools
  const cliTools = detectCliTools(cwd);
  const mcpServers = detectMcpServers(cwd);
  const tier = calculateTier(cliTools, mcpServers, ragEnabled);
  
  // Extract query from args
  const query = args.filter(a => !a.startsWith('--')).join(' ').trim();
  if (!query) {
    output({ error: 'Missing research query' }, { formatter: formatCollect, raw });
    return;
  }
  
  const sources = [];
  const timing = {};
  
  // Stage 1: Web search (Brave Search MCP or built-in websearch)
  status(`[1/3] Collecting web sources... (~${Math.ceil(timeout/1000)}s timeout)`);
  const webStart = Date.now();
  try {
    const webResults = collectWebSources(cwd, query, config, timeout);
    if (webResults) sources.push(...webResults);
  } catch (e) {
    debugLog('collect.web', `web collection failed: ${e.message}`);
  }
  timing.web_ms = Date.now() - webStart;
  
  // Stage 2: YouTube (if yt-dlp available)
  if (cliTools['yt-dlp']?.available) {
    status(`[2/3] Searching YouTube... (~${Math.ceil(timeout/1000)}s timeout)`);
    const ytStart = Date.now();
    try {
      const ytResults = collectYouTubeSources(cwd, query, config, timeout);
      if (ytResults) sources.push(...ytResults);
    } catch (e) {
      debugLog('collect.youtube', `youtube collection failed: ${e.message}`);
    }
    timing.youtube_ms = Date.now() - ytStart;
  } else {
    status('[2/3] YouTube: skipped (yt-dlp not installed)');
    timing.youtube_ms = 0;
  }
  
  // Stage 3: Context7 (if configured — MCP server, not subprocess)
  // Context7 is an MCP server used by the agent directly, not by CLI
  // We record its availability but don't collect from it here
  status('[3/3] Context7: available to agent directly via MCP');
  timing.context7_available = mcpServers['context7']?.configured && mcpServers['context7']?.enabled;
  
  timing.total_ms = Date.now() - webStart; // approximate
  
  const result = {
    tier: tier.number,
    tier_name: tier.name,
    query,
    source_count: sources.length,
    sources,
    timing,
    // Pre-formatted context for agent injection (Tier 2 format)
    agent_context: formatSourcesForAgent(sources, query),
  };
  
  output(result, { formatter: formatCollect, raw });
}
```

### Pattern 2: Source Collection Functions

**What:** Individual collector functions for each source type.
**When to use:** Called by the pipeline orchestrator.

```javascript
// Web source collection via existing websearch command
function collectWebSources(cwd, query, config, timeout) {
  try {
    const stdout = execFileSync(process.execPath, [
      process.argv[1], // gsd-tools.cjs path
      'util:websearch', query, '--limit', '5',
    ], { encoding: 'utf-8', timeout, stdio: 'pipe', cwd });
    
    const data = JSON.parse(stdout);
    if (!data.results) return [];
    
    return data.results.map(r => ({
      type: 'web',
      title: r.title || '',
      url: r.url || '',
      snippet: r.description || r.snippet || '',
      source: 'brave_search',
    }));
  } catch (e) {
    debugLog('collect.web', `websearch failed: ${e.message}`);
    return [];
  }
}

// YouTube source collection via existing yt-search + yt-transcript
function collectYouTubeSources(cwd, query, config, timeout) {
  // Step 1: Search for relevant videos
  let searchResults;
  try {
    const stdout = execFileSync(process.execPath, [
      process.argv[1],
      'research:yt-search', query, '--count', '3',
    ], { encoding: 'utf-8', timeout, stdio: 'pipe', cwd });
    searchResults = JSON.parse(stdout);
  } catch (e) {
    return [];
  }
  
  if (!searchResults?.results?.length) return [];
  
  // Step 2: Get transcript for top result only (expensive operation)
  const topVideo = searchResults.results[0];
  let transcript = null;
  try {
    const stdout = execFileSync(process.execPath, [
      process.argv[1],
      'research:yt-transcript', topVideo.id,
    ], { encoding: 'utf-8', timeout, stdio: 'pipe', cwd });
    const transcriptData = JSON.parse(stdout);
    if (transcriptData.has_subtitles) {
      transcript = transcriptData.transcript;
    }
  } catch (e) {
    debugLog('collect.youtube', `transcript extraction failed: ${e.message}`);
  }
  
  return [{
    type: 'youtube',
    title: topVideo.title,
    url: topVideo.url,
    channel: topVideo.channel,
    duration: topVideo.duration,
    quality_score: topVideo.quality_score,
    transcript: transcript ? truncateTranscript(transcript, 3000) : null,
    source: 'yt-dlp',
  }];
}
```

### Pattern 3: Tier 2 Source-to-Agent Format (KEY RESEARCH FINDING)

**What:** XML-tagged structured format for injecting collected sources into agent prompts.
**When to use:** Tier 2 (sources without NotebookLM synthesis) — the LLM synthesizes from raw sources.

This is the core research question for Phase 58. Based on:
- Anthropic's official guidance on XML tags for prompt structuring (HIGH confidence)
- RAG pipeline best practices for multi-source context (MEDIUM confidence)
- Practical source-to-context formatting patterns (MEDIUM confidence)

```javascript
/**
 * Format collected sources for injection into agent prompts.
 * Uses XML tags following Anthropic's recommended prompt structuring.
 * 
 * Structure:
 *   <collected_sources>
 *     <source type="web" title="..." url="...">snippet</source>
 *     <source type="youtube" title="..." url="..." channel="...">transcript excerpt</source>
 *   </collected_sources>
 */
function formatSourcesForAgent(sources, query) {
  if (!sources.length) return '';
  
  const parts = ['<collected_sources>'];
  parts.push(`<research_query>${query}</research_query>`);
  parts.push('');
  
  for (const s of sources) {
    if (s.type === 'web') {
      parts.push(`<source type="web" title="${escapeXmlAttr(s.title)}" url="${s.url}">`);
      parts.push(s.snippet);
      parts.push('</source>');
      parts.push('');
    } else if (s.type === 'youtube') {
      parts.push(`<source type="youtube" title="${escapeXmlAttr(s.title)}" url="${s.url}" channel="${escapeXmlAttr(s.channel || '')}">`);
      if (s.transcript) {
        parts.push(s.transcript);
      } else {
        parts.push(`[Video: ${s.title} — transcript unavailable]`);
      }
      parts.push('</source>');
      parts.push('');
    }
  }
  
  parts.push('</collected_sources>');
  return parts.join('\n');
}

function escapeXmlAttr(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function truncateTranscript(text, maxChars) {
  if (text.length <= maxChars) return text;
  // Truncate at word boundary
  const truncated = text.slice(0, maxChars);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > maxChars * 0.8 ? truncated.slice(0, lastSpace) : truncated) + '\n[...transcript truncated]';
}
```

**Key design decisions for Tier 2 format:**

1. **XML tags, not markdown sections.** Anthropic's official docs recommend XML tags for structuring multi-part prompts. Claude models parse `<source>` tags reliably. Attributes carry metadata (type, title, url) without consuming content tokens.

2. **Transcript truncation at 3000 chars.** YouTube transcripts can be 10,000+ chars. For agent consumption, 3000 chars (~750 words, ~5 minutes of speech) provides sufficient context without dominating the context window. The full transcript remains available via `research:yt-transcript`.

3. **Web snippets as-is.** Brave Search snippets are already concise (200-400 chars). No further truncation needed.

4. **Source attribution via attributes.** Each `<source>` tag includes type, title, URL. The agent can cite these in its output. This creates a traceable chain: source URL → agent citation → research document.

5. **Query echo.** The `<research_query>` tag reminds the agent what was searched, helping it assess relevance.

### Pattern 4: Degradation Architecture

**What:** Automatic tier selection based on detected tools, with no configuration required.
**When to use:** Every `research:collect` invocation.

```
Tier 1: Full RAG (yt-dlp + MCP + NotebookLM)
  → Collect all sources → NotebookLM synthesis → Agent receives synthesized output
  → NOT implemented in Phase 58 (NotebookLM is Phase 59)

Tier 2: Sources without synthesis (yt-dlp + MCP)
  → Collect web + YouTube sources → Format as XML → Agent synthesizes
  → PRIMARY TARGET for Phase 58

Tier 3: Brave/Context7 only (MCP available, no yt-dlp)
  → Collect web sources only → Format as XML → Agent synthesizes
  → Degraded but functional

Tier 4: Pure LLM (no tools or --quick)
  → No source collection → Agent uses training knowledge only
  → Fallback — identical to current behavior (zero regression)
```

**Critical: Tier 4 must produce identical output to current behavior.** The existing researcher agents work without any source injection. When `research:collect` returns tier 4 (empty sources), the workflow must NOT modify the agent prompt at all — ensuring zero regression.

### Pattern 5: Agent Integration via Workflow Modification

**What:** Modify `workflows/research-phase.md` to call `research:collect` before spawning the researcher, and inject collected sources into the agent prompt.
**When to use:** Every research invocation (the collect step is a no-op at Tier 4).

```markdown
## Step 3.5: Collect Research Sources (NEW)

```bash
SOURCES=$(node $GSD_HOME/bin/gsd-tools.cjs research:collect "${QUERY}" 2>/dev/null)
TIER=$(echo "$SOURCES" | jq -r '.tier // 4')
AGENT_CONTEXT=$(echo "$SOURCES" | jq -r '.agent_context // ""')
```

If TIER < 4 and AGENT_CONTEXT is non-empty:
  Inject into researcher prompt as additional context:
  ```
  <additional_context>
  Phase description: {description}
  
  ${AGENT_CONTEXT}
  </additional_context>
  ```

If TIER == 4:
  Use existing prompt unchanged (zero regression).
```

### Pattern 6: Progressive Status Output

**What:** Write progress messages to stderr so the user sees pipeline stages even when stdout is piped to JSON.
**When to use:** Each stage of source collection.

```javascript
// Uses existing status() function from output.js
// status() writes to stderr — visible to user, doesn't contaminate JSON stdout

status('[1/3] Collecting web sources... (~30s timeout)');
// ... collect web
status('[2/3] Searching YouTube... (~30s timeout)');
// ... collect youtube  
status('[3/3] Context7: available to agent directly via MCP');
// ... done
status(`Research collection complete: ${sources.length} sources, Tier ${tier.number} (${timing.total_ms}ms)`);
```

### Pattern 7: Quick Flag Implementation

**What:** `--quick` flag bypasses the entire pipeline.
**When to use:** Speed-sensitive workflows, development/testing, environments without tools.

```javascript
// In cmdResearchCollect:
if (args.includes('--quick')) {
  output({ tier: 4, tier_name: 'Pure LLM', skipped: 'quick_flag', sources: [], timing: {} }, ...);
  return;
}

// In workflow (research-phase.md):
// --quick flag is passed through from the slash command to gsd-tools
// The workflow checks: if quick flag present, skip research:collect entirely
```

### Anti-Patterns to Avoid

- **Don't use async/await for subprocess calls.** The project uses `execFileSync` exclusively. Don't introduce `child_process.exec` with promises — it would break the synchronous execution model.
- **Don't call MCP servers from gsd-tools.** MCP servers (Brave Search, Context7) are available to the *agent*, not to the CLI tool. The CLI tool calls `util:websearch` which uses the Brave Search API key, but Context7 is an MCP server that the agent uses directly. Don't try to invoke MCP servers from subprocess.
- **Don't require NotebookLM for Phase 58.** NotebookLM integration is Phase 59. This phase must work at Tier 2/3/4 only. The pipeline architecture should have a clear extension point for Tier 1 to be added in Phase 59.
- **Don't modify existing command signatures.** `cmdResearchYtSearch` and `cmdResearchYtTranscript` must keep their current signatures and behavior. The orchestrator calls them as subprocesses, not as function imports.
- **Don't inject sources into agent prompt at Tier 4.** This would change the researcher's behavior and potentially degrade quality. Tier 4 must be byte-identical to current behavior.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tool detection | Custom PATH scanning | Existing `detectCliTools()` + `detectMcpServers()` | Already handles config overrides, binary fallbacks, MCP config shapes |
| Tier calculation | New tier logic | Existing `calculateTier()` | DRY — shared between capabilities, init, and now collect |
| Web search | HTTP client | Existing `util:websearch` command (Brave Search API) | Already handles API key, response parsing, error handling |
| YouTube search | YouTube API client | Existing `research:yt-search` command | Already handles yt-dlp subprocess, quality scoring, filtering |
| Transcript extraction | Custom subtitle parser | Existing `research:yt-transcript` command | Already handles VTT parsing, deduplication, temp dir lifecycle |
| Progress output | Custom progress bar | Existing `status()` function (stderr) | Standard pattern across all commands |
| Output formatting | Custom renderer | Existing `output()` + `formatTable()` pattern | Consistent with all other commands |

**Key insight:** Phase 58 is primarily an *orchestration* layer. Almost all the actual functionality already exists from Phases 56-57. The new code coordinates existing pieces, adds the `agent_context` formatting, and modifies the workflow.

## Common Pitfalls

### Pitfall 1: Subprocess Timeout Cascading

**What goes wrong:** Each subprocess call has a timeout. If web search takes 25s and YouTube takes 25s, total pipeline time is 50s — exceeding user patience.
**Why it happens:** Sequential `execFileSync` calls with independent timeouts.
**How to avoid:** Use a per-stage timeout that's a fraction of `rag_timeout`. E.g., if `rag_timeout` is 30s, allocate 15s to web, 15s to YouTube. Or use `rag_timeout` as the total budget and reduce per-stage limits proportionally.
**Warning signs:** Pipeline consistently takes >30s; users abandon research.

### Pitfall 2: MCP Server vs CLI Subprocess Confusion

**What goes wrong:** Trying to call Context7 from gsd-tools.cjs as a subprocess.
**Why it happens:** Context7 and Brave Search are *MCP servers* — they're available to the host editor's agent, not to CLI subprocesses. Only `util:websearch` wraps Brave Search as a CLI command.
**How to avoid:** For web search, call `util:websearch` (which uses Brave Search API directly). For Context7, note its availability in the output but let the agent use it via MCP tools. Don't try to invoke MCP servers from the CLI.
**Warning signs:** "MCP server not found" errors, empty Context7 results from CLI.

### Pitfall 3: Breaking Existing Researcher Behavior (Zero Regression)

**What goes wrong:** Researchers produce different (worse) output when RAG pipeline fails.
**Why it happens:** Error handling injects error messages into the prompt, or empty-source formatting injects empty XML tags.
**How to avoid:** At Tier 4, `agent_context` is empty string `""`. The workflow checks: if empty, do NOT inject anything. The researcher prompt is unchanged. Test this explicitly.
**Warning signs:** Research quality degrades when tools are absent; users report different output.

### Pitfall 4: Bundle Size Bloat

**What goes wrong:** Adding orchestration code pushes bundle past 1500KB budget.
**Why it happens:** Verbose code, excessive inline constants, duplicated patterns.
**How to avoid:** The orchestration layer is lightweight — it coordinates subprocesses, doesn't do heavy computation. Estimate: ~150-200 lines of new code (~3-5KB). Current bundle is 1170KB, budget is 1500KB. Well within limits.
**Warning signs:** `wc -c bin/gsd-tools.cjs` exceeds 1300KB after build.

### Pitfall 5: stdout Contamination from Subprocess

**What goes wrong:** Subprocess stderr output leaks into parent's stdout, corrupting JSON output.
**Why it happens:** `execFileSync` with `stdio: 'pipe'` captures both stdout and stderr, but stderr is discarded. If a subprocess writes to stdout AND stderr, only stdout is returned. But if the subprocess writes non-JSON to stdout, parsing fails.
**How to avoid:** All gsd-tools commands that produce JSON write ONLY JSON to stdout. Status messages go to stderr. The `stdio: 'pipe'` option in `execFileSync` correctly separates them. Verify subprocess calls capture only stdout.
**Warning signs:** JSON.parse errors on subprocess output.

## Code Examples

### Example 1: Complete research:collect Command Registration

```javascript
// In src/router.js — research namespace case block
case 'research': {
  if (subCmd === 'capabilities') {
    lazyResearch().cmdResearchCapabilities(cwd, restArgs, raw);
  } else if (subCmd === 'yt-search') {
    lazyResearch().cmdResearchYtSearch(cwd, restArgs, raw);
  } else if (subCmd === 'yt-transcript') {
    lazyResearch().cmdResearchYtTranscript(cwd, restArgs, raw);
  } else if (subCmd === 'collect') {                              // NEW
    lazyResearch().cmdResearchCollect(cwd, restArgs, raw);        // NEW
  } else {
    error('Unknown research subcommand. Available: capabilities, yt-search, yt-transcript, collect');
  }
  break;
}
```

### Example 2: Workflow Modification (research-phase.md)

```markdown
## Step 3.5: Collect Research Sources (if RAG enabled)

If research config is enabled and --quick flag is NOT set:

```bash
COLLECT_OUTPUT=$(node $GSD_HOME/bin/gsd-tools.cjs research:collect "${PHASE_DESCRIPTION}" 2>/dev/null)
```

Extract: tier, agent_context from JSON output.

If agent_context is non-empty, prepend to the researcher prompt's <additional_context>:

```
<additional_context>
Phase description: {description}

{agent_context}
</additional_context>
```

If agent_context is empty or collection failed, use existing prompt unchanged.
```

### Example 3: Expected JSON Output Shape

```json
{
  "tier": 2,
  "tier_name": "Sources without synthesis",
  "query": "Node.js subprocess patterns parallel execution",
  "source_count": 4,
  "sources": [
    {
      "type": "web",
      "title": "Node.js child_process best practices",
      "url": "https://example.com/article",
      "snippet": "Use execFileSync for...",
      "source": "brave_search"
    },
    {
      "type": "youtube",
      "title": "Advanced Node.js Patterns",
      "url": "https://www.youtube.com/watch?v=abc123",
      "channel": "Fireship",
      "duration": 912,
      "quality_score": 78,
      "transcript": "Today we're going to look at...[truncated]",
      "source": "yt-dlp"
    }
  ],
  "timing": {
    "web_ms": 2150,
    "youtube_ms": 8400,
    "context7_available": true,
    "total_ms": 10550
  },
  "agent_context": "<collected_sources>\n<research_query>Node.js subprocess patterns parallel execution</research_query>\n\n<source type=\"web\" title=\"Node.js child_process best practices\" url=\"https://example.com/article\">\nUse execFileSync for...\n</source>\n\n<source type=\"youtube\" title=\"Advanced Node.js Patterns\" url=\"https://www.youtube.com/watch?v=abc123\" channel=\"Fireship\">\nToday we're going to look at...[truncated]\n</source>\n\n</collected_sources>"
}
```

### Example 4: TTY Formatted Output

```
╔══════════════════════════════════════╗
║       Research Collection            ║
╚══════════════════════════════════════╝

Research Tier: 2 — Sources without synthesis
Query: Node.js subprocess patterns

── Sources Collected ──────────────────
  ┌───────┬─────────────────────────────────────────┬──────────────┐
  │ Type  │ Title                                   │ Source       │
  ├───────┼─────────────────────────────────────────┼──────────────┤
  │ web   │ Node.js child_process best practices    │ brave_search │
  │ web   │ Parallel exec in Node.js                │ brave_search │
  │ yt    │ Advanced Node.js Patterns               │ yt-dlp       │
  └───────┴─────────────────────────────────────────┴──────────────┘

── Timing ─────────────────────────────
  Web search:  2.1s
  YouTube:     8.4s
  Total:       10.6s
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Agent uses only training data | Agent can receive collected sources | Phase 58 (new) | Better research quality with real sources |
| No source collection | Brave Search + YouTube sources | Phase 56-57 built primitives | Research grounded in current data |
| No degradation | 4-tier automatic degradation | Phase 56 calculateTier() | Works everywhere, better with tools |
| No status feedback | Progressive stderr status | Phase 58 (new) | User sees pipeline progress |

**Important note on "parallel" collection:** This project uses `execFileSync` (synchronous, blocking) for all subprocess calls. True OS-level parallelism would require `child_process.spawn` or `child_process.exec` with callbacks/promises. This is explicitly NOT the project pattern. The "parallel where possible" requirement from ORCH-04 should be interpreted as "sequential with progress output" for the CLI tool, and "the agent can make parallel MCP calls" for the Context7/Brave Search MCP servers. The CLI orchestrator runs sources sequentially.

## Open Questions

1. **Context7 collection: agent-side or CLI-side?**
   - What we know: Context7 is an MCP server. The CLI tool can't invoke MCP servers directly. The agent (gsd-phase-researcher) can use Context7 via MCP tools.
   - What's unclear: Should the workflow instruct the agent to use Context7 in addition to collected sources? Or should the collected sources be sufficient?
   - Recommendation: Add a note in the workflow that Context7 is available to the agent via MCP tools. The agent can use it directly if the MCP server is configured. The CLI's `research:collect` focuses on Brave Search (via websearch command) and YouTube (via yt-dlp).

2. **Transcript length for agent context**
   - What we know: YouTube transcripts can be 5,000-20,000+ chars. Context window budget matters.
   - What's unclear: Optimal truncation point for transcript excerpts in agent context.
   - Recommendation: Default to 3,000 chars (~750 words, ~5 min of speech). Make configurable via `--transcript-limit` flag. Monitor token usage during testing and adjust.

3. **Number of YouTube videos to transcribe**
   - What we know: Transcript extraction takes 5-15s per video. Multiple videos compound latency.
   - What's unclear: Whether 1 transcript (top-scored) or 2-3 transcripts provide meaningfully better research.
   - Recommendation: Start with top 1 video only. Each additional video adds ~10s latency with diminishing returns. The search results listing (without transcripts) for top 3 is cheap and included.

## Sources

### Primary (HIGH confidence)
- `src/commands/research.js` — Current implementation (993 lines), all existing patterns
- `src/router.js` — Namespace routing pattern for research commands
- `src/lib/output.js` — `output()`, `status()`, `debugLog()` patterns
- `src/lib/config.js` — `loadConfig()` pattern for rag_enabled, rag_timeout
- `.planning/phases/56-foundation-and-config/56-01-SUMMARY.md` — detectCliTools, detectMcpServers
- `.planning/phases/56-foundation-and-config/56-02-SUMMARY.md` — calculateTier, capabilities command
- `.planning/phases/57-youtube-integration/57-01-SUMMARY.md` — yt-search command
- `.planning/phases/57-youtube-integration/57-02-SUMMARY.md` — yt-transcript command
- Anthropic official docs: [Use XML tags to structure prompts](https://docs.claude.com/en/docs/use-xml-tags) — XML tag structuring for multi-source context

### Secondary (MEDIUM confidence)
- RAG pipeline best practices (multiple sources, 2025-2026): XML-tagged source format, 200-1000 token chunks, source attribution
- Node.js `Promise.allSettled` pattern docs — parallel execution patterns (not used here due to execFileSync, but informs understanding)

### Tertiary (LOW confidence)
- Optimal transcript truncation length (3000 chars) — empirical estimate, needs validation with actual agent runs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — building entirely on existing patterns, no new dependencies
- Architecture: HIGH — straightforward orchestration of existing commands via subprocess
- Tier 2 format (XML tags): HIGH — backed by Anthropic's official docs on XML tag structuring
- Transcript truncation: LOW — 3000 char default is a reasonable estimate, needs empirical validation
- Pitfalls: HIGH — identified from analyzing existing codebase patterns and project decisions

**Research date:** 2026-03-02
**Valid until:** 2026-04-01 (stable — all patterns are internal to the project)
