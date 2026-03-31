/**
 * CLI Tool Install Guidance Module
 * 
 * Provides platform-specific install instructions for CLI tools.
 * Supports darwin (macOS), linux, and win32 (Windows) platforms.
 */

/**
 * Full tool configuration with platform-specific install commands
 */
const TOOL_CONFIG = {
  ripgrep: {
    name: 'ripgrep',
    aliases: ['rg'],
    description: 'Ultra-fast grep alternative that respects .gitignore',
    website: 'https://github.com/BurntSushi/ripgrep',
    install: {
      darwin: 'brew install ripgrep',
      linux: 'sudo apt install ripgrep',
      win32: 'winget install BurntSushi.ripgrep.MSVC'
    },
    alternatives: 'grep (built-in, but slower)'
  },
  fd: {
    name: 'fd',
    aliases: ['fd-find'],
    description: 'Fast find alternative that respects .gitignore',
    website: 'https://github.com/sharkdp/fd',
    install: {
      darwin: 'brew install fd',
      linux: 'sudo apt install fd-find',
      win32: 'winget install sharkdp.fd'
    },
    alternatives: 'find (built-in)'
  },
  jq: {
    name: 'jq',
    aliases: [],
    description: 'Lightweight JSON processor',
    website: 'https://jqlang.github.io/jq/',
    install: {
      darwin: 'brew install jq',
      linux: 'sudo apt install jq',
      win32: 'winget install jqlang.jq'
    },
    alternatives: 'Node.js JSON transforms'
  },
  yq: {
    name: 'yq',
    aliases: [],
    description: 'YAML processor',
    website: 'https://github.com/mikefarah/yq',
    install: {
      darwin: 'brew install yq',
      linux: 'sudo apt install yq',
      win32: 'winget install黑崎一护.yq'
    },
    alternatives: 'Node.js yaml parser (js-yaml)'
  },
  ast_grep: {
    name: 'ast-grep',
    aliases: ['sg'],
    description: 'Syntax-aware structural code search and rewrite',
    website: 'https://ast-grep.github.io/',
    install: {
      darwin: 'brew install ast-grep',
      linux: 'cargo install ast-grep || brew install ast-grep',
      win32: 'winget install ast-grep.ast-grep'
    },
    alternatives: 'ripgrep or grep (text-only search)'
  },
  sd: {
    name: 'sd',
    aliases: [],
    description: 'Intuitive find and replace CLI',
    website: 'https://github.com/chmln/sd',
    install: {
      darwin: 'brew install sd',
      linux: 'cargo install sd || brew install sd',
      win32: 'winget install chmln.sd'
    },
    alternatives: 'sed or perl one-liners'
  },
  hyperfine: {
    name: 'hyperfine',
    aliases: [],
    description: 'Command-line benchmarking tool',
    website: 'https://github.com/sharkdp/hyperfine',
    install: {
      darwin: 'brew install hyperfine',
      linux: 'sudo apt install hyperfine',
      win32: 'winget install sharkdp.hyperfine'
    },
    alternatives: 'time / manual repeated timing'
  },
  bat: {
    name: 'bat',
    aliases: [],
    description: 'Syntax-highlighted cat alternative',
    website: 'https://github.com/sharkdp/bat',
    install: {
      darwin: 'brew install bat',
      linux: 'sudo apt install bat',
      win32: 'winget install sharkdp.bat'
    },
    alternatives: 'cat (built-in, no highlighting)'
  },
  gh: {
    name: 'gh',
    aliases: [],
    description: 'GitHub CLI',
    website: 'https://cli.github.com/',
    install: {
      darwin: 'brew install gh',
      linux: 'sudo apt install gh',
      win32: 'winget install GitHub.cli'
    },
    alternatives: 'GitHub web interface'
  },
  bun: {
    name: 'bun',
    aliases: [],
    description: 'Fast JavaScript runtime',
    website: 'https://bun.sh',
    install: {
      darwin: 'curl -fsSL https://bun.sh/install | bash',
      linux: 'curl -fsSL https://bun.sh/install | bash',
      win32: 'powershell -c "irm bun.sh/install.ps1|iex"'
    },
    alternatives: 'Node.js (built-in)',
    additionalInstall: {
      darwin: 'brew install oven-sh/bun/bun',
      linux: 'npm install -g bun',
      win32: 'scoop install bun'
    }
  }
};

/**
 * Get the current platform
 * @returns {string} - 'darwin', 'linux', or 'win32'
 */
function getPlatform() {
  const platform = process.platform;
  if (platform === 'darwin' || platform === 'linux' || platform === 'win32') {
    return platform;
  }
  // Default to linux for unknown platforms
  return 'linux';
}

/**
 * Get install guidance for a specific tool
 * @param {string} toolName - Tool name to get guidance for
 * @returns {object|null} - Platform-specific guidance or null if tool not found
 */
function getInstallGuidance(toolName) {
  const normalizedName = toolName.toLowerCase();
  
  // Find tool config
  let toolConfig = null;
  for (const [key, config] of Object.entries(TOOL_CONFIG)) {
    if (key === normalizedName || config.aliases.includes(normalizedName)) {
      toolConfig = config;
      break;
    }
  }

  if (!toolConfig) {
    return null;
  }

  const platform = getPlatform();
  const installCommand = toolConfig.install[platform];

  return {
    name: toolConfig.name,
    description: toolConfig.description,
    website: toolConfig.website,
    installCommand: installCommand,
    installInstructions: formatInstallInstructions(toolConfig, platform),
    platform: platform,
    alternatives: toolConfig.alternatives
  };
}

/**
 * Format install instructions as multi-line string
 * @param {object} toolConfig - Tool configuration
 * @param {string} platform - Current platform
 * @returns {string} - Formatted install instructions
 */
function formatInstallInstructions(toolConfig, platform) {
  const lines = [];
  
  lines.push(`=== ${toolConfig.name} ===`);
  lines.push(`Description: ${toolConfig.description}`);
  lines.push(`Website: ${toolConfig.website}`);
  lines.push('');
  lines.push('Install:');
  lines.push(`  ${toolConfig.install[platform]}`);
  lines.push('');
  lines.push(`Alternatives: ${toolConfig.alternatives}`);
  
  return lines.join('\n');
}

/**
 * Get install command for a tool on the current platform
 * @param {string} toolName - Tool name
 * @returns {string|null} - Install command or null if not found
 */
function getInstallCommand(toolName) {
  const guidance = getInstallGuidance(toolName);
  return guidance ? guidance.installCommand : null;
}

/**
 * Get all tools configuration
 * @returns {object} - All tool configurations
 */
function getAllToolConfig() {
  return TOOL_CONFIG;
}

module.exports = {
  TOOL_CONFIG,
  getInstallGuidance,
  getInstallCommand,
  getAllToolConfig,
  getPlatform
};
