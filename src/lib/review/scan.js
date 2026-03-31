'use strict';

const { runReviewRules } = require('./rules');

function scanReviewTarget(cwd, target) {
  if (!target || target.status !== 'ok') return [];
  return runReviewRules(cwd, target);
}

module.exports = {
  scanReviewTarget,
};
