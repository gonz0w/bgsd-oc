# Stack Research Template

Template for `.planning/research/STACK.md` — recommended technologies for the project domain.

<template>

```markdown
# Stack Research

**Domain:** [domain type]
**Researched:** [date]
**Confidence:** [HIGH/MEDIUM/LOW]

<!-- section: compact -->
<stack_compact>
<!-- Compact view for planners. Keep under 25 lines. -->

**Core stack:**

| Technology | Purpose | Version |
|------------|---------|---------|
| [name] | [what it does] | [ver] |
| [name] | [what it does] | [ver] |
| [name] | [what it does] | [ver] |

**Key supporting libs:** [comma-separated: name (purpose)]

**Avoid:** [comma-separated list of technologies to not use, with one-word reason]

**Install:** `npm install [core packages]`
</stack_compact>
<!-- /section -->

<!-- section: recommended_stack -->
## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| [name] | [version] | [what it does] | [why experts use it for this domain] |
| [name] | [version] | [what it does] | [why experts use it for this domain] |
| [name] | [version] | [what it does] | [why experts use it for this domain] |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| [name] | [version] | [what it does] | [specific use case] |
| [name] | [version] | [what it does] | [specific use case] |
| [name] | [version] | [what it does] | [specific use case] |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| [name] | [what it does] | [configuration tips] |
| [name] | [what it does] | [configuration tips] |

## Installation

```bash
# Core
npm install [packages]

# Supporting
npm install [packages]

# Dev dependencies
npm install -D [packages]
```
<!-- /section -->

<!-- section: alternatives -->
## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| [our choice] | [other option] | [conditions where alternative is better] |
| [our choice] | [other option] | [conditions where alternative is better] |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| [technology] | [specific problem] | [recommended alternative] |
| [technology] | [specific problem] | [recommended alternative] |
<!-- /section -->

<!-- section: patterns -->
## Stack Patterns by Variant

**If [condition]:**
- Use [variation]
- Because [reason]

**If [condition]:**
- Use [variation]
- Because [reason]
<!-- /section -->

<!-- section: compatibility -->
## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| [package@version] | [package@version] | [compatibility notes] |

## Sources

- [Context7 library ID] — [topics fetched]
- [Official docs URL] — [what was verified]
- [Other source] — [confidence level]

---
*Stack research for: [domain]*
*Researched: [date]*
```

</template>

<guidelines>

**Core Technologies:**
- Include specific version numbers
- Explain why this is the standard choice, not just what it does
- Focus on technologies that affect architecture decisions

**Supporting Libraries:**
- Include libraries commonly needed for this domain
- Note when each is needed (not all projects need all libraries)

**Alternatives:**
- Don't just dismiss alternatives
- Explain when alternatives make sense
- Helps user make informed decisions if they disagree

**What NOT to Use:**
- Actively warn against outdated or problematic choices
- Explain the specific problem, not just "it's old"
- Provide the recommended alternative

**Version Compatibility:**
- Note any known compatibility issues
- Critical for avoiding debugging time later

</guidelines>
