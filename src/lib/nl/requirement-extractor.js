// Requirement Extractor - Converts natural language goal descriptions to structured requirements
// with clarifying questions for ambiguous areas

/**
 * Parse goal description to extract key entities and intent
 * @param {string} text - Natural language goal description
 * @returns {Object} {entities: [], missing: [], confidence: 0.X}
 */
function parseGoalDescription(text) {
  if (!text || typeof text !== 'string') {
    return { entities: [], missing: [], confidence: 0 };
  }

  const trimmed = text.trim().toLowerCase();
  const entities = [];
  const missing = [];
  let confidence = 0.5;

  // Feature type detection
  const featurePatterns = [
    { type: 'auth', keywords: ['auth', 'authentication', 'login', 'password', 'user management', 'sign in', 'sign up', 'oauth', 'sso'] },
    { type: 'api', keywords: ['api', 'endpoint', 'rest', 'route', 'controller', 'request', 'response'] },
    { type: 'ui', keywords: ['ui', 'interface', 'component', 'button', 'form', 'modal', 'page', 'screen', 'view'] },
    { type: 'database', keywords: ['database', 'db', 'schema', 'table', 'model', 'migration', 'query'] },
    { type: 'storage', keywords: ['storage', 'file', 'upload', 'download', 's3', 'bucket'] },
    { type: 'notification', keywords: ['notification', 'email', 'sms', 'push', 'webhook', 'alert'] },
    { type: 'testing', keywords: ['test', 'spec', 'coverage', 'unit', 'integration', 'e2e'] },
    { type: 'config', keywords: ['config', 'setting', 'environment', 'env', 'flag'] }
  ];

  for (const pattern of featurePatterns) {
    for (const keyword of pattern.keywords) {
      if (trimmed.includes(keyword)) {
        entities.push({ type: 'feature', value: pattern.type, keyword });
        confidence += 0.1;
        break;
      }
    }
  }

  // Scope detection
  const scopePatterns = [
    { scope: 'simple', keywords: ['simple', 'basic', 'minimal', 'just', 'only'] },
    { scope: 'complex', keywords: ['complex', 'advanced', 'full', 'complete', 'comprehensive'] },
    { scope: 'partial', keywords: ['partial', 'some', 'partially', 'a bit'] }
  ];

  for (const pattern of scopePatterns) {
    for (const keyword of pattern.keywords) {
      if (trimmed.includes(keyword)) {
        entities.push({ type: 'scope', value: pattern.scope, keyword });
        confidence = Math.min(confidence + 0.15, 1.0);
        break;
      }
    }
  }

  // Priority detection
  const priorityPatterns = [
    { priority: 'high', keywords: ['urgent', 'asap', 'critical', 'important', 'priority', 'soon'] },
    { priority: 'low', keywords: ['eventually', 'later', 'whenever', 'nice to have', 'optional'] }
  ];

  for (const pattern of priorityPatterns) {
    for (const keyword of pattern.keywords) {
      if (trimmed.includes(keyword)) {
        entities.push({ type: 'priority', value: pattern.priority, keyword });
        break;
      }
    }
  }

  // Detect missing information
  if (!entities.some(e => e.type === 'feature')) {
    missing.push('feature_type');
    confidence -= 0.1;
  }

  if (!entities.some(e => e.type === 'scope')) {
    missing.push('scope');
  }

  return {
    entities,
    missing,
    confidence: Math.max(0, Math.min(1, confidence))
  };
}

/**
 * Generate clarifying questions based on ambiguous areas
 * @param {Object} partialRequirements - Output from parseGoalDescription
 * @returns {Array} Array of question objects {text, options?, type}
 */
function generateClarifyingQuestions(partialRequirements) {
  const questions = [];
  const { entities, missing } = partialRequirements;

  // Check what's missing and generate appropriate questions
  if (missing.includes('feature_type') || !entities.some(e => e.type === 'feature')) {
    questions.push({
      text: 'What type of feature are you building?',
      options: [
        'User authentication (login, signup, password reset)',
        'API endpoint or service',
        'User interface component or page',
        'Database schema or model',
        'File storage or upload',
        'Notifications or alerts',
        'Tests or validation',
        'Configuration or settings'
      ],
      type: 'feature_type'
    });
  }

  if (missing.includes('scope') || !entities.some(e => e.type === 'scope')) {
    questions.push({
      text: 'What is the scope of this feature?',
      options: [
        'Simple - basic functionality only',
        'Medium - standard features with common cases',
        'Full - complete implementation with edge cases'
      ],
      type: 'scope'
    });
  }

  // Ask about dependencies if feature is complex
  const scopeEntity = entities.find(e => e.type === 'scope');
  if (scopeEntity && scopeEntity.value === 'complex') {
    questions.push({
      text: 'Does this feature depend on any other features?',
      options: [
        'No - standalone feature',
        'Yes - authentication needed first',
        'Yes - database setup needed first',
        'Yes - other services/APIs needed'
      ],
      type: 'dependencies'
    });
  }

  // Ask about integrations for certain features
  const featureEntity = entities.find(e => e.type === 'feature');
  if (featureEntity && featureEntity.value === 'api') {
    questions.push({
      text: 'What type of API do you need?',
      options: [
        'REST API with standard CRUD',
        'GraphQL API',
        'WebSocket for real-time',
        'Webhook / callback endpoint'
      ],
      type: 'api_type'
    });
  }

  return questions;
}

/**
 * Convert goal + answers to structured requirements object
 * @param {string} goalText - Original goal description
 * @param {Object} answers - User answers to clarifying questions
 * @returns {Object} {requirements: [], scope, priority}
 */
function extractRequirements(goalText, answers = {}) {
  const parsed = parseGoalDescription(goalText);
  const requirements = [];

  // Add feature requirement
  const featureEntity = parsed.entities.find(e => e.type === 'feature');
  if (featureEntity) {
    requirements.push({
      type: 'feature',
      name: featureEntity.value,
      description: goalText
    });
  }

  // Determine scope
  let scope = 'medium';
  if (parsed.entities.some(e => e.type === 'scope' && e.value === 'simple')) {
    scope = 'simple';
  } else if (parsed.entities.some(e => e.type === 'scope' && e.value === 'complex')) {
    scope = 'complex';
  }

  // Override scope from answers if provided
  if (answers.scope) {
    scope = answers.scope;
  }

  // Determine priority
  let priority = 'medium';
  const priorityEntity = parsed.entities.find(e => e.type === 'priority');
  if (priorityEntity) {
    priority = priorityEntity.value;
  }
  if (answers.priority) {
    priority = answers.priority;
  }

  // Add requirements based on feature type
  if (featureEntity) {
    switch (featureEntity.value) {
      case 'auth':
        requirements.push({
          type: 'implementation',
          name: 'authentication',
          specifics: answers.auth_type ? [answers.auth_type] : []
        });
        break;
      case 'api':
        requirements.push({
          type: 'implementation',
          name: 'api_endpoint',
          specifics: answers.api_type ? [answers.api_type] : []
        });
        break;
      case 'ui':
        requirements.push({
          type: 'implementation',
          name: 'interface_component',
          specifics: []
        });
        break;
      case 'database':
        requirements.push({
          type: 'implementation',
          name: 'data_model',
          specifics: []
        });
        break;
    }
  }

  // Add dependency requirements if specified
  if (answers.dependencies && answers.dependencies !== 'No - standalone feature') {
    requirements.push({
      type: 'dependency',
      name: 'prerequisite',
      description: answers.dependencies
    });
  }

  return {
    requirements,
    scope,
    priority,
    originalGoal: goalText,
    parsed: parsed
  };
}

module.exports = {
  parseGoalDescription,
  generateClarifyingQuestions,
  extractRequirements
};
