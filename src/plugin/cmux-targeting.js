import { capabilities, ping } from './cmux-cli.js';

const REQUIRED_SIDEBAR_METHODS = ['set-status', 'clear-status', 'set-progress', 'clear-progress', 'log'];

function normalizeAccessMode(value) {
  if (!value) return null;

  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'allowall' || normalized === 'allow-all' || normalized === 'allow_all') return 'allowAll';
  if (normalized === 'off') return 'off';
  if (normalized === 'cmux processes only' || normalized === 'cmuxonly' || normalized === 'cmux-only' || normalized === 'cmux_only') {
    return 'cmuxOnly';
  }
  return value;
}

function extractCapabilitiesPayload(capabilityResult) {
  if (!capabilityResult || !capabilityResult.json) return null;
  return capabilityResult.json.result || capabilityResult.json;
}

function extractMethods(payload) {
  const candidates = [
    payload?.methods,
    payload?.available_methods,
    payload?.capabilities,
    payload?.result?.methods,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.map((entry) => String(entry));
    }
  }

  return [];
}

function resolveAccessMode(payload) {
  return normalizeAccessMode(
    payload?.access_mode
    || payload?.accessMode
    || payload?.socket_mode
    || payload?.socketMode
    || payload?.socket?.mode
  );
}

function hasManagedEnv(env) {
  return Boolean(env?.CMUX_WORKSPACE_ID || env?.CMUX_SURFACE_ID);
}

function hasCompleteManagedEnv(env) {
  return Boolean(env?.CMUX_WORKSPACE_ID && env?.CMUX_SURFACE_ID);
}

function buildVerdict(overrides = {}) {
  return Object.freeze({
    available: false,
    attached: false,
    mode: 'none',
    suppressionReason: null,
    workspaceId: null,
    surfaceId: null,
    accessMode: null,
    methods: [],
    writeProven: false,
    ...overrides,
  });
}

function inferPingSuppressionReason(result) {
  if (result?.error?.type === 'missing-cli') return 'cmux-missing';
  if (result?.timedOut) return 'cmux-timeout';
  return 'cmux-unreachable';
}

function buildCmuxClient(options = {}) {
  if (options.cmux) return options.cmux;

  const shared = {
    command: options.command,
    cwd: options.projectDir,
    env: options.env,
    timeoutMs: options.timeoutMs,
    maxBuffer: options.maxBuffer,
  };

  return {
    ping: (callOptions = {}) => ping({ ...shared, ...callOptions }),
    capabilities: (callOptions = {}) => capabilities({ ...shared, ...callOptions }),
    identify: (callOptions = {}) => identify({ ...shared, ...callOptions }),
    listWorkspaces: (callOptions = {}) => listWorkspaces({ ...shared, ...callOptions }),
    sidebarState: (callOptions = {}) => sidebarState({ ...shared, ...callOptions }),
  };
}

export function suppressionReason(value) {
  if (!value || typeof value !== 'object') return null;
  return value.suppressionReason || value.verdict?.suppressionReason || null;
}

export function createNoopCmuxAdapter(verdict = {}) {
  const normalizedVerdict = buildVerdict(verdict);

  async function suppressed(action, details = {}) {
    return {
      ok: false,
      suppressed: true,
      action,
      reason: normalizedVerdict.suppressionReason || 'not-attached',
      mode: normalizedVerdict.mode,
      available: normalizedVerdict.available,
      attached: normalizedVerdict.attached,
      workspaceId: normalizedVerdict.workspaceId,
      surfaceId: normalizedVerdict.surfaceId,
      details,
    };
  }

  return Object.freeze({
    ...normalizedVerdict,
    verdict: normalizedVerdict,
    getVerdict() {
      return normalizedVerdict;
    },
    setStatus(key, value, options = {}) {
      return suppressed('set-status', { key, value, options });
    },
    clearStatus(key, options = {}) {
      return suppressed('clear-status', { key, options });
    },
    setProgress(progress, options = {}) {
      return suppressed('set-progress', { progress, options });
    },
    clearProgress(options = {}) {
      return suppressed('clear-progress', { options });
    },
    log(message, options = {}) {
      return suppressed('log', { message, options });
    },
  });
}

export async function resolveCmuxAvailability(options = {}) {
  const env = options.env || process.env;
  const cmux = buildCmuxClient(options);
  const mode = hasManagedEnv(env) ? 'managed' : 'alongside';

  const pingResult = await cmux.ping();
  if (!pingResult.ok) {
    return buildVerdict({
      mode: 'none',
      suppressionReason: inferPingSuppressionReason(pingResult),
    });
  }

  const capabilitiesResult = await cmux.capabilities();
  if (!capabilitiesResult.ok) {
    return buildVerdict({
      mode,
      suppressionReason: 'capabilities-unavailable',
    });
  }

  const payload = extractCapabilitiesPayload(capabilitiesResult);
  const accessMode = resolveAccessMode(payload);
  const methods = extractMethods(payload);
  const missingMethods = methods.length > 0
    ? REQUIRED_SIDEBAR_METHODS.filter((method) => !methods.includes(method))
    : [];

  if (accessMode === 'off') {
    return buildVerdict({
      mode,
      accessMode,
      methods,
      suppressionReason: 'access-mode-off',
    });
  }

  if (missingMethods.length > 0) {
    return buildVerdict({
      mode,
      accessMode,
      methods,
      suppressionReason: 'missing-methods',
    });
  }

  if (hasManagedEnv(env) && !hasCompleteManagedEnv(env)) {
    return buildVerdict({
      mode: 'managed',
      accessMode,
      methods,
      suppressionReason: 'missing-env',
    });
  }

  if (!hasManagedEnv(env) && accessMode && accessMode !== 'allowAll') {
    return buildVerdict({
      mode: 'alongside',
      accessMode,
      methods,
      suppressionReason: 'access-mode-blocked',
    });
  }

  return buildVerdict({
    available: true,
    mode: hasManagedEnv(env) ? 'managed' : accessMode === 'allowAll' ? 'alongside' : 'none',
    workspaceId: env.CMUX_WORKSPACE_ID || null,
    surfaceId: env.CMUX_SURFACE_ID || null,
    accessMode,
    methods,
  });
}
