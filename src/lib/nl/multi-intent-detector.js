// Multi-Intent Detector - Detects and sequences multiple intents in compound commands
// Uses nl-parser for single-intent parsing

const { parse } = require('./nl-parser.js');

/**
 * Detect if input contains multiple intents
 * @param {string} text - User input
 * @returns {Object} {isCompound: boolean, intents: []}
 */
function detectIntents(text) {
  if (!text || typeof text !== 'string') {
    return { isCompound: false, intents: [] };
  }

  const trimmed = text.trim().toLowerCase();
  const intents = [];

  // Compound command patterns (include aliases)
  const compoundPatterns = [
    // "plan and execute", "plan then execute", "run tests then check coverage"
    /\b(plan|execute|verify|debug|test|build|deploy|run|check)\b.*\b(and|then|,)\b.*\b(plan|execute|verify|debug|test|build|deploy|run|check)\b/i,
    // "plan, execute, verify"
    /^[^,]+,.*,.*$/i,
    // "plan X and verify it"
    /\b(plan|execute|verify|run|check)\b.*\b(and|then)\b.*\b(it|them|that)\b/i
  ];

  const isCompound = compoundPatterns.some(pattern => pattern.test(trimmed));

  if (isCompound) {
    // Extract individual intents - use regex to find all intent words in order
    // Include aliases for intent matching
    const intentWords = ['plan', 'execute', 'exec', 'run', 'verify', 'check', 'debug', 'test', 'build', 'deploy'];
    const intentAlias = {
      'exec': 'execute',
      'run': 'execute',
      'check': 'verify'
    };
    
    // Build a regex that finds all intent words in order
    const intentPattern = new RegExp('\\b(' + intentWords.join('|') + ')\\b', 'gi');
    
    let match;
    while ((match = intentPattern.exec(trimmed)) !== null) {
      // Resolve alias
      let normalizedIntent = match[1].toLowerCase();
      if (intentAlias[normalizedIntent]) {
        normalizedIntent = intentAlias[normalizedIntent];
      }
      
      // Extract a reasonable context around each intent
      const start = Math.max(0, match.index - 20);
      const end = Math.min(trimmed.length, match.index + 30);
      const raw = trimmed.slice(start, end).trim();
      
      intents.push({ intent: normalizedIntent, raw });
    }
    
    // If no matches found, fall back to full text
    if (intents.length === 0) {
      intents.push({ intent: null, raw: trimmed });
    }
  }

  return {
    isCompound,
    intents: intents.length > 0 ? intents : [{ intent: null, raw: trimmed }]
  };
}

/**
 * Parse compound command into ordered intent objects
 * @param {string} text - Compound command text
 * @returns {Array} [{intent: "plan", target: "phase 5"}, ...]
 */
function parseCompoundCommand(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const { intents } = detectIntents(text);
  const result = [];
  
  // Extract phase numbers from text
  const phaseMatch = text.match(/phase\s*(\d+)/i);
  const phase = phaseMatch ? `phase ${phaseMatch[1]}` : null;

  // Intent type normalization
  const intentMap = {
    'exec': 'execute',
    'run': 'execute',
    'plan': 'plan',
    'verify': 'verify',
    'check': 'verify',
    'debug': 'debug',
    'test': 'test',
    'build': 'build',
    'deploy': 'deploy'
  };

  for (const item of intents) {
    const normalizedIntent = intentMap[item.intent] || item.intent;
    
    // Try to extract specific target from the segment
    let target = phase;
    const segmentPhaseMatch = item.raw.match(/phase\s*(\d+)/i);
    if (segmentPhaseMatch) {
      target = `phase ${segmentPhaseMatch[1]}`;
    } else if (item.raw.includes('it') || item.raw.includes('them') || item.raw.includes('that')) {
      // Pronoun reference - use phase from main text if available
      target = phase || 'current';
    }

    result.push({
      intent: normalizedIntent,
      target: target,
      raw: item.raw
    });
  }

  return result;
}

/**
 * Order intents respecting dependencies (plan before exec, exec before verify)
 * @param {Array} intents - Array of intent objects
 * @returns {Array} Ordered intents
 */
function sequenceIntents(intents) {
  if (!intents || intents.length === 0) {
    return [];
  }

  if (intents.length === 1) {
    return intents;
  }

  // Intent order weights (lower = earlier)
  const intentOrder = {
    'plan': 1,
    'execute': 2,
    'debug': 3,
    'test': 4,
    'verify': 5,
    'build': 6,
    'deploy': 7
  };

  // Sort by intent order
  const sorted = [...intents].sort((a, b) => {
    const orderA = intentOrder[a.intent] || 99;
    const orderB = intentOrder[b.intent] || 99;
    return orderA - orderB;
  });

  // Check for missing links in the chain
  const warnings = [];
  const intentTypes = sorted.map(i => i.intent);
  
  // Detect missing links
  if (intentTypes.includes('plan') && !intentTypes.includes('execute') && !intentTypes.includes('verify')) {
    warnings.push('After planning, consider executing the plan');
  }
  if (intentTypes.includes('execute') && !intentTypes.includes('verify')) {
    warnings.push('After executing, consider verifying the results');
  }

  return sorted.map(item => ({
    ...item,
    warnings: warnings.length > 0 ? warnings : undefined
  }));
}

/**
 * Main detection function - combines detection and parsing
 * @param {string} text - User input
 * @returns {Object} Parsed result with intents
 */
function detectAndParse(text) {
  const isCompound = detectIntents(text).isCompound;
  
  if (!isCompound) {
    // Use nl-parser for single intent
    const parsed = parse(text);
    return {
      isCompound: false,
      intents: parsed.parsed ? [{ intent: parsed.intent || parsed.command, target: parsed.params }] : []
    };
  }

  const parsed = parseCompoundCommand(text);
  const sequenced = sequenceIntents(parsed);

  return {
    isCompound: true,
    intents: sequenced,
    chain: sequenced.map(i => i.intent).join(' → ')
  };
}

module.exports = {
  detectIntents,
  parseCompoundCommand,
  sequenceIntents,
  detectAndParse
};
