// Parameter extraction for natural language commands
// Extracts phase numbers, flags, and targets from user input

/**
 * Extract phase number from input
 * Matches patterns: "phase 5", "p5", "phase98", standalone 2-digit numbers
 * @param {string} input - User input string
 * @returns {number|null} Extracted phase number or null
 */
function extractPhaseNumber(input) {
  if (!input || typeof input !== 'string') {
    return null;
  }
  
  const normalizedInput = input.toLowerCase();
  
  // Pattern 1: "phase 5" or "phase 98"
  const phasePattern1 = /\bphase\s+(\d{1,3})\b/i;
  const match1 = normalizedInput.match(phasePattern1);
  if (match1) {
    return parseInt(match1[1], 10);
  }
  
  // Pattern 2: "p5" or "p98" (single letter followed by digits)
  const phasePattern2 = /\b[pP](\d{1,3})\b/;
  const match2 = normalizedInput.match(phasePattern2);
  if (match2) {
    return parseInt(match2[1], 10);
  }
  
  // Pattern 3: "phase98" (no space)
  const phasePattern3 = /\bphase(\d{1,3})\b/i;
  const match3 = normalizedInput.match(phasePattern3);
  if (match3) {
    return parseInt(match3[1], 10);
  }
  
  // Pattern 4: Standalone 2-digit number (e.g., "5" or "98" as separate word)
  const phasePattern4 = /\b(\d{2})\b/;
  const match4 = normalizedInput.match(phasePattern4);
  if (match4) {
    return parseInt(match4[1], 10);
  }
  
  return null;
}

/**
 * Extract flags from input
 * Supports: --flag, -f, and keyword flags (force, verbose, debug, auto, dry-run)
 * @param {string} input - User input string
 * @returns {string[]} Array of flag names
 */
function extractFlags(input) {
  if (!input || typeof input !== 'string') {
    return [];
  }
  
  const flags = [];
  const normalizedInput = input.toLowerCase();
  
  // Keyword flag mappings
  const keywordFlags = {
    'force': 'force',
    'forced': 'force',
    'verbose': 'verbose',
    'debug': 'debug',
    'auto': 'auto',
    'automatic': 'auto',
    'dry-run': 'dry-run',
    'dryrun': 'dry-run',
    'quiet': 'quiet',
    'fast': 'fast'
  };
  
  // Pattern: --flag or -f
  const dashFlagPattern = /(-{1,2})(\w+)/g;
  let match;
  while ((match = dashFlagPattern.exec(input)) !== null) {
    flags.push(match[2].toLowerCase());
  }
  
  // Pattern: keyword flags
  const words = normalizedInput.split(/\s+/);
  for (const word of words) {
    const cleanWord = word.replace(/[^a-z0-9-]/g, '');
    if (keywordFlags[cleanWord]) {
      const flag = keywordFlags[cleanWord];
      if (!flags.includes(flag)) {
        flags.push(flag);
      }
    }
  }
  
  return flags;
}

/**
 * Extract target from input
 * Returns remaining text after intent/command words are removed
 * @param {string} input - User input string
 * @param {Object} options - Options object
 * @param {string} [options.intent] - Detected intent to filter
 * @returns {string|null} Extracted target or null
 */
function extractTarget(input, options = {}) {
  if (!input || typeof input !== 'string') {
    return null;
  }
  
  let filtered = input;
  
  // Remove common command words based on intent
  if (options.intent) {
    const intentWords = {
      plan: ['plan', 'planning', 'create', 'new', 'make', 'add'],
      execute: ['execute', 'executing', 'run', 'running', 'start', 'go', 'do', 'implement'],
      verify: ['verify', 'verifying', 'check', 'checking', 'test', 'testing', 'validate', 'confirm', 'audit'],
      query: ['show', 'display', 'list', 'get', 'find', 'search', 'what', 'how', 'status', 'progress']
    };
    
    const wordsToRemove = intentWords[options.intent] || [];
    for (const word of wordsToRemove) {
      const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi');
      filtered = filtered.replace(regex, '');
    }
  }
  
  // Remove phase patterns
  filtered = filtered.replace(/\bphase\s+\d{1,3}\b/gi, '');
  filtered = filtered.replace(/\b[pP]\d{1,3}\b/g, '');
  filtered = filtered.replace(/\bphase\d{1,3}\b/gi, '');
  
  // Remove flags
  filtered = filtered.replace(/-{1,2}\w+\b/g, '');
  
  // Clean up and return
  filtered = filtered.trim();
  
  return filtered || null;
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { extractPhaseNumber, extractFlags, extractTarget };
