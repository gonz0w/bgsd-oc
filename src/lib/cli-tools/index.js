/**
 * CLI Tools Index Module
 * 
 * Unified exports for all CLI tool wrappers.
 * Provides convenience functions for common pipelines.
 */

const { searchRipgrep, parseRipgrepJson, isRipgrepAvailable } = require('./ripgrep.js');
const { findFiles, findDirectories, findByExtension, isFdAvailable } = require('./fd.js');
const { transformJson, transformWithPreset, getFilterPresets, FILTER_PRESETS, isJqAvailable } = require('./jq.js');
const { parseYAML, transformYAML, YAMLtoJSON, transformWithPreset: transformYAMLWithPreset, getFilterPresets: getYqFilterPresets, FILTER_PRESETS: YQ_FILTER_PRESETS, isYqAvailable } = require('./yq.js');
const { catWithHighlight, getFileTheme, listThemes, getLanguage, getStylePresets, STYLE_PRESETS, isBatAvailable } = require('./bat.js');
const { listPRs, getPR, listIssues, getIssue, getRepoInfo, isGhAvailable, checkAuth } = require('./gh.js');
const { detectTool, getToolStatus, clearCache, TOOLS } = require('./detector.js');
const { withToolFallback, isToolAvailable, getToolGuidance } = require('./fallback.js');
const { getInstallGuidance } = require('./install-guidance.js');

/**
 * Search for a pattern in files matching a file pattern
 * Combines fd (file discovery) with ripgrep (content search)
 * 
 * @param {string} pattern - Content pattern to search for
 * @param {string} filePattern - File pattern for fd (e.g., '*.js')
 * @param {object} options - Search options
 * @returns {object} - { success, usedFallback, result, error }
 */
async function searchFiles(pattern, filePattern, options = {}) {
  const {
    contentOptions = {},
    fileOptions = { type: 'f' }
  } = options;

  // First find files matching the pattern
  const fileResult = findFiles(filePattern, fileOptions);
  
  if (!fileResult.success || !fileResult.result || fileResult.result.length === 0) {
    return {
      success: true,
      usedFallback: fileResult.usedFallback,
      result: []
    };
  }

  // Then search in those files
  const searchResult = searchRipgrep(pattern, {
    ...contentOptions,
    paths: fileResult.result
  });

  return searchResult;
}

/**
 * Search for content and transform the results
 * Full pipeline: fd → ripgrep → jq
 * 
 * @param {string} contentPattern - Content to search for
 * @param {string} jqFilter - jq filter to transform results
 * @param {object} options - Pipeline options
 * @returns {object} - { success, usedFallback, result, error }
 */
function searchAndTransform(contentPattern, jqFilter, options = {}) {
  const {
    filePattern = '*',
    contentOptions = {},
    fileOptions = { type: 'f' },
    jqOptions = {}
  } = options;

  // First find files
  const fileResult = findFiles(filePattern, fileOptions);
  
  if (!fileResult.success || !fileResult.result || fileResult.result.length === 0) {
    return {
      success: true,
      usedFallback: false,
      result: null
    };
  }

  // Search content
  const searchResult = searchRipgrep(contentPattern, {
    ...contentOptions,
    paths: fileResult.result
  });

  if (!searchResult.success || !searchResult.result) {
    return searchResult;
  }

  // Transform with jq
  const transformResult = transformJson(searchResult.result, jqFilter, jqOptions);
  
  return {
    success: transformResult.success,
    usedFallback: searchResult.usedFallback || transformResult.usedFallback,
    result: transformResult.result,
    error: transformResult.error
  };
}

/**
 * Get status of all CLI tools
 * @returns {object}
 */
function getAllToolStatus() {
  return getToolStatus();
}

/**
 * Check if a specific tool is available
 * @param {string} toolName - Tool name (ripgrep, fd, jq, yq, bat, gh)
 * @returns {boolean}
 */
function checkToolAvailability(toolName) {
  return isToolAvailable(toolName);
}

module.exports = {
  // ripgrep exports
  searchRipgrep,
  parseRipgrepJson,
  isRipgrepAvailable,
  
  // fd exports
  findFiles,
  findDirectories,
  findByExtension,
  isFdAvailable,
  
  // jq exports
  transformJson,
  transformWithPreset,
  getFilterPresets,
  FILTER_PRESETS,
  isJqAvailable,
  
  // yq exports
  parseYAML,
  transformYAML,
  YAMLtoJSON,
  transformYAMLWithPreset,
  getYqFilterPresets,
  YQ_FILTER_PRESETS,
  isYqAvailable,
  
  // bat exports
  catWithHighlight,
  getFileTheme,
  listThemes,
  getLanguage,
  getStylePresets,
  STYLE_PRESETS,
  isBatAvailable,
  
  // gh exports
  listPRs,
  getPR,
  listIssues,
  getIssue,
  getRepoInfo,
  isGhAvailable,
  checkAuth,
  
  // detector exports
  detectTool,
  getToolStatus,
  clearCache,
  TOOLS,
  
  // fallback exports
  withToolFallback,
  isToolAvailable,
  getToolGuidance,
  
  // install guidance
  getInstallGuidance,
  
  // convenience functions
  searchFiles,
  searchAndTransform,
  getAllToolStatus,
  checkToolAvailability
};
