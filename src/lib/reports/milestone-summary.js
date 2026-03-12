'use strict';

const fs = require('fs');
const path = require('path');

const { formatTable, sectionHeader, box, banner, color, relativeTime, getTerminalWidth } = require('../format');
const { safeReadFile, cachedReadFile, getMilestoneInfo, getPhaseTree, normalizePhaseName } = require('../helpers');
const { extractFrontmatter } = require('../frontmatter');
const { execGit } = require('../git');

// Escape regex special characters to prevent ReDoS and injection
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Unicode block characters for sparkline
const SPARKLINE_BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

/**
 * Generate a milestone summary report
 * @param {string} milestoneId - Milestone version (e.g., "v11.0") or null for current
 * @param {object} options - Options object
 * @param {string} options.format - 'console' or 'json'
 * @param {boolean} options.save - Whether to save the report to file
 * @param {string} options.filePath - Custom file path for saving
 * @param {string} cwd - Working directory
 * @returns {object} Report data or formatted string
 */
function generateMilestoneSummary(milestoneId, options = {}, cwd) {
  const { format = 'console', save = false, filePath: customFilePath } = options;
  cwd = cwd || process.cwd();

  // Get milestone data
  const milestoneData = loadMilestoneData(milestoneId, cwd);
  
  if (!milestoneData) {
    return format === 'json' 
      ? { error: `Milestone not found: ${milestoneId || 'current'}` }
      : `Error: Milestone not found: ${milestoneId || 'current'}`;
  }

  // Calculate metrics
  const metrics = calculateMilestoneMetrics(milestoneData, cwd);

  if (format === 'json') {
    const result = { milestone: milestoneData.name, version: milestoneData.version, ...metrics };
    if (save) {
      const defaultPath = path.join(cwd, '.planning', 'milestones', `${milestoneData.version}`, 'summary.md');
      const savePath = customFilePath || defaultPath;
      saveMilestoneReport(JSON.stringify(result, null, 2), savePath, cwd);
      result.saved_to = savePath;
    }
    return result;
  }

  // Format for console
  const report = formatMilestoneReport(milestoneData, metrics, cwd);
  
  if (save) {
    const defaultPath = path.join(cwd, '.planning', 'milestones', `${milestoneData.version}`, 'summary.md');
    const savePath = customFilePath || defaultPath;
    saveMilestoneReport(report, savePath, cwd);
    return { report, saved_to: savePath };
  }
  
  return report;
}

/**
 * Load milestone data from ROADMAP.md and archived milestone files
 */
function loadMilestoneData(milestoneId, cwd) {
  const milestoneInfo = getMilestoneInfo(cwd);
  
  // If no specific milestone requested, use current
  const targetVersion = milestoneId || milestoneInfo.version;
  
  // Try to find milestone in archived milestones
  const milestonesDir = path.join(cwd, '.planning', 'milestones');
  let milestoneData = null;
  
  // Check archived milestone file
  const archivedPath = path.join(milestonesDir, `${targetVersion}-ROADMAP.md`);
  if (fs.existsSync(archivedPath)) {
    const content = cachedReadFile(archivedPath);
    milestoneData = parseMilestoneRoadmap(content, targetVersion);
  }
  
  // Fallback to current ROADMAP.md
  if (!milestoneData) {
    const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
    if (fs.existsSync(roadmapPath)) {
      const content = cachedReadFile(roadmapPath);
      milestoneData = parseMilestoneRoadmap(content, targetVersion);
    }
  }
  
  // If still not found and no specific ID requested, use current milestone info
  if (!milestoneData && !milestoneId) {
    return {
      name: milestoneInfo.name || 'Current Milestone',
      version: milestoneInfo.version,
      started: milestoneInfo.started,
      completed: new Date().toISOString().split('T')[0],
      phases: [],
      status: 'in_progress'
    };
  }
  
  return milestoneData;
}

/**
 * Parse milestone data from ROADMAP.md content
 */
function parseMilestoneRoadmap(content, targetVersion) {
  const milestone = {
    name: '',
    version: targetVersion,
    started: null,
    completed: null,
    phases: [],
    status: 'unknown'
  };

  // Find milestone section - handles both "## Milestone v11.0" and "## Milestones" with list items
  // targetVersion may have "v" prefix (v11.0) or not (11.0), handle both
  const versionNum = targetVersion.replace(/^v/, '');  // "11.0"
  const escapedVersion = escapeRegex(versionNum);
  let versionRegex = new RegExp(`##?\\s+Milestone\\s+v?${escapedVersion.replace('.', '\\.')}[\\s\\S]*?(?=##?\\s+Milestone|##?\\s+Phases|$)`, 'i');
  let match = content.match(versionRegex);
  
  // If not found, try to find milestone from list items under ## Milestones
  if (!match) {
    const escapedListVersion = escapeRegex(versionNum);
    const listItemRegex = new RegExp(`v?${escapedListVersion}.*?Phases.*?(\\d+)-(\\d+)`, 'i');
    const listMatch = content.match(listItemRegex);
    if (listMatch) {
      const startPhase = parseInt(listMatch[1]);
      const endPhase = parseInt(listMatch[2]);
      const phases = [];
      for (let p = startPhase; p <= endPhase; p++) {
        phases.push({ number: p, complete: false });
      }
      milestone.phases = phases;
      milestone.name = targetVersion.startsWith('v') ? targetVersion : 'v' + targetVersion;
      milestone.status = 'complete';
      return milestone;
    }
  }
  
  if (!match) return null;
  
  const section = match[0];
  
  // Extract name
  const nameMatch = section.match(/Milestone\s+[\d.]+\s*[:\-]?\s*(.+)/i);
  if (nameMatch) {
    milestone.name = nameMatch[1].trim();
  }
  
  // Extract dates
  const startedMatch = section.match(/started[:\s]+(\d{4}-\d{2}-\d{2})/i);
  const completedMatch = section.match(/completed[:\s]+(\d{4}-\d{2}-\d{2})/i);
  const statusMatch = section.match(/status[:\s]+(\w+)/i);
  
  if (startedMatch) milestone.started = startedMatch[1];
  if (completedMatch) milestone.completed = completedMatch[1];
  if (statusMatch) milestone.status = statusMatch[1].toLowerCase();
  
  // Extract phases
  const phaseMatches = section.match(/Phase\s+(\d+)/g) || [];
  milestone.phases = phaseMatches.map(p => {
    const num = p.match(/\d+/)[0];
    return { number: parseInt(num), complete: false };
  });
  
  return milestone;
}

/**
 * Calculate detailed metrics from milestone data
 */
function calculateMilestoneMetrics(milestoneData, cwd) {
  const phaseTree = getPhaseTree(cwd);
  const metrics = {
    totalPhases: milestoneData.phases.length,
    completedPhases: 0,
    totalTasks: 0,
    completedTasks: 0,
    timeMetrics: {
      started: milestoneData.started,
      completed: milestoneData.completed,
      duration: null
    },
    qualityScores: [],
    phases: [],
    velocityMetrics: null
  };

  // Check each phase in the milestone
  for (const phase of milestoneData.phases) {
    const phaseNorm = normalizePhaseName(String(phase.number));
    const phaseEntry = phaseTree.get(phaseNorm);
    
    if (phaseEntry) {
      const phaseSummaryCount = phaseEntry.summaries.length;
      const phasePlanCount = phaseEntry.plans.length;
      const isComplete = phaseSummaryCount >= phasePlanCount && phasePlanCount > 0;
      
      if (isComplete) {
        metrics.completedPhases++;
        phase.complete = true;
      }
      
      // Count tasks from plans
      let phaseTasks = 0;
      for (const planFile of phaseEntry.plans) {
        const planPath = path.join(phaseEntry.fullPath, planFile);
        const content = safeReadFile(planPath);
        if (content) {
          const taskMatches = content.match(/<task\s/gi) || [];
          phaseTasks += taskMatches.length;
        }
      }
      
      metrics.totalTasks += phaseTasks;
      if (isComplete) {
        metrics.completedTasks += phaseTasks;
      }
      
      metrics.phases.push({
        number: phase.number,
        complete: isComplete,
        plans: phasePlanCount,
        summaries: phaseSummaryCount,
        tasks: phaseTasks
      });
    }
  }
  
  // Calculate duration
  if (milestoneData.started) {
    const start = new Date(milestoneData.started);
    const end = milestoneData.completed ? new Date(milestoneData.completed) : new Date();
    const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    metrics.timeMetrics.duration = `${diffDays} days`;
  }
  
  // Load quality scores from phase summaries
  metrics.qualityScores = loadQualityScores(metrics.phases, cwd);
  
  // Calculate velocity metrics
  metrics.velocityMetrics = calculateVelocityFromHistory(cwd);
  
  return metrics;
}

/**
 * Load quality scores from phase summaries
 */
function loadQualityScores(phases, cwd) {
  const scores = [];
  const phaseTree = getPhaseTree(cwd);
  
  for (const phase of phases) {
    if (!phase.complete) continue;
    
    const phaseNorm = normalizePhaseName(String(phase.number));
    const phaseEntry = phaseTree.get(phaseNorm);
    
    if (!phaseEntry || phaseEntry.summaries.length === 0) continue;
    
    // Check each summary for quality info
    for (const summaryFile of phaseEntry.summaries) {
      const summaryPath = path.join(phaseEntry.fullPath, summaryFile);
      const content = safeReadFile(summaryPath);
      if (!content) continue;
      
      const fm = extractFrontmatter(content);
      if (fm.quality) {
        scores.push({ phase: phase.number, score: fm.quality });
      }
    }
  }
  
  return scores;
}

/**
 * Calculate velocity from git history
 */
function calculateVelocityFromHistory(cwd) {
  // Get session data from git log
  const gitResult = execGit(cwd, ['log', '--oneline', '--format=%ai|%s', '--after="2026-01-01"', '--', '.planning/']);
  
  if (gitResult.exitCode !== 0 || !gitResult.stdout) {
    return null;
  }
  
  const sessions = [];
  const lines = gitResult.stdout.split('\n').filter(Boolean);
  
  // Group commits by date
  const commitsByDate = {};
  for (const line of lines) {
    const [dateTime, ...msgParts] = line.split('|');
    if (!dateTime) continue;
    
    const date = dateTime.split(' ')[0];
    const msg = msgParts.join('|');
    
    if (!commitsByDate[date]) {
      commitsByDate[date] = { date, commits: 0, tasks: 0 };
    }
    
    // Count summary commits as task completions
    if (msg.toLowerCase().includes('summary')) {
      commitsByDate[date].tasks++;
    }
    commitsByDate[date].commits++;
  }
  
  const sessionsList = Object.values(commitsByDate).sort((a, b) => a.date.localeCompare(b.date));
  
  if (sessionsList.length === 0) {
    return null;
  }
  
  // Calculate metrics
  const totalTasks = sessionsList.reduce((sum, s) => sum + s.tasks, 0);
  const totalSessions = sessionsList.length;
  const avgTasksPerSession = totalSessions > 0 ? (totalTasks / totalSessions).toFixed(1) : 0;
  
  // Calculate trend
  let trend = 'stable';
  if (sessionsList.length >= 4) {
    const half = Math.ceil(sessionsList.length / 2);
    const firstHalf = sessionsList.slice(0, half);
    const secondHalf = sessionsList.slice(half);
    
    const firstAvg = firstHalf.reduce((sum, s) => sum + s.tasks, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, s) => sum + s.tasks, 0) / secondHalf.length;
    
    if (secondAvg > firstAvg * 1.2) trend = 'improving';
    else if (secondAvg < firstAvg * 0.8) trend = 'declining';
  }
  
  // Generate sparkline data
  const sparklineData = sessionsList.slice(-10).map(s => s.tasks);
  const maxTasks = Math.max(...sparklineData, 1);
  const normalizedSparkline = sparklineData.map(t => t / maxTasks);
  
  return {
    totalSessions,
    totalTasks,
    avgTasksPerSession: parseFloat(avgTasksPerSession),
    trend,
    sparkline: renderSparkline(normalizedSparkline)
  };
}

/**
 * Render a simple sparkline
 */
function renderSparkline(data) {
  if (!data || data.length === 0) return '∅';
  
  return data.map(val => {
    const idx = Math.min(Math.floor(val * SPARKLINE_BLOCKS.length), SPARKLINE_BLOCKS.length - 1);
    return SPARKLINE_BLOCKS[idx];
  }).join('');
}

/**
 * Format milestone report for console display
 */
function formatMilestoneReport(milestoneData, metrics, cwd) {
  const lines = [];
  
  // Header
  lines.push(banner(`Milestone ${milestoneData.version}: ${milestoneData.name}`));
  lines.push('');
  
  // Overview section
  lines.push(sectionHeader('Overview'));
  
  const progressPercent = metrics.totalPhases > 0 
    ? Math.round((metrics.completedPhases / metrics.totalPhases) * 100) 
    : 0;
  
  lines.push(`  Version:    ${color.bold(milestoneData.version)}`);
  lines.push(`  Status:     ${metrics.completedPhases === metrics.totalPhases ? color.green('Complete') : color.yellow('In Progress')}`);
  lines.push(`  Progress:   ${color.bold(`${metrics.completedPhases}/${metrics.totalPhases}`)} phases (${progressPercent}%)`);
  lines.push(`  Tasks:      ${color.bold(`${metrics.completedTasks}/${metrics.totalTasks}`)} completed`);
  lines.push('');
  
  // Timeline section
  lines.push(sectionHeader('Timeline'));
  lines.push(`  Started:    ${metrics.timeMetrics.started || 'N/A'}`);
  lines.push(`  Completed:  ${metrics.timeMetrics.completed || 'In Progress'}`);
  lines.push(`  Duration:   ${metrics.timeMetrics.duration || 'N/A'}`);
  lines.push('');
  
  // Phases table
  if (metrics.phases.length > 0) {
    lines.push(sectionHeader('Phases'));
    const phaseRows = metrics.phases.map(p => [
      `Phase ${p.number}`,
      p.complete ? color.green('✓') : color.yellow('○'),
      String(p.plans),
      String(p.tasks)
    ]);
    lines.push(formatTable(['Phase', 'Status', 'Plans', 'Tasks'], phaseRows, { maxRows: 20 }));
    lines.push('');
  }
  
  // Velocity section
  if (metrics.velocityMetrics) {
    lines.push(sectionHeader('Velocity'));
    lines.push(`  Sessions:   ${color.bold(String(metrics.velocityMetrics.totalSessions))}`);
    lines.push(`  Tasks:      ${color.bold(String(metrics.velocityMetrics.totalTasks))}`);
    lines.push(`  Average:    ${color.bold(`${metrics.velocityMetrics.avgTasksPerSession} tasks/session`)}`);
    lines.push(`  Trend:      ${metrics.velocityMetrics.trend === 'improving' ? color.green('↑ improving') : metrics.velocityMetrics.trend === 'declining' ? color.red('↓ declining') : color.yellow('→ stable')}`);
    lines.push(`  Sparkline:  ${metrics.velocityMetrics.sparkline}`);
    lines.push('');
  }
  
  // Quality section
  if (metrics.qualityScores.length > 0) {
    lines.push(sectionHeader('Quality'));
    const avgQuality = metrics.qualityScores.reduce((sum, q) => sum + q.score, 0) / metrics.qualityScores.length;
    lines.push(`  Average Score: ${color.bold(`${avgQuality.toFixed(1)}%`)}`);
    lines.push('');
  }
  
  // Summary line
  const summaryText = `${metrics.completedPhases}/${metrics.totalPhases} phases, ${metrics.completedTasks} tasks completed`;
  const { summaryLine } = require('../format');
  lines.push(summaryLine(summaryText));
  
  return lines.join('\n');
}

/**
 * Save milestone report to file
 */
function saveMilestoneReport(content, filePath, cwd) {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  
  // Ensure directory exists
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(fullPath, content, 'utf-8');
  return fullPath;
}

module.exports = {
  generateMilestoneSummary,
  formatMilestoneReport,
  saveMilestoneReport
};
