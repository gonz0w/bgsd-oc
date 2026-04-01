import { execFileSync } from 'child_process';

const NODE_PROBE_OUTPUT = 'bgsd-node-runtime-ok';

let cachedNodeRuntime = null;

function probeNodeRuntime(candidate) {
  if (!candidate || typeof candidate !== 'string') return false;

  try {
    const output = execFileSync(candidate, [
      '--input-type=module',
      '--eval',
      `process.stdout.write(${JSON.stringify(NODE_PROBE_OUTPUT)})`,
    ], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
    });

    return String(output || '').trim() === NODE_PROBE_OUTPUT;
  } catch {
    return false;
  }
}

export function resolveNodeRuntime(options = {}) {
  const { useCache = true } = options;

  if (useCache && cachedNodeRuntime) {
    return cachedNodeRuntime;
  }

  const candidates = [
    options.envNodePath === undefined ? process.env.BGSD_NODE_PATH : options.envNodePath,
    options.execPath === undefined ? process.execPath : options.execPath,
    options.argv0 === undefined ? process.argv0 : options.argv0,
    'node',
  ];

  for (const candidate of [...new Set(candidates.filter(Boolean))]) {
    if (probeNodeRuntime(candidate)) {
      if (useCache) cachedNodeRuntime = candidate;
      return candidate;
    }
  }

  throw new Error('Could not locate a usable Node.js runtime. Set BGSD_NODE_PATH to your node binary.');
}

export function resetNodeRuntimeCache() {
  cachedNodeRuntime = null;
}
