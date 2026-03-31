'use strict';

const fs = require('fs');
const path = require('path');

const DEV_ROOT = path.resolve(__dirname, '..', '..');

function firstExistingPath(paths) {
  for (const candidate of paths) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function resolvePluginRoot(options = {}) {
  const { overrideDir, argvEntry } = options;

  if (overrideDir && fs.existsSync(overrideDir)) {
    return overrideDir;
  }

  const envPluginDir = process.env.BGSD_PLUGIN_DIR;
  if (envPluginDir && fs.existsSync(envPluginDir)) {
    return envPluginDir;
  }

  const entry = argvEntry || process.argv[1] || __filename;
  const binRelative = path.resolve(path.dirname(entry), '..');
  if (fs.existsSync(binRelative)) {
    return binRelative;
  }

  return DEV_ROOT;
}

function resolvePluginDirs(options = {}) {
  const pluginRoot = resolvePluginRoot(options);

  const workflowsDir = firstExistingPath([
    path.join(pluginRoot, 'workflows'),
    path.join(DEV_ROOT, 'workflows'),
  ]) || path.join(pluginRoot, 'workflows');

  const agentsDir = firstExistingPath([
    path.join(path.dirname(pluginRoot), 'agents'),
    path.join(pluginRoot, 'agents'),
    path.join(DEV_ROOT, 'agents'),
  ]) || path.join(path.dirname(pluginRoot), 'agents');

  const referencesDir = firstExistingPath([
    path.join(pluginRoot, 'references'),
    path.join(DEV_ROOT, 'references'),
  ]) || path.join(pluginRoot, 'references');

  const templatesDir = firstExistingPath([
    path.join(pluginRoot, 'templates'),
    path.join(DEV_ROOT, 'templates'),
  ]) || path.join(pluginRoot, 'templates');

  return {
    pluginRoot,
    workflowsDir,
    agentsDir,
    referencesDir,
    templatesDir,
  };
}

module.exports = {
  resolvePluginRoot,
  resolvePluginDirs,
};
