'use strict';

const fs = require('fs');
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

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  SECURITY_PATTERNS,
  scanSkillFiles,
  formatScanResults,
  cmdSkillsList,
  cmdSkillsValidate,
};
