const fs = require('fs');
const path = require('path');

function buildAtomicTempPath(targetPath, options = {}) {
  const dir = path.dirname(targetPath);
  const base = path.basename(targetPath);
  const suffix = options.suffix || `${process.pid}-${Date.now()}`;
  return path.join(dir, `.${base}.tmp-${suffix}`);
}

function writeFileAtomic(targetPath, content, options = {}) {
  if (!targetPath || typeof targetPath !== 'string') {
    throw new Error('targetPath is required');
  }

  const dir = path.dirname(targetPath);
  const encoding = options.encoding || 'utf-8';
  const tempPath = options.tempPath || buildAtomicTempPath(targetPath, options);

  fs.mkdirSync(dir, { recursive: true });

  try {
    fs.writeFileSync(tempPath, content, encoding);
    if (typeof options.beforeRename === 'function') {
      options.beforeRename({ targetPath, tempPath, content });
    }
    fs.renameSync(tempPath, targetPath);
  } catch (error) {
    try {
      fs.rmSync(tempPath, { force: true });
    } catch {}
    throw error;
  }

  return {
    targetPath,
    tempPath,
  };
}

module.exports = {
  buildAtomicTempPath,
  writeFileAtomic,
};
