const { CONFIG_SCHEMA } = require('./constants');

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]));
  }
  return value;
}

function deepMerge(base, override) {
  if (override === undefined) return cloneValue(base);
  if (Array.isArray(override)) return cloneValue(override);
  if (!isPlainObject(base) || !isPlainObject(override)) return cloneValue(override);

  const result = cloneValue(base);
  for (const [key, value] of Object.entries(override)) {
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = deepMerge(result[key], value);
    } else {
      result[key] = cloneValue(value);
    }
  }
  return result;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const entry of Object.values(value)) {
    deepFreeze(entry);
  }
  return value;
}

function getSchemaLookupValue(rawConfig, key, def) {
  if (!isPlainObject(rawConfig)) return undefined;
  if (rawConfig[key] !== undefined) return rawConfig[key];

  if (def.nested) {
    const section = rawConfig[def.nested.section];
    if (isPlainObject(section) && section[def.nested.field] !== undefined) {
      return section[def.nested.field];
    }
    if (def.nested.section === 'workflow' && def.nested.field === 'plan_check' && isPlainObject(section)) {
      if (section.plan_checker !== undefined) return section.plan_checker;
    }
  }

  for (const alias of def.aliases || []) {
    if (rawConfig[alias] !== undefined) return rawConfig[alias];
  }

  return undefined;
}

function normalizeSchemaValue(rawValue, def) {
  if (rawValue === undefined) return cloneValue(def.default);
  if (def.coerce === 'parallelization') {
    if (typeof rawValue === 'boolean') return rawValue;
    if (isPlainObject(rawValue) && rawValue.enabled !== undefined) return Boolean(rawValue.enabled);
    return cloneValue(def.default);
  }
  return cloneValue(rawValue);
}

function preferredSchemaPath(key, def) {
  return def.nested ? `${def.nested.section}.${def.nested.field}` : key;
}

function shouldSkipMigrationForCompatibility(config, key, def) {
  if (!def.nested || def.nested.section !== 'workspace') return false;
  if (config[key] !== undefined) return false;
  if (isPlainObject(config.workspace)) return false;
  return true;
}

function setByPath(target, keyPath, value) {
  const keys = keyPath.split('.').filter(Boolean);
  if (keys.length === 0) throw new Error('keyPath is required');

  let current = target;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      throw new Error('Cannot set prototype properties');
    }
    if (!isPlainObject(current[key])) current[key] = {};
    current = current[key];
  }

  const lastKey = keys[keys.length - 1];
  if (lastKey === '__proto__' || lastKey === 'constructor' || lastKey === 'prototype') {
    throw new Error('Cannot set prototype properties');
  }
  current[lastKey] = cloneValue(value);
  return target;
}

function buildDefaultConfig(options = {}) {
  let result = {};
  for (const [key, def] of Object.entries(CONFIG_SCHEMA)) {
    if (def.nested) {
      if (!isPlainObject(result[def.nested.section])) result[def.nested.section] = {};
      result[def.nested.section][def.nested.field] = cloneValue(def.default);
    } else {
      result[key] = cloneValue(def.default);
    }
  }

  if (options.overrides) {
    result = deepMerge(result, options.overrides);
  }

  return result;
}

function normalizeConfig(rawConfig, options = {}) {
  const parsed = isPlainObject(rawConfig) ? rawConfig : {};
  const result = {};

  for (const [key, def] of Object.entries(CONFIG_SCHEMA)) {
    result[key] = normalizeSchemaValue(getSchemaLookupValue(parsed, key, def), def);
  }

  const extraDefaults = options.extraDefaults || {};
  for (const [key, defaultValue] of Object.entries(extraDefaults)) {
    if (Object.prototype.hasOwnProperty.call(result, key)) continue;
    const rawValue = parsed[key];
    if (rawValue === undefined) {
      result[key] = cloneValue(defaultValue);
    } else if (isPlainObject(defaultValue) && isPlainObject(rawValue)) {
      result[key] = deepMerge(defaultValue, rawValue);
    } else {
      result[key] = cloneValue(rawValue);
    }
  }

  return options.freeze === false ? result : deepFreeze(result);
}

function migrateConfig(rawConfig) {
  const config = isPlainObject(rawConfig) ? cloneValue(rawConfig) : {};
  const migratedKeys = [];
  const unchangedKeys = [];

  for (const [key, def] of Object.entries(CONFIG_SCHEMA)) {
    if (shouldSkipMigrationForCompatibility(config, key, def)) {
      continue;
    }
    const existingValue = getSchemaLookupValue(config, key, def);
    const targetPath = preferredSchemaPath(key, def);
    if (existingValue !== undefined) {
      unchangedKeys.push(targetPath);
      continue;
    }
    setByPath(config, targetPath, def.default);
    migratedKeys.push(targetPath);
  }

  return { config, migratedKeys, unchangedKeys };
}

function applyConfigValue(rawConfig, keyPath, value, options = {}) {
  const base = options.withDefaults ? deepMerge(buildDefaultConfig(options.withDefaults), rawConfig || {}) : cloneValue(rawConfig || {});
  return setByPath(base, keyPath, value);
}

function serializeConfig(config) {
  return JSON.stringify(config, null, 2) + '\n';
}

module.exports = {
  applyConfigValue,
  buildDefaultConfig,
  deepMerge,
  isPlainObject,
  migrateConfig,
  normalizeConfig,
  serializeConfig,
};
