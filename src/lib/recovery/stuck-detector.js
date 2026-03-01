/**
 * Stuck/Loop Detection Module
 * 
 * Tracks failure patterns per task and triggers recovery after >2 retries
 * on the same error. Provides rollback and alternative strategy suggestions.
 */

const SEVERITY = require('../review/severity.js').SEVERITY;

/**
 * Configuration for stuck detection
 */
const DEFAULT_CONFIG = {
  maxRetries: 2,
  detectionWindow: 10, // Consider last N attempts
  similarityThreshold: 0.8 // Error message similarity threshold
};

/**
 * StuckDetector - Tracks task execution patterns
 */
class StuckDetector {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.taskHistory = new Map(); // taskId -> [{ error, timestamp, attempt }]
    this.recoveryCallbacks = [];
  }

  /**
   * Record a task attempt
   * @param {string} taskId - Unique task identifier
   * @param {Object} attempt - Attempt details
   */
  recordAttempt(taskId, { error, timestamp = Date.now() }) {
    if (!this.taskHistory.has(taskId)) {
      this.taskHistory.set(taskId, []);
    }
    
    const history = this.taskHistory.get(taskId);
    const attempt = {
      error: this._normalizeError(error),
      timestamp,
      attemptNumber: history.length + 1
    };
    
    history.push(attempt);
    
    // Keep only last N attempts within detection window
    if (history.length > this.config.detectionWindow) {
      history.shift();
    }
    
    // Check if stuck
    if (this.isStuck(taskId)) {
      this._triggerRecovery(taskId);
    }
  }

  /**
   * Check if a task is stuck (repeated same error > maxRetries)
   * @param {string} taskId - Task identifier
   * @returns {boolean} True if stuck
   */
  isStuck(taskId) {
    const history = this.taskHistory.get(taskId);
    if (!history || history.length <= this.config.maxRetries) {
      return false;
    }
    
    // Get last N attempts
    const recentAttempts = history.slice(-this.config.maxRetries - 1);
    
    // Check if all recent attempts have similar errors
    const firstError = recentAttempts[0].error;
    return recentAttempts.every(attempt => 
      this._errorsSimilar(attempt.error, firstError)
    );
  }

  /**
   * Get stuck status for a task
   * @param {string} taskId - Task identifier
   * @returns {Object} Status object
   */
  getStatus(taskId) {
    const history = this.taskHistory.get(taskId);
    if (!history) {
      return { isStuck: false, attempts: 0, retryCount: 0 };
    }
    
    const isStuck = this.isStuck(taskId);
    const recentAttempts = history.slice(-this.config.maxRetries - 1);
    
    return {
      isStuck,
      attempts: history.length,
      retryCount: recentAttempts.length - 1,
      lastError: history[history.length - 1]?.error,
      recoveryTriggered: isStuck
    };
  }

  /**
   * Reset tracking for a task (e.g., after successful completion)
   * @param {string} taskId - Task identifier
   */
  reset(taskId) {
    this.taskHistory.delete(taskId);
  }

  /**
   * Register a recovery callback
   * @param {Function} callback - Recovery function(taskId, recoveryInfo)
   */
  onRecovery(callback) {
    this.recoveryCallbacks.push(callback);
  }

  /**
   * Normalize error message for comparison
   */
  _normalizeError(error) {
    if (typeof error === 'string') {
      return error.toLowerCase().replace(/\s+/g, ' ').trim();
    }
    if (error?.message) {
      return this._normalizeError(error.message);
    }
    return 'unknown error';
  }

  /**
   * Check if two errors are similar
   */
  _errorsSimilar(error1, error2) {
    if (error1 === error2) return true;
    
    // Simple similarity check - if one is substring of another
    const longer = error1.length > error2.length ? error1 : error2;
    const shorter = error1.length > error2.length ? error2 : error1;
    
    return longer.includes(shorter) && 
           longer.length / shorter.length < 2;
  }

  /**
   * Trigger recovery workflow
   */
  _triggerRecovery(taskId) {
    const history = this.taskHistory.get(taskId);
    const recoveryInfo = {
      taskId,
      attempts: history.length,
      errorPattern: history[history.length - 1]?.error,
      lastGoodState: this._findLastGoodState(taskId),
      suggestedApproaches: this._generateAlternatives(history)
    };
    
    for (const callback of this.recoveryCallbacks) {
      try {
        callback(taskId, recoveryInfo);
      } catch (err) {
        console.error(`Recovery callback error: ${err.message}`);
      }
    }
  }

  /**
   * Find last known good state (simplified)
   */
  _findLastGoodState(taskId) {
    // In a full implementation, would track state snapshots
    return { message: 'Last good state tracking not implemented' };
  }

  /**
   * Generate alternative approaches
   */
  _generateAlternatives(history) {
    const lastError = history[history.length - 1]?.error || '';
    
    const alternatives = [
      {
        approach: 'Pivot to checkpoint',
        description: 'Consider pivoting to a prior checkpoint: trajectory pivot <checkpoint-name> --reason "..."'
      },
      {
        approach: 'Take a break',
        description: 'Step away from this task, clear context, return with fresh perspective'
      },
      {
        approach: 'Simplify',
        description: 'Reduce scope, implement minimal viable version first'
      },
      {
        approach: 'Research',
        description: 'Look up documentation, examples, or similar implementations'
      }
    ];
    
    // Add specific suggestions based on error type
    if (lastError.includes('import') || lastError.includes('require')) {
      alternatives.push({
        approach: 'Check dependencies',
        description: 'Verify all imports are correct and packages are installed'
      });
    }
    
    if (lastError.includes('syntax')) {
      alternatives.push({
        approach: 'Validate syntax',
        description: 'Run linting or syntax checker to identify issues'
      });
    }
    
    return alternatives;
  }
}

/**
 * Create a stuck detector instance
 */
function createStuckDetector(config) {
  return new StuckDetector(config);
}

module.exports = {
  StuckDetector,
  createStuckDetector,
  DEFAULT_CONFIG
};
