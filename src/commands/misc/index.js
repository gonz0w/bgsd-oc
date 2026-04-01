'use strict';

// Barrel re-export combining all misc subdomain modules
const frontmatter = require('./frontmatter');
const configUtils = require('./config-utils');
const templates = require('./templates');
const historyExamples = require('./history-examples');
const gitHelpers = require('./git-helpers');
const recovery = require('./recovery');

module.exports = Object.assign(
  {},
  frontmatter,
  configUtils,
  templates,
  historyExamples,
  gitHelpers,
  recovery
);
