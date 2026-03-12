'use strict';

const fs = require('fs');
const path = require('path');

const { formatTable, sectionHeader, banner, color, relativeTime } = require('../format');
const { cachedReadFile, getMilestoneInfo, getPhaseTree } = require('../helpers');
const { execGit } = require('../git');

// Reuse sparkline from viz module
const { renderSparkline: renderSparklineViz, calculateVelocityTrend } = require('../viz/sparkline');

/**
 * Calculate velocity metrics from session history
 * @param {Array} sessionHistory - Array of { date, tasksCompleted, duration, phase } objects
 * @param {object} options - Options
 * @param {number} options.sessions - Number of recent sessions to consider (default: 10)
 * @param {string} cwd - Working directory
 * @returns {object} Velocity metrics
 */
function calculateVelocityMetrics(sessionHistory, options = {}, cwd) {
  cwd = cwd || process.cwd();
  const { sessions = 10 } = options;
  
  // If no session history provided, try to load from git
  const history = sessionHistory || loadSessionHistory(cwd);
  
  if (!history || history.length === 0) {
    return {
      avgTasksPerSession: 0,
      avgDuration: 0,
      trend: 'stable',
      trendDirection: 'stable',
      totalSessions: 0,
      totalTasks: 0,
      sparklineData: [],
      sessions: []
    };
  }
  
  // Take last N sessions
  const recentSessions = history.slice(-sessions);
  
  // Calculate metrics
  const totalTasks = recentSessions.reduce((sum, s) => sum + (s.tasksCompleted || 0), 0);
  const totalDuration = recentSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const totalSessions = recentSessions.length;
  
  const avgTasksPerSession = totalSessions > 0 ? (totalTasks / totalSessions).toFixed(1) : 0;
  const avgDuration = totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0;
  
  // Calculate trend
  const trendResult = getVelocityTrend(recentSessions);
  
  // Prepare sparkline data
  const sparklineData = recentSessions.map(s => s.tasksCompleted || 0);
  
  return {
    avgTasksPerSession: parseFloat(avgTasksPerSession),
    avgDuration,
    trend: trendResult.trend,
    trendDirection: trendResult.direction,
    totalSessions,
    totalTasks,
    sparklineData,
    sessions: recentSessions
  };
}

/**
 * Load session history from various sources
 */
function loadSessionHistory(cwd) {
  const sessions = [];
  
  // Try to get session data from git log
  const gitResult = execGit(cwd, ['log', '--oneline', '--format=%ai|%s', '--after="2025-12-01"', '--', '.planning/']);
  
  if (gitResult.exitCode === 0 && gitResult.stdout) {
    const lines = gitResult.stdout.split('\n').filter(Boolean);
    
    // Group commits by date
    const commitsByDate = {};
    for (const line of lines) {
      const [dateTime, ...msgParts] = line.split('|');
      if (!dateTime) continue;
      
      const date = dateTime.split(' ')[0];
      const msg = msgParts.join('|');
      
      if (!commitsByDate[date]) {
        commitsByDate[date] = { date, tasksCompleted: 0, duration: 30, phase: null };
      }
      
      // Count summary commits as task completions
      if (msg.toLowerCase().includes('summary')) {
        commitsByDate[date].tasksCompleted++;
      }
    }
    
    sessions.push(...Object.values(commitsByDate).sort((a, b) => a.date.localeCompare(b.date)));
  }
  
  // Try to load from STATE.md performance metrics
  try {
    const statePath = path.join(cwd, '.planning', 'STATE.md');
    if (fs.existsSync(statePath)) {
      const state = cachedReadFile(statePath);
      
      // Look for performance metrics table
      const metricsMatch = state.match(/### Performance Metrics[\s\S]*?\|[\s\S]*?(?=\n###|\n---|\n$)/);
      if (metricsMatch) {
        const rows = metricsMatch[0].match(/\|\s*[\d.]+-\d+\s*\|[^\n]+/g) || [];
        for (const row of rows) {
          const cols = row.split('|').map(c => c.trim()).filter(Boolean);
          if (cols.length >= 2) {
            // Parse duration (e.g., "~15 min/plan")
            let duration = 15;
            const durMatch = cols[1].match(/(\d+)\s*min/);
            if (durMatch) duration = parseInt(durMatch[1]);
            
            sessions.push({
              date: new Date().toISOString().split('T')[0],
              tasksCompleted: 1,
              duration,
              phase: null
            });
          }
        }
      }
    }
  } catch (e) {
    // Ignore errors - git data is primary source
  }
  
  return sessions;
}

/**
 * Calculate trend direction from velocity history
 * @param {Array} velocityHistory - Array of session objects with tasksCompleted
 * @returns {object} { trend: string, direction: string }
 */
function getVelocityTrend(velocityHistory) {
  if (!velocityHistory || velocityHistory.length < 4) {
    return { trend: 'stable', direction: 'stable' };
  }
  
  const half = Math.ceil(velocityHistory.length / 2);
  const firstHalf = velocityHistory.slice(0, half);
  const secondHalf = velocityHistory.slice(half);
  
  const firstAvg = firstHalf.reduce((sum, s) => sum + (s.tasksCompleted || 0), 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, s) => sum + (s.tasksCompleted || 0), 0) / secondHalf.length;
  
  const diff = secondAvg - firstAvg;
  const threshold = firstAvg * 0.2; // 20% change threshold
  
  if (diff > threshold) {
    return { trend: 'improving', direction: 'up' };
  } else if (diff < -threshold) {
    return { trend: 'declining', direction: 'down' };
  }
  
  return { trend: 'stable', direction: 'stable' };
}

/**
 * Render velocity report for display
 * @param {object} metrics - Velocity metrics from calculateVelocityMetrics
 * @param {object} options - Display options
 * @param {string} options.format - 'console' or 'json'
 * @param {boolean} options.showSparkline - Show sparkline (default: true for console)
 * @param {number} options.sessions - Number of sessions to show
 * @param {string} cwd - Working directory
 * @returns {string|object} Formatted report
 */
function renderVelocityReport(metrics, options = {}, cwd) {
  const { format = 'console', showSparkline = true, sessions = 10 } = options;
  cwd = cwd || process.cwd();
  
  const milestone = getMilestoneInfo(cwd);
  
  if (format === 'json') {
    return {
      milestone: milestone.version,
      ...metrics
    };
  }
  
  // Console format
  const lines = [];
  
  lines.push(banner('Velocity'));
  lines.push(`  Milestone: ${color.bold(milestone.version)}`);
  lines.push('');
  
  // Metrics section
  lines.push(sectionHeader('Metrics'));
  lines.push(`  Total Sessions: ${color.bold(String(metrics.totalSessions))}`);
  lines.push(`  Total Tasks:     ${color.bold(String(metrics.totalTasks))}`);
  lines.push(`  Avg Tasks/Session: ${color.bold(String(metrics.avgTasksPerSession))}`);
  lines.push(`  Avg Duration:     ${color.bold(`${metrics.avgDuration} min`)}`);
  lines.push('');
  
  // Trend section
  lines.push(sectionHeader('Trend'));
  const trendColor = metrics.trend === 'improving' ? color.green : metrics.trend === 'declining' ? color.red : color.yellow;
  const trendArrow = metrics.trend === 'improving' ? '↑' : metrics.trend === 'declining' ? '↓' : '→';
  lines.push(`  Direction: ${trendColor(`${trendArrow} ${metrics.trend}`)}`);
  
  // Sparkline
  if (showSparkline && metrics.sparklineData && metrics.sparklineData.length > 0) {
    const normalized = metrics.sparklineData.map(t => {
      const max = Math.max(...metrics.sparklineData, 1);
      return t / max;
    });
    const sparkline = renderSparklineViz(normalized, { width: Math.min(metrics.sparklineData.length, 15) });
    lines.push(`  Sparkline: ${sparkline}`);
  }
  lines.push('');
  
  // Recent sessions table
  if (metrics.sessions && metrics.sessions.length > 0) {
    lines.push(sectionHeader('Recent Sessions'));
    const sessionRows = metrics.sessions.slice(-sessions).map(s => [
      s.date,
      String(s.tasksCompleted || 0),
      s.duration ? `${s.duration} min` : '-',
      s.phase || '-'
    ]);
    lines.push(formatTable(['Date', 'Tasks', 'Duration', 'Phase'], sessionRows, { maxRows: sessions }));
    lines.push('');
  }
  
  // Summary
  const { summaryLine } = require('../format');
  lines.push(summaryLine(`${metrics.avgTasksPerSession} tasks/session ${metrics.trend}`));
  
  return lines.join('\n');
}

module.exports = {
  calculateVelocityMetrics,
  renderVelocityReport,
  getVelocityTrend
};
