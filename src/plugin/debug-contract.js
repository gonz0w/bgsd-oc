function isTruthyDebugValue(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  return normalized !== '' && normalized !== '0' && normalized !== 'false' && normalized !== 'off';
}

export function isDebugEnabled(options = {}) {
  const env = options.env || process.env;
  if (isTruthyDebugValue(env && env.BGSD_DEBUG)) {
    return true;
  }

  if (options.allowVerbose === false) {
    return false;
  }

  return global._gsdCompactMode === false;
}

export function writeDebugDiagnostic(prefix, message, options = {}) {
  if (!isDebugEnabled(options)) {
    return false;
  }

  process.stderr.write(`${prefix} ${message}\n`);
  return true;
}
