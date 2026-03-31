'use strict';

function normalizeRepoPath(filePath) {
  return String(filePath || '')
    .replace(/^"|"$/g, '')
    .replace(/^\.\//, '')
    .replace(/^a\//, '')
    .replace(/^b\//, '')
    .replace(/\\/g, '/');
}

function parseNameStatus(stdout) {
  if (!stdout) return [];
  return stdout
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split('\t');
      const status = parts[0] || 'M';
      const pathValue = status.startsWith('R') || status.startsWith('C') ? parts[2] : parts[1];
      return {
        status,
        path: normalizeRepoPath(pathValue),
        previous_path: status.startsWith('R') || status.startsWith('C') ? normalizeRepoPath(parts[1]) : null,
      };
    })
    .filter(entry => entry.path);
}

function compressLineNumbers(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return [];
  const sorted = [...new Set(lines)].sort((a, b) => a - b);
  const ranges = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
      continue;
    }
    ranges.push({ start, end });
    start = sorted[i];
    end = sorted[i];
  }
  ranges.push({ start, end });
  return ranges;
}

function toExpandedLines(ranges) {
  const values = [];
  for (const range of ranges || []) {
    for (let line = range.start; line <= range.end; line++) values.push(line);
  }
  return values;
}

function finalizeFile(files, currentFile, currentChangedLines) {
  if (!currentFile) return;
  const existing = files.get(currentFile.path) || { ...currentFile, hunks: [] };
  const nextRanges = compressLineNumbers(currentChangedLines);
  existing.hunks = compressLineNumbers([...toExpandedLines(existing.hunks), ...toExpandedLines(nextRanges)]);
  files.set(currentFile.path, existing);
}

function parseUnifiedDiff(diffText, nameStatusEntries = []) {
  const files = new Map();
  const statusByPath = new Map(nameStatusEntries.map(entry => [entry.path, entry]));
  const lines = String(diffText || '').split('\n');
  let currentFile = null;
  let currentChangedLines = [];
  let currentNewLine = 0;
  let inHunk = false;

  function flush() {
    finalizeFile(files, currentFile, currentChangedLines);
    currentChangedLines = [];
    inHunk = false;
  }

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      flush();
      const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
      if (!match) {
        currentFile = null;
        continue;
      }
      const nextPath = normalizeRepoPath(match[2]);
      const statusEntry = statusByPath.get(nextPath) || { status: 'M', previous_path: null };
      currentFile = {
        path: nextPath,
        status: statusEntry.status,
        previous_path: statusEntry.previous_path,
        hunks: [],
      };
      continue;
    }

    if (!currentFile) continue;

    if (line.startsWith('@@')) {
      flush();
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
      if (!match) continue;
      currentNewLine = parseInt(match[1], 10);
      inHunk = true;
      continue;
    }

    if (!inHunk) continue;

    if (line.startsWith('+') && !line.startsWith('+++')) {
      currentChangedLines.push(currentNewLine);
      currentNewLine += 1;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      currentChangedLines.push(currentNewLine > 0 ? currentNewLine : 1);
    } else if (line.startsWith(' ')) {
      currentNewLine += 1;
    }
  }

  flush();

  for (const entry of nameStatusEntries) {
    if (!files.has(entry.path)) {
      files.set(entry.path, {
        path: entry.path,
        status: entry.status,
        previous_path: entry.previous_path,
        hunks: [],
      });
    }
  }

  return Array.from(files.values());
}

module.exports = {
  compressLineNumbers,
  normalizeRepoPath,
  parseNameStatus,
  parseUnifiedDiff,
};
