# Phase 83: Search & Discovery - Research

**Researched:** 2026-03-10
**Domain:** CLI tool integration (ripgrep, fd, jq)
**Confidence:** HIGH

## Summary

Phase 83 integrates ripgrep, fd, and jq CLI tools for accelerated content search and file discovery. Building on Phase 82's detection infrastructure, this phase adds functional wrappers that output JSON for programmatic parsing, respect .gitignore patterns, and compose into efficient pipelines. The recommended approach uses execFileSync for shell-injection prevention, implements file-first pipeline ordering (fd → ripgrep) to reduce search space early, and provides graceful fallback to Node.js implementations when tools are unavailable.

**Primary recommendation:** Create `src/lib/cli-tools/ripgrep.js`, `src/lib/cli-tools/fd.js`, `src/lib/cli-tools/jq.js` modules using the Phase 82 fallback wrapper pattern, with JSON output parsing and pipeline support.

---

## User Constraints

*(From 83-CONTEXT.md)*

### Implementation Decisions
- **Sequential pipelines** — tools chain together for common search patterns
- **Default order: file-first (fd → ripgrep)** — filter files first to reduce search space early
- **Shell pipeline execution** — use OS pipes between tool processes for efficiency

### Agent's Discretion
- Specific jq filter expressions for common transformations
- How to handle edge cases in pipeline (e.g., no files found by fd)
- Fallback behavior if any tool in pipeline fails

### Specific Ideas
- "whatever is more efficient" — efficiency is the primary goal for pipeline ordering
- File-first approach reduces search space early by filtering files before content search

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ripgrep (rg) | Latest (v14+) | Content search with JSON output | 10-100x faster than Node.js regex |
| fd | Latest | File discovery respecting .gitignore | 5-20x faster than fast-glob |
| jq | Latest | JSON transformation in pipelines | Standard CLI JSON processor |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| detector.js | Phase 82 | Tool availability checking with caching | Always, before using CLI tools |
| fallback.js | Phase 82 | Graceful fallback wrapper | Always, for graceful degradation |
| install-guidance.js | Phase 82 | Platform-specific install commands | When tool unavailable |

### Prerequisites

Phase 82 delivered:
- `src/lib/cli-tools/detector.js` — Tool detection with 5-min TTL cache
- `src/lib/cli-tools/install-guidance.js` — Platform-specific install commands
- `src/lib/cli-tools/fallback.js` — Graceful fallback wrapper pattern

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| execSync with shell: true | execFileSync with array args | More complex but safer against injection |
| grep (built-in) | ripgrep | ripgrep 10-100x faster, respects .gitignore |
| find (built-in) | fd | fd 5-20x faster, better filtering options |
| Node.js JSON.parse | jq | jq handles streaming, large files better |

---

## Architecture Patterns

### Recommended Project Structure

```
src/lib/cli-tools/
├── detector.js         # Phase 82 - tool detection
├── install-guidance.js # Phase 82 - install commands
├── fallback.js         # Phase 82 - fallback wrapper
├── ripgrep.js         # NEW - ripgrep wrapper with JSON output
├── fd.js              # NEW - fd wrapper with .gitignore
├── jq.js              # NEW - jq wrapper for pipelines
└── index.js           # NEW - unified exports
```

### Pattern 1: CLI Tool Wrapper with Fallback

```javascript
const { detectTool } = require('./detector.js');
const { withToolFallback } = require('./fallback.js');

function searchRipgrep(pattern, options = {}) {
  const args = ['--json', pattern, ...options.paths || ['.']];
  if (options.ignoreCase) args.unshift('-i');
  if (options.glob) args.push('--glob', options.glob);
  
  const result = execFileSync('rg', args, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: options.timeout || 30000,
    cwd: options.cwd
  });
  
  return parseRipgrepJson(result);
}

function parseRipgrepJson(output) {
  const lines = output.split('\n').filter(line => line.trim());
  return lines
    .map(line => JSON.parse(line))
    .filter(obj => obj.type === 'match')
    .map(match => ({
      path: match.data.path.text,
      lineNumber: match.data.line_number,
      line: match.data.lines.text,
      offset: match.data.absolute_offset
    }));
}
```

### Pattern 2: File-First Pipeline (fd → ripgrep)

```javascript
async function searchInFiles(pattern, filePattern, options = {}) {
  // Step 1: Discover files with fd
  const files = await fdFind({
    pattern: filePattern,
    type: 'f',
    exclude: options.exclude
  });
  
  if (files.length === 0) {
    return { success: true, results: [], note: 'No files found matching pattern' };
  }
  
  // Step 2: Search in files with ripgrep
  const results = await ripgrepSearch(pattern, {
    paths: files,
    ignoreCase: options.ignoreCase
  });
  
  return { success: true, results };
}
```

### Pattern 3: Pipeline with jq Transformation

```javascript
function transformWithJq(inputJson, filterExpression) {
  const result = execFileSync('jq', ['-c', filterExpression], {
    input: inputJson,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
  return result;
}
```

### Anti-Patterns to Avoid

1. **Shell injection via string concatenation** — Never build command strings with user input
2. **No error handling for missing tools** — Always check tool availability first
3. **Ignoring .gitignore by default** — fd respects .gitignore by default; don't disable without reason
4. **Processing huge JSON in memory** — Use jq streaming for large files (`--stream`)
5. **No timeout on long-running searches** — Set reasonable timeouts (30s default)
6. **Assuming tools are installed** — Phase 82 infrastructure must be used for detection

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON parsing | Custom regex parser | ripgrep --json + JSON.parse | Structured, extensible |
| File discovery | Custom glob walker | fd | Respects .gitignore, faster |
| JSON transformation | Custom map/filter | jq | Industry standard, efficient |
| Tool detection | Custom which wrapper | detector.js | Cached, tested |
| Fallback logic | try/catch everywhere | fallback.js | Consistent pattern |

---

## Common Pitfalls

### Pitfall 1: ripgrep JSON output is JSON Lines (not a single JSON array)
**What goes wrong:** Parsing `JSON.parse(output)` fails because output is multiple JSON objects on separate lines.
**Why it happens:** ripgrep `--json` outputs JSON Lines format (one JSON object per line).
**How to avoid:** Split by newline, filter empty lines, parse each line individually.
**Warning signs:** "Unexpected token { in JSON at position 0" errors.

### Pitfall 2: fd returns empty results silently
**What goes wrong:** No matches returns empty array, no error.
**Why it happens:** fd is designed to be silent when no matches found.
**How to avoid:** Check result length, provide informative message if empty.
**Warning signs:** Downstream ripgrep receives empty file list, searches current directory.

### Pitfall 3: Large output causes memory issues
**What goes wrong:** ripgrep output for large repositories causes memory exhaustion.
**Why it happens:** Collecting all results in memory before processing.
**How to avoid:** Use streaming patterns, jq `--stream`, or limit results with `--max-count`.
**Warning signs:** "JavaScript heap out of memory" errors.

### Pitfall 4: Tool not installed causes uncaught error
**What goes wrong:** execFileSync throws when tool binary not found.
**Why it happens:** execFileSync doesn't check tool availability first.
**How to avoid:** Always use `detectTool()` or `withToolFallback()` before executing.
**Warning signs:** "ENOENT: no such file or directory" errors.

### Pitfall 5: Pipeline fails if any tool fails
**What goes wrong:** fd finds no files, ripgrep never runs, unclear what happened.
**Why it happens:** Each tool in pipeline has independent error handling.
**How to avoid:** Wrap pipeline in try/catch, provide diagnostic info at each stage.

### Pitfall 6: Missing .gitignore respect
**What goes wrong:** Search includes node_modules, dist, or other ignored directories.
**Why it happens:** Using raw find/glob instead of fd.
**How to avoid:** fd respects .gitignore by default; use `-I` only when explicitly needed.

---

## Code Examples

### ripgrep with JSON Output

```javascript
// Simple search with JSON output
const result = execFileSync('rg', ['--json', 'TODO', '.'], {
  encoding: 'utf8',
  stdio: ['pipe', 'pipe', 'pipe']
});

// Parse JSON Lines
const matches = result
  .split('\n')
  .filter(line => line.trim())
  .map(line => JSON.parse(line))
  .filter(obj => obj.type === 'match');

// Extract useful data
const useful = matches.map(m => ({
  file: m.data.path.text,
  line: m.data.line_number,
  text: m.data.lines.text.trim()
}));
```

### ripgrep JSON Output Format (from official docs)

```
{"type":"begin","data":{"path":{"text":"file.txt"}}}
{"type":"match","data":{"path":{"text":"file.txt"},"lines":{"text":"matched line"},"line_number":42,"absolute_offset":1337,"submatches":[{"match":{"text":"pattern"},"start":0,"end":7}]}}
{"type":"end","data":{"path":{"text":"file.txt"},"binary_offset":null,"stats":{...}}}
```

### fd with .gitignore

```javascript
// Basic file discovery (respects .gitignore by default)
const files = execFileSync('fd', ['-e', 'js', '-e', 'ts'], {
  encoding: 'utf8',
  stdio: ['pipe', 'pipe', 'pipe']
}).split('\n').filter(f => f);

// Include hidden files
execFileSync('fd', ['-H', 'pattern']);

// Ignore .gitignore
execFileSync('fd', ['-I', 'pattern']);

// By file type
execFileSync('fd', ['-t', 'f']);  // files only
execFileSync('fd', ['-t', 'd']);  // directories only
```

### jq in Pipeline

```bash
# Extract file paths from ripgrep JSON
rg --json pattern | jq -r 'select(.type == "match") | .data.path.text'

# Transform ripgrep output to array of objects
rg --json pattern | jq -c '[inputs | select(.type == "match") | {file: .data.path.text, line: .data.line_number}]'

# Filter by condition
echo '[1,2,3,4]' | jq 'map(select(. > 2))'

# Handle errors gracefully
echo 'invalid' | jq '. as $line | try fromjson catch $line'
```

### Error Handling Pattern

```javascript
const { detectTool } = require('./detector.js');
const { execFileSync } = require('child_process');

function safeRipgrep(pattern, options = {}) {
  const tool = detectTool('ripgrep');
  
  if (!tool.available) {
    return {
      success: false,
      usedFallback: true,
      guidance: getInstallGuidance('ripgrep'),
      error: 'ripgrep not available'
    };
  }
  
  try {
    const result = execFileSync('rg', ['--json', pattern], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: options.timeout || 30000
    });
    
    return { success: true, result: parseJsonLines(result) };
  } catch (error) {
    // ripgrep returns non-zero for no matches, which throws
    if (error.status === 1) {
      return { success: true, result: [] };  // No matches
    }
    return { success: false, error: error.message };
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Node.js regex search | ripgrep --json | v9.2 Phase 83 | 10-100x speedup |
| fast-glob / find | fd | v9.2 Phase 83 | 5-20x speedup |
| JSON.stringify + parse | jq | v9.2 Phase 83 | Streaming support |
| grep -r | ripgrep | Pre-v9.2 | Default search tool |

---

## Open Questions

1. **Should pipelines support async streaming?** Current pattern uses execFileSync (synchronous). For very large outputs, streaming via child_process spawn might be better.

2. **How to handle very large repositories?** Need result limiting (`--max-count`), pagination, or streaming. Not addressed in Phase 83 scope.

3. **Should fd support custom ignore files?** Beyond .gitignore, fd supports `.fdignore`. Not required for v9.2.

---

## Sources

### Primary (HIGH confidence)

- ripgrep official documentation — JSON output format, CLI options
- fd official documentation — .gitignore integration, CLI options
- jq official documentation — Filter expressions, streaming

### Secondary (MEDIUM confidence)

- Phase 82 implementation — detector.js, fallback.js patterns
- Context7 code examples — JSON Lines parsing patterns

### Tertiary (LOW confidence)

- Stack Overflow / jq cookbook — Edge case handling
- Community patterns — Pipeline composition

---

## Phase Requirements

| Requirement | Description | Status |
|-------------|-------------|--------|
| CLI-04 | User can use ripgrep for content search with --json output for parsing | Pending |
| CLI-05 | User can use fd for file discovery with .gitignore respect | Pending |
| CLI-06 | User can use jq for JSON processing in CLI pipelines | Pending |

---

## Metadata

**Confidence breakdown:**
- Tool integration patterns: HIGH (validated by Phase 82 infrastructure)
- JSON output parsing: HIGH (documented by ripgrep)
- .gitignore behavior: HIGH (documented by fd)
- Pipeline composition: MEDIUM (based on shell patterns, needs implementation validation)

**Research date:** 2026-03-10
**Valid until:** v9.2 milestone completion
