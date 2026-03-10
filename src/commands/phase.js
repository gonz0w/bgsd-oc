const fs = require('fs');
const path = require('path');
const { output, error, debugLog } = require('../lib/output');
const { normalizePhaseName, getArchivedPhaseDirs, findPhaseInternal, generateSlugInternal, getMilestoneInfo, invalidateFileCache, cachedReadFile } = require('../lib/helpers');
const { extractFrontmatter } = require('../lib/frontmatter');
const { execGit } = require('../lib/git');

// Insert checklist entry if missing. Returns updated content.
function ensureChecklistEntry(content, phaseNum, name, afterPhasePattern) {
  const esc = String(phaseNum).replace('.', '\\.');
  if (new RegExp(`-\\s*\\[[ x]\\]\\s*\\*\\*Phase\\s+${esc}[:\\s]`, 'i').test(content)) return content;
  const pat = afterPhasePattern || /(- \[[ x]\] \*\*Phase\s+\d+(?:\.\d+)?:[^\n]+\n)(?!- \[[ x]\] \*\*Phase)/;
  const m = content.match(pat);
  if (!m) return content;
  const pos = m.index + m[0].length;
  return content.slice(0, pos) + `- [ ] **Phase ${phaseNum}: ${name}**\n` + content.slice(pos);
}

// ─── Phase Commands ──────────────────────────────────────────────────────────

function cmdPhasesList(cwd, options, raw) {
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const { type, phase, includeArchived } = options;

  // If no phases directory, return empty
  if (!fs.existsSync(phasesDir)) {
    if (type) {
      output({ files: [], count: 0 }, raw, '');
    } else {
      output({ directories: [], count: 0 }, raw, '');
    }
    return;
  }

  try {
    // Get all phase directories
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    let dirs = entries.filter(e => e.isDirectory()).map(e => e.name);

    // Include archived phases if requested
    if (includeArchived) {
      const archived = getArchivedPhaseDirs(cwd);
      for (const a of archived) {
        dirs.push(`${a.name} [${a.milestone}]`);
      }
    }

    // Sort numerically (handles decimals: 01, 02, 02.1, 02.2, 03)
    dirs.sort((a, b) => {
      const aNum = parseFloat(a.match(/^(\d+(?:\.\d+)?)/)?.[1] || '0');
      const bNum = parseFloat(b.match(/^(\d+(?:\.\d+)?)/)?.[1] || '0');
      return aNum - bNum;
    });

    // If filtering by phase number
    if (phase) {
      const normalized = normalizePhaseName(phase);
      const match = dirs.find(d => d.startsWith(normalized));
      if (!match) {
        output({ files: [], count: 0, phase_dir: null, error: 'Phase not found' }, raw, '');
        return;
      }
      dirs = [match];
    }

    // If listing files of a specific type
    if (type) {
      const files = [];
      for (const dir of dirs) {
        const dirPath = path.join(phasesDir, dir);
        const dirFiles = fs.readdirSync(dirPath);

        let filtered;
        if (type === 'plans') {
          filtered = dirFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
        } else if (type === 'summaries') {
          filtered = dirFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
        } else {
          filtered = dirFiles;
        }

        files.push(...filtered.sort());
      }

      const result = {
        files,
        count: files.length,
        phase_dir: phase ? dirs[0].replace(/^\d+(?:\.\d+)?-?/, '') : null,
      };
      output(result, raw, files.join('\n'));
      return;
    }

    // Default: list directories
    output({ directories: dirs, count: dirs.length }, raw, dirs.join('\n'));
  } catch (e) {
    debugLog('phase.list', 'list phases failed', e);
    error('Failed to list phases: ' + e.message);
  }
}

function cmdPhaseNextDecimal(cwd, basePhase, raw) {
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const normalized = normalizePhaseName(basePhase);

  // Check if phases directory exists
  if (!fs.existsSync(phasesDir)) {
    output(
      {
        found: false,
        base_phase: normalized,
        next: `${normalized}.1`,
        existing: [],
      },
      raw,
      `${normalized}.1`
    );
    return;
  }

  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);

    // Check if base phase exists
    const baseExists = dirs.some(d => d.startsWith(normalized + '-') || d === normalized);

    // Find existing decimal phases for this base
    const decimalPattern = new RegExp(`^${normalized}\\.(\\d+)`);
    const existingDecimals = [];

    for (const dir of dirs) {
      const match = dir.match(decimalPattern);
      if (match) {
        existingDecimals.push(`${normalized}.${match[1]}`);
      }
    }

    // Sort numerically
    existingDecimals.sort((a, b) => {
      const aNum = parseFloat(a);
      const bNum = parseFloat(b);
      return aNum - bNum;
    });

    // Calculate next decimal
    let nextDecimal;
    if (existingDecimals.length === 0) {
      nextDecimal = `${normalized}.1`;
    } else {
      const lastDecimal = existingDecimals[existingDecimals.length - 1];
      const lastNum = parseInt(lastDecimal.split('.')[1], 10);
      nextDecimal = `${normalized}.${lastNum + 1}`;
    }

    output(
      {
        found: baseExists,
        base_phase: normalized,
        next: nextDecimal,
        existing: existingDecimals,
      },
      raw,
      nextDecimal
    );
  } catch (e) {
    debugLog('phase.nextDecimal', 'calculate next decimal failed', e);
    error('Failed to calculate next decimal phase: ' + e.message);
  }
}

function cmdPhaseAdd(cwd, description, raw) {
  if (!description) {
    error('description required for phase add');
  }

  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  if (!fs.existsSync(roadmapPath)) {
    error('ROADMAP.md not found');
  }

  const content = cachedReadFile(roadmapPath);
  const slug = generateSlugInternal(description);

  // Find highest integer phase number
  const phasePattern = /#{2,4}\s*Phase\s+(\d+)(?:\.\d+)?:/gi;
  let maxPhase = 0;
  let m;
  while ((m = phasePattern.exec(content)) !== null) {
    const num = parseInt(m[1], 10);
    if (num > maxPhase) maxPhase = num;
  }

  const newPhaseNum = maxPhase + 1;
  const paddedNum = String(newPhaseNum).padStart(2, '0');
  const dirName = `${paddedNum}-${slug}`;
  const dirPath = path.join(cwd, '.planning', 'phases', dirName);

  // Create directory with .gitkeep so git tracks empty folders
  fs.mkdirSync(dirPath, { recursive: true });
  fs.writeFileSync(path.join(dirPath, '.gitkeep'), '');

  // Build phase detail section
  const phaseEntry = `\n### Phase ${newPhaseNum}: ${description}\n\n**Goal:** [To be planned]\n**Depends on:** Phase ${maxPhase}\n**Plans:** 0 plans\n\nPlans:\n- [ ] TBD (run /gsd:plan-phase ${newPhaseNum} to break down)\n`;

  // Find insertion point: before last "---" or at end
  let updatedContent;
  const lastSeparator = content.lastIndexOf('\n---');
  if (lastSeparator > 0) {
    updatedContent = content.slice(0, lastSeparator) + phaseEntry + content.slice(lastSeparator);
  } else {
    updatedContent = content + phaseEntry;
  }

  updatedContent = ensureChecklistEntry(updatedContent, newPhaseNum, description);
  fs.writeFileSync(roadmapPath, updatedContent, 'utf-8');
  invalidateFileCache(roadmapPath);

  const result = {
    phase_number: newPhaseNum,
    padded: paddedNum,
    name: description,
    slug,
    directory: `.planning/phases/${dirName}`,
  };

  output(result, raw, paddedNum);
}

function cmdPhaseInsert(cwd, afterPhase, description, raw) {
  if (!afterPhase || !description) {
    error('after-phase and description required for phase insert');
  }

  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  if (!fs.existsSync(roadmapPath)) {
    error('ROADMAP.md not found');
  }

  const content = cachedReadFile(roadmapPath);
  const slug = generateSlugInternal(description);

  // Normalize input then strip leading zeros for flexible matching
  const normalizedAfter = normalizePhaseName(afterPhase);
  const unpadded = normalizedAfter.replace(/^0+/, '');
  // Escape all regex special characters, not just dots
  const afterPhaseEscaped = unpadded.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const targetPattern = new RegExp(`#{2,4}\\s*Phase\\s+0*${afterPhaseEscaped}:`, 'i');
  if (!targetPattern.test(content)) {
    error(`Phase ${afterPhase} not found in ROADMAP.md`);
  }

  // Calculate next decimal using existing logic
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const normalizedBase = normalizePhaseName(afterPhase);
  let existingDecimals = [];

  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    const decimalPattern = new RegExp(`^${normalizedBase}\\.(\\d+)`);
    for (const dir of dirs) {
      const dm = dir.match(decimalPattern);
      if (dm) existingDecimals.push(parseInt(dm[1], 10));
    }
  } catch (e) { debugLog('phase.insert', 'readdir failed', e); }

  const nextDecimal = existingDecimals.length === 0 ? 1 : Math.max(...existingDecimals) + 1;
  const decimalPhase = `${normalizedBase}.${nextDecimal}`;
  const dirName = `${decimalPhase}-${slug}`;
  const dirPath = path.join(cwd, '.planning', 'phases', dirName);

  // Create directory with .gitkeep so git tracks empty folders
  fs.mkdirSync(dirPath, { recursive: true });
  fs.writeFileSync(path.join(dirPath, '.gitkeep'), '');

  // Build phase entry
  const phaseEntry = `\n### Phase ${decimalPhase}: ${description} (INSERTED)\n\n**Goal:** [Urgent work - to be planned]\n**Depends on:** Phase ${afterPhase}\n**Plans:** 0 plans\n\nPlans:\n- [ ] TBD (run /gsd:plan-phase ${decimalPhase} to break down)\n`;

  // Insert after the target phase section
  const headerPattern = new RegExp(`(#{2,4}\\s*Phase\\s+0*${afterPhaseEscaped}:[^\\n]*\\n)`, 'i');
  const headerMatch = content.match(headerPattern);
  if (!headerMatch) {
    error(`Could not find Phase ${afterPhase} header`);
  }

  const headerIdx = content.indexOf(headerMatch[0]);
  const afterHeader = content.slice(headerIdx + headerMatch[0].length);
  const nextPhaseMatch = afterHeader.match(/\n#{2,4}\s+Phase\s+\d/i);

  let insertIdx;
  if (nextPhaseMatch) {
    insertIdx = headerIdx + headerMatch[0].length + nextPhaseMatch.index;
  } else {
    insertIdx = content.length;
  }

  let updatedContent = content.slice(0, insertIdx) + phaseEntry + content.slice(insertIdx);
  const parentPat = new RegExp(`(- \\[[ x]\\] \\*\\*Phase\\s+0*${afterPhaseEscaped}:[^\\n]+\\n)`);
  updatedContent = ensureChecklistEntry(updatedContent, decimalPhase, `${description} (INSERTED)`, parentPat);
  fs.writeFileSync(roadmapPath, updatedContent, 'utf-8');
  invalidateFileCache(roadmapPath);

  const result = {
    phase_number: decimalPhase,
    after_phase: afterPhase,
    name: description,
    slug,
    directory: `.planning/phases/${dirName}`,
  };

  output(result, raw, decimalPhase);
}

function cmdPhaseRemove(cwd, targetPhase, options, raw) {
  if (!targetPhase) {
    error('phase number required for phase remove');
  }

  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const force = options.force || false;

  if (!fs.existsSync(roadmapPath)) {
    error('ROADMAP.md not found');
  }

  // Normalize the target
  const normalized = normalizePhaseName(targetPhase);
  const isDecimal = targetPhase.includes('.');

  // Find and validate target directory
  let targetDir = null;
  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
    targetDir = dirs.find(d => d.startsWith(normalized + '-') || d === normalized);
  } catch (e) { debugLog('phase.remove', 'readdir failed', e); }

  // Check for executed work (SUMMARY.md files)
  if (targetDir && !force) {
    const targetPath = path.join(phasesDir, targetDir);
    const files = fs.readdirSync(targetPath);
    const summaries = files.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
    if (summaries.length > 0) {
      error(`Phase ${targetPhase} has ${summaries.length} executed plan(s). Use --force to remove anyway.`);
    }
  }

  // Delete target directory
  if (targetDir) {
    fs.rmSync(path.join(phasesDir, targetDir), { recursive: true, force: true });
  }

  // Renumber subsequent phases
  const renamedDirs = [];
  const renamedFiles = [];

  if (isDecimal) {
    // Decimal removal: renumber sibling decimals
    const baseParts = normalized.split('.');
    const baseInt = baseParts[0];
    const removedDecimal = parseInt(baseParts[1], 10);

    try {
      const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();

      const decPattern = new RegExp(`^${baseInt}\\.(\\d+)-(.+)$`);
      const toRename = [];
      for (const dir of dirs) {
        const dm = dir.match(decPattern);
        if (dm && parseInt(dm[1], 10) > removedDecimal) {
          toRename.push({ dir, oldDecimal: parseInt(dm[1], 10), slug: dm[2] });
        }
      }

      toRename.sort((a, b) => b.oldDecimal - a.oldDecimal);

      for (const item of toRename) {
        const newDecimal = item.oldDecimal - 1;
        const oldPhaseId = `${baseInt}.${item.oldDecimal}`;
        const newPhaseId = `${baseInt}.${newDecimal}`;
        const newDirName = `${baseInt}.${newDecimal}-${item.slug}`;

        fs.renameSync(path.join(phasesDir, item.dir), path.join(phasesDir, newDirName));
        renamedDirs.push({ from: item.dir, to: newDirName });

        const dirFiles = fs.readdirSync(path.join(phasesDir, newDirName));
        for (const f of dirFiles) {
          if (f.includes(oldPhaseId)) {
            const newFileName = f.replace(oldPhaseId, newPhaseId);
            fs.renameSync(
              path.join(phasesDir, newDirName, f),
              path.join(phasesDir, newDirName, newFileName)
            );
            renamedFiles.push({ from: f, to: newFileName });
          }
        }
      }
    } catch (e) { debugLog('phase.remove', 'rename failed', e); }

  } else {
    // Integer removal: renumber all subsequent integer phases
    const removedInt = parseInt(normalized, 10);

    try {
      const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();

      const toRename = [];
      for (const dir of dirs) {
        const dm = dir.match(/^(\d+)(?:\.(\d+))?-(.+)$/);
        if (!dm) continue;
        const dirInt = parseInt(dm[1], 10);
        if (dirInt > removedInt) {
          toRename.push({
            dir,
            oldInt: dirInt,
            decimal: dm[2] ? parseInt(dm[2], 10) : null,
            slug: dm[3],
          });
        }
      }

      toRename.sort((a, b) => {
        if (a.oldInt !== b.oldInt) return b.oldInt - a.oldInt;
        return (b.decimal || 0) - (a.decimal || 0);
      });

      for (const item of toRename) {
        const newInt = item.oldInt - 1;
        const newPadded = String(newInt).padStart(2, '0');
        const oldPadded = String(item.oldInt).padStart(2, '0');
        const decimalSuffix = item.decimal !== null ? `.${item.decimal}` : '';
        const oldPrefix = `${oldPadded}${decimalSuffix}`;
        const newPrefix = `${newPadded}${decimalSuffix}`;
        const newDirName = `${newPrefix}-${item.slug}`;

        fs.renameSync(path.join(phasesDir, item.dir), path.join(phasesDir, newDirName));
        renamedDirs.push({ from: item.dir, to: newDirName });

        const dirFiles = fs.readdirSync(path.join(phasesDir, newDirName));
        for (const f of dirFiles) {
          if (f.startsWith(oldPrefix)) {
            const newFileName = newPrefix + f.slice(oldPrefix.length);
            fs.renameSync(
              path.join(phasesDir, newDirName, f),
              path.join(phasesDir, newDirName, newFileName)
            );
            renamedFiles.push({ from: f, to: newFileName });
          }
        }
      }
    } catch (e) { debugLog('phase.remove', 'rename failed', e); }
  }

  // Update ROADMAP.md
  let roadmapContent = cachedReadFile(roadmapPath);

  // Remove the target phase section - escape all regex special chars
  const targetEscaped = targetPhase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sectionPattern = new RegExp(
    `\\n?#{2,4}\\s*Phase\\s+${targetEscaped}\\s*:[\\s\\S]*?(?=\\n#{2,4}\\s+Phase\\s+\\d|$)`,
    'i'
  );
  roadmapContent = roadmapContent.replace(sectionPattern, '');

  // Remove from phase list (checkbox)
  const checkboxPattern = new RegExp(`\\n?-\\s*\\[[ x]\\]\\s*.*Phase\\s+${targetEscaped}[:\\s][^\\n]*`, 'gi');
  roadmapContent = roadmapContent.replace(checkboxPattern, '');

  // Remove from progress table
  const tableRowPattern = new RegExp(`\\n?\\|\\s*${targetEscaped}\\.?\\s[^|]*\\|[^\\n]*`, 'gi');
  roadmapContent = roadmapContent.replace(tableRowPattern, '');

  // Renumber references in ROADMAP for subsequent phases
  if (!isDecimal) {
    const removedInt = parseInt(normalized, 10);

    const maxPhase = 99;
    for (let oldNum = maxPhase; oldNum > removedInt; oldNum--) {
      const newNum = oldNum - 1;
      const oldStr = String(oldNum);
      const newStr = String(newNum);
      const oldPad = oldStr.padStart(2, '0');
      const newPad = newStr.padStart(2, '0');

      roadmapContent = roadmapContent.replace(
        new RegExp(`(#{2,4}\\s*Phase\\s+)${oldStr}(\\s*:)`, 'gi'),
        `$1${newStr}$2`
      );

      roadmapContent = roadmapContent.replace(
        new RegExp(`(Phase\\s+)${oldStr}([:\\s])`, 'g'),
        `$1${newStr}$2`
      );

      roadmapContent = roadmapContent.replace(
        new RegExp(`${oldPad}-(\\d{2})`, 'g'),
        `${newPad}-$1`
      );

      roadmapContent = roadmapContent.replace(
        new RegExp(`(\\|\\s*)${oldStr}\\.\\s`, 'g'),
        `$1${newStr}. `
      );

      roadmapContent = roadmapContent.replace(
        new RegExp(`(Depends on:?\\*\\*:?\\s*Phase\\s+)${oldStr}\\b`, 'gi'),
        `$1${newStr}`
      );
    }
  }

  fs.writeFileSync(roadmapPath, roadmapContent, 'utf-8');
  invalidateFileCache(roadmapPath);

  // Update STATE.md phase count
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (fs.existsSync(statePath)) {
    let stateContent = cachedReadFile(statePath);
    const totalPattern = /(\*\*Total Phases:\*\*\s*)(\d+)/;
    const totalMatch = stateContent.match(totalPattern);
    if (totalMatch) {
      const oldTotal = parseInt(totalMatch[2], 10);
      stateContent = stateContent.replace(totalPattern, `$1${oldTotal - 1}`);
    }
    const ofPattern = /(\bof\s+)(\d+)(\s*(?:\(|phases?))/i;
    const ofMatch = stateContent.match(ofPattern);
    if (ofMatch) {
      const oldTotal = parseInt(ofMatch[2], 10);
      stateContent = stateContent.replace(ofPattern, `$1${oldTotal - 1}$3`);
    }
    fs.writeFileSync(statePath, stateContent, 'utf-8');
    invalidateFileCache(statePath);
  }

  const result = {
    removed: targetPhase,
    directory_deleted: targetDir || null,
    renamed_directories: renamedDirs,
    renamed_files: renamedFiles,
    roadmap_updated: true,
    state_updated: fs.existsSync(statePath),
  };

  output(result, raw);
}

function cmdRequirementsMarkComplete(cwd, reqIdsRaw, raw) {
  if (!reqIdsRaw || reqIdsRaw.length === 0) {
    error('requirement IDs required. Usage: requirements mark-complete REQ-01,REQ-02 or REQ-01 REQ-02');
  }

  const reqIds = reqIdsRaw
    .join(' ')
    .replace(/[\[\]]/g, '')
    .split(/[,\s]+/)
    .map(r => r.trim())
    .filter(Boolean);

  if (reqIds.length === 0) {
    error('no valid requirement IDs found');
  }

  const reqPath = path.join(cwd, '.planning', 'REQUIREMENTS.md');
  if (!fs.existsSync(reqPath)) {
    output({ updated: false, reason: 'REQUIREMENTS.md not found', ids: reqIds }, raw, 'no requirements file');
    return;
  }

  let reqContent = cachedReadFile(reqPath);
  const updated = [];
  const notFound = [];

  for (const reqId of reqIds) {
    let found = false;

    const checkboxPattern = new RegExp(`(-\\s*\\[)[ ](\\]\\s*\\*\\*${reqId}\\*\\*)`, 'gi');
    if (checkboxPattern.test(reqContent)) {
      reqContent = reqContent.replace(checkboxPattern, '$1x$2');
      found = true;
    }

    const tablePattern = new RegExp(`(\\|\\s*${reqId}\\s*\\|[^|]+\\|)\\s*Pending\\s*(\\|)`, 'gi');
    if (tablePattern.test(reqContent)) {
      reqContent = reqContent.replace(
        new RegExp(`(\\|\\s*${reqId}\\s*\\|[^|]+\\|)\\s*Pending\\s*(\\|)`, 'gi'),
        '$1 Complete $2'
      );
      found = true;
    }

    if (found) {
      updated.push(reqId);
    } else {
      notFound.push(reqId);
    }
  }

  if (updated.length > 0) {
    fs.writeFileSync(reqPath, reqContent, 'utf-8');
    invalidateFileCache(reqPath);
  }

  output({
    updated: updated.length > 0,
    marked_complete: updated,
    not_found: notFound,
    total: reqIds.length,
  }, raw, `${updated.length}/${reqIds.length} requirements marked complete`);
}

function cmdPhaseComplete(cwd, phaseNum, raw) {
  if (!phaseNum) {
    error('phase number required for phase complete');
  }

  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const normalized = normalizePhaseName(phaseNum);
  const today = new Date().toISOString().split('T')[0];

  const phaseInfo = findPhaseInternal(cwd, phaseNum);
  if (!phaseInfo) {
    error(`Phase ${phaseNum} not found`);
  }

  const planCount = phaseInfo.plans.length;
  const summaryCount = phaseInfo.summaries.length;

  // Update ROADMAP.md: mark phase complete
  if (fs.existsSync(roadmapPath)) {
    let roadmapContent = cachedReadFile(roadmapPath);

    const checkboxPattern = new RegExp(
      `(-\\s*\\[)[ ](\\]\\s*.*Phase\\s+${phaseNum.replace('.', '\\.')}[:\\s][^\\n]*)`,
      'i'
    );
    roadmapContent = roadmapContent.replace(checkboxPattern, `$1x$2 (completed ${today})`);

    const phaseEscaped = phaseNum.replace('.', '\\.');
    const tablePattern = new RegExp(
      `(\\|\\s*${phaseEscaped}\\.?\\s[^|]*\\|[^|]*\\|)\\s*[^|]*(\\|)\\s*[^|]*(\\|)`,
      'i'
    );
    roadmapContent = roadmapContent.replace(
      tablePattern,
      `$1 Complete    $2 ${today} $3`
    );

    const planCountPattern = new RegExp(
      `(#{2,4}\\s*Phase\\s+${phaseEscaped}[\\s\\S]*?\\*\\*Plans:?\\*\\*:?\\s*)[^\\n]+`,
      'i'
    );
    roadmapContent = roadmapContent.replace(
      planCountPattern,
      `$1${summaryCount}/${planCount} plans complete`
    );

    fs.writeFileSync(roadmapPath, roadmapContent, 'utf-8');
    invalidateFileCache(roadmapPath);

    // Update REQUIREMENTS.md traceability for this phase's requirements
    const reqPath = path.join(cwd, '.planning', 'REQUIREMENTS.md');
    if (fs.existsSync(reqPath)) {
      const reqMatch = roadmapContent.match(
        new RegExp(`Phase\\s+${phaseNum.replace('.', '\\.')}[\\s\\S]*?\\*\\*Requirements:?\\*\\*:?\\s*([^\\n]+)`, 'i')
      );

      if (reqMatch) {
        const reqIds = reqMatch[1].replace(/[\[\]]/g, '').split(/[,\s]+/).map(r => r.trim()).filter(Boolean);
        let reqContent = cachedReadFile(reqPath);

        for (const reqId of reqIds) {
          reqContent = reqContent.replace(
            new RegExp(`(-\\s*\\[)[ ](\\]\\s*\\*\\*${reqId}\\*\\*)`, 'gi'),
            '$1x$2'
          );
          reqContent = reqContent.replace(
            new RegExp(`(\\|\\s*${reqId}\\s*\\|[^|]+\\|)\\s*Pending\\s*(\\|)`, 'gi'),
            '$1 Complete $2'
          );
        }

        fs.writeFileSync(reqPath, reqContent, 'utf-8');
        invalidateFileCache(reqPath);
      }
    }
  }

  // Find next phase — check both disk directories AND ROADMAP.md phase sections
  let nextPhaseNum = null;
  let nextPhaseName = null;
  let isLastPhase = true;

  const currentFloat = parseFloat(phaseNum);

  // 1. Check disk directories for next phase
  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();

    for (const dir of dirs) {
      const dm = dir.match(/^(\d+(?:\.\d+)?)-?(.*)/);
      if (dm) {
        const dirFloat = parseFloat(dm[1]);
        if (dirFloat > currentFloat) {
          nextPhaseNum = dm[1];
          nextPhaseName = dm[2] || null;
          isLastPhase = false;
          break;
        }
      }
    }
  } catch (e) { debugLog('phase.complete', 'find next phase from disk failed', e); }

  // 2. Also check ROADMAP.md for phases beyond current (sections + checklist)
  let uncheckedRoadmapPhases = [];
  if (fs.existsSync(roadmapPath)) {
    try {
      const roadmapContent = cachedReadFile(roadmapPath);

      // Collect all ### Phase N: sections
      const sectionPhases = [];
      const hp = /#{2,4}\s*Phase\s+(\d+(?:\.\d+)?)\s*:\s*([^\n]+)/gi;
      let hm;
      while ((hm = hp.exec(roadmapContent)) !== null) {
        sectionPhases.push({ number: hm[1], name: hm[2].trim() });
      }

      // If still last phase, check roadmap sections for phases beyond current
      if (isLastPhase) {
        for (const rp of sectionPhases) {
          if (parseFloat(rp.number) > currentFloat) {
            nextPhaseNum = rp.number;
            nextPhaseName = rp.name.replace(/\s+/g, '-').toLowerCase();
            isLastPhase = false;
            break;
          }
        }
      }

      // Also check checklist entries for phases beyond current
      if (isLastPhase) {
        const clp = /-\s*\[[ x]\]\s*\*\*Phase\s+(\d+(?:\.\d+)?)\s*:\s*([^*]+)\*\*/gi;
        let clm;
        while ((clm = clp.exec(roadmapContent)) !== null) {
          if (parseFloat(clm[1]) > currentFloat) {
            nextPhaseNum = clm[1];
            nextPhaseName = clm[2].trim().replace(/\s+/g, '-').toLowerCase();
            isLastPhase = false;
            break;
          }
        }
      }

      // Cross-validate: find unchecked phases in roadmap
      const checkedPhases = new Set();
      const ckp = /-\s*\[x\]\s*.*Phase\s+(\d+(?:\.\d+)?)/gi;
      let ckm;
      while ((ckm = ckp.exec(roadmapContent)) !== null) checkedPhases.add(ckm[1]);

      uncheckedRoadmapPhases = sectionPhases
        .map(p => p.number)
        .filter(p => parseFloat(p) !== currentFloat && !checkedPhases.has(p));

      // If unchecked phases exist beyond current, definitely not last
      const uncheckedBeyond = uncheckedRoadmapPhases.filter(p => parseFloat(p) > currentFloat);
      if (uncheckedBeyond.length > 0 && isLastPhase) {
        isLastPhase = false;
        if (!nextPhaseNum) {
          uncheckedBeyond.sort((a, b) => parseFloat(a) - parseFloat(b));
          nextPhaseNum = uncheckedBeyond[0];
          const np = new RegExp(`#{2,4}\\s*Phase\\s+${uncheckedBeyond[0].replace('.', '\\.')}\\s*:\\s*([^\\n]+)`, 'i');
          const nm = roadmapContent.match(np);
          nextPhaseName = nm ? nm[1].trim().replace(/\s+/g, '-').toLowerCase() : null;
        }
      }
    } catch (e) { debugLog('phase.complete', 'roadmap phase validation failed', e); }
  }

  // Update STATE.md
  if (fs.existsSync(statePath)) {
    let stateContent = cachedReadFile(statePath);

    stateContent = stateContent.replace(
      /(\*\*Current Phase:\*\*\s*).*/,
      `$1${nextPhaseNum || phaseNum}`
    );

    if (nextPhaseName) {
      stateContent = stateContent.replace(
        /(\*\*Current Phase Name:\*\*\s*).*/,
        `$1${nextPhaseName.replace(/-/g, ' ')}`
      );
    }

    stateContent = stateContent.replace(
      /(\*\*Status:\*\*\s*).*/,
      `$1${isLastPhase ? 'Milestone complete' : 'Ready to plan'}`
    );

    stateContent = stateContent.replace(
      /(\*\*Current Plan:\*\*\s*).*/,
      `$1Not started`
    );

    stateContent = stateContent.replace(
      /(\*\*Last Activity:\*\*\s*).*/,
      `$1${today}`
    );

    stateContent = stateContent.replace(
      /(\*\*Last Activity Description:\*\*\s*).*/,
      `$1Phase ${phaseNum} complete${nextPhaseNum ? `, transitioned to Phase ${nextPhaseNum}` : ''}`
    );

    fs.writeFileSync(statePath, stateContent, 'utf-8');
    invalidateFileCache(statePath);
  }

  const result = {
    completed_phase: phaseNum,
    phase_name: phaseInfo.phase_name,
    plans_executed: `${summaryCount}/${planCount}`,
    next_phase: nextPhaseNum,
    next_phase_name: nextPhaseName,
    is_last_phase: isLastPhase,
    date: today,
    roadmap_updated: fs.existsSync(roadmapPath),
    state_updated: fs.existsSync(statePath),
  };

  // Include warning if there are unchecked phases remaining in the roadmap
  if (uncheckedRoadmapPhases.length > 0) {
    result.unchecked_roadmap_phases = uncheckedRoadmapPhases;
  }

  output(result, raw);
}

function cmdMilestoneComplete(cwd, version, options, raw) {
  if (!version) {
    error('version required for milestone complete (e.g., v1.0)');
  }

  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const reqPath = path.join(cwd, '.planning', 'REQUIREMENTS.md');
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  const milestonesPath = path.join(cwd, '.planning', 'MILESTONES.md');
  const archiveDir = path.join(cwd, '.planning', 'milestones');
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const today = new Date().toISOString().split('T')[0];
  const milestoneName = options.name || version;

  fs.mkdirSync(archiveDir, { recursive: true });

  let phaseCount = 0;
  let totalPlans = 0;
  let totalTasks = 0;
  const accomplishments = [];

  // Get milestone info for phase range
  let phaseRange = null;
  try {
    const milestone = getMilestoneInfo(cwd);
    phaseRange = milestone.phaseRange;
  } catch (e) { debugLog('milestone.complete', 'getMilestoneInfo failed', e); }

  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();

    for (const dir of dirs) {
      let shouldArchive = false;
      if (phaseRange) {
        const dirMatch = dir.match(/^(\d+)/);
        if (dirMatch) {
          const num = parseInt(dirMatch[1]);
          if (num >= phaseRange.start && num <= phaseRange.end) {
            shouldArchive = true;
          }
        }
      } else {
        shouldArchive = true;
      }
      
      if (shouldArchive) {
        phaseCount++;
        const phaseFiles = fs.readdirSync(path.join(phasesDir, dir));
        const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
        const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
        totalPlans += plans.length;

        for (const s of summaries) {
          try {
            const content = cachedReadFile(path.join(phasesDir, dir, s));
            const fm = extractFrontmatter(content);
            if (fm['one-liner']) {
              accomplishments.push(fm['one-liner']);
            }
            const taskMatches = content.match(/##\s*Task\s*\d+/gi) || [];
            totalTasks += taskMatches.length;
          } catch (e) { debugLog('milestone.complete', 'frontmatter extraction failed', e); }
        }
      }
    }
  } catch (e) { debugLog('milestone.complete', 'frontmatter extraction failed', e); }

  // Archive ROADMAP.md
  if (fs.existsSync(roadmapPath)) {
    const roadmapContent = cachedReadFile(roadmapPath);
    fs.writeFileSync(path.join(archiveDir, `${version}-ROADMAP.md`), roadmapContent, 'utf-8');
  }

  // Archive REQUIREMENTS.md
  if (fs.existsSync(reqPath)) {
    const reqContent = cachedReadFile(reqPath);
    const archiveHeader = `# Requirements Archive: ${version} ${milestoneName}\n\n**Archived:** ${today}\n**Status:** SHIPPED\n\nFor current requirements, see \`.planning/REQUIREMENTS.md\`.\n\n---\n\n`;
    fs.writeFileSync(path.join(archiveDir, `${version}-REQUIREMENTS.md`), archiveHeader + reqContent, 'utf-8');
  }

  // Archive audit file if exists
  const auditFile = path.join(cwd, '.planning', `${version}-MILESTONE-AUDIT.md`);
  if (fs.existsSync(auditFile)) {
    fs.renameSync(auditFile, path.join(archiveDir, `${version}-MILESTONE-AUDIT.md`));
  }

  // Create/append MILESTONES.md entry
  const accomplishmentsList = accomplishments.map(a => `- ${a}`).join('\n');
  const milestoneEntry = `## ${version} ${milestoneName} (Shipped: ${today})\n\n**Phases completed:** ${phaseCount} phases, ${totalPlans} plans, ${totalTasks} tasks\n\n**Key accomplishments:**\n${accomplishmentsList || '- (none recorded)'}\n\n---\n\n`;

  if (fs.existsSync(milestonesPath)) {
    const existing = cachedReadFile(milestonesPath);
    fs.writeFileSync(milestonesPath, existing + '\n' + milestoneEntry, 'utf-8');
    invalidateFileCache(milestonesPath);
  } else {
    fs.writeFileSync(milestonesPath, `# Milestones\n\n${milestoneEntry}`, 'utf-8');
    invalidateFileCache(milestonesPath);
  }

  // Update STATE.md
  if (fs.existsSync(statePath)) {
    let stateContent = cachedReadFile(statePath);
    stateContent = stateContent.replace(
      /(\*\*Status:\*\*\s*).*/,
      `$1${version} milestone complete`
    );
    stateContent = stateContent.replace(
      /(\*\*Last Activity:\*\*\s*).*/,
      `$1${today}`
    );
    stateContent = stateContent.replace(
      /(\*\*Last Activity Description:\*\*\s*).*/,
      `$1${version} milestone completed and archived`
    );
    fs.writeFileSync(statePath, stateContent, 'utf-8');
    invalidateFileCache(statePath);
  }

  // Auto-archive phase directories
  let phasesArchived = false;
  try {
    const phaseArchiveDir = path.join(archiveDir, `${version}-phases`);
    fs.mkdirSync(phaseArchiveDir, { recursive: true });

    const milestone = getMilestoneInfo(cwd);
    const phaseRange = milestone.phaseRange;

    const phaseEntries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const phaseDirNames = phaseEntries.filter(e => e.isDirectory()).map(e => e.name);
    for (const dir of phaseDirNames) {
      if (phaseRange) {
        const dirMatch = dir.match(/^(\d+)/);
        if (dirMatch) {
          const num = parseInt(dirMatch[1]);
          if (num < phaseRange.start || num > phaseRange.end) continue;
        }
      } else if (!options.archivePhases) {
        continue;
      }
      fs.renameSync(path.join(phasesDir, dir), path.join(phaseArchiveDir, dir));
    }
    const archivedEntries = fs.readdirSync(phaseArchiveDir);
    phasesArchived = archivedEntries.length > 0;
  } catch (e) { debugLog('milestone.complete', 'readdir failed', e); }

  // Reorganize ROADMAP.md - collapse completed phases in <details> block
  let roadmapReorganized = false;
  if (fs.existsSync(roadmapPath)) {
    try {
      let roadmapContent = cachedReadFile(roadmapPath);
      
      // Extract completed phases (those that were archived)
      const completedPhaseSections = [];
      const phaseDetailsRegex = /^##\s+Phase\s+(\d+):\s+(.+)$/gm;
      let match;
      const completedNums = [];
      
      if (phaseRange) {
        for (let n = phaseRange.start; n <= phaseRange.end; n++) {
          completedNums.push(n);
        }
      }
      
      // Find and extract completed phase sections
      const lines = roadmapContent.split('\n');
      let inCompletedPhase = false;
      let completedPhaseLines = [];
      let currentPhaseNum = null;
      
      for (const line of lines) {
        const phaseMatch = line.match(/^##\s+Phase\s+(\d+):\s+(.+)$/);
        if (phaseMatch) {
          currentPhaseNum = parseInt(phaseMatch[1]);
          if (phaseRange && (currentPhaseNum < phaseRange.start || currentPhaseNum > phaseRange.end)) {
            inCompletedPhase = false;
            continue;
          }
          inCompletedPhase = true;
          completedPhaseLines = [line];
        } else if (inCompletedPhase) {
          if (line.match(/^##\s+Phase\s+\d+/) || line.match(/^#\s+Roadmap/)) {
            // Next phase or end of roadmap
            inCompletedPhase = false;
            if (completedPhaseLines.length > 0) {
              completedPhaseSections.push(completedPhaseLines.join('\n'));
              completedPhaseLines = [];
            }
            completedPhaseLines = [line];
            inCompletedPhase = line.match(/^##\s+Phase\s+\d+/) ? true : false;
          } else {
            completedPhaseLines.push(line);
          }
        }
      }
      if (completedPhaseLines.length > 0) {
        completedPhaseSections.push(completedPhaseLines.join('\n'));
      }
      
      if (completedPhaseSections.length > 0) {
        const collapsedSections = completedPhaseSections.join('\n\n---\n\n');
        const detailsBlock = `<details>\n<summary>${version} ${milestoneName} - ${phaseCount} phases completed</summary>\n\n${collapsedSections}\n\n</details>`;
        
        // Replace completed phases with details block
        let newRoadmapContent = '';
        let inSection = false;
        let sectionBuffer = [];
        
        for (const line of lines) {
          const phaseMatch = line.match(/^##\s+Phase\s+(\d+):/);
          if (phaseMatch) {
            const num = parseInt(phaseMatch[1]);
            if (phaseRange && num >= phaseRange.start && num <= phaseRange.end) {
              // Skip this phase - will be replaced with details block
              inSection = true;
              continue;
            } else if (!phaseRange && completedPhaseSections.join('').includes(line)) {
              inSection = true;
              continue;
            }
          }
          
          if (inSection) {
            // Check if we've left the completed section
            if (!line.match(/^##\s+Phase\s+\d+/) && !line.match(/^#\s+Roadmap/) && line.trim() !== '') {
              // Still in a completed section
              continue;
            }
            inSection = false;
          }
          
          if (!inSection) {
            newRoadmapContent += line + '\n';
          }
        }
        
        // Insert details block before Phase Coverage Matrix or at end
        const matrixMatch = newRoadmapContent.match(/(##\s+Phase\s+Coverage\s+Matrix)/);
        if (matrixMatch) {
          newRoadmapContent = newRoadmapContent.replace(
            matrixMatch[1],
            `${detailsBlock}\n\n---\n\n## Phase Coverage Matrix`
          );
        }
        
        fs.writeFileSync(roadmapPath, newRoadmapContent, 'utf-8');
        invalidateFileCache(roadmapPath);
        roadmapReorganized = true;
      }
    } catch (e) { debugLog('milestone.complete', 'roadmap reorganization failed', e); }
  }

  // Generate vX.X-DOCS.md artifact
  let docsCreated = false;
  try {
    // Get git log for changelog
    let changelog = '';
    try {
      const { execSync } = require('child_process');
      // Find previous tag
      let prevTag = '';
      try {
        prevTag = execSync('git describe --tags --abbrev=0 2>/dev/null', { cwd, encoding: 'utf-8' }).trim();
      } catch (e) { /* no previous tags */ }
      
      if (prevTag) {
        changelog = execSync(`git log ${prevTag}..HEAD --oneline --format="%h %s" 2>/dev/null | head -50`, { cwd, encoding: 'utf-8' });
      } else {
        changelog = execSync('git log --oneline --format="%h %s" 2>/dev/null | head -50', { cwd, encoding: 'utf-8' });
      }
    } catch (e) { changelog = '(no git history)'; }
    
    // Get STATE.md metrics
    let currentPhase = 'Unknown';
    let totalPlansCompleted = 'Unknown';
    let velocity = 'Unknown';
    let currentFocus = 'General';
    
    if (fs.existsSync(statePath)) {
      const stateContent = cachedReadFile(statePath);
      const phaseMatch = stateContent.match(/\*\*Phase:\*\*\s*(\d+)/);
      if (phaseMatch) currentPhase = phaseMatch[1];
      const plansMatch = stateContent.match(/Total plans completed:\s*(\d+)/);
      if (plansMatch) totalPlansCompleted = plansMatch[1];
      const velMatch = stateContent.match(/Average duration:\s*~?(\d+)/);
      if (velMatch) velocity = velMatch[1];
      const focusMatch = stateContent.match(/Current focus:\s*([^\n]+)/);
      if (focusMatch) currentFocus = focusMatch[1].trim();
    }
    
    const docsContent = `# Milestone ${version} Documentation

**Generated:** ${today}
**Version:** ${version}
**Milestone Name:** ${milestoneName}

---

## Changelog

Commits in this milestone:

\`\`\`
${changelog || '(no commits)'}
\`\`\`

---

## State Summary

- **Current Phase:** ${currentPhase}
- **Total Plans Completed:** ${totalPlansCompleted}
- **Velocity:** ~${velocity} min/plan
- **Current Focus:** ${currentFocus}

---

## Key Accomplishments

${accomplishmentsList || '- (none recorded)'}

---

## Archive Location

See \`.planning/milestones/${version}-ROADMAP.md\` and \`.planning/milestones/${version}-REQUIREMENTS.md\` for the complete archived roadmap and requirements.
`;

    fs.writeFileSync(path.join(archiveDir, `${version}-DOCS.md`), docsContent, 'utf-8');
    docsCreated = true;
  } catch (e) { debugLog('milestone.complete', 'docs generation failed', e); }

  // Create git tag
  let tagCreated = false;
  try {
    const { execSync } = require('child_process');
    const tagMessage = `${version} ${milestoneName} — ${accomplishments[0] || 'Milestone complete'}`;
    execSync(`git tag -a ${version} -m "${tagMessage}"`, { cwd, encoding: 'utf-8' });
    tagCreated = true;
  } catch (e) { debugLog('milestone.complete', 'tag creation failed', e); }

  // Commit milestone completion
  let commitCreated = false;
  try {
    const { execSync } = require('child_process');
    const commitFiles = [
      `.planning/milestones/${version}-ROADMAP.md`,
      `.planning/milestones/${version}-REQUIREMENTS.md`,
      `.planning/milestones/${version}-DOCS.md`,
      `.planning/MILESTONES.md`,
      `.planning/STATE.md`,
      `.planning/ROADMAP.md`,
    ].filter(f => fs.existsSync(path.join(cwd, f)));
    
    if (commitFiles.length > 0) {
      execSync(`git add ${commitFiles.join(' ')}`, { cwd, encoding: 'utf-8' });
      try {
        execSync(`git commit -m "chore: complete ${version} milestone"`, { cwd, encoding: 'utf-8' });
        commitCreated = true;
      } catch (e) {
        // Maybe nothing to commit
        debugLog('milestone.complete', 'commit failed (possibly nothing to commit)', e);
      }
    }
  } catch (e) { debugLog('milestone.complete', 'commit failed', e); }

  const result = {
    version,
    name: milestoneName,
    date: today,
    phases: phaseCount,
    plans: totalPlans,
    tasks: totalTasks,
    accomplishments,
    archived: {
      roadmap: fs.existsSync(path.join(archiveDir, `${version}-ROADMAP.md`)),
      requirements: fs.existsSync(path.join(archiveDir, `${version}-REQUIREMENTS.md`)),
      audit: fs.existsSync(path.join(archiveDir, `${version}-MILESTONE-AUDIT.md`)),
      phases: phasesArchived,
      docs: docsCreated,
    },
    reorganized: {
      roadmap: roadmapReorganized,
    },
    git: {
      tag_created: tagCreated,
      commit_created: commitCreated,
    },
    milestones_updated: true,
    state_updated: fs.existsSync(statePath),
  };

  output(result, raw);
}

module.exports = {
  cmdPhasesList,
  cmdPhaseNextDecimal,
  cmdPhaseAdd,
  cmdPhaseInsert,
  cmdPhaseRemove,
  cmdRequirementsMarkComplete,
  cmdPhaseComplete,
  cmdMilestoneComplete,
};
