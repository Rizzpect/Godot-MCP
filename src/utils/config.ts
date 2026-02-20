/**
 * Godot MCP Server - Configuration Utilities
 */

import { GodotConfig } from '../types/index.js';
import { homedir } from 'os';
import { join } from 'path';

export const DEFAULT_CONFIG: Partial<GodotConfig> = {
  lspPort: 6005,
  debugMode: false,
};

export function getDefaultGodotPath(): string {
  const platform = process.platform;
  
  if (platform === 'win32') {
    // Common Windows paths
    const paths = [
      'C:\\Program Files\\Godot\\Godot.exe',
      'C:\\Program Files (x86)\\Godot\\Godot.exe',
      join(homedir(), 'Godot', 'Godot.exe'),
    ];
    return paths[0]; // Default to first common path
  } else if (platform === 'darwin') {
    // macOS paths
    return '/Applications/Godot.app/Contents/MacOS/Godot';
  } else {
    // Linux paths
    return '/usr/bin/godot';
  }
}

export function getConfigFromEnv(): GodotConfig {
  return {
    godotPath: process.env.GODOT_PATH || getDefaultGodotPath(),
    projectPath: process.env.GODOT_PROJECT_PATH || process.cwd(),
    lspPort: parseInt(process.env.GODOT_LSP_PORT || '6005', 10),
    debugMode: process.env.DEBUG === 'true',
  };
}

export function validateConfig(config: GodotConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!config.godotPath) {
    errors.push('GODOT_PATH is required');
  }
  
  if (!config.projectPath) {
    errors.push('GODOT_PROJECT_PATH is required');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
