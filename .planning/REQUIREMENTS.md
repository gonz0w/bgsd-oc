# Requirements — v8.1 RAG-Powered Research Pipeline

## YouTube Integration

- [x] **YT-01**: User can search YouTube for developer content via yt-dlp `ytsearch:` prefix and receive structured metadata (title, duration, views, channel, upload date, video ID)
- [x] **YT-02**: User can extract transcripts from YouTube videos via yt-dlp auto/manual subtitle download with built-in VTT-to-text parser
- [x] **YT-03**: User can filter YouTube search results by recency, duration, view count, and channel allowlist before expensive transcript extraction

## NotebookLM Integration

- [x] **NLM-01**: User can create NotebookLM notebooks and add sources (URLs, YouTube URLs, plain text, PDFs) via notebooklm-py CLI
- [x] **NLM-02**: User can ask domain-specific questions against loaded notebook sources and receive grounded, cited answers via NotebookLM chat synthesis
- [x] **NLM-03**: User can generate structured research reports (briefing docs, study guides) from NotebookLM notebooks
- [x] **NLM-04**: System checks NotebookLM auth health (cookie validity) before operations and provides clear re-auth messaging when expired

## Research Orchestration

- [x] **ORCH-01**: Research pipeline collects sources from Brave Search, Context7, YouTube, and NotebookLM in a defined sequence with structured output
- [x] **ORCH-02**: Pipeline degrades gracefully through 4 tiers (Full RAG → Sources without synthesis → Brave/Context7 only → Pure LLM) based on available tools
- [x] **ORCH-03**: Researcher agents (gsd-project-researcher, gsd-phase-researcher) use new RAG pipeline when tools are available, with no regression when tools are absent
- [x] **ORCH-04**: Pipeline provides progressive output at each stage with time estimates and parallel source collection
- [x] **ORCH-05**: User can skip RAG pipeline entirely via `--quick` flag for speed-sensitive research workflows

## Infrastructure & Configuration

- [x] **INFRA-01**: config.json schema extended with RAG settings (rag_enabled, tool paths, search parameters, research timeout)
- [x] **INFRA-02**: `research:capabilities` command reports available tools, current degradation tier, and missing tool recommendations
- [ ] **INFRA-03**: Research results (notebook IDs, synthesis outputs, transcripts) cached in v8.0 SQLite cache to avoid re-running expensive operations
- [x] **INFRA-04**: System detects available research MCP servers (Brave Search, Context7, Exa) and recommends missing ones
- [ ] **INFRA-05**: Interrupted research sessions can be saved and resumed via session persistence file

## Future Requirements (deferred to v8.2+)

- HackerNews Algolia API integration
- Internationalized YouTube search (non-English)
- Advanced NotebookLM features (deep research mode, source guide extraction)
- Exa MCP server implementation (recommend in docs, defer code)
- Research result non-determinism mitigation beyond source logging

## Out of Scope

- **Local vector store / embedding pipeline** — wrong architecture for CLI; NotebookLM is the external RAG engine
- **YouTube HTML scraping** — fragile, ToS risk; yt-dlp is the established tool
- **LangChain.js / LlamaIndex.js** — too heavy, overengineered for subprocess-based pipeline
- **Real-time content monitoring / watch mode** — CLI is short-lived by design
- **YouTube Data API v3 integration** — requires API key, quota management; yt-dlp handles all use cases

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| YT-01 | Phase 57 | Complete |
| YT-02 | Phase 57 | Complete |
| YT-03 | Phase 57 | Complete |
| NLM-01 | Phase 59 | Complete |
| NLM-02 | Phase 59 | Complete |
| NLM-03 | Phase 59 | Complete |
| NLM-04 | Phase 59 | Complete |
| ORCH-01 | Phase 58 | Complete |
| ORCH-02 | Phase 58 | Complete |
| ORCH-03 | Phase 58 | Complete |
| ORCH-04 | Phase 58 | Complete |
| ORCH-05 | Phase 58 | Complete |
| INFRA-01 | Phase 56 | Complete |
| INFRA-02 | Phase 56 | Complete |
| INFRA-03 | Phase 60 | Pending |
| INFRA-04 | Phase 56 | Complete |
| INFRA-05 | Phase 60 | Pending |
