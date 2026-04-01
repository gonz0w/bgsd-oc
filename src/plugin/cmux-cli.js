import { execFile } from 'node:child_process';

export const DEFAULT_CMUX_TIMEOUT_MS = 750;
export const DEFAULT_CMUX_MAX_BUFFER = 1024 * 1024;

function normalizeTimeout(timeoutMs) {
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_CMUX_TIMEOUT_MS;
}

function buildTargetArgs(options = {}) {
  const args = [];

  if (options.workspace) {
    args.push('--workspace', String(options.workspace));
  }
  if (options.surface) {
    args.push('--surface', String(options.surface));
  }
  if (options.window) {
    args.push('--window', String(options.window));
  }

  return args;
}

function buildGlobalArgs(options = {}) {
  const args = [];

  if (options.idFormat) {
    args.push('--id-format', String(options.idFormat));
  }

  return args;
}

function normalizeExecError(error, { timedOut = false } = {}) {
  if (!error) return null;

  if (timedOut) {
    return {
      type: 'timeout',
      message: error.message || `cmux command timed out after ${DEFAULT_CMUX_TIMEOUT_MS}ms`,
      code: error.code || null,
      signal: error.signal || null,
    };
  }

  if (error.name === 'AbortError') {
    return {
      type: 'aborted',
      message: error.message || 'cmux command aborted',
      code: error.code || null,
      signal: error.signal || null,
    };
  }

  if (error.code === 'ENOENT') {
    return {
      type: 'missing-cli',
      message: error.message || 'cmux CLI not found',
      code: error.code,
      signal: error.signal || null,
    };
  }

  return {
    type: 'command-failed',
    message: error.message || 'cmux command failed',
    code: typeof error.code === 'number' || typeof error.code === 'string' ? error.code : null,
    signal: error.signal || null,
  };
}

function ensureJsonFlag(args) {
  return args.includes('--json') ? [...args] : [...args, '--json'];
}

function parseSidebarStateText(stdout) {
  const text = String(stdout || '').trim();
  if (!text) return null;

  const result = { status: [] };
  let currentSection = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, '');
    if (!line) continue;

    const indentedEntry = line.match(/^\s+([^=]+)=(.*)$/);
    if (indentedEntry && currentSection === 'status') {
      result.status.push({
        key: indentedEntry[1].trim(),
        value: indentedEntry[2].trim(),
      });
      continue;
    }

    const entry = line.match(/^([^=]+)=(.*)$/);
    if (!entry) continue;

    const key = entry[1].trim();
    const value = entry[2].trim();
    result[key] = value;
    currentSection = key === 'status_count' ? 'status' : null;
  }

  return result;
}

export async function runCmuxCommand(commandName, commandArgs = [], options = {}) {
  const executable = options.command || 'cmux';
  const timeoutMs = normalizeTimeout(options.timeoutMs);
  const signal = options.signal;
  const args = [...buildGlobalArgs(options), commandName, ...commandArgs, ...buildTargetArgs(options)];

  let timedOut = false;
  let cleanupAbort = null;

  const result = await new Promise((resolve) => {
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    let aborted = false;
    const onAbort = () => {
      aborted = true;
      child.kill('SIGTERM');
    };

    if (signal) {
      if (signal.aborted) {
        aborted = true;
      } else {
        signal.addEventListener('abort', onAbort, { once: true });
        cleanupAbort = () => signal.removeEventListener('abort', onAbort);
      }
    }

    const child = execFile(executable, args, {
      cwd: options.cwd,
      env: options.env,
      encoding: 'utf-8',
      windowsHide: true,
      maxBuffer: Number.isFinite(options.maxBuffer) && options.maxBuffer > 0 ? options.maxBuffer : DEFAULT_CMUX_MAX_BUFFER,
      timeout: timeoutMs,
    }, (error, stdout, stderr) => {
      clearTimeout(timer);
      if (cleanupAbort) cleanupAbort();

      const normalizedError = normalizeExecError(error, { timedOut });
      resolve({
        ok: !normalizedError,
        command: executable,
        commandName,
        args,
        stdout: typeof stdout === 'string' ? stdout : String(stdout || ''),
        stderr: typeof stderr === 'string' ? stderr : String(stderr || ''),
        exitCode: error && typeof error.code === 'number' ? error.code : null,
        signal: error?.signal || null,
        timedOut,
        aborted: aborted || normalizedError?.type === 'aborted',
        error: normalizedError,
      });
    });

    if (aborted) {
      child.kill('SIGTERM');
    }
  });

  return result;
}

export async function runCmuxJson(commandName, commandArgs = [], options = {}) {
  const result = await runCmuxCommand(commandName, ensureJsonFlag(commandArgs), options);

  if (!result.ok) {
    return { ...result, json: null };
  }

  try {
    const text = String(result.stdout || '').trim();
    return {
      ...result,
      json: text ? JSON.parse(text) : null,
    };
  } catch (error) {
    return {
      ...result,
      ok: false,
      json: null,
      error: {
        type: 'invalid-json',
        message: error.message || 'cmux returned invalid JSON',
        code: null,
        signal: null,
      },
    };
  }
}

export function ping(options = {}) {
  return runCmuxCommand('ping', [], options);
}

export function capabilities(options = {}) {
  return runCmuxJson('capabilities', [], options);
}

export function identify(options = {}) {
  return runCmuxJson('identify', [], { ...options, idFormat: options.idFormat || 'both' });
}

export function listWorkspaces(options = {}) {
  return runCmuxJson('list-workspaces', [], options);
}

export function sidebarState(options = {}) {
  return runCmuxJson('sidebar-state', [], options).then((result) => {
    if (result.ok || result?.error?.type !== 'invalid-json') {
      return result;
    }

    const parsed = parseSidebarStateText(result.stdout);
    if (!parsed) {
      return result;
    }

    return {
      ...result,
      ok: true,
      json: { result: parsed },
      error: null,
    };
  });
}
