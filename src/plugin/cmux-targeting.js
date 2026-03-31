import fs from 'node:fs';
import path from 'node:path';
import { capabilities, identify, listWorkspaces, ping, runCmuxCommand, sidebarState } from './cmux-cli.js';

const REQUIRED_SIDEBAR_METHODS = ['set-status', 'clear-status', 'set-progress', 'clear-progress', 'log'];
export const CMUX_WRITE_PROBE_KEY = 'bgsd.target.probe';
const CMUX_WRITE_PROBE_VALUE = 'attach-check';

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

function extractJsonPayload(result) {
  if (!result?.json) return null;
  return result.json.result || result.json;
}

function extractWorkspaceId(payload) {
  return payload?.workspace?.id
    || payload?.workspace_id
    || payload?.workspaceId
    || payload?.id
    || null;
}

function extractSurfaceId(payload) {
  return payload?.surface?.id
    || payload?.surface_id
    || payload?.surfaceId
    || null;
}

function extractWorkspaceEntries(payload) {
  const candidates = [
    payload?.workspaces,
    payload?.items,
    payload?.results,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

function extractSidebarCwd(payload) {
  return payload?.cwd
    || payload?.workspace?.cwd
    || payload?.state?.cwd
    || null;
}

function extractSidebarStatusEntries(payload) {
  const candidates = [
    payload?.status,
    payload?.sidebar?.status,
    payload?.state?.status,
    payload?.workspace?.status,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

function normalizeComparablePath(targetPath) {
  if (!targetPath) return null;

  try {
    return fs.realpathSync.native(targetPath);
  } catch {
    return path.resolve(targetPath);
  }
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
    setStatus: ({ key, value, ...callOptions } = {}) => runCmuxCommand('set-status', [String(key), String(value)], { ...shared, ...callOptions }),
    clearStatus: ({ key, ...callOptions } = {}) => runCmuxCommand('clear-status', [String(key)], { ...shared, ...callOptions }),
    setProgress: ({ progress, label, ...callOptions } = {}) => runCmuxCommand('set-progress', label ? [String(progress), '--label', String(label)] : [String(progress)], { ...shared, ...callOptions }),
    clearProgress: (callOptions = {}) => runCmuxCommand('clear-progress', [], { ...shared, ...callOptions }),
    log: ({ message, level, source, ...callOptions } = {}) => {
      const args = [];
      if (level) args.push('--level', String(level));
      if (source) args.push('--source', String(source));
      args.push(String(message));
      return runCmuxCommand('log', args, { ...shared, ...callOptions });
    },
    notify: ({ title, subtitle, body, level, ...callOptions } = {}) => {
      const args = [];
      if (level) args.push('--level', String(level));
      if (title) args.push('--title', String(title));
      if (subtitle) args.push('--subtitle', String(subtitle));
      if (body) args.push('--body', String(body));
      return runCmuxCommand('notify', args, { ...shared, ...callOptions });
    },
  };
}

export async function probeCmuxWritePath(options = {}) {
  const cmux = buildCmuxClient(options);
  const workspaceId = options.workspaceId || null;

  if (!workspaceId) {
    return {
      ok: false,
      suppressionReason: 'write-probe-failed',
      workspaceId: null,
      probeKey: CMUX_WRITE_PROBE_KEY,
    };
  }

  const setResult = await cmux.setStatus({
    workspace: workspaceId,
    key: CMUX_WRITE_PROBE_KEY,
    value: CMUX_WRITE_PROBE_VALUE,
  });

  if (!setResult?.ok) {
    return {
      ok: false,
      suppressionReason: 'write-probe-failed',
      workspaceId,
      probeKey: CMUX_WRITE_PROBE_KEY,
    };
  }

  let sidebarResult = null;
  let cleanupResult = null;

  try {
    sidebarResult = await cmux.sidebarState({ workspace: workspaceId });
  } finally {
    cleanupResult = await cmux.clearStatus({ workspace: workspaceId, key: CMUX_WRITE_PROBE_KEY });
  }

  const sidebarPayload = extractJsonPayload(sidebarResult);
  const visible = sidebarResult?.ok && extractSidebarStatusEntries(sidebarPayload).some((entry) => entry?.key === CMUX_WRITE_PROBE_KEY);

  if (!visible || !cleanupResult?.ok) {
    return {
      ok: false,
      suppressionReason: 'write-probe-failed',
      workspaceId,
      probeKey: CMUX_WRITE_PROBE_KEY,
    };
  }

  return {
    ok: true,
    suppressionReason: null,
    workspaceId,
    probeKey: CMUX_WRITE_PROBE_KEY,
  };
}

export async function resolveManagedWorkspaceTarget(options = {}) {
  const env = options.env || process.env;
  const workspaceId = env.CMUX_WORKSPACE_ID || null;
  const surfaceId = env.CMUX_SURFACE_ID || null;

  if (!workspaceId || !surfaceId) {
    return {
      ok: false,
      mode: 'managed',
      suppressionReason: 'missing-env',
      workspaceId: null,
      surfaceId: null,
    };
  }

  const identifyResult = await options.cmux.identify();
  if (!identifyResult.ok) {
    return {
      ok: false,
      mode: 'managed',
      suppressionReason: 'identify-unavailable',
      workspaceId: null,
      surfaceId: null,
    };
  }

  const identifyPayload = extractJsonPayload(identifyResult);
  const identifiedWorkspaceId = extractWorkspaceId(identifyPayload?.workspace ? identifyPayload : identifyPayload?.result || identifyPayload);
  const identifiedSurfaceId = extractSurfaceId(identifyPayload?.surface ? identifyPayload : identifyPayload?.result || identifyPayload);

  if (identifiedWorkspaceId !== workspaceId) {
    return {
      ok: false,
      mode: 'managed',
      suppressionReason: 'workspace-mismatch',
      workspaceId: null,
      surfaceId: null,
    };
  }

  if (identifiedSurfaceId !== surfaceId) {
    return {
      ok: false,
      mode: 'managed',
      suppressionReason: 'surface-mismatch',
      workspaceId: null,
      surfaceId: null,
    };
  }

  return {
    ok: true,
    mode: 'managed',
    workspaceId,
    surfaceId,
    suppressionReason: null,
  };
}

export async function resolveAlongsideWorkspaceTarget(options = {}) {
  const projectDir = normalizeComparablePath(options.projectDir);
  if (!projectDir) {
    return {
      ok: false,
      mode: 'alongside',
      suppressionReason: 'ambiguous-cwd',
      workspaceId: null,
      surfaceId: null,
    };
  }

  const workspacesResult = await options.cmux.listWorkspaces();
  if (!workspacesResult.ok) {
    return {
      ok: false,
      mode: 'alongside',
      suppressionReason: 'ambiguous-cwd',
      workspaceId: null,
      surfaceId: null,
    };
  }

  const workspacesPayload = extractJsonPayload(workspacesResult);
  const matches = [];

  for (const workspace of extractWorkspaceEntries(workspacesPayload)) {
    const workspaceId = extractWorkspaceId(workspace);
    if (!workspaceId) continue;

    const sidebarResult = await options.cmux.sidebarState({ workspace: workspaceId });
    if (!sidebarResult.ok) continue;

    const sidebarPayload = extractJsonPayload(sidebarResult);
    const workspaceCwd = normalizeComparablePath(extractSidebarCwd(sidebarPayload));
    if (workspaceCwd === projectDir) {
      matches.push(workspaceId);
    }
  }

  if (matches.length !== 1) {
    return {
      ok: false,
      mode: 'alongside',
      suppressionReason: 'ambiguous-cwd',
      workspaceId: null,
      surfaceId: null,
    };
  }

  return {
    ok: true,
    mode: 'alongside',
    workspaceId: matches[0],
    surfaceId: null,
    suppressionReason: null,
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
    notify(payload, options = {}) {
      return suppressed('notify', { payload, options });
    },
  });
}

export function createAttachedCmuxAdapter(verdict = {}, options = {}) {
  const normalizedVerdict = buildVerdict({
    ...verdict,
    attached: true,
    writeProven: true,
  });
  const cmux = buildCmuxClient(options);

  async function runAttached(action, run, details = {}) {
    const result = await run();
    return {
      ok: Boolean(result?.ok),
      suppressed: false,
      action,
      mode: normalizedVerdict.mode,
      available: normalizedVerdict.available,
      attached: normalizedVerdict.attached,
      workspaceId: normalizedVerdict.workspaceId,
      surfaceId: normalizedVerdict.surfaceId,
      details,
      error: result?.error || null,
    };
  }

  return Object.freeze({
    ...normalizedVerdict,
    verdict: normalizedVerdict,
    getVerdict() {
      return normalizedVerdict;
    },
    setStatus(key, value, callOptions = {}) {
      return runAttached('set-status', () => cmux.setStatus({ ...callOptions, workspace: normalizedVerdict.workspaceId, key, value }), { key, value, options: callOptions });
    },
    clearStatus(key, callOptions = {}) {
      return runAttached('clear-status', () => cmux.clearStatus({ ...callOptions, workspace: normalizedVerdict.workspaceId, key }), { key, options: callOptions });
    },
    setProgress(progress, callOptions = {}) {
      return runAttached('set-progress', () => cmux.setProgress({ ...callOptions, workspace: normalizedVerdict.workspaceId, progress }), { progress, options: callOptions });
    },
    clearProgress(callOptions = {}) {
      return runAttached('clear-progress', () => cmux.clearProgress({ ...callOptions, workspace: normalizedVerdict.workspaceId }), { options: callOptions });
    },
    log(message, callOptions = {}) {
      return runAttached('log', () => cmux.log({ ...callOptions, workspace: normalizedVerdict.workspaceId, message }), { message, options: callOptions });
    },
    notify(payload = {}, callOptions = {}) {
      return runAttached(
        'notify',
        () => cmux.notify({ ...callOptions, workspace: normalizedVerdict.workspaceId, ...payload }),
        { payload, options: callOptions },
      );
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

  if (hasManagedEnv(env)) {
    const managedTarget = await resolveManagedWorkspaceTarget({ env, cmux });
    if (!managedTarget.ok) {
      return buildVerdict({
        mode: 'managed',
        accessMode,
        methods,
        workspaceId: null,
        surfaceId: null,
        suppressionReason: managedTarget.suppressionReason,
      });
    }

    const writeProbe = await probeCmuxWritePath({ ...options, cmux, workspaceId: managedTarget.workspaceId });
    if (!writeProbe.ok) {
      return buildVerdict({
        available: true,
        mode: 'managed',
        workspaceId: managedTarget.workspaceId,
        surfaceId: managedTarget.surfaceId,
        accessMode,
        methods,
        suppressionReason: writeProbe.suppressionReason,
      });
    }

    return buildVerdict({
      available: true,
      attached: true,
      mode: 'managed',
      workspaceId: managedTarget.workspaceId,
      surfaceId: managedTarget.surfaceId,
      accessMode,
      methods,
      writeProven: true,
    });
  }

  if (accessMode && accessMode !== 'allowAll') {
    return buildVerdict({
      mode: 'alongside',
      accessMode,
      methods,
      suppressionReason: 'access-mode-blocked',
    });
  }

  const alongsideTarget = await resolveAlongsideWorkspaceTarget({
    cmux,
    projectDir: options.projectDir,
  });

  if (!alongsideTarget.ok) {
    return buildVerdict({
      mode: 'alongside',
      accessMode,
      methods,
      workspaceId: null,
      surfaceId: null,
      suppressionReason: alongsideTarget.suppressionReason,
    });
  }

  const writeProbe = await probeCmuxWritePath({ ...options, cmux, workspaceId: alongsideTarget.workspaceId });
  if (!writeProbe.ok) {
    return buildVerdict({
      available: true,
      mode: 'alongside',
      workspaceId: alongsideTarget.workspaceId,
      surfaceId: null,
      accessMode,
      methods,
      suppressionReason: writeProbe.suppressionReason,
    });
  }

  return buildVerdict({
    available: true,
    attached: true,
    mode: 'alongside',
    workspaceId: alongsideTarget.workspaceId,
    surfaceId: null,
    accessMode,
    methods,
    writeProven: true,
  });
}
