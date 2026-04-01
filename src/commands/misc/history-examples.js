'use strict';

const fs = require('fs');
const path = require('path');
const { output, error, debugLog } = require('../../lib/output');
const { cachedReadFile, extractFrontmatter, getArchivedPhaseDirs } = require('../../lib/helpers');

function cmdHistoryDigest(cwd, options, raw) {
  const limit = options.limit || null;       // --limit N: only output N most recent phases
  const phasesFilter = options.phases || null; // --phases 10,11,12: specific phases
  const compact = options.compact || false;   // --compact: omit decisions and tech_stack

  const phasesDir = path.join(cwd, '.planning', 'phases');
  const digest = { phases: {}, decisions: [], tech_stack: new Set() };

  // Collect all phase directories: archived + current
  const allPhaseDirs = [];

  // Add archived phases first (oldest milestones first)
  const archived = getArchivedPhaseDirs(cwd);
  for (const a of archived) {
    allPhaseDirs.push({ name: a.name, fullPath: a.fullPath, milestone: a.milestone });
  }

  // Add current phases
  if (fs.existsSync(phasesDir)) {
    try {
      const currentDirs = fs.readdirSync(phasesDir, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => e.name)
        .sort();
      for (const dir of currentDirs) {
        allPhaseDirs.push({ name: dir, fullPath: path.join(phasesDir, dir), milestone: null });
      }
    } catch (e) { debugLog('feature.historyDigest', 'readdir failed', e); }
  }

  if (allPhaseDirs.length === 0) {
    digest.tech_stack = [];
    output(digest, raw);
    return;
  }

  try {
    for (const { name: dir, fullPath: dirPath } of allPhaseDirs) {
      const summaries = fs.readdirSync(dirPath).filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');

      for (const summary of summaries) {
        try {
          const content = cachedReadFile(path.join(dirPath, summary));
          if (!content) continue;
          const fm = extractFrontmatter(content);

          const phaseNum = fm.phase || dir.split('-')[0];

          if (!digest.phases[phaseNum]) {
            digest.phases[phaseNum] = {
              name: fm.name || dir.split('-').slice(1).join(' ') || 'Unknown',
              provides: new Set(),
              affects: new Set(),
              patterns: new Set(),
            };
          }

          // Merge provides
          if (fm['dependency-graph'] && fm['dependency-graph'].provides) {
            fm['dependency-graph'].provides.forEach(p => digest.phases[phaseNum].provides.add(p));
          } else if (fm.provides) {
            fm.provides.forEach(p => digest.phases[phaseNum].provides.add(p));
          }

          // Merge affects
          if (fm['dependency-graph'] && fm['dependency-graph'].affects) {
            fm['dependency-graph'].affects.forEach(a => digest.phases[phaseNum].affects.add(a));
          }

          // Merge patterns
          if (fm['patterns-established']) {
            fm['patterns-established'].forEach(p => digest.phases[phaseNum].patterns.add(p));
          }

          // Merge decisions
          if (fm['key-decisions']) {
            fm['key-decisions'].forEach(d => {
              digest.decisions.push({ phase: phaseNum, decision: d });
            });
          }

          // Merge tech stack
          if (fm['tech-stack'] && fm['tech-stack'].added) {
            fm['tech-stack'].added.forEach(t => digest.tech_stack.add(typeof t === 'string' ? t : t.name));
          }

        } catch (e) {
          debugLog('feature.historyDigest', 'skip malformed summary', e);
          // Skip malformed summaries
        }
      }
    }

    // Convert Sets to Arrays for JSON output
    Object.keys(digest.phases).forEach(p => {
      digest.phases[p].provides = [...digest.phases[p].provides];
      digest.phases[p].affects = [...digest.phases[p].affects];
      digest.phases[p].patterns = [...digest.phases[p].patterns];
    });
    digest.tech_stack = [...digest.tech_stack];

    // Apply --phases filter: only keep specific phase numbers
    if (phasesFilter) {
      const allowed = new Set(phasesFilter);
      digest.phases = Object.fromEntries(Object.entries(digest.phases).filter(([k]) => allowed.has(k)));
      digest.decisions = digest.decisions.filter(d => allowed.has(String(d.phase)));
    }

    // Apply --limit N: keep N most recent phases (by number, descending)
    if (limit) {
      const kept = new Set(Object.keys(digest.phases).sort((a, b) => parseFloat(b) - parseFloat(a)).slice(0, limit));
      digest.phases = Object.fromEntries(Object.entries(digest.phases).filter(([k]) => kept.has(k)));
      digest.decisions = digest.decisions.filter(d => kept.has(String(d.phase)));
    }

    // Apply --compact: omit decisions and tech_stack
    if (compact) { delete digest.decisions; delete digest.tech_stack; }

    output(digest, raw);
  } catch (e) {
    debugLog('feature.historyDigest', 'digest generation failed', e);
    error('Failed to generate history digest: ' + e.message);
  }
}

function cmdListTodos(cwd, area, raw) {
  const { output, debugLog } = require('../../lib/output');
  const pendingDir = path.join(cwd, '.planning', 'todos', 'pending');

  let count = 0;
  const todos = [];

  try {
    const files = fs.readdirSync(pendingDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(pendingDir, file), 'utf-8');
        const createdMatch = content.match(/^created:\s*(.+)$/m);
        const titleMatch = content.match(/^title:\s*(.+)$/m);
        const areaMatch = content.match(/^area:\s*(.+)$/m);

        const todoArea = areaMatch ? areaMatch[1].trim() : 'general';

        // Apply area filter if specified
        if (area && todoArea !== area) continue;

        count++;
        todos.push({
          file,
          created: createdMatch ? createdMatch[1].trim() : 'unknown',
          title: titleMatch ? titleMatch[1].trim() : 'Untitled',
          area: todoArea,
          path: path.join('.planning', 'todos', 'pending', file),
        });
      } catch (e) { debugLog('feature.listTodos', 'read todo file failed', e); }
    }
  } catch (e) { debugLog('feature.listTodos', 'read pending dir failed', e); }

  const result = { count, todos };
  output(result, raw, count.toString());
}

function cmdTodoComplete(cwd, filename, raw) {
  const { output, error } = require('../../lib/output');

  if (!filename) {
    error('filename required for todo complete');
  }

  const pendingDir = path.join(cwd, '.planning', 'todos', 'pending');
  const completedDir = path.join(cwd, '.planning', 'todos', 'completed');
  const sourcePath = path.join(pendingDir, filename);

  if (!fs.existsSync(sourcePath)) {
    error(`Todo not found: ${filename}`);
  }

  // Ensure completed directory exists
  fs.mkdirSync(completedDir, { recursive: true });

  // Read, add completion timestamp, move
  let content = fs.readFileSync(sourcePath, 'utf-8');
  const today = new Date().toISOString().split('T')[0];
  content = `completed: ${today}\n` + content;

  fs.writeFileSync(path.join(completedDir, filename), content, 'utf-8');
  fs.unlinkSync(sourcePath);

  output({ completed: true, file: filename, date: today }, raw, 'completed');
}

module.exports = {
  cmdHistoryDigest,
  cmdListTodos,
  cmdTodoComplete,
};
