# Roadmap: bGSD Plugin v9.2 CLI Tool Integrations & Runtime Modernization

## Overview

This milestone expands CLI tool integrations for faster operations and explores Bun runtime for significant startup improvements.

## Milestones

- ⏳ **v9.2 CLI Tool Integrations & Runtime Modernization** - Phases 82-85 (in progress)
- ✅ **v9.1 Performance Acceleration** - Phases 77-81 (completed 2026-03-10) — see `.planning/milestones/v9.1-ROADMAP.md`
- ✅ Previous milestones shipped - see `.planning/MILESTONES.md`

## Phases

- [ ] **Phase 82: Tool Detection Infrastructure** - CLI tool availability detection, caching, install guidance, graceful fallback
- [ ] **Phase 83: Search & Discovery** - ripgrep, fd, jq integrations with JSON output
- [ ] **Phase 84: Extended Tools** - yq, bat, gh CLI integrations
- [ ] **Phase 85: Runtime Exploration** - Bun runtime detection, compatibility docs, benchmarking

---

## Phase Details

### Phase 82: Tool Detection Infrastructure

**Goal:** Users can detect available CLI tools and receive helpful guidance when tools are unavailable

**Depends on:** Nothing (first phase)

**Requirements:** CLI-01, CLI-02, CLI-03

**Success Criteria** (what must be TRUE):
  1. User can run a command to see which CLI tools (ripgrep, fd, jq, yq, bat, gh) are available vs unavailable
  2. When a CLI tool is unavailable, the user sees clear, platform-specific install instructions
  3. When a CLI tool is unavailable, operations gracefully fall back to existing Node.js implementations without errors

**Plans:** 82-01 (Tool Detection Infrastructure)

---

### Phase 83: Search & Discovery

**Goal:** Users can use ripgrep, fd, and jq for faster content search and file discovery

**Depends on:** Phase 82 (Tool Detection Infrastructure)

**Requirements:** CLI-04, CLI-05, CLI-06

**Success Criteria** (what must be TRUE):
  1. User can run ripgrep searches and receive JSON-formatted output suitable for parsing
  2. User can run fd file discovery commands that respect .gitignore patterns
  3. User can pipe JSON data through jq for transformation and extraction in CLI pipelines

**Plans:** TBD

---

### Phase 84: Extended Tools

**Goal:** Users can use yq, bat, and gh for YAML processing, syntax-highlighted output, and GitHub operations

**Depends on:** Phase 83 (Search & Discovery)

**Requirements:** CLI-07, CLI-08, CLI-09

**Success Criteria** (what must be TRUE):
  1. User can process YAML files with yq for extraction and transformation
  2. User can view file contents with syntax highlighting via bat
  3. User can perform GitHub operations (list PRs, view issues) via gh CLI with proper auth handling

**Plans:** TBD

---

### Phase 85: Runtime Exploration

**Goal:** Users can detect Bun runtime availability and benchmark startup performance compared to Node.js

**Depends on:** Phase 84 (Extended Tools)

**Requirements:** RUNT-01, RUNT-02, RUNT-03

**Success Criteria** (what must be TRUE):
  1. User can detect if Bun runtime is available on their system
  2. User can view documentation of Bun compatibility and known limitations with the plugin
  3. User can run a benchmark command comparing Node.js vs Bun startup time for the plugin

**Plans:** TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 82. Tool Detection Infrastructure | 1/1 | Planned | - |
| 83. Search & Discovery | 0/1 | Not started | - |
| 84. Extended Tools | 0/1 | Not started | - |
| 85. Runtime Exploration | 0/1 | Not started | - |

---

## Requirement Coverage

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLI-01: Tool detection with caching | Phase 82 | Pending |
| CLI-02: Install instructions when unavailable | Phase 82 | Pending |
| CLI-03: Graceful fallback to Node.js | Phase 82 | Pending |
| CLI-04: ripgrep with --json output | Phase 83 | Pending |
| CLI-05: fd with .gitignore respect | Phase 83 | Pending |
| CLI-06: jq for JSON processing | Phase 83 | Pending |
| CLI-07: yq for YAML processing | Phase 84 | Pending |
| CLI-08: bat for syntax-highlighted output | Phase 84 | Pending |
| CLI-09: gh CLI for GitHub operations | Phase 84 | Pending |
| RUNT-01: Bun runtime detection | Phase 85 | Pending |
| RUNT-02: Bun compatibility documentation | Phase 85 | Pending |
| RUNT-03: Node vs Bun benchmark | Phase 85 | Pending |

---

*Roadmap created: 2026-03-10*
*Last updated: 2026-03-10*
