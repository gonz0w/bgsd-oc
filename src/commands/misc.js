'use strict';

// Barrel re-export for backward compatibility
// Original misc.js (2938 LOC) has been extracted into misc/ subdomain
module.exports = Object.assign(
  {},
  require('./misc/frontmatter'),
  require('./misc/config-utils'),
  require('./misc/templates'),
  require('./misc/history-examples'),
  require('./misc/git-helpers'),
  require('./misc/recovery')
);
