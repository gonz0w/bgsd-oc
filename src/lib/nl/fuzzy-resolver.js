// Fuzzy matching resolver using Fuse.js
// Provides fuzzy string matching with threshold 0.4 for NL command resolution

const Fuse = require('fuse.js');

// Lazy-loaded Fuse instance (loaded on first use)
let fuseInstance = null;
let fuseData = null;

/**
 * Initialize or get cached Fuse instance
 * @param {Array} data - Array of phrase objects to search
 * @returns {Fuse} Fuse instance
 */
function getFuseInstance(data) {
  if (fuseInstance && fuseData === data) {
    return fuseInstance;
  }
  
  const options = {
    keys: ['phrase'],
    threshold: 0.4,
    distance: 100,
    includeScore: true,
    minMatchCharLength: 2,
    shouldSort: true,
    findAllMatches: false,
    ignoreLocation: true
  };
  
  fuseInstance = new Fuse(data, options);
  fuseData = data;
  
  return fuseInstance;
}

/**
 * FuzzyResolver class for NL command resolution
 */
class FuzzyResolver {
  constructor(data = null) {
    this.data = data;
    this.fuse = null;
    this.initialized = false;
  }
  
  /**
   * Initialize the resolver with phrase data
   * @param {Array} data - Array of {phrase, command, intent} objects
   */
  initialize(data) {
    if (!data || !Array.isArray(data)) {
      throw new Error('FuzzyResolver requires an array of phrase data');
    }
    this.data = data;
    this.fuse = getFuseInstance(data);
    this.initialized = true;
  }
  
  /**
   * Resolve input to best matching phrase
   * @param {string} input - User input to resolve
   * @returns {Array} Array of {phrase, command, score} sorted by score
   */
  resolve(input) {
    if (!input || typeof input !== 'string') {
      return [];
    }
    
    if (!this.initialized) {
      // Lazy load command registry
      const { PHRASES } = require('./command-registry.js');
      this.initialize(PHRASES);
    }
    
    const normalizedInput = input.toLowerCase().trim();
    const results = this.fuse.search(normalizedInput);
    
    return results.map(result => ({
      phrase: result.item.phrase,
      command: result.item.command,
      intent: result.item.intent,
      score: result.score,
      confidence: 1 - result.score
    })).slice(0, 5);
  }
  
  /**
   * Find best match only
   * @param {string} input - User input
   * @returns {Object|null} Best match or null
   */
  findBest(input) {
    const results = this.resolve(input);
    return results.length > 0 ? results[0] : null;
  }
  
  /**
   * Check if input has a good match (confidence >= threshold)
   * @param {string} input - User input
   * @param {number} threshold - Confidence threshold (default 0.6)
   * @returns {boolean} True if good match exists
   */
  hasGoodMatch(input, threshold = 0.6) {
    const best = this.findBest(input);
    return best !== null && best.confidence >= threshold;
  }
}

module.exports = { FuzzyResolver, getFuseInstance };
