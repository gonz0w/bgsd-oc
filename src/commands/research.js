'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { checkBinary } = require('../commands/env');
const { loadConfig } = require('../lib/config');
const { output, status, debugLog } = require('../lib/output');
const { banner, sectionHeader, formatTable, color, SYMBOLS, truncate } = require('../lib/format');

// ─── Tier Calculation ────────────────────────────────────────────────────────

/**
 * Tier definitions for degradation levels.
 */
const TIER_DEFINITIONS = [
  { number: 1, name: 'Full RAG', description: 'All tools available — YouTube + MCP + NotebookLM synthesis' },
  { number: 2, name: 'Sources without synthesis', description: 'YouTube + MCP sources, LLM synthesizes' },
  { number: 3, name: 'Brave/Context7 only', description: 'Web search sources only, no video content' },
  { number: 4, name: 'Pure LLM', description: 'No external sources, LLM knowledge only' },
];

/**
 * Calculate the current degradation tier based on detected tools.
 * Shared between capabilities command and init output (DRY).
 *
 * @param {object} cliTools - Result from detectCliTools()
 * @param {object} mcpServers - Result from detectMcpServers()
 * @param {boolean} ragEnabled - Whether RAG is enabled in config
 * @returns {{ number: number, name: string }}
 */
function calculateTier(cliTools, mcpServers, ragEnabled) {
  if (!ragEnabled) {
    return { number: 4, name: 'Pure LLM' };
  }

  const hasMcp = Object.entries(mcpServers)
    .filter(([k]) => k !== 'warning')
    .some(([, s]) => s.configured && s.enabled);
  const hasYtdlp = cliTools['yt-dlp']?.available || false;
  const hasNlm = cliTools['notebooklm-py']?.available || false;

  if (hasMcp && hasYtdlp && hasNlm) return { number: 1, name: 'Full RAG' };
  if (hasMcp && hasYtdlp) return { number: 2, name: 'Sources without synthesis' };
  if (hasMcp) return { number: 3, name: 'Brave/Context7 only' };
  return { number: 4, name: 'Pure LLM' };
}

// ─── CLI Tool Detection ──────────────────────────────────────────────────────

/**
 * Detect CLI research tools (yt-dlp, notebooklm-py).
 * Uses config overrides for paths if set, otherwise auto-detects via checkBinary.
 *
 * @param {string} cwd - Project root directory
 * @returns {object} Tool detection results keyed by tool name
 */
function detectCliTools(cwd) {
  const config = loadConfig(cwd);

  const results = {
    'yt-dlp': { available: false, version: null, path: null, install_hint: 'pip install yt-dlp' },
    'notebooklm-py': { available: false, version: null, path: null, install_hint: 'pip install notebooklm-py' },
  };

  // yt-dlp: check config override first, then auto-detect
  if (config.ytdlp_path) {
    debugLog('research.cli', `checking configured yt-dlp path: ${config.ytdlp_path}`);
    try {
      if (fs.existsSync(config.ytdlp_path)) {
        const binary = checkBinary(config.ytdlp_path, '--version');
        results['yt-dlp'].available = binary.available;
        results['yt-dlp'].version = binary.version;
        results['yt-dlp'].path = config.ytdlp_path;
      }
    } catch {
      debugLog('research.cli', `configured yt-dlp path not accessible: ${config.ytdlp_path}`);
    }
  } else {
    const binary = checkBinary('yt-dlp', '--version');
    results['yt-dlp'].available = binary.available;
    results['yt-dlp'].version = binary.version;
    results['yt-dlp'].path = binary.path;
  }

  // notebooklm-py: check config override, then try 'notebooklm-py', then fallback to 'nlm'
  if (config.nlm_path) {
    debugLog('research.cli', `checking configured nlm path: ${config.nlm_path}`);
    try {
      if (fs.existsSync(config.nlm_path)) {
        const binary = checkBinary(config.nlm_path, '--version');
        results['notebooklm-py'].available = binary.available;
        results['notebooklm-py'].version = binary.version;
        results['notebooklm-py'].path = config.nlm_path;
      }
    } catch {
      debugLog('research.cli', `configured nlm path not accessible: ${config.nlm_path}`);
    }
  } else {
    // Try 'notebooklm-py' first
    let binary = checkBinary('notebooklm-py', '--version');
    if (binary.available) {
      results['notebooklm-py'].available = true;
      results['notebooklm-py'].version = binary.version;
      results['notebooklm-py'].path = binary.path;
    } else {
      // Fallback: try 'nlm'
      debugLog('research.cli', 'notebooklm-py not found, trying nlm');
      binary = checkBinary('nlm', '--version');
      if (binary.available) {
        results['notebooklm-py'].available = true;
        results['notebooklm-py'].version = binary.version;
        results['notebooklm-py'].path = binary.path;
      }
    }
  }

  return results;
}

// ─── MCP Server Detection ────────────────────────────────────────────────────

/**
 * Known MCP research server patterns for keyword matching.
 * Case-insensitive matching on server name keys.
 */
const MCP_RESEARCH_SERVERS = [
  { id: 'brave-search', keywords: ['brave'] },
  { id: 'context7',     keywords: ['context7'] },
  { id: 'exa',          keywords: ['exa'] },
];

/**
 * Detect configured MCP research servers by reading the editor's MCP config file.
 * Does NOT probe servers at runtime — only checks configuration.
 *
 * @param {string} cwd - Project root directory
 * @returns {object} Server detection results keyed by server id, plus optional warning
 */
function detectMcpServers(cwd) {
  const config = loadConfig(cwd);

  const results = {
    'brave-search': { configured: false, enabled: false, name_match: null },
    'context7':     { configured: false, enabled: false, name_match: null },
    'exa':          { configured: false, enabled: false, name_match: null },
  };

  // Determine MCP config file path
  let mcpConfigPath = config.mcp_config_path;

  if (!mcpConfigPath) {
    // Smart defaults: try known editor config locations
    const homedir = process.env.HOME || process.env.USERPROFILE || '';
    const defaultPaths = [
      path.join(homedir, '.config', 'oc', 'opencode.json'),
      path.join(homedir, '.config', 'opencode', 'opencode.json'),
    ];

    for (const p of defaultPaths) {
      try {
        if (fs.existsSync(p)) {
          mcpConfigPath = p;
          debugLog('research.mcp', `auto-detected MCP config: ${p}`);
          break;
        }
      } catch {
        // Skip inaccessible paths
      }
    }
  }

  if (!mcpConfigPath) {
    debugLog('research.mcp', 'no MCP config file found');
    results.warning = 'MCP config not found — set mcp_config_path in config or place opencode.json in ~/.config/oc/';
    return results;
  }

  // Read and parse the config file
  let configData;
  try {
    const raw = fs.readFileSync(mcpConfigPath, 'utf-8');
    configData = JSON.parse(raw);
  } catch (e) {
    debugLog('research.mcp', `failed to read MCP config: ${e.message}`);
    results.warning = `MCP config unreadable at ${mcpConfigPath}: ${e.message}`;
    return results;
  }

  // Extract server entries — handle both shapes:
  // Shape 1: { mcpServers: { name: {...} } }  (e.g., .mcp.json)
  // Shape 2: { mcp: { name: {...} } }          (e.g., opencode.json)
  // Shape 3: { mcp: { servers: { name: {...} } } }
  let servers = null;

  if (configData.mcpServers && typeof configData.mcpServers === 'object') {
    servers = configData.mcpServers;
  } else if (configData.mcp && typeof configData.mcp === 'object') {
    if (configData.mcp.servers && typeof configData.mcp.servers === 'object') {
      servers = configData.mcp.servers;
    } else {
      // mcp directly contains server entries (opencode.json pattern)
      // Filter out non-object values that might be config flags
      servers = {};
      for (const [key, val] of Object.entries(configData.mcp)) {
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          servers[key] = val;
        }
      }
    }
  }

  if (!servers || Object.keys(servers).length === 0) {
    debugLog('research.mcp', 'no mcpServers found in config');
    results.warning = `No MCP servers found in ${mcpConfigPath}`;
    return results;
  }

  // Match server names against research server keywords
  for (const [serverName, serverConfig] of Object.entries(servers)) {
    const nameLower = serverName.toLowerCase();

    for (const research of MCP_RESEARCH_SERVERS) {
      const matched = research.keywords.some(kw => nameLower.includes(kw));
      if (matched) {
        results[research.id].configured = true;
        results[research.id].name_match = serverName;

        // Check for disabled flag
        if (serverConfig && serverConfig.disabled === true) {
          results[research.id].enabled = false;
        } else {
          results[research.id].enabled = true;
        }

        debugLog('research.mcp', `matched ${serverName} → ${research.id} (enabled: ${results[research.id].enabled})`);
        break; // One match per server entry
      }
    }
  }

  return results;
}

// ─── Capabilities Command ────────────────────────────────────────────────────

/**
 * Format capabilities data for TTY display.
 * @param {object} data - Capabilities result object
 * @returns {string}
 */
function formatCapabilities(data) {
  const lines = [];

  lines.push(banner('Research Capabilities'));
  lines.push('');

  // Current tier — prominent display
  const tierColor = data.current_tier.number <= 2 ? color.green : data.current_tier.number === 3 ? color.yellow : color.red;
  lines.push(color.bold('Research Tier: ') + tierColor(`${data.current_tier.number} — ${data.current_tier.name}`));
  lines.push('');

  // RAG status
  lines.push(color.dim(`RAG Enabled: ${data.rag_enabled ? color.green(SYMBOLS.check + ' yes') : color.red(SYMBOLS.cross + ' no')}`));
  lines.push('');

  // CLI Tools table
  lines.push(sectionHeader('CLI Tools'));
  const cliRows = Object.entries(data.cli_tools).map(([name, info]) => {
    const statusIcon = info.available ? color.green(SYMBOLS.check) : color.red(SYMBOLS.cross);
    const version = info.version || color.dim('—');
    return [statusIcon, name, version, info.install_hint || ''];
  });
  lines.push(formatTable(['', 'Tool', 'Version', 'Install'], cliRows));
  lines.push('');

  // MCP Servers table
  lines.push(sectionHeader('MCP Servers'));
  const mcpRows = Object.entries(data.mcp_servers)
    .filter(([k]) => k !== 'warning')
    .map(([id, info]) => {
      let statusIcon;
      if (info.configured && info.enabled) statusIcon = color.green(SYMBOLS.check);
      else if (info.configured && !info.enabled) statusIcon = color.yellow(SYMBOLS.warning);
      else statusIcon = color.red(SYMBOLS.cross);
      const status = info.configured ? (info.enabled ? 'enabled' : 'disabled') : 'not configured';
      const match = info.name_match || color.dim('—');
      return [statusIcon, id, status, match];
    });
  lines.push(formatTable(['', 'Server', 'Status', 'Config Key'], mcpRows));

  if (data.warning) {
    lines.push('');
    lines.push(color.yellow(SYMBOLS.warning + ' ' + data.warning));
  }

  // Recommendations
  if (data.recommendations.length > 0) {
    lines.push('');
    lines.push(sectionHeader('Recommendations'));
    for (const rec of data.recommendations) {
      lines.push(`  ${color.yellow(SYMBOLS.arrow)} ${color.bold(rec.tool)}: ${rec.benefit}`);
      lines.push(`    Install: ${color.cyan(rec.install)}`);
    }
  }

  // Tier overview
  lines.push('');
  lines.push(sectionHeader('Tier Overview'));
  for (const tier of data.tiers) {
    const icon = tier.active ? color.green(SYMBOLS.check) : color.dim(SYMBOLS.pending);
    const label = tier.active ? color.bold(`Tier ${tier.number}`) : color.dim(`Tier ${tier.number}`);
    lines.push(`  ${icon} ${label}: ${tier.name} — ${tier.description}`);
  }

  return lines.join('\n');
}

/**
 * Command handler: research capabilities
 * Reports available research tools, degradation tier, and recommendations.
 *
 * @param {string} cwd - Project root directory
 * @param {string[]} args - Command arguments
 * @param {boolean} raw - Raw output mode
 */
function cmdResearchCapabilities(cwd, args, raw) {
  const config = loadConfig(cwd);
  const ragEnabled = config.rag_enabled !== false;

  const cliTools = detectCliTools(cwd);
  const mcpServers = detectMcpServers(cwd);
  const currentTier = calculateTier(cliTools, mcpServers, ragEnabled);

  // Build tiers array with active flag
  const tiers = TIER_DEFINITIONS.map(t => ({
    ...t,
    active: t.number === currentTier.number,
  }));

  // Build recommendations for missing tools
  const recommendations = [];

  if (!cliTools['yt-dlp'].available) {
    recommendations.push({
      tool: 'yt-dlp',
      install: 'pip install yt-dlp',
      benefit: 'Enables YouTube transcript extraction for developer content research',
    });
  }

  if (!cliTools['notebooklm-py'].available) {
    recommendations.push({
      tool: 'notebooklm-py',
      install: 'pip install notebooklm-py',
      benefit: 'Enables RAG synthesis via NotebookLM for grounded research answers',
    });
  }

  const mcpBenefits = {
    'brave-search': 'Web search with rich snippets for current documentation and discussions',
    'context7': 'Library documentation lookup with version-specific code examples',
    'exa': 'Semantic code search across GitHub, Stack Overflow, and official docs',
  };

  for (const [id, info] of Object.entries(mcpServers)) {
    if (id === 'warning') continue;
    if (!info.configured) {
      recommendations.push({
        tool: `${id} MCP`,
        install: `Add ${id} server to MCP config`,
        benefit: mcpBenefits[id] || `Enables ${id} MCP server for research`,
      });
    }
  }

  const result = {
    rag_enabled: ragEnabled,
    current_tier: currentTier,
    tiers,
    cli_tools: cliTools,
    mcp_servers: mcpServers,
    recommendations,
    warning: mcpServers.warning || null,
  };

  output(result, { formatter: formatCapabilities, raw });
}

// ─── YouTube Search Command ──────────────────────────────────────────────────

/**
 * Parse a named flag from args array.
 * @param {string[]} args
 * @param {string} flag - e.g. '--count'
 * @param {*} defaultValue
 * @returns {*}
 */
function parseFlag(args, flag, defaultValue) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return defaultValue;
  return args[idx + 1];
}

/**
 * Format duration seconds as M:SS string.
 * @param {number|null} sec
 * @returns {string}
 */
function formatDuration(sec) {
  if (sec == null) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Format view count with K/M suffixes.
 * @param {number|null} views
 * @returns {string}
 */
function formatViews(views) {
  if (views == null) return '—';
  if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
  if (views >= 1000) return (views / 1000).toFixed(1) + 'K';
  return String(views);
}

/**
 * Compute quality score (0-100) for a YouTube search result.
 *
 * Components:
 *   Recency (0-40): Linear decay from 40 (today) to 0 (maxAgeDays ago). Null → 20.
 *   Views (0-30): Log-scale. min(30, log10(view_count + 1) * 6). Null → 10.
 *   Duration (0-30): Bell curve centered at 15-20 min. Peak=30, drops to 10 at bounds. Null → 15.
 *
 * @param {object} result - Extracted result with upload_date, view_count, duration
 * @param {number} maxAgeDays - Maximum age in days for recency scoring
 * @returns {number} 0-100 integer
 */
function computeQualityScore(result, maxAgeDays) {
  const now = Date.now();

  // Recency component (0-40)
  let recency = 20; // neutral default
  if (result.upload_date) {
    const uploadTime = new Date(result.upload_date).getTime();
    if (!isNaN(uploadTime)) {
      const ageDays = (now - uploadTime) / (1000 * 60 * 60 * 24);
      recency = Math.max(0, 40 * (1 - ageDays / maxAgeDays));
    }
  }

  // View component (0-30)
  let viewScore = 10; // neutral default
  if (result.view_count != null) {
    viewScore = Math.min(30, Math.log10(result.view_count + 1) * 6);
  }

  // Duration component (0-30) — bell curve centered at 15-20 min (900-1200 sec)
  let durationScore = 15; // neutral default
  if (result.duration != null) {
    const dur = result.duration;
    const idealMin = 900;  // 15 min
    const idealMax = 1200; // 20 min
    if (dur >= idealMin && dur <= idealMax) {
      durationScore = 30; // peak
    } else if (dur < idealMin) {
      // Linear from 10 at 300s (5 min) to 30 at 900s (15 min)
      const minBound = 300;
      durationScore = dur <= minBound ? 10 : 10 + 20 * ((dur - minBound) / (idealMin - minBound));
    } else {
      // Linear from 30 at 1200s (20 min) to 10 at 3600s (60 min)
      const maxBound = 3600;
      durationScore = dur >= maxBound ? 10 : 30 - 20 * ((dur - idealMax) / (maxBound - idealMax));
    }
  }

  const total = recency + viewScore + durationScore;
  return Math.min(100, Math.max(0, Math.round(total)));
}

/**
 * Format yt-search results for TTY display.
 * @param {object} data - yt-search result object
 * @returns {string}
 */
function formatYtSearch(data) {
  const lines = [];

  lines.push(banner('YouTube Search'));
  lines.push('');

  if (data.error) {
    lines.push(color.red(`Error: ${data.error}`));
    if (data.install_hint) {
      lines.push(color.yellow(`Install: ${data.install_hint}`));
    }
    if (data.details) {
      lines.push(color.dim(data.details));
    }
    return lines.join('\n');
  }

  lines.push(color.bold('Query: ') + data.query);
  lines.push(color.dim(`Results: ${data.post_filter_count} of ${data.pre_filter_count} (after filtering)`));
  lines.push('');

  if (data.results.length === 0) {
    lines.push(color.yellow('No results match the current filters.'));
    return lines.join('\n');
  }

  const rows = data.results.map(r => {
    const scoreColor = r.quality_score >= 60 ? color.green : r.quality_score >= 30 ? color.yellow : color.red;
    return [
      scoreColor(String(r.quality_score)),
      truncate(r.title || '', 50),
      truncate(r.channel || '', 20),
      formatDuration(r.duration),
      formatViews(r.view_count),
      r.upload_date ? r.upload_date.slice(0, 10) : '—',
    ];
  });

  lines.push(formatTable(['Score', 'Title', 'Channel', 'Duration', 'Views', 'Date'], rows));

  return lines.join('\n');
}

/**
 * Command handler: research yt-search
 * Search YouTube via yt-dlp and return structured, filtered, quality-scored results.
 *
 * @param {string} cwd - Project root directory
 * @param {string[]} args - Command arguments
 * @param {boolean} raw - Raw output mode
 */
function cmdResearchYtSearch(cwd, args, raw) {
  // 1. Check yt-dlp availability
  const cliTools = detectCliTools(cwd);
  if (!cliTools['yt-dlp'].available) {
    const result = { error: 'yt-dlp not installed', install_hint: 'pip install yt-dlp', available: false };
    output(result, { formatter: formatYtSearch, raw });
    return;
  }

  // 2. Parse args
  const count = parseInt(parseFlag(args, '--count', '10'), 10);
  const maxAgeDays = parseInt(parseFlag(args, '--max-age', '730'), 10);
  const minDuration = parseInt(parseFlag(args, '--min-duration', '300'), 10);
  const maxDuration = parseInt(parseFlag(args, '--max-duration', '3600'), 10);
  const minViews = parseInt(parseFlag(args, '--min-views', '0'), 10);

  // Extract positional query (args that don't start with --)
  const positional = args.filter(a => !a.startsWith('--'));
  // Also remove values that follow flags
  const flagValues = new Set();
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length && !args[i + 1].startsWith('--')) {
      flagValues.add(args[i + 1]);
    }
  }
  const query = positional.filter(a => !flagValues.has(a)).join(' ').trim();

  if (!query) {
    const result = { error: 'Missing search query', usage: 'research:yt-search "topic" [--count N] [--max-age DAYS] [--min-duration SEC] [--max-duration SEC] [--min-views N]' };
    output(result, { formatter: formatYtSearch, raw });
    return;
  }

  // 3. Execute yt-dlp search
  let rawResults;
  try {
    const ytdlpPath = cliTools['yt-dlp'].path || 'yt-dlp';
    const stdout = execFileSync(ytdlpPath, [
      `ytsearch${count}:${query}`,
      '--dump-json',
      '--flat-playlist',
      '--no-download',
      '--no-warnings',
    ], { encoding: 'utf-8', timeout: 30000, stdio: 'pipe' });

    rawResults = stdout.trim().split('\n').filter(Boolean).map(line => {
      try { return JSON.parse(line); }
      catch { return null; }
    }).filter(Boolean);
  } catch (err) {
    const result = { error: 'yt-dlp search failed', details: err.message };
    output(result, { formatter: formatYtSearch, raw });
    return;
  }

  // 4. Extract structured fields
  const extracted = rawResults.map(r => {
    const id = r.id || null;
    let uploadDate = null;
    if (r.upload_date && /^\d{8}$/.test(r.upload_date)) {
      uploadDate = `${r.upload_date.slice(0, 4)}-${r.upload_date.slice(4, 6)}-${r.upload_date.slice(6, 8)}`;
    }
    return {
      id,
      title: r.title || null,
      channel: r.uploader || r.channel || null,
      duration: r.duration != null ? r.duration : null,
      view_count: r.view_count != null ? r.view_count : null,
      upload_date: uploadDate,
      url: id ? `https://www.youtube.com/watch?v=${id}` : null,
      description: r.description ? r.description.slice(0, 200) : null,
    };
  });

  const preFilterCount = extracted.length;

  // 5. Apply filters
  const now = Date.now();
  const filtered = extracted.filter(r => {
    // Recency filter
    if (r.upload_date) {
      const uploadTime = new Date(r.upload_date).getTime();
      if (!isNaN(uploadTime)) {
        const ageDays = (now - uploadTime) / (1000 * 60 * 60 * 24);
        if (ageDays > maxAgeDays) return false;
      }
    }
    // Duration filter
    if (r.duration != null) {
      if (r.duration < minDuration || r.duration > maxDuration) return false;
    }
    // View count filter
    if (r.view_count != null) {
      if (r.view_count < minViews) return false;
    }
    return true;
  });

  // 6. Compute quality scores
  const scored = filtered.map(r => ({
    ...r,
    quality_score: computeQualityScore(r, maxAgeDays),
  }));

  // 7. Sort by quality score descending
  scored.sort((a, b) => b.quality_score - a.quality_score);

  const result = {
    query,
    pre_filter_count: preFilterCount,
    post_filter_count: scored.length,
    results: scored,
  };

  output(result, { formatter: formatYtSearch, raw });
}

// ─── YouTube Transcript Command ──────────────────────────────────────────────

/**
 * Parse VTT subtitle content into clean text.
 * Handles deduplication of overlapping cue lines (common in auto-generated subs),
 * HTML tag stripping, and optional timestamp preservation.
 *
 * @param {string} vttContent - Raw VTT file content
 * @param {boolean} keepTimestamps - If true, preserve [HH:MM:SS] markers
 * @returns {string} Cleaned transcript text
 */
function parseVtt(vttContent, keepTimestamps) {
  const lines = vttContent.split('\n');
  const cues = [];
  let currentTimestamp = null;
  let currentLines = [];
  let inCue = false;

  const timestampRe = /^(\d{2}:\d{2}:\d{2})\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip WEBVTT header and metadata
    if (trimmed === 'WEBVTT' || trimmed.startsWith('Kind:') || trimmed.startsWith('Language:') || trimmed.startsWith('NOTE')) {
      continue;
    }

    // Check for timestamp line
    const tsMatch = trimmed.match(timestampRe);
    if (tsMatch) {
      // Save previous cue if any
      if (currentLines.length > 0) {
        cues.push({ timestamp: currentTimestamp, text: currentLines.join(' ') });
      }
      currentTimestamp = tsMatch[1];
      currentLines = [];
      inCue = true;
      continue;
    }

    // Skip cue index numbers (numeric-only lines before timestamp)
    if (/^\d+$/.test(trimmed)) {
      continue;
    }

    // Empty line ends current cue
    if (trimmed === '') {
      if (inCue && currentLines.length > 0) {
        cues.push({ timestamp: currentTimestamp, text: currentLines.join(' ') });
        currentLines = [];
        inCue = false;
      }
      continue;
    }

    // Content line — strip HTML/VTT tags
    if (inCue) {
      let cleaned = trimmed
        .replace(/<[^>]+>/g, '')  // Strip all HTML/VTT tags
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (cleaned) {
        currentLines.push(cleaned);
      }
    }
  }

  // Flush final cue
  if (currentLines.length > 0) {
    cues.push({ timestamp: currentTimestamp, text: currentLines.join(' ') });
  }

  // Deduplicate consecutive identical lines (auto-subs repeat across overlapping cues)
  const deduped = [];
  let prevText = null;
  for (const cue of cues) {
    if (cue.text !== prevText) {
      deduped.push(cue);
      prevText = cue.text;
    }
  }

  // Build output
  let result;
  if (keepTimestamps) {
    result = deduped.map(c => `[${c.timestamp}] ${c.text}`).join('\n');
  } else {
    result = deduped.map(c => c.text).join(' ');
  }

  // Clean up excessive whitespace
  result = result.replace(/  +/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  return result;
}

/**
 * Extract video ID from various YouTube URL formats or bare ID.
 * @param {string} input - Video ID or YouTube URL
 * @returns {string|null} Video ID or null if unparseable
 */
function extractVideoId(input) {
  if (!input) return null;

  // Bare ID: 11-character alphanumeric + hyphens/underscores
  if (/^[\w-]{11}$/.test(input)) {
    return input;
  }

  // Full URL formats
  try {
    const url = new URL(input);
    // youtube.com/watch?v=ID
    if (url.searchParams.has('v')) {
      return url.searchParams.get('v');
    }
    // youtu.be/ID
    if (url.hostname === 'youtu.be') {
      return url.pathname.slice(1).split('/')[0] || null;
    }
    // youtube.com/embed/ID or youtube.com/v/ID
    const embedMatch = url.pathname.match(/\/(embed|v)\/([\w-]+)/);
    if (embedMatch) {
      return embedMatch[2];
    }
  } catch {
    // Not a valid URL — treat as bare ID
  }

  // Fallback: return as-is (could be an ID without strict 11-char match)
  return input;
}

/**
 * Format yt-transcript results for TTY display.
 * @param {object} data - yt-transcript result object
 * @returns {string}
 */
function formatYtTranscript(data) {
  const lines = [];

  lines.push(banner('YouTube Transcript'));
  lines.push('');

  if (data.error) {
    lines.push(color.red(`Error: ${data.error}`));
    if (data.install_hint) {
      lines.push(color.yellow(`Install: ${data.install_hint}`));
    }
    return lines.join('\n');
  }

  if (!data.has_subtitles) {
    lines.push(color.yellow(data.message || 'No subtitles available for this video'));
    lines.push(color.dim(`Video ID: ${data.video_id}`));
    return lines.join('\n');
  }

  // Metadata header
  lines.push(color.bold('Video ID: ') + data.video_id);
  lines.push(color.dim(`Language: ${data.language}${data.auto_generated ? ' (auto-generated)' : ''}`));
  lines.push(color.dim(`Words: ${data.word_count} | Characters: ${data.char_count}`));
  lines.push('');

  // Transcript text (truncated for display, full in JSON)
  const displayLimit = 2000;
  if (data.transcript.length > displayLimit) {
    lines.push(data.transcript.slice(0, displayLimit));
    lines.push('');
    lines.push(color.dim(`... truncated for display (${data.char_count} chars total). Use JSON output for full transcript.`));
  } else {
    lines.push(data.transcript);
  }

  return lines.join('\n');
}

/**
 * Command handler: research yt-transcript
 * Extract and clean YouTube video transcripts via yt-dlp subtitle download.
 *
 * @param {string} cwd - Project root directory
 * @param {string[]} args - Command arguments
 * @param {boolean} raw - Raw output mode
 */
function cmdResearchYtTranscript(cwd, args, raw) {
  // 1. Check yt-dlp availability
  const cliTools = detectCliTools(cwd);
  if (!cliTools['yt-dlp'].available) {
    const result = { error: 'yt-dlp not installed', install_hint: 'pip install yt-dlp', available: false };
    output(result, { formatter: formatYtTranscript, raw });
    return;
  }

  // 2. Parse args
  const keepTimestamps = args.includes('--timestamps');
  const lang = parseFlag(args, '--lang', 'en');

  // Extract positional video ID/URL (first arg not starting with --)
  const positional = args.filter(a => !a.startsWith('--'));
  // Remove flag values from positional
  const flagValues = new Set();
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--lang' && i + 1 < args.length) {
      flagValues.add(args[i + 1]);
    }
  }
  const videoInput = positional.filter(a => !flagValues.has(a))[0];

  if (!videoInput) {
    const result = { error: 'Missing video ID or URL', usage: 'research:yt-transcript <video-id|url> [--timestamps] [--lang LANG]' };
    output(result, { formatter: formatYtTranscript, raw });
    return;
  }

  const videoId = extractVideoId(videoInput);
  if (!videoId) {
    const result = { error: 'Could not parse video ID from input', input: videoInput };
    output(result, { formatter: formatYtTranscript, raw });
    return;
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const ytdlpPath = cliTools['yt-dlp'].path || 'yt-dlp';

  // 3. Download subtitles to temp dir
  let tmpDir;
  try {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-yt-'));
  } catch (e) {
    const result = { error: 'Failed to create temp directory', details: e.message };
    output(result, { formatter: formatYtTranscript, raw });
    return;
  }

  try {
    try {
      execFileSync(ytdlpPath, [
        '--write-sub',
        '--write-auto-sub',
        '--sub-lang', lang + ',en,en-auto',
        '--sub-format', 'vtt',
        '--skip-download',
        '--no-warnings',
        '-o', path.join(tmpDir, '%(id)s'),
        videoUrl,
      ], { encoding: 'utf-8', timeout: 30000, stdio: 'pipe' });
    } catch (err) {
      // yt-dlp exits non-zero for some cases but still writes subtitle files.
      // Only treat as hard error if no files were written at all.
      debugLog('research.yt-transcript', `yt-dlp exited with error: ${err.message}`);
    }

    // 4. Find VTT file in tmpDir
    let vttFiles;
    try {
      vttFiles = fs.readdirSync(tmpDir).filter(f => f.endsWith('.vtt'));
    } catch {
      vttFiles = [];
    }

    if (vttFiles.length === 0) {
      const result = {
        video_id: videoId,
        error: null,
        transcript: null,
        message: 'No subtitles available for this video',
        has_subtitles: false,
      };
      output(result, { formatter: formatYtTranscript, raw });
      return;
    }

    // Prefer exact lang match over auto-generated
    let selectedFile = vttFiles[0]; // fallback to first
    let autoGenerated = true;
    let detectedLang = lang;

    for (const f of vttFiles) {
      // yt-dlp file naming: {id}.{lang}.vtt
      const parts = f.replace('.vtt', '').split('.');
      const fileLang = parts.length > 1 ? parts.slice(1).join('.') : '';

      if (fileLang === lang) {
        selectedFile = f;
        autoGenerated = false;
        detectedLang = lang;
        break;
      }
      if (fileLang === 'en' && lang !== 'en') {
        selectedFile = f;
        autoGenerated = false;
        detectedLang = 'en';
      }
    }

    // Detect auto-generated from filename pattern (e.g., "en-auto" or just being the only option)
    if (selectedFile.includes('-auto')) {
      autoGenerated = true;
    }

    // 5. Parse VTT content
    const vttContent = fs.readFileSync(path.join(tmpDir, selectedFile), 'utf-8');
    const transcript = parseVtt(vttContent, keepTimestamps);

    // 8. Return structured result
    const wordCount = transcript.split(/\s+/).filter(Boolean).length;
    const charCount = transcript.length;

    const result = {
      video_id: videoId,
      has_subtitles: true,
      language: detectedLang,
      auto_generated: autoGenerated,
      transcript,
      word_count: wordCount,
      char_count: charCount,
    };

    output(result, { formatter: formatYtTranscript, raw });

  } finally {
    // 7. Clean up tmpDir
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      debugLog('research.yt-transcript', `failed to clean up tmpDir: ${tmpDir}`);
    }
  }
}

// ─── Source Collection Pipeline ──────────────────────────────────────────────

/**
 * Collect web sources via util:websearch subprocess.
 * Returns array of structured source objects, empty array on failure.
 *
 * @param {string} cwd - Project root directory
 * @param {string} query - Search query
 * @param {object} config - Loaded config object
 * @param {number} timeout - Timeout in milliseconds
 * @returns {object[]}
 */
function collectWebSources(cwd, query, config, timeout) {
  try {
    const stdout = execFileSync(process.execPath, [
      process.argv[1], 'util:websearch', query, '--limit', '5',
    ], { encoding: 'utf-8', timeout, stdio: 'pipe', cwd });

    const data = JSON.parse(stdout);
    if (data.results && Array.isArray(data.results)) {
      return data.results.map(r => ({
        type: 'web',
        title: r.title || '',
        url: r.url || '',
        snippet: r.description || '',
        source: 'brave_search',
      }));
    }
    return [];
  } catch (err) {
    debugLog('research.collect', `collectWebSources failed: ${err.message}`);
    return [];
  }
}

/**
 * Collect YouTube sources via research:yt-search and research:yt-transcript subprocesses.
 * Returns array of structured source objects, empty array on failure.
 *
 * @param {string} cwd - Project root directory
 * @param {string} query - Search query
 * @param {object} config - Loaded config object
 * @param {number} timeout - Timeout in milliseconds
 * @returns {object[]}
 */
function collectYouTubeSources(cwd, query, config, timeout) {
  try {
    // Step 1: Search YouTube
    const searchStdout = execFileSync(process.execPath, [
      process.argv[1], 'research:yt-search', query, '--count', '3',
    ], { encoding: 'utf-8', timeout, stdio: 'pipe', cwd });

    const searchData = JSON.parse(searchStdout);
    if (!searchData.results || searchData.results.length === 0) {
      return [];
    }

    const sources = searchData.results.map(r => ({
      type: 'youtube',
      title: r.title || '',
      url: r.url || '',
      channel: r.channel || '',
      duration: r.duration,
      quality_score: r.quality_score,
      source: 'yt-dlp',
      transcript: null,
    }));

    // Step 2: Get transcript for top result only (expensive)
    const topVideo = searchData.results[0];
    if (topVideo && topVideo.id) {
      try {
        const transcriptStdout = execFileSync(process.execPath, [
          process.argv[1], 'research:yt-transcript', topVideo.id,
        ], { encoding: 'utf-8', timeout, stdio: 'pipe', cwd });

        const transcriptData = JSON.parse(transcriptStdout);
        if (transcriptData.has_subtitles && transcriptData.transcript) {
          sources[0].transcript = transcriptData.transcript;
        }
      } catch (err) {
        debugLog('research.collect', `transcript fetch failed for ${topVideo.id}: ${err.message}`);
      }
    }

    return sources;
  } catch (err) {
    debugLog('research.collect', `collectYouTubeSources failed: ${err.message}`);
    return [];
  }
}

/**
 * Escape a string for use in XML attributes.
 * @param {string} str
 * @returns {string}
 */
function escapeXmlAttr(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Truncate transcript text at a word boundary, appending truncation notice.
 * @param {string} text - Full transcript text
 * @param {number} maxChars - Maximum characters (default: 3000)
 * @returns {string}
 */
function truncateTranscript(text, maxChars) {
  if (!text) return '';
  maxChars = maxChars || 3000;
  if (text.length <= maxChars) return text;

  // Find last space before maxChars
  const truncated = text.slice(0, maxChars);
  const lastSpace = truncated.lastIndexOf(' ');
  const cutPoint = lastSpace > 0 ? lastSpace : maxChars;
  return text.slice(0, cutPoint) + '\n[...transcript truncated]';
}

/**
 * Format collected sources into XML-tagged string for agent consumption.
 * Used in agent_context field at Tier 2/3.
 *
 * @param {object[]} sources - Array of source objects
 * @param {string} query - The original research query
 * @returns {string} XML-tagged string or empty string if no sources
 */
function formatSourcesForAgent(sources, query) {
  if (!sources || sources.length === 0) return '';

  const lines = [];
  lines.push('<collected_sources>');
  lines.push(`<research_query>${escapeXmlAttr(query)}</research_query>`);

  for (const src of sources) {
    if (src.type === 'youtube') {
      lines.push(`<source type="youtube" title="${escapeXmlAttr(src.title)}" url="${escapeXmlAttr(src.url)}" channel="${escapeXmlAttr(src.channel)}">`);
      if (src.transcript) {
        lines.push(truncateTranscript(src.transcript));
      } else {
        lines.push(`[Video: ${escapeXmlAttr(src.title)} — transcript unavailable]`);
      }
      lines.push('</source>');
    } else {
      // web source
      lines.push(`<source type="web" title="${escapeXmlAttr(src.title)}" url="${escapeXmlAttr(src.url)}">`);
      lines.push(src.snippet || '');
      lines.push('</source>');
    }
  }

  lines.push('</collected_sources>');
  return lines.join('\n');
}

/**
 * Format research:collect data for TTY display.
 * @param {object} data - Collect result object
 * @returns {string}
 */
function formatCollect(data) {
  const lines = [];

  lines.push(banner('Research Collection'));
  lines.push('');

  // Tier display
  const tierColor = data.tier <= 2 ? color.green : data.tier === 3 ? color.yellow : color.red;
  lines.push(color.bold('Tier: ') + tierColor(`${data.tier} — ${data.tier_name}`));

  if (data.skipped) {
    lines.push(color.dim(`Skipped: ${data.skipped}`));
    return lines.join('\n');
  }

  lines.push('');

  // Source table
  if (data.sources && data.sources.length > 0) {
    const rows = data.sources.map(s => {
      const typeIcon = s.type === 'youtube' ? color.red('YT') : color.blue('WEB');
      return [typeIcon, truncate(s.title || '', 50), s.source || ''];
    });
    lines.push(formatTable(['Type', 'Title', 'Source'], rows));
  } else {
    lines.push(color.dim('No sources collected'));
  }

  // Timing
  if (data.timing) {
    lines.push('');
    const webSec = data.timing.web_ms ? (data.timing.web_ms / 1000).toFixed(1) + 's' : '—';
    const ytSec = data.timing.youtube_ms ? (data.timing.youtube_ms / 1000).toFixed(1) + 's' : '—';
    const totalSec = data.timing.total_ms ? (data.timing.total_ms / 1000).toFixed(1) + 's' : '—';
    lines.push(color.dim(`Timing: web ${webSec} | youtube ${ytSec} | total ${totalSec}`));
  }

  return lines.join('\n');
}

/**
 * Command handler: research collect
 * Orchestrates multi-source collection with tier-aware degradation, progressive status,
 * --quick bypass, and XML-tagged agent_context formatting.
 *
 * @param {string} cwd - Project root directory
 * @param {string[]} args - Command arguments
 * @param {boolean} raw - Raw output mode
 */
function cmdResearchCollect(cwd, args, raw) {
  const config = loadConfig(cwd);
  const ragEnabled = config.rag_enabled !== false;

  // Parse --quick flag
  const quick = args.includes('--quick');

  // Quick mode: bypass pipeline entirely
  if (quick || !ragEnabled) {
    const result = {
      tier: 4,
      tier_name: 'Pure LLM',
      query: args.filter(a => !a.startsWith('--')).join(' ').trim() || '',
      skipped: quick ? 'quick_flag' : 'rag_disabled',
      source_count: 0,
      sources: [],
      timing: { web_ms: 0, youtube_ms: 0, total_ms: 0 },
      agent_context: '',
    };
    output(result, { formatter: formatCollect, raw });
    return;
  }

  // Detect tools and calculate tier
  const cliTools = detectCliTools(cwd);
  const mcpServers = detectMcpServers(cwd);
  const tier = calculateTier(cliTools, mcpServers, ragEnabled);

  // Extract query from positional args (filter out --prefixed args and their values)
  const flagValues = new Set();
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length && !args[i + 1].startsWith('--')) {
      flagValues.add(args[i + 1]);
    }
  }
  const query = args.filter(a => !a.startsWith('--')).filter(a => !flagValues.has(a)).join(' ').trim();

  if (!query) {
    const result = { error: 'Missing search query', usage: 'research:collect "topic" [--quick]' };
    output(result, { formatter: formatCollect, raw });
    return;
  }

  // Allocate per-stage timeout
  const stageTimeout = Math.max(5000, Math.floor((config.rag_timeout || 30) * 1000 / 2));

  const allSources = [];
  const timing = {};
  const pipelineStart = Date.now();

  // Stage 1: Web sources
  status('[1/3] Collecting web sources...');
  const webStart = Date.now();
  const webSources = collectWebSources(cwd, query, config, stageTimeout);
  timing.web_ms = Date.now() - webStart;
  allSources.push(...webSources);

  // Stage 2: YouTube sources
  if (cliTools['yt-dlp'] && cliTools['yt-dlp'].available) {
    status('[2/3] Searching YouTube...');
    const ytStart = Date.now();
    const ytSources = collectYouTubeSources(cwd, query, config, stageTimeout);
    timing.youtube_ms = Date.now() - ytStart;
    allSources.push(...ytSources);
  } else {
    status('[2/3] YouTube: skipped (yt-dlp not installed)');
    timing.youtube_ms = 0;
  }

  // Stage 3: Context7 availability note
  timing.context7_available = !!(mcpServers['context7'] && mcpServers['context7'].configured && mcpServers['context7'].enabled);
  status('[3/3] Context7: available to agent directly via MCP');

  timing.total_ms = Date.now() - pipelineStart;

  // Build agent_context XML
  const agent_context = formatSourcesForAgent(allSources, query);

  status(`Research collection complete: ${allSources.length} sources, Tier ${tier.number} (${timing.total_ms}ms)`);

  const result = {
    tier: tier.number,
    tier_name: tier.name,
    query,
    source_count: allSources.length,
    sources: allSources,
    timing,
    agent_context,
  };

  output(result, { formatter: formatCollect, raw });
}

module.exports = { detectCliTools, detectMcpServers, calculateTier, cmdResearchCapabilities, cmdResearchYtSearch, cmdResearchYtTranscript, cmdResearchCollect, collectWebSources, collectYouTubeSources, formatSourcesForAgent, parseVtt };
