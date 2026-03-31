const fs = require('fs');

const { invalidateFileCache } = require('./helpers');
const { withProjectLock } = require('./project-lock');
const { writeFileAtomic } = require('./atomic-write');

function defaultSerializeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function parseJsonStoreContent(raw, defaultValue) {
  if (!raw || !String(raw).trim()) {
    return cloneJsonValue(defaultValue);
  }

  const parsed = JSON.parse(raw);
  if (Array.isArray(defaultValue)) {
    return Array.isArray(parsed) ? parsed : cloneJsonValue(defaultValue);
  }
  if (defaultValue && typeof defaultValue === 'object') {
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : cloneJsonValue(defaultValue);
  }
  return parsed;
}

function cloneJsonValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function rollbackJsonStore(filePath, originalContent, existedBefore, serialize, defaultValue) {
  if (!existedBefore) {
    fs.rmSync(filePath, { force: true });
    invalidateFileCache(filePath);
    return;
  }

  const content = originalContent != null
    ? originalContent
    : serialize(cloneJsonValue(defaultValue));
  writeFileAtomic(filePath, content);
  invalidateFileCache(filePath);
}

function mutateJsonStore(cwd, options = {}) {
  const {
    filePath,
    defaultValue = [],
    parse = (raw) => parseJsonStoreContent(raw, defaultValue),
    serialize = defaultSerializeJson,
    transform,
    sqliteMirror,
    lockOptions = {},
  } = options;

  if (!cwd || typeof cwd !== 'string') {
    throw new Error('cwd is required');
  }
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('filePath is required');
  }
  if (typeof transform !== 'function') {
    throw new Error('transform must be a function');
  }

  return withProjectLock(cwd, () => {
    const existedBefore = fs.existsSync(filePath);
    const originalContent = existedBefore ? fs.readFileSync(filePath, 'utf-8') : null;
    const currentValue = parse(originalContent);

    const transformResult = transform(cloneJsonValue(currentValue), {
      cwd,
      filePath,
      existedBefore,
      currentValue: cloneJsonValue(currentValue),
    }) || {};

    const nextValue = Object.prototype.hasOwnProperty.call(transformResult, 'nextData')
      ? transformResult.nextData
      : transformResult;
    const result = Object.prototype.hasOwnProperty.call(transformResult, 'result')
      ? transformResult.result
      : {};

    const serialized = serialize(nextValue);
    writeFileAtomic(filePath, serialized);
    invalidateFileCache(filePath);

    try {
      if (typeof sqliteMirror === 'function') {
        sqliteMirror({
          cwd,
          filePath,
          previousData: currentValue,
          nextData: cloneJsonValue(nextValue),
          result,
          existedBefore,
        });
      }
    } catch (error) {
      rollbackJsonStore(filePath, originalContent, existedBefore, serialize, defaultValue);
      throw error;
    }

    return {
      filePath,
      data: nextValue,
      existedBefore,
      ...result,
    };
  }, lockOptions);
}

module.exports = {
  cloneJsonValue,
  defaultSerializeJson,
  mutateJsonStore,
  parseJsonStoreContent,
};
