/**
 * Terminal Dashboard Visualization
 * Provides btop-style full-screen dashboard for project metrics
 */

const readline = require('readline');

// Default themes
const THEMES = {
  dark: {
    header: '\x1b[36m',
    metric: '\x1b[32m',
    label: '\x1b[90m',
    value: '\x1b[37m',
    border: '\x1b[90m',
    highlight: '\x1b[33m',
    reset: '\x1b[0m'
  },
  light: {
    header: '\x1b[34m',
    metric: '\x1b[32m',
    label: '\x1b[90m',
    value: '\x1b[30m',
    border: '\x1b[90m',
    highlight: '\x1b[33m',
    reset: '\x1b[0m'
  }
};

// Unicode box-drawing
const BOX = {
  tl: '┌', tr: '┐', bl: '└', br: '┘',
  h: '─', v: '│', hv: '┼'
};

/**
 * Detect terminal capabilities
 */
function detectTerminal() {
  try {
    const cols = process.stdout.columns || 80;
    const rows = process.stdout.rows || 24;
    const isTTY = process.stdout.isTTY;
    
    return {
      cols,
      rows,
      isTTY,
      supportsUnicode: isTTY && cols >= 80,
      isLargeEnough: cols >= 80 && rows >= 24
    };
  } catch {
    return {
      cols: 80,
      rows: 24,
      isTTY: false,
      supportsUnicode: false,
      isLargeEnough: true
    };
  }
}

/**
 * Render dashboard header
 */
function renderHeader(projectData, theme) {
  const { header, reset } = theme;
  const name = projectData.milestone || 'Project';
  const width = 76;
  
  const title = ` ${name} Dashboard `;
  const padding = width - title.length - 2;
  const leftPad = Math.floor(padding / 2);
  const rightPad = padding - leftPad;
  
  return `${header}${BOX.tl}${BOX.h.repeat(leftPad)}${title}${BOX.h.repeat(rightPad)}${BOX.tr}${reset}\n`;
}

/**
 * Render a metric card
 */
function renderMetricCard(title, value, subtitle, theme, width = 24) {
  const { metric, label, value: valColor, border, reset } = theme;
  
  const innerWidth = width - 2;
  let card = `${border}${BOX.v}${reset} `;
  
  // Title
  card += `${label}${title}${reset}`;
  card += ' '.repeat(Math.max(0, innerWidth - title.length - value.toString().length - 2));
  
  // Value
  card += `${metric}${value}${reset}`;
  card += ` ${border}${BOX.v}${reset}\n`;
  
  // Subtitle (if provided)
  if (subtitle) {
    card += `${border}${BOX.v}${reset} ${label}${subtitle}${reset}`;
    card += ' '.repeat(Math.max(0, innerWidth - subtitle.length - 1));
    card += ` ${border}${BOX.v}${reset}\n`;
  }
  
  return card;
}

/**
 * Render progress section
 */
function renderProgressSection(progress, theme) {
  const { metric, label, border, reset } = theme;
  
  const total = progress.total || 0;
  const completed = progress.completed || 0;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  // Simple ASCII bar
  const barWidth = 10;
  const filled = Math.round((percent / 100) * barWidth);
  const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
  
  const value = `${bar} ${percent}%`;
  const subtitle = `${completed}/${total} tasks`;
  
  return renderMetricCard('Progress', value, subtitle, theme);
}

/**
 * Render phase section
 */
function renderPhasesSection(phases, theme) {
  const { metric, label, border, reset } = theme;
  
  const total = phases.total || 0;
  const completed = phases.completed || 0;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  const value = `${percent}%`;
  const subtitle = `${completed}/${total} phases`;
  
  return renderMetricCard('Milestone', value, subtitle, theme);
}

/**
 * Render quality section
 */
function renderQualitySection(quality, theme) {
  const { metric, label, border, reset } = theme;
  
  const grade = quality.grade || 'N/A';
  const score = quality.score || 0;
  
  const value = `${grade} (${score})`;
  const subtitle = 'Quality Grade';
  
  return renderMetricCard('Quality', value, subtitle, theme);
}

/**
 * Render footer with keyboard hints
 */
function renderFooter(theme, width = 76) {
  const { label, reset } = theme;
  
  const hints = '←→ Navigate  |  Enter Expand  |  Q Quit';
  const padding = width - hints.length - 2;
  
  return `${theme.border}${BOX.bl}${BOX.h.repeat(width)}${BOX.br}${reset}\n` +
         `${theme.border}${BOX.v}${reset} ${label}${hints}${reset}${' '.repeat(padding)} ${theme.border}${BOX.v}${reset}\n`;
}

/**
 * Main render function
 * @param {object} projectData - Project data with milestone, progress, phases, quality
 * @param {object} options - Options
 * @returns {string} Dashboard string
 */
function renderDashboard(projectData, options = {}) {
  const { width: optWidth, height: optHeight, theme: themeName = 'auto' } = options;
  
  // Detect terminal
  const term = detectTerminal();
  
  if (!term.isLargeEnough) {
    return `Terminal too small (${term.cols}x${term.rows}). Minimum: 80x24\n`;
  }
  
  // Determine theme
  let theme;
  if (themeName === 'auto') {
    theme = term.isTTY ? THEMES.dark : THEMES.light;
  } else {
    theme = THEMES[themeName] || THEMES.dark;
  }
  
  const width = Math.min(optWidth || 76, term.cols - 4);
  const height = optHeight || 24;
  
  let output = '';
  
  // Extract theme colors
  const { label, reset } = theme;
  
  // Clear screen
  if (term.isTTY) {
    output += '\x1b[2J\x1b[H';
  }
  
  // Header
  output += renderHeader(projectData, theme);
  
  // Separator
  output += `${theme.border}${BOX.v}${BOX.h.repeat(width)}${BOX.v}${reset}\n`;
  
  // Metrics row
  const cardWidth = Math.floor((width - 4) / 3);
  
  output += renderProgressSection(projectData.progress || {}, theme);
  output += renderPhasesSection(projectData.phases || {}, theme);
  output += renderQualitySection(projectData.quality || {}, theme);
  
  // Separator
  output += `${theme.border}${BOX.v}${BOX.h.repeat(width)}${BOX.v}${reset}\n`;
  
  // Quick stats
  const stats = `Sessions: ${projectData.sessions || 0}  |  Velocity: ${projectData.velocity || 'N/A'}  |  Last Updated: ${projectData.lastUpdated || 'N/A'}`;
  const statsPad = width - stats.length - 2;
  output += `${theme.border}${BOX.v}${reset} ${stats}${' '.repeat(Math.max(0, statsPad))} ${theme.border}${BOX.v}${reset}\n`;
  
  // Footer
  output += renderFooter(theme, width);
  
  return output;
}

/**
 * Create interactive dashboard instance
 */
function createDashboard() {
  const term = detectTerminal();
  
  if (!term.isLargeEnough) {
    throw new Error(`Terminal too small (${term.cols}x${term.rows}). Minimum: 80x24`);
  }
  
  let state = {
    selected: 0,
    view: 'main', // 'main' or 'expanded'
    expandedIndex: 0
  };
  
  return {
    state,
    
    render(data) {
      return renderDashboard(data);
    },
    
    handleInput(key, data) {
      switch (key) {
        case 'q':
        case 'Q':
          return { action: 'quit' };
          
        case 'left':
        case 'arrow left':
          state.selected = Math.max(0, state.selected - 1);
          break;
          
        case 'right':
        case 'arrow right':
          state.selected = Math.min(2, state.selected + 1);
          break;
          
        case 'enter':
          state.view = state.view === 'main' ? 'expanded' : 'main';
          state.expandedIndex = state.selected;
          break;
      }
      return { action: 'redraw', state };
    },
    
    getMetricsSection(data) {
      const sections = ['progress', 'phases', 'quality'];
      return data[sections[state.selected]];
    },
    
    getExpandedView(data) {
      const section = this.getMetricsSection(data);
      return JSON.stringify(section, null, 2);
    }
  };
}

/**
 * DashboardView class for more complex interactions
 */
class DashboardView {
  constructor() {
    this.state = {
      selected: 0,
      expanded: false,
      data: null
    };
    this.term = detectTerminal();
  }
  
  render(data) {
    this.state.data = data;
    return renderDashboard(data);
  }
  
  handleInput(key) {
    if (key === 'q' || key === 'Q') {
      return { action: 'quit' };
    }
    
    if (key === 'enter') {
      this.state.expanded = !this.state.expanded;
      return { action: 'redraw' };
    }
    
    if (key === 'left' || key === 'arrow left') {
      this.state.selected = Math.max(0, this.state.selected - 1);
      return { action: 'redraw' };
    }
    
    if (key === 'right' || key === 'arrow right') {
      this.state.selected = Math.min(2, this.state.selected + 1);
      return { action: 'redraw' };
    }
    
    return { action: 'none' };
  }
  
  getMetricsSection() {
    const sections = ['progress', 'phases', 'quality'];
    return this.state.data?.[sections[this.state.selected]];
  }
  
  getExpandedView() {
    return this.getMetricsSection();
  }
}

module.exports = {
  renderDashboard,
  createDashboard,
  DashboardView,
  detectTerminal
};
