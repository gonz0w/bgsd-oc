'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { output, error, debugLog } = require('../lib/output');

// ─── Security Patterns (41 patterns across 7+ categories) ───────────────────

/**
 * Security patterns for scanning skill files.
 * Each pattern has: id, category, severity, pattern (RegExp), description.
 * Severity: 'dangerous' (blocks install) or 'warn' (surfaces but allows).
 */
const SECURITY_PATTERNS = [
  // Category 1: Code Execution (dangerous)
  { id: 'exec-eval',        category: 'Code Execution',     severity: 'dangerous', pattern: /\beval\s*\(/,                          description: 'Direct eval() call — arbitrary code execution' },
  { id: 'exec-new-func',    category: 'Code Execution',     severity: 'dangerous', pattern: /\bnew\s+Function\s*\(/,               description: 'new Function() — arbitrary code execution' },
  { id: 'exec-vm-run',      category: 'Code Execution',     severity: 'dangerous', pattern: /\bvm\.runInContext\s*\(/,             description: 'vm.runInContext — sandbox escape risk' },
  { id: 'exec-vm-ctx',      category: 'Code Execution',     severity: 'dangerous', pattern: /\bvm\.createContext\s*\(/,           description: 'vm.createContext — sandbox setup for code execution' },
  { id: 'exec-vm-script',   category: 'Code Execution',     severity: 'dangerous', pattern: /\bvm\.Script\s*\b/,                  description: 'vm.Script — compiled script execution' },
  { id: 'exec-child-proc',  category: 'Code Execution',     severity: 'dangerous', pattern: /\bchild_process\b/,                  description: 'child_process module — process spawning' },
  { id: 'exec-execsync',    category: 'Code Execution',     severity: 'dangerous', pattern: /\bexecSync\s*\(/,                    description: 'execSync() — synchronous shell command execution' },
  { id: 'exec-spawnsync',   category: 'Code Execution',     severity: 'dangerous', pattern: /\bspawnSync\s*\(/,                   description: 'spawnSync() — synchronous process spawning' },
  { id: 'exec-exec',        category: 'Code Execution',     severity: 'dangerous', pattern: /\bexec\s*\(/,                        description: 'exec() — shell command execution' },
  { id: 'exec-spawn',       category: 'Code Execution',     severity: 'dangerous', pattern: /\bspawn\s*\(/,                       description: 'spawn() — process spawning' },

  // Category 2: Network Access (warn)
  { id: 'net-fetch',        category: 'Network Access',     severity: 'warn',      pattern: /\bfetch\s*\(/,                       description: 'fetch() — outbound HTTP request' },
  { id: 'net-http-req',     category: 'Network Access',     severity: 'warn',      pattern: /\bhttp\.request\s*\(/,               description: 'http.request — outbound HTTP' },
  { id: 'net-https-req',    category: 'Network Access',     severity: 'warn',      pattern: /\bhttps\.request\s*\(/,              description: 'https.request — outbound HTTPS' },
  { id: 'net-xhr',          category: 'Network Access',     severity: 'warn',      pattern: /\bXMLHttpRequest\b/,                 description: 'XMLHttpRequest — outbound HTTP' },
  { id: 'net-websocket',    category: 'Network Access',     severity: 'warn',      pattern: /\bWebSocket\s*\(/,                   description: 'WebSocket — persistent network connection' },
  { id: 'net-connect',      category: 'Network Access',     severity: 'warn',      pattern: /\bnet\.connect\s*\(/,                description: 'net.connect — raw TCP connection' },
  // Category 3: Filesystem Operations (warn)
  { id: 'fs-writefile',     category: 'Filesystem Ops',     severity: 'warn',      pattern: /\bfs\.writeFile\s*\(/,               description: 'fs.writeFile — writes files to disk' },
  { id: 'fs-unlink',        category: 'Filesystem Ops',     severity: 'warn',      pattern: /\bfs\.unlink\s*\(/,                  description: 'fs.unlink — deletes files' },
  { id: 'fs-rmdir',         category: 'Filesystem Ops',     severity: 'warn',      pattern: /\bfs\.rmdir\s*\(/,                   description: 'fs.rmdir — removes directories' },
  { id: 'fs-rm',            category: 'Filesystem Ops',     severity: 'warn',      pattern: /\bfs\.rm\s*\(/,                      description: 'fs.rm() — recursive file removal' },
  { id: 'fs-rename',        category: 'Filesystem Ops',     severity: 'warn',      pattern: /\bfs\.rename\s*\(/,                  description: 'fs.rename — moves/renames files' },
  { id: 'fs-copyfile',      category: 'Filesystem Ops',     severity: 'warn',      pattern: /\bfs\.copyFile\s*\(/,                description: 'fs.copyFile — copies files' },

  // Category 4: Process/System
  { id: 'proc-exit',        category: 'Process/System',     severity: 'dangerous', pattern: /\bprocess\.exit\s*\(/,               description: 'process.exit — terminates the process' },
  { id: 'proc-kill',        category: 'Process/System',     severity: 'dangerous', pattern: /\bprocess\.kill\s*\(/,               description: 'process.kill — sends signals to processes' },
  { id: 'proc-env',         category: 'Process/System',     severity: 'warn',      pattern: /\bprocess\.env\b/,                   description: 'process.env — access to environment variables' },
  { id: 'proc-os-exec',     category: 'Process/System',     severity: 'dangerous', pattern: /\bos\.exec\s*\(/,                    description: 'os.exec — system command execution' },
  { id: 'proc-require-os',  category: 'Process/System',     severity: 'warn',      pattern: /\brequire\s*\(\s*['"]os['"]\s*\)/,  description: "require('os') — OS module access" },

  // Category 5: Crypto Mining (dangerous)
  { id: 'mine-stratum',     category: 'Crypto Mining',      severity: 'dangerous', pattern: /stratum\+tcp/i,                      description: 'stratum+tcp — cryptocurrency mining pool protocol' },
  { id: 'mine-cryptonight', category: 'Crypto Mining',      severity: 'dangerous', pattern: /cryptonight/i,                      description: 'CryptoNight — Monero mining algorithm' },
  { id: 'mine-coinhive',    category: 'Crypto Mining',      severity: 'dangerous', pattern: /coinhive/i,                          description: 'Coinhive — in-browser mining service' },
  { id: 'mine-minergate',   category: 'Crypto Mining',      severity: 'dangerous', pattern: /minergate/i,                         description: 'MinerGate — mining pool service' },

  // Category 6: Data Exfiltration (dangerous)
  { id: 'exfil-buffer-b64', category: 'Data Exfiltration',  severity: 'dangerous', pattern: /Buffer\.from[\s\S]{0,20}base64/,     description: 'Buffer.from with base64 — possible data encoding for exfil' },
  { id: 'exfil-btoa',       category: 'Data Exfiltration',  severity: 'dangerous', pattern: /\bbtoa\s*\(/,                        description: 'btoa() — base64 encoding (possible data exfiltration)' },
  { id: 'exfil-cookie',     category: 'Data Exfiltration',  severity: 'dangerous', pattern: /\bdocument\.cookie\b/,               description: 'document.cookie — browser cookie access' },
  { id: 'exfil-localstor',  category: 'Data Exfiltration',  severity: 'dangerous', pattern: /\blocalStorage\b/,                   description: 'localStorage — browser local storage access' },

  // Category 7: Prompt Injection (dangerous)
  { id: 'inject-system',    category: 'Prompt Injection',   severity: 'dangerous', pattern: /<system>/i,                          description: '<system> tag — prompt injection marker' },
  { id: 'inject-inst',      category: 'Prompt Injection',   severity: 'dangerous', pattern: /\[INST\]/i,                          description: '[INST] marker — LLM instruction injection' },
  { id: 'inject-ignore',    category: 'Prompt Injection',   severity: 'dangerous', pattern: /IGNORE PREVIOUS/i,                   description: 'IGNORE PREVIOUS — classic prompt injection' },
  { id: 'inject-ignore2',   category: 'Prompt Injection',   severity: 'dangerous', pattern: /ignore all prior/i,                  description: 'ignore all prior — prompt injection attempt' },
  { id: 'inject-you-are',   category: 'Prompt Injection',   severity: 'dangerous', pattern: /you are now/i,                       description: 'you are now — role override injection' },
  { id: 'inject-new-inst',  category: 'Prompt Injection',   severity: 'dangerous', pattern: /new instructions:/i,                 description: 'new instructions: — instruction injection' },
];

// ─── Scanner ─────────────────────────────────────────────────────────────────

/**
 * Recursively collect all files in a directory.
 */
function collectFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Scan all files in a skill directory against all 41 security patterns.
 * Returns:
 *   {
 *     verdict: 'clean'|'warn'|'dangerous',
 *     findings: [{ file, line, pattern_id, category, severity, match }],
 *     summary: { dangerous: N, warn: N, clean: N, total_patterns: 41 }
 *   }
 */
function scanSkillFiles(skillDir) {
  const findings = [];
  const files = collectFiles(skillDir);

  for (const filePath of files) {
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
      debugLog('skills.scan', `Cannot read ${filePath}`, e);
      continue;
    }

    const lines = content.split('\n');
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const lineText = lines[lineIdx];
      for (const pat of SECURITY_PATTERNS) {
        const matchObj = lineText.match(pat.pattern);
        if (matchObj) {
          findings.push({
            file: filePath,
            line: lineIdx + 1,
            pattern_id: pat.id,
            category: pat.category,
            severity: pat.severity,
            match: matchObj[0],
          });
        }
      }
    }
  }

  // Determine verdict
  let verdict = 'clean';
  if (findings.some(f => f.severity === 'dangerous')) {
    verdict = 'dangerous';
  } else if (findings.some(f => f.severity === 'warn')) {
    verdict = 'warn';
  }

  const dangerousCount = findings.filter(f => f.severity === 'dangerous').length;
  const warnCount = findings.filter(f => f.severity === 'warn').length;

  return {
    verdict,
    findings,
    summary: {
      dangerous: dangerousCount,
      warn: warnCount,
      clean: SECURITY_PATTERNS.length - new Set(findings.map(f => f.pattern_id)).size,
      total_patterns: SECURITY_PATTERNS.length,
    },
  };
}

// ─── Format Scan Results ──────────────────────────────────────────────────────

/**
 * Format scan results for TTY output.
 * Groups findings severity-first (dangerous > warn).
 * Shows category progress checklist.
 * If verbose: show matched code snippets.
 */
function formatScanResults(scanResult, verbose) {
  const lines = [];
  const { verdict, findings, summary } = scanResult;

  // Gather unique categories from SECURITY_PATTERNS for checklist
  const allCategories = [];
  const seenCats = new Set();
  for (const pat of SECURITY_PATTERNS) {
    if (!seenCats.has(pat.category)) {
      seenCats.add(pat.category);
      allCategories.push(pat.category);
    }
  }

  if (verdict === 'clean') {
    lines.push(`Security scan passed (${summary.total_patterns} patterns, 0 findings)`);
  } else {
    // Build category checklist
    const checklistParts = allCategories.map(cat => {
      const catFindings = findings.filter(f => f.category === cat);
      if (catFindings.length === 0) {
        return `\u2713 ${cat}`;
      } else {
        const warnCount = catFindings.filter(f => f.severity === 'warn').length;
        const dangerCount = catFindings.filter(f => f.severity === 'dangerous').length;
        const suffix = dangerCount > 0
          ? `(${dangerCount} dangerous)`
          : `(${warnCount} warnings)`;
        return `\u2717 ${cat} ${suffix}`;
      }
    });
    lines.push(checklistParts.join('  '));

    // Group findings: dangerous first, then warn
    const grouped = [
      ...findings.filter(f => f.severity === 'dangerous'),
      ...findings.filter(f => f.severity === 'warn'),
    ];

    for (const finding of grouped) {
      const relFile = finding.file;
      const prefix = finding.severity === 'dangerous' ? '[DANGEROUS]' : '[WARN]';
      lines.push(`  ${prefix} ${finding.category} — ${finding.pattern_id} at ${relFile}:${finding.line}`);
      if (verbose) {
        lines.push(`    Matched: ${finding.match}`);
      }
    }

    // Count summary
    lines.push(`${summary.dangerous} dangerous, ${summary.warn} warnings, ${summary.clean} clean`);

    // Block message if dangerous
    if (verdict === 'dangerous') {
      lines.push('Install BLOCKED — dangerous patterns found');
    }
  }

  return lines.join('\n');
}

// ─── skills:list ─────────────────────────────────────────────────────────────

/**
 * Extract description from SKILL.md content.
 * Checks frontmatter `description:` field first, then first `## Purpose` section.
 */
function extractSkillDescription(skillMdContent) {
  if (!skillMdContent) return '';

  // Check frontmatter description: field
  const fmMatch = skillMdContent.match(/^---\n([\s\S]+?)\n---/);
  if (fmMatch) {
    const fmBody = fmMatch[1];
    const descMatch = fmBody.match(/^description:\s*(.+)$/m);
    if (descMatch) {
      return descMatch[1].trim().replace(/^["']|["']$/g, '');
    }
  }

  // Check first ## Purpose section
  const purposeMatch = skillMdContent.match(/^##\s+Purpose\s*\n+([\s\S]+?)(?:\n##|\n---|\z)/m);
  if (purposeMatch) {
    // Take first non-empty line
    const firstLine = purposeMatch[1].split('\n').find(l => l.trim());
    if (firstLine) return firstLine.trim();
  }

  return '';
}

/**
 * List all installed skills in .agents/skills/ directory.
 * Each entry shows name + description + scan status.
 */
function cmdSkillsList(cwd, options, raw) {
  const skillsDir = path.join(cwd, '.agents', 'skills');

  // Handle missing directory
  if (!fs.existsSync(skillsDir)) {
    if (raw) {
      output({ skills: [] }, raw);
    } else {
      console.log('No skills installed.');
    }
    return;
  }

  let entries;
  try {
    entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  } catch (e) {
    if (raw) {
      output({ skills: [] }, raw);
    } else {
      console.log('No skills installed.');
    }
    return;
  }

  // Filter to subdirectories containing SKILL.md
  const skillDirs = entries.filter(e => {
    if (!e.isDirectory()) return false;
    const skillMdPath = path.join(skillsDir, e.name, 'SKILL.md');
    return fs.existsSync(skillMdPath);
  });

  if (skillDirs.length === 0) {
    if (raw) {
      output({ skills: [] }, raw);
    } else {
      console.log('No skills installed.');
    }
    return;
  }

  const skills = [];

  for (const dir of skillDirs) {
    const skillDir = path.join(skillsDir, dir.name);
    const skillMdPath = path.join(skillDir, 'SKILL.md');

    // Read SKILL.md for description
    let skillMdContent = '';
    try {
      skillMdContent = fs.readFileSync(skillMdPath, 'utf-8');
    } catch (e) {
      debugLog('skills.list', `Cannot read ${skillMdPath}`, e);
    }

    const description = extractSkillDescription(skillMdContent);

    // Run security scan
    const scanResult = scanSkillFiles(skillDir);
    const scanStatus = scanResult.verdict === 'clean'
      ? '\u2713 clean'
      : `\u26a0 ${scanResult.summary.warn + scanResult.summary.dangerous} ${scanResult.verdict === 'dangerous' ? 'dangerous' : 'warnings'}`;

    skills.push({
      name: dir.name,
      description,
      path: skillDir,
      scan_status: scanResult.verdict,
    });

    if (!raw) {
      skills[skills.length - 1]._display = { scanStatus };
    }
  }

  if (raw) {
    output({ skills: skills.map(s => ({ name: s.name, description: s.description, path: s.path, scan_status: s.scan_status })) }, raw);
    return;
  }

  // Human-readable aligned list
  const nameWidth = Math.max(4, ...skills.map(s => s.name.length)) + 2;
  const descWidth = Math.max(11, ...skills.map(s => s.description.length)) + 2;

  for (const skill of skills) {
    const display = skill._display || {};
    const name = skill.name.padEnd(nameWidth);
    const desc = (skill.description || '').padEnd(descWidth);
    console.log(`${name}${desc}${display.scanStatus || ''}`);
  }
}

// ─── skills:validate ─────────────────────────────────────────────────────────

/**
 * Validate (re-scan) an installed skill and report full findings.
 * Options:
 *   name     — required skill name to validate
 *   verbose  — if true, show matched code snippets per finding
 */
function cmdSkillsValidate(cwd, options, raw) {
  const { name, verbose } = options || {};

  if (!name) {
    error('Usage: skills validate --name <skill-name>');
    return;
  }

  const skillDir = path.join(cwd, '.agents', 'skills', name);

  // Check skill directory exists
  if (!fs.existsSync(skillDir)) {
    error(`Skill not found: ${name}`);
    return;
  }

  // Check SKILL.md is present
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    error(`Invalid skill: missing SKILL.md`);
    return;
  }

  // Run full 41-pattern security scan
  const scanResult = scanSkillFiles(skillDir);

  // Log validate attempt to audit trail
  logAuditEntry(cwd, {
    action: 'validate',
    name,
    outcome: 'validated',
    scan_verdict: {
      dangerous: scanResult.summary.dangerous,
      warn: scanResult.summary.warn,
      clean: scanResult.summary.clean,
      patterns: scanResult.findings.map(f => f.pattern_id),
    },
  });

  if (raw) {
    output({ name, path: skillDir, scan: scanResult }, raw);
    return;
  }

  // TTY output: header + formatted scan results
  console.log(`Validating skill: ${name}`);
  console.log(`Path: ${skillDir}`);
  console.log('');
  console.log(formatScanResults(scanResult, verbose || false));
}

// ─── GitHub Helpers ───────────────────────────────────────────────────────────

/**
 * Parse a GitHub repository URL or shorthand into { owner, repo }.
 * Accepts: https://github.com/owner/repo, github.com/owner/repo, owner/repo
 * Returns null for invalid/unsupported formats (subdirectories, non-GitHub hosts).
 */
function parseGitHubUrl(source) {
  if (!source || typeof source !== 'string') return null;

  let s = source.trim();

  // Strip protocol
  s = s.replace(/^https?:\/\//, '');

  // Must start with github.com/ or be a plain owner/repo
  if (s.startsWith('github.com/')) {
    s = s.slice('github.com/'.length);
  }

  // Now s should be owner/repo (exactly two path segments, no trailing slash)
  const parts = s.replace(/\/+$/, '').split('/');
  if (parts.length !== 2) return null;

  const [owner, repo] = parts;
  if (!owner || !repo) return null;

  // Reject relative path segments — these are local paths, not GitHub owners
  if (owner === '.' || owner === '..') return null;

  // Basic validation: only alphanumeric, hyphens, underscores, dots; must start with alphanumeric
  const validName = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
  if (!validName.test(owner) || !validName.test(repo)) return null;

  return { owner, repo };
}

/**
 * Fetch the file list for a GitHub repo via the Contents API.
 * Recursively fetches subdirectory contents.
 * Returns array of { name, path, size, download_url, type }.
 */
async function fetchGitHubContents(owner, repo, subPath) {
  const apiPath = subPath ? subPath : '';
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${apiPath}`;

  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });
  } catch (e) {
    throw new Error(`Network error fetching GitHub contents: ${e.message}`);
  }

  if (response.status === 404) {
    throw new Error(`Repository not found: ${owner}/${repo}`);
  }
  if (response.status === 403) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    if (remaining === '0') {
      throw new Error('GitHub API rate limit exceeded. Wait a few minutes and try again.');
    }
    throw new Error(`GitHub API returned 403 Forbidden for ${owner}/${repo}`);
  }
  if (!response.ok) {
    throw new Error(`GitHub API error ${response.status} for ${owner}/${repo}`);
  }

  const entries = await response.json();
  if (!Array.isArray(entries)) {
    throw new Error(`Unexpected response from GitHub API for ${owner}/${repo}`);
  }

  const files = [];
  for (const entry of entries) {
    if (entry.type === 'file') {
      files.push({ name: entry.name, path: entry.path, size: entry.size, download_url: entry.download_url, type: 'file' });
    } else if (entry.type === 'dir') {
      // Recurse into subdirectories
      const subFiles = await fetchGitHubContents(owner, repo, entry.path);
      files.push(...subFiles);
    }
  }
  return files;
}

/**
 * Download raw file contents from GitHub for each file with a download_url.
 * Returns array of { path, content, size }.
 */
async function downloadFiles(files) {
  const results = [];
  for (const file of files) {
    if (!file.download_url) continue;
    let response;
    try {
      response = await fetch(file.download_url);
    } catch (e) {
      throw new Error(`Failed to download ${file.path}: ${e.message}`);
    }
    if (!response.ok) {
      throw new Error(`Failed to download ${file.path}: HTTP ${response.status}`);
    }
    const content = await response.text();
    results.push({ path: file.path, content, size: file.size || Buffer.byteLength(content) });
  }
  return results;
}

// ─── Local Path Detection ─────────────────────────────────────────────────────

/**
 * Detect if source is a local filesystem path.
 * Returns the resolved absolute path, or null if it's not a local path.
 */
function parseLocalPath(source, cwd) {
  if (!source || typeof source !== 'string') return null;
  const s = source.trim();
  // Local paths start with ./, ../, /, or ~ (home-relative)
  if (s.startsWith('./') || s.startsWith('../') || s.startsWith('/') || s.startsWith('~')) {
    const resolved = s.startsWith('~')
      ? path.join(os.homedir(), s.slice(1))
      : path.resolve(cwd, s);
    return resolved;
  }
  return null;
}

/**
 * Collect all files from a local directory recursively.
 * Returns array of { path (relative), content, size }.
 */
function collectLocalFiles(localDir, baseDir) {
  const base = baseDir || localDir;
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(localDir, { withFileTypes: true });
  } catch (e) {
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(localDir, entry.name);
    const relPath = path.relative(base, fullPath);
    if (entry.isDirectory()) {
      results.push(...collectLocalFiles(fullPath, base));
    } else {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const size = Buffer.byteLength(content, 'utf-8');
        results.push({ path: relPath, content, size });
      } catch (_) { /* skip unreadable files */ }
    }
  }
  return results;
}

// ─── skills:install ───────────────────────────────────────────────────────────

/**
 * Install a skill from a GitHub repository or local directory.
 *
 * Without --confirm: fetch/read, scan, display results, output confirmation prompt.
 * With --confirm:    re-fetch/read, verify scan, write files, log audit.
 *
 * Dangerous scan verdict is a hard block — files are never written.
 * Warn verdict is surfaced in the confirmation prompt.
 */
async function cmdSkillsInstall(cwd, options, raw) {
  const { source, confirm, verbose } = options || {};

  if (!source) {
    error('Usage: skills install --source <github-url-or-local-path>');
    return;
  }

  // 1a. Detect local path vs GitHub URL
  const localPath = parseLocalPath(source, cwd);

  let name;
  let downloadedFiles;
  let sourceLabel = source;

  if (localPath) {
    // ── Local directory install ──────────────────────────────────────────────
    if (!fs.existsSync(localPath)) {
      error(`Local path not found: ${localPath}`);
      return;
    }
    if (!fs.statSync(localPath).isDirectory()) {
      error(`Local path must be a directory: ${localPath}`);
      return;
    }

    name = path.basename(localPath);
    sourceLabel = localPath;

    // Verify SKILL.md exists in local dir root
    if (!fs.existsSync(path.join(localPath, 'SKILL.md'))) {
      error(`Invalid skill: no SKILL.md found in ${localPath}`);
      return;
    }

    // Collect files from local directory
    downloadedFiles = collectLocalFiles(localPath);
    if (downloadedFiles.length === 0) {
      error(`No files found in local skill directory: ${localPath}`);
      return;
    }

  } else {
    // ── GitHub URL install ───────────────────────────────────────────────────
    // 1b. Parse GitHub URL
    const parsed = parseGitHubUrl(source);
    if (!parsed) {
      error(`Invalid source: ${source}\nExpected a GitHub URL (owner/repo, github.com/owner/repo, https://github.com/owner/repo)\nor a local path (./path/to/skill, /absolute/path)`);
      return;
    }
    const { owner, repo } = parsed;
    name = repo;

    // 3. Fetch repo contents
    let fileList;
    try {
      fileList = await fetchGitHubContents(owner, repo);
    } catch (e) {
      error(e.message);
      return;
    }

    // 4. Verify SKILL.md exists in repo root
    const hasSkillMd = fileList.some(f => f.path === 'SKILL.md' || f.name === 'SKILL.md' && !f.path.includes('/'));
    if (!hasSkillMd) {
      error(`Invalid skill: no SKILL.md found in repository root of ${owner}/${repo}`);
      return;
    }

    // 5. Download all files
    try {
      downloadedFiles = await downloadFiles(fileList);
    } catch (e) {
      error(e.message);
      return;
    }
  }

  // 2. Check for existing skill installation (applies to both local and GitHub)
  const skillsDir = path.join(cwd, '.agents', 'skills');
  const skillDestDir = path.join(skillsDir, name);
  if (fs.existsSync(skillDestDir)) {
    error(`Skill '${name}' already installed. Run skills:remove first.`);
    return;
  }

  // 6. Write to temp directory for scanning (unique dir via mkdtempSync — no TOCTOU)
  let tempDir;
  try {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `bgsd-skill-${name}-`));
  } catch (e) {
    error(`Failed to create temp directory for scanning: ${e.message}`);
    return;
  }
  try {
    for (const file of downloadedFiles) {
      const destPath = path.join(tempDir, file.path);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      // Exclusive write within our exclusively-created temp dir
      const fd = fs.openSync(destPath, 'wx');
      try { fs.writeSync(fd, file.content, 0, 'utf8'); } finally { fs.closeSync(fd); }
    }
  } catch (e) {
    // Clean up temp on error
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) { /* noop */ }
    error(`Failed to prepare temp directory for scanning: ${e.message}`);
    return;
  }

  // 7. Run security scan on temp directory
  const scanResult = scanSkillFiles(tempDir);
  const scanOutput = formatScanResults(scanResult, verbose || false);

  // 8. Dangerous verdict — hard block, log audit, clean up
  if (scanResult.verdict === 'dangerous') {
    // Log blocked attempt
    logAuditEntry(cwd, {
      action: 'blocked',
      source: sourceLabel,
      name,
      outcome: 'blocked',
      scan_verdict: {
        dangerous: scanResult.summary.dangerous,
        warn: scanResult.summary.warn,
        clean: scanResult.summary.clean,
        patterns: scanResult.findings.map(f => f.pattern_id),
      },
    });

    // Clean up temp
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) { /* noop */ }

    if (raw) {
      output({
        blocked: true,
        reason: 'dangerous_patterns',
        scan: scanResult,
      }, raw);
      return;
    }

    console.log(scanOutput);
    console.log('');
    console.log(`Install BLOCKED — dangerous patterns found. Audit entry written.`);
    return;
  }

  // Clean up temp dir (no longer needed after scan for non-confirm path)
  if (!confirm) {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) { /* noop */ }
  }

  // 9. Format file list + sizes for display
  const totalSize = downloadedFiles.reduce((sum, f) => sum + f.size, 0);
  const totalSizeStr = totalSize < 1024
    ? `${totalSize}B`
    : totalSize < 1024 * 1024
      ? `${(totalSize / 1024).toFixed(1)}KB`
      : `${(totalSize / (1024 * 1024)).toFixed(1)}MB`;

  // 10. Build confirmation prompt
  const warnNote = scanResult.verdict === 'warn'
    ? ` (${scanResult.summary.warn} warnings)`
    : '';
  const confirmPrompt = `Install skill '${name}' (${downloadedFiles.length} files, ${totalSizeStr})${warnNote}? [y/N]`;

  // Non-confirm path: show results, output confirmation data
  if (!confirm) {
    if (raw) {
      output({
        action: 'confirm',
        name,
        source: sourceLabel,
        files: downloadedFiles.map(f => ({ path: f.path, size: f.size })),
        scan: scanResult,
        prompt: confirmPrompt,
      }, raw);
      return;
    }

    // TTY: show scan results, file list, prompt
    if (scanResult.verdict !== 'clean') {
      console.log(scanOutput);
      console.log('');
    } else {
      console.log(scanOutput);
    }
    console.log(`Files to install (${downloadedFiles.length}):`);
    for (const f of downloadedFiles) {
      const sizeStr = f.size < 1024 ? `${f.size}B` : `${(f.size / 1024).toFixed(1)}KB`;
      console.log(`  ${f.path} (${sizeStr})`);
    }
    console.log('');
    console.log(confirmPrompt);
    return;
  }

  // --confirm path: write files to destination
  try {
    fs.mkdirSync(skillDestDir, { recursive: true });
    for (const file of downloadedFiles) {
      const destPath = path.join(skillDestDir, file.path);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, file.content, 'utf-8');
    }
  } catch (e) {
    // Clean up partial install on failure
    try { fs.rmSync(skillDestDir, { recursive: true, force: true }); } catch (_) { /* noop */ }
    // Clean up temp if still around
    if (fs.existsSync(tempDir)) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) { /* noop */ }
    }
    error(`Failed to install skill '${name}': ${e.message}`);
    return;
  }

  // Clean up temp dir
  if (fs.existsSync(tempDir)) {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) { /* noop */ }
  }

  // Log successful install
  logAuditEntry(cwd, {
    action: 'install',
    source: sourceLabel,
    name,
    outcome: 'installed',
    scan_verdict: {
      dangerous: scanResult.summary.dangerous,
      warn: scanResult.summary.warn,
      clean: scanResult.summary.clean,
      patterns: scanResult.findings.map(f => f.pattern_id),
    },
  });

  const successMsg = `Installed '${name}' to .agents/skills/${name}/ (${downloadedFiles.length} files)`;

  if (raw) {
    output({ installed: true, name, path: path.join('.agents', 'skills', name), files: downloadedFiles.length }, raw);
    return;
  }

  console.log(successMsg);
}

// ─── Audit Logging ────────────────────────────────────────────────────────────

/**
 * Append an audit entry to .agents/skill-audit.json.
 * Entry shape: { timestamp, action, source, name, outcome, scan_verdict }
 * Creates .agents/ directory if it doesn't exist.
 * Log grows indefinitely — no rotation.
 */
function logAuditEntry(cwd, entry) {
  const agentsDir = path.join(cwd, '.agents');
  const auditPath = path.join(agentsDir, 'skill-audit.json');

  // Ensure .agents/ directory exists
  try {
    fs.mkdirSync(agentsDir, { recursive: true });
  } catch (e) {
    debugLog('skills.audit', 'mkdir .agents failed', e);
  }

  // Read existing entries or start fresh
  let entries = [];
  try {
    if (fs.existsSync(auditPath)) {
      const raw = fs.readFileSync(auditPath, 'utf-8');
      entries = JSON.parse(raw);
      if (!Array.isArray(entries)) entries = [];
    }
  } catch (e) {
    debugLog('skills.audit', 'read audit log failed (resetting)', e);
    entries = [];
  }

  // Build full entry
  const fullEntry = {
    timestamp: new Date().toISOString(),
    action: entry.action,
    source: entry.source || null,
    name: entry.name || null,
    outcome: entry.outcome || entry.action,
    scan_verdict: entry.scan_verdict || null,
  };

  entries.push(fullEntry);

  try {
    fs.writeFileSync(auditPath, JSON.stringify(entries, null, 2), 'utf-8');
  } catch (e) {
    debugLog('skills.audit', 'write audit log failed', e);
  }
}

// ─── skills:remove ────────────────────────────────────────────────────────────

/**
 * Remove an installed skill by name and log the removal to the audit trail.
 * Options:
 *   name — required skill name to remove
 */
function cmdSkillsRemove(cwd, options, raw) {
  const { name } = options || {};

  if (!name) {
    error('Usage: skills remove --name <skill-name>');
    return;
  }

  const skillDir = path.join(cwd, '.agents', 'skills', name);

  // Check skill directory exists
  if (!fs.existsSync(skillDir)) {
    error(`Skill not found: ${name}`);
    return;
  }

  // Remove directory recursively
  try {
    fs.rmSync(skillDir, { recursive: true, force: true });
  } catch (e) {
    error(`Failed to remove skill '${name}': ${e.message}`);
    return;
  }

  // Log removal audit entry (name + timestamp only per CONTEXT.md)
  logAuditEntry(cwd, {
    action: 'remove',
    name,
    outcome: 'removed',
  });

  if (raw) {
    output({ removed: name }, raw);
    return;
  }

  console.log(`Removed skill '${name}'`);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  SECURITY_PATTERNS,
  scanSkillFiles,
  formatScanResults,
  cmdSkillsList,
  cmdSkillsValidate,
  parseGitHubUrl,
  cmdSkillsInstall,
  logAuditEntry,
  cmdSkillsRemove,
};
