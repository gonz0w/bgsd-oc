# Phase 147: Security Audit Workflow - Research

**Researched:** 2026-03-28
**Domain:** CLI-first security audit scanning for OWASP-style code risks, secrets detection, and dependency vulnerability checks
**Confidence:** MEDIUM

## User Constraints

These constraints are locked by `147-CONTEXT.md`, phase requirements, and repo conventions, and should drive the implementation:

- Start with **core-signal coverage**, not a broad low-precision security sweep.
- Cover the phase promise directly: **OWASP-style code risks, secrets detection, and dependency vulnerability checks**.
- Output must be **action-first**, grouped by severity, with confidence, file/location, rationale, and next-step guidance.
- Show **high- and medium-confidence** findings; confidence must be explicit.
- Exclusions must stay **narrow and auditable at the finding level**; do not allow broad rule-wide or project-wide suppressions in v1.
- Secret-like values are flagged by default across the repo; users manage known fixtures and samples via explicit allowlisting.
- Match repo architecture: **CLI-first, deterministic JSON output, human-readable markdown artifacts, low ceremony, backward compatibility, path-agnostic behavior, and no dependency-heavy runtime design**.
- Phase 147 should **mirror Phase 146's scan-first / workflow-second pattern** rather than inventing a separate architecture.

### Phase Requirements

| ID | Requirement | Implementation Impact |
|----|-------------|-----------------------|
| SEC-01 | OWASP Top 10 pattern library | Need a curated, high-signal rule inventory mapped to OWASP categories, not full SAST parity |
| SEC-02 | Secrets-in-code detection with allowlist | Need deterministic secret fingerprinting, redacted reporting, and explicit allowlist handling |
| SEC-03 | Dependency vulnerability checks | Need manifest/lock parsing plus advisory lookup with severity/remediation metadata |
| SEC-04 | `/bgsd-security` orchestrates CLI + verifier agent | Need stable JSON contract, centralized confidence gate, and independent verification fields |
| SEC-05 | `.planning/security-exclusions.json` with reason + expiry | Need exact-match suppression schema and expiry validation before final output |

## Summary

Implement Phase 147 as a **multi-engine, CLI-first security pipeline** that reuses the Phase 146 architecture: resolve scan scope, collect deterministic findings from specialized engines, normalize them into one schema, apply exclusions, confidence-gate the results, and let `/bgsd-security` orchestrate any higher-judgment verification or user interaction. The important design choice is to keep the workflow unified while keeping the scanners separate: **code-pattern rules**, **secret detection**, and **dependency advisory checks** should each have their own detector logic but emit the same finding shape.

For v1, the established ecosystem pattern is **not** to build a full-blown cross-language taint-analysis engine. Current practice is layered: high-signal structural rules for code risks, regex-plus-entropy style secret detection, and advisory-backed dependency checks. Semgrep, Gitleaks, and OSV-Scanner each specialize in one of those layers. In this repo, the right adaptation is to copy the architecture pattern, not the runtime stack: keep bGSD zero-dependency and deterministic by using in-repo rule registries plus HTTP queries to an advisory source, instead of embedding large scanners as mandatory runtime dependencies.

The biggest "unknown unknown" for planning is that **dependency vulnerability accuracy depends heavily on version resolution quality**. `package.json` ranges, `requirements.txt` specifiers, and `go.mod` constraints are not equivalent to resolved lockfile versions. If the implementation reports vulnerabilities from unconstrained semver/specifier data as if they were resolved package facts, it will create noisy results fast. The plan should therefore treat dependency evidence quality as part of confidence scoring.

**Primary recommendation:** Build `security:scan` as three deterministic engines (OWASP rules, secrets, dependency advisory lookup) sharing Phase 146's routing/exclusion/reporting pipeline, and keep v1 intentionally high-signal instead of trying to match commercial SAST breadth.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins (`fs`, `path`, `crypto`, `https`, `child_process`) | Project runtime | File reads, hashing/fingerprints, HTTP advisory queries, optional Git-backed scope resolution | Fits repo's zero-dependency CLI model |
| Existing review pipeline modules (`src/commands/review.js`, `src/lib/review/*`) | In-repo | Shared scan orchestration, severity ordering, config loading, exclusions pattern, JSON output contract | Phase 147 depends on Phase 146 and should mirror its architecture |
| Existing `src/lib/ast.js` / Acorn path | In-repo | JS/TS-aware structural rules for injection, unsafe exec, template sinks, auth/config mistakes | Already present and aligned with current code review implementation |
| OWASP Top 10 taxonomy | 2021 list still maps cleanly to requirements; 2025 is current release | Category model for grouping/reporting code-risk findings | Official OWASP taxonomy gives recognizable, user-facing security buckets |
| OSV API / OSV data model | Current docs 2026-03 | Advisory source for dependency vulnerability checks | Open vulnerability schema and officially supported scanner frontend reduce custom database work |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing `src/lib/review/severity.js` | In-repo | Shared severity vocabulary and ordering | Reuse so review/security/readiness reports align |
| Existing `src/lib/review/config.js` pattern | In-repo | Confidence threshold loading from `.planning/config.json` | Extend with `security` section rather than inventing a second config style |
| Existing `src/lib/review/exclusions.js` pattern | In-repo | Exact-match exclusion loading and normalization | Clone shape for `.planning/security-exclusions.json`, adding `expires_at` |
| Semgrep rule-pack model | Current docs 2026-03 | Reference for organizing language-aware security rules by registry/pack | Use as design inspiration for internal rule metadata, not as a required runtime dependency |
| Gitleaks rule model | v8.x current README/docs fetched 2026-03 | Reference for secret detection rules, allowlists, redaction, and fingerprinting | Use as design inspiration for findings/fingerprints, not as mandatory runtime dependency |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Internal zero-dependency scanners plus API lookups | Embed Semgrep/Gitleaks/OSV-Scanner binaries as required runtime deps | Rejected for v1: stronger coverage, but violates current repo style and increases install/runtime complexity |
| High-signal curated OWASP rules | Broad heuristic repo-wide security grep pack | Rejected: too noisy for a confidence-gated first release |
| OSV-backed dependency checks | Package-manager-specific audit commands only (`npm audit`, etc.) | Rejected as the primary path: fragmented by ecosystem and harder to unify across JS/Python/Go |
| Finding-level exclusions | Broad path/rule suppressions or baseline files | Rejected: weak auditability and conflicts with locked context decisions |
| Shared finding schema across engines | Separate per-engine report formats | Rejected: makes `/bgsd-security` orchestration and readiness checks much harder |

## Architecture Patterns

### Recommended Project Structure

- `src/commands/security.js` - command entrypoints for `security:scan` and helpers.
- `src/lib/security/config.js` - threshold/config loading, mirroring review config patterns.
- `src/lib/security/schema.js` - normalized finding schema helpers.
- `src/lib/security/scan.js` - top-level pipeline coordinator.
- `src/lib/security/engines/owasp.js` - structural/code-pattern scanning.
- `src/lib/security/engines/secrets.js` - secret detection and allowlist filtering.
- `src/lib/security/engines/dependencies.js` - manifest parsing and advisory lookups.
- `src/lib/security/exclusions.js` - `.planning/security-exclusions.json` loading/matching.
- `src/lib/security/rules/*` - curated rule registry by category/language.
- `commands/bgsd-security.md` plus workflow file - orchestration layer consuming scan JSON.
- `tests/security*.test.cjs` - scanner, exclusions, confidence, manifest parsing, and workflow contract coverage.

### Pattern 1: Reuse the Phase 146 pipeline shape, but split detector engines

Use the same stage discipline established in Phase 146:

1. Resolve scope.
2. Run detector engines independently.
3. Normalize all raw findings to one schema.
4. Apply exclusions.
5. Apply confidence gate.
6. Sort/group by severity.
7. Emit stable JSON for workflow/agent consumption.

The crucial adaptation is that Phase 147 needs **multiple detectors**, not one generic scanner. Do not merge everything into one giant rule loop.

### Pattern 2: Normalize everything to one finding shape

Recommended raw security finding shape:

```json
{
  "id": "sec-014",
  "engine": "secrets",
  "rule_id": "secret-generic-api-key",
  "owasp": ["A02"],
  "path": "src/config.js",
  "line": 18,
  "severity": "BLOCKER",
  "confidence": 0.93,
  "title": "Possible hardcoded API key",
  "message": "Credential-like token committed in source file.",
  "evidence": {
    "kind": "regex+entropy",
    "match_preview": "AIza...",
    "redacted": true
  },
  "next_step": "Move secret to environment/config store and rotate it.",
  "verification": {
    "independent_check": "matched provider prefix and entropy threshold"
  }
}
```

This is what lets `/bgsd-security` stay simple.

### Pattern 3: OWASP coverage should be category mapping, not a promise of full category completeness

OWASP Top 10 is the reporting taxonomy, not the implementation unit. Build a curated v1 rule set and map each rule to one or more OWASP buckets.

Recommended v1 categories:

- **A03 Injection** - SQL string interpolation, shell exec with untrusted input, template/code eval patterns.
- **A01 Broken Access Control** - missing ownership/role guard in obvious controller/route patterns.
- **A05 Security Misconfiguration** - dangerous defaults, disabled TLS/SSL verification, permissive CORS, debug-enabled prod-like config.
- **A07 Identification and Authentication Failures** - hardcoded credentials, unsafe token handling, auth bypass flags.
- **A02 Cryptographic Failures** - plaintext secrets, weak hashing/storage patterns, insecure transport toggles.
- **A06 Vulnerable and Outdated Components** - dependency advisory engine output.
- **A09 Security Logging and Monitoring Failures** - only very explicit cases in v1; otherwise keep low-confidence or omit.

Do **not** promise meaningful v1 detection for categories that usually need deeper architectural or runtime analysis.

### Pattern 4: Secrets scanning should use layered evidence, not regex alone

Use a layered decision model:

1. Provider-specific patterns first (AWS, GitHub tokens, Slack tokens, PEM headers, etc.).
2. Generic assignment patterns next (`api_key=`, `token:`, `password:`).
3. Entropy and surrounding-keyword checks to raise confidence.
4. Path/context allowlist evaluation after detection.
5. Redact matched values before output.

This follows the ecosystem pattern used by secret scanners and keeps generic-secret noise under control.

### Pattern 5: Dependency scanning should separate parsing from advisory matching

Pipeline:

1. Parse manifests/lockfiles into package records.
2. Classify evidence quality (`resolved`, `pinned`, `range-only`, `unknown`).
3. Batch-query advisory source.
4. Score confidence based on version precision.
5. Emit remediation guidance.

Important: `package.json` without lockfile resolution is weaker evidence than a resolved lockfile or exact pinned version.

### Pattern 6: Exclusions should match exact findings, not broad intent

Recommended schema:

```json
{
  "version": 1,
  "exclusions": [
    {
      "rule_id": "secret-generic-api-key",
      "path": "tests/fixtures/sample.env",
      "reason": "Intentional sample credential in fixture",
      "expires_at": "2026-06-30"
    }
  ]
}
```

Matching rules:

- Match exact `rule_id + normalized path` in v1.
- Require `reason` and `expires_at`.
- Surface expired exclusions as warnings.
- Do not support path-only ignores or hidden baseline suppression in v1.

### Pattern 7: `/bgsd-security` should verify, not rediscover

Like `/bgsd-review`, the workflow should consume scanner output rather than regenerate findings in prompt space.

Recommended workflow contract:

1. Run `security:scan`.
2. If no findings above threshold: end quietly with summary metadata.
3. For medium-confidence findings or exclusion suggestions: agent verifies or asks focused questions.
4. Present action-first severity report.

### Anti-Patterns to Avoid

- Claiming full OWASP coverage from a handful of regexes.
- Treating dependency version ranges as if they were resolved installations.
- Printing full secret values in JSON, markdown, or logs.
- Allowing broad suppressions that can hide future findings.
- Forcing all three engines into one monolithic rule format.
- Re-running whole-repo scans inside the workflow prompt instead of trusting CLI output.
- Building deep taint/dataflow analysis before the first usable workflow exists.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OWASP taxonomy | Custom security category naming scheme | OWASP Top 10 category mapping | Users already understand OWASP language |
| Dependency vulnerability database | Homegrown vulnerability DB | OSV schema/API-backed advisory lookup | Advisory curation is a solved external problem |
| Full SAST engine | Deep interprocedural taint framework | Curated structural rules over supported languages | v1 needs high-signal findings, not research-grade analysis |
| Secret-finding identity | Ad hoc text ignores | Stable per-finding fingerprints/redacted evidence | Necessary for auditable suppressions |
| Output contract | Engine-specific console text | One normalized JSON schema plus severity-led formatter | Keeps workflow and readiness integration deterministic |
| Exclusion mechanics | Broad ignores / hidden cache | `.planning/security-exclusions.json` exact-match entries with expiry | Matches locked user decision and keeps suppressions reviewable |
| Dependency ecosystem coverage | Package-manager-specific shell-outs as the only path | Internal manifest parsing + shared advisory backend | Produces one consistent cross-language workflow |

## Common Pitfalls

### Pitfall 1: "OWASP coverage" becomes a marketing label, not a truthful implementation
**What goes wrong:** The scanner claims OWASP coverage but only has a few generic regexes.  
**Why it happens:** OWASP categories are broad and tempting to overstate.  
**How to avoid:** Map every shipped rule to OWASP categories explicitly and document which categories are intentionally narrow in v1.  
**Warning signs:** Few rules, broad claims, and no rule-to-category inventory.

### Pitfall 2: Dependency findings are noisy because versions are unresolved
**What goes wrong:** Users get advisories for package ranges that may not actually be installed.  
**Why it happens:** Manifests and lockfiles are treated as equivalent evidence.  
**How to avoid:** Distinguish resolved/pinned/range-only evidence and lower confidence when exact installed version is unknown.  
**Warning signs:** Frequent alerts on broad semver ranges or conflicting results across lockfile/manifests.

### Pitfall 3: Secret reports leak the secret again
**What goes wrong:** The finding output becomes a second disclosure channel.  
**Why it happens:** Raw matches are stored for debugging or shown in markdown.  
**How to avoid:** Redact by default, keep only minimal preview/fingerprint, never print full secret values.  
**Warning signs:** JSON includes full token strings or markdown copy-pastes the credential.

### Pitfall 4: Generic secret rules drown users in false positives
**What goes wrong:** Fixture data, hashes, UUIDs, and examples dominate the report.  
**Why it happens:** Generic regex patterns run without keyword, entropy, or context checks.  
**How to avoid:** Layer provider-specific rules, keyword context, entropy, and explicit allowlisting.  
**Warning signs:** Findings cluster in tests/examples and most exclusions target fake data.

### Pitfall 5: Exclusions become a backdoor to silence the scanner
**What goes wrong:** Teams hide entire rule families or directories instead of managing true false positives.  
**Why it happens:** Broad suppression is operationally easier than exact suppression.  
**How to avoid:** Only allow exact rule-plus-path exclusions with reason and expiry, and warn on expiration.  
**Warning signs:** One exclusion suppresses many future findings or never expires.

### Pitfall 6: One confidence threshold is applied without engine-specific meaning
**What goes wrong:** A 0.8 score means different things for secrets, dependency alerts, and code patterns.  
**Why it happens:** Confidence is treated as one global number without evidence model.  
**How to avoid:** Normalize to one threshold, but derive score using engine-specific evidence signals.  
**Warning signs:** Users distrust some finding classes much more than others at the same score.

### Pitfall 7: Workflow duplicates CLI verification logic
**What goes wrong:** The agent second-guesses deterministic findings and creates inconsistent output.  
**Why it happens:** Prompt logic tries to rediscover vulnerabilities instead of consuming the scan artifact.  
**How to avoid:** Make the CLI the source of deterministic findings; the workflow only verifies edge cases, explains, and asks for judgment when needed.  
**Warning signs:** Same issue appears twice with different severity/confidence.

## Code Examples

Verified ecosystem patterns and adapted repo patterns.

### Example 1: Multi-engine scan coordinator

```js
function scanSecurityTarget(cwd, target, config) {
  const raw = [
    ...runOwaspRules(cwd, target, config),
    ...scanSecrets(cwd, target, config),
    ...scanDependencies(cwd, target, config)
  ];

  const normalized = raw.map(normalizeSecurityFinding);
  const filtered = applySecurityExclusions(normalized, loadSecurityExclusions(cwd), cwd);
  return confidenceGate(sortBySeverity(filtered), config.confidence_threshold);
}
```

### Example 2: Confidence model for dependency evidence quality

```js
function scoreDependencyFinding(pkg, advisory) {
  const resolvedBonus = pkg.version_source === 'lockfile' ? 0.15 : 0;
  const pinnedBonus = pkg.version_exact ? 0.1 : 0;
  const rangePenalty = pkg.version_source === 'manifest-range' ? 0.2 : 0;
  return clamp(0.75 + resolvedBonus + pinnedBonus - rangePenalty, 0, 0.99);
}
```

### Example 3: Secret redaction before output

```js
function redactSecret(value) {
  if (!value || value.length < 8) return '***REDACTED***';
  return `${value.slice(0, 4)}…${value.slice(-2)}`;
}
```

### Example 4: Exact exclusion matching with expiry

```js
function isExcluded(finding, entry, today) {
  return entry.rule_id === finding.rule_id &&
    normalizePath(entry.path) === normalizePath(finding.path) &&
    new Date(entry.expires_at) >= today;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Treat OWASP 2021 as the current Top 10 | OWASP 2025 is now the current release; 2021 remains the familiar implementation baseline | Verified in OWASP docs fetched 2026-03 | Planner should avoid stating 2021 is "latest" while still mapping rules to requirement language |
| Use one tool per security problem with unrelated outputs | Unified AppSec workflows commonly combine SAST, SCA, and secrets scanning | Visible in current Semgrep docs | Supports one `/bgsd-security` workflow with multiple engines under one report |
| Depend only on package-manager-native audit commands | OSV/OpenSSF ecosystem provides a shared vulnerability schema and scanner frontend | OSV/OSV-Scanner docs current 2026-03 | Good fit for a cross-language advisory backend |
| Regex-only secrets scanning | Modern secret scanners layer regex, keywords, entropy, decoding, and fingerprints | Reflected in current Gitleaks docs | v1 should at least support provider-specific rules, generic heuristics, redaction, and stable suppression identity |
| Broad ignore files and baselines as the main false-positive strategy | Narrower, auditable suppressions are increasingly preferred for trust-sensitive scans | Ecosystem trend; repo context strongly reinforces this | Matches the user decision to require finding-level exclusions |

## Open Questions

- Whether v1 dependency scanning should parse lockfiles when present even though the requirement text only names `package.json`, `requirements.txt`, and `go.mod`.
- Whether security exclusions should stay exact `rule_id + path` only, or also include a stable fingerprint for secret findings whose line numbers may move.
- How much non-JS structural analysis is realistic in v1 beyond text/regex heuristics.
- Whether the workflow should expose engine-specific confidence explanations in TTY mode or reserve that detail for JSON/debug output.

## Sources

### Primary (HIGH confidence)

- `.planning/phases/147-security-audit-workflow/147-CONTEXT.md`
- `.planning/REQUIREMENTS.md` (SEC-01 through SEC-05)
- `.planning/ROADMAP.md` (Phase 147 section)
- `src/commands/review.js`
- `src/lib/review/config.js`
- `src/lib/review/exclusions.js`
- OWASP Top 10 current site: <https://owasp.org/www-project-top-ten/>
- OWASP Top 10 2021 list: <https://owasp.org/Top10/2021/>
- OSV introduction/docs: <https://osv.dev/docs/>
- OSV-Scanner docs: <https://google.github.io/osv-scanner/>

### Secondary (MEDIUM confidence)

- Semgrep docs home: <https://semgrep.dev/docs/>
- Semgrep community rules repo: <https://github.com/semgrep/semgrep-rules>
- Gitleaks README/docs: <https://github.com/gitleaks/gitleaks>

### Tertiary (LOW confidence)

- General ecosystem knowledge about current SAST/secrets scanning patterns and advisory workflow design where official source detail was not fetched in this run.

## Metadata

**Confidence breakdown:** HIGH for repo-architecture reuse, exclusion design direction, and OWASP/OSV/Semgrep/Gitleaks existence/current-state claims; MEDIUM for the recommended v1 stack and multi-engine architecture; LOW for any implied ecosystem consensus beyond the cited docs.  
**Research date:** 2026-03-28  
**Valid until:** 2026-06-28 or until Phase 147 scope changes or the project adopts mandatory external scanner dependencies.
