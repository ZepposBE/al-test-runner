/**
 * Configuration utilities for AL Test Runner MCP Server
 */

import { readFileSync, existsSync, readdirSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname, normalize, sep } from 'path';
import type { ALTestRunnerConfig, MCPSettings } from '../types';

// Cache for MCP settings to avoid repeated file reads
// Key is the NORMALIZED project path, value is the settings (or null if not found)
let cachedMCPSettings: Map<string, MCPSettings | null> = new Map();

// Current active project path context (derived from last operation)
// We store both normalized (for cache lookups) and original (for file operations)
let currentProjectContextNormalized: string | null = null;
let currentProjectContextOriginal: string | null = null;

/**
 * Normalize a path for consistent comparison and caching
 */
function normalizePath(path: string): string {
  // Normalize path separators and resolve .. and .
  let normalized = normalize(path);
  // On Windows, convert to consistent case for comparison
  if (process.platform === 'win32') {
    normalized = normalized.toLowerCase();
  }
  return normalized;
}

/**
 * Find the project root directory by looking for app.json starting from a given path
 * Walks up the directory tree until it finds app.json or reaches the root
 * 
 * @param startPath - A file or directory path to start searching from
 * @returns The project root directory containing app.json, or null if not found
 */
export function findProjectRootFromPath(startPath: string): string | null {
  if (!startPath) {
    return null;
  }

  // Normalize the path
  let currentDir = normalize(startPath);
  
  // If it's a file, start from its directory
  if (existsSync(currentDir)) {
    try {
      const stat = require('fs').statSync(currentDir);
      if (!stat.isDirectory()) {
        currentDir = dirname(currentDir);
      }
    } catch {
      currentDir = dirname(currentDir);
    }
  } else {
    // Path doesn't exist, assume it's a file and start from parent
    currentDir = dirname(currentDir);
  }

  // Walk up the directory tree looking for app.json
  const root = process.platform === 'win32' ? currentDir.split(sep)[0] + sep : '/';
  
  while (currentDir && currentDir !== root) {
    const appJsonPath = join(currentDir, 'app.json');
    if (existsSync(appJsonPath)) {
      return currentDir;
    }
    
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached root
      break;
    }
    currentDir = parentDir;
  }

  return null;
}

/**
 * Set the current project context based on a file path
 * This affects which project's settings are used for subsequent operations
 * 
 * @param filePath - A file path within the project
 * @returns The detected project root, or null if not found
 */
export function setProjectContextFromFile(filePath: string): string | null {
  const projectRoot = findProjectRootFromPath(filePath);
  if (projectRoot) {
    currentProjectContextNormalized = normalizePath(projectRoot);
    currentProjectContextOriginal = projectRoot;  // Keep original case for file operations
    return projectRoot;
  }
  return null;
}

/**
 * Clear the project context (useful for testing)
 */
export function clearProjectContext(): void {
  currentProjectContextNormalized = null;
  currentProjectContextOriginal = null;
}

/**
 * Get the currently active project context
 * Returns the ORIGINAL (non-normalized) path for file operations
 */
export function getCurrentProjectContext(): string | null {
  return currentProjectContextOriginal;
}

/**
 * Get the normalized project context (for cache lookups)
 */
function getNormalizedProjectContext(): string | null {
  return currentProjectContextNormalized;
}

/**
 * Get the path to the MCP settings file
 * @param projectPath - Optional project path override (if not provided, uses current context or defaults)
 */
export function getMCPSettingsPath(projectPath?: string): string {
  // Use original paths for file operations
  const basePath = projectPath 
    || currentProjectContextOriginal 
    || process.env.AL_PROJECT_PATH 
    || process.cwd();
  return join(basePath, '.altestrunner', 'mcp-settings.json');
}

/**
 * Load MCP settings from .altestrunner/mcp-settings.json
 * Returns null if file doesn't exist or can't be parsed
 * 
 * @param projectPath - Optional project path override (if not provided, uses current context or defaults)
 */
export function getMCPSettings(projectPath?: string): MCPSettings | null {
  // For cache key, use normalized path
  // For file operations, use original path
  const originalPath = projectPath 
    || currentProjectContextOriginal 
    || process.env.AL_PROJECT_PATH 
    || process.cwd();
  
  const normalizedCacheKey = normalizePath(originalPath);
  
  // Check cache first using normalized key
  if (cachedMCPSettings.has(normalizedCacheKey)) {
    return cachedMCPSettings.get(normalizedCacheKey) || null;
  }

  // Use original path for file operations
  const settingsPath = getMCPSettingsPath(originalPath);
  
  if (!existsSync(settingsPath)) {
    cachedMCPSettings.set(normalizedCacheKey, null);
    return null;
  }

  try {
    const data = readFileSync(settingsPath, 'utf-8');
    const settings = JSON.parse(data) as MCPSettings;
    cachedMCPSettings.set(normalizedCacheKey, settings);
    return settings;
  } catch (error) {
    console.error('Error reading MCP settings:', error);
    cachedMCPSettings.set(normalizedCacheKey, null);
    return null;
  }
}

/**
 * Clear the MCP settings cache (useful for testing or when settings change)
 * @param projectPath - Optional: clear cache only for specific project. If not provided, clears all.
 */
export function clearMCPSettingsCache(projectPath?: string): void {
  if (projectPath) {
    cachedMCPSettings.delete(normalizePath(projectPath));
  } else {
    cachedMCPSettings.clear();
  }
}

/**
 * Get the AL project path with priority resolution:
 * 1. Current project context (derived from filename)
 * 2. MCP Settings (projectPath)
 * 3. Environment variable (AL_PROJECT_PATH)
 * 4. Current working directory
 * 
 * Returns the ORIGINAL path (preserves case) for file system operations.
 * 
 * @param contextPath - Optional file path to derive project context from
 */
export function getProjectPath(contextPath?: string): string {
  // If a context path is provided, try to derive project root from it
  if (contextPath) {
    const derived = findProjectRootFromPath(contextPath);
    if (derived) {
      // Also update the current context for subsequent calls
      currentProjectContextNormalized = normalizePath(derived);
      currentProjectContextOriginal = derived;
      return derived;
    }
  }
  
  // Priority 1: Current project context (use original path for file operations)
  if (currentProjectContextOriginal && existsSync(currentProjectContextOriginal)) {
    return currentProjectContextOriginal;
  }
  
  // Priority 2: MCP Settings (from current context or default)
  const mcpSettings = getMCPSettings();
  if (mcpSettings?.projectPath && existsSync(mcpSettings.projectPath)) {
    return mcpSettings.projectPath;
  }
  
  // Priority 3: Environment variable
  if (process.env.AL_PROJECT_PATH) {
    return process.env.AL_PROJECT_PATH;
  }
  
  // Priority 4: Current working directory
  return process.cwd();
}

/**
 * Get the path to the .altestrunner directory
 */
export function getALTestRunnerPath(): string {
  const projectPath = getProjectPath();
  return join(projectPath, '.altestrunner');
}

/**
 * Get the path to the AL Test Runner config file
 */
export function getConfigPath(): string {
  return join(getALTestRunnerPath(), 'config.json');
}

/**
 * Get the path to the last test results file
 */
export function getLastResultsPath(): string {
  return join(getALTestRunnerPath(), 'last.xml');
}

/**
 * Get the path to the code coverage file
 */
export function getCodeCoveragePath(): string {
  const config = getALTestRunnerConfig();
  if (config?.codeCoveragePath) {
    // If path is relative, resolve from project path
    if (!config.codeCoveragePath.startsWith('/') && !config.codeCoveragePath.match(/^[A-Za-z]:/)) {
      return join(getProjectPath(), config.codeCoveragePath);
    }
    return config.codeCoveragePath;
  }
  return join(getALTestRunnerPath(), 'codecoverage.json');
}

/**
 * Read the AL Test Runner config file
 */
export function getALTestRunnerConfig(): ALTestRunnerConfig | null {
  const configPath = getConfigPath();
  
  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const data = readFileSync(configPath, 'utf-8');
    return JSON.parse(data) as ALTestRunnerConfig;
  } catch (error) {
    console.error('Error reading config:', error);
    return null;
  }
}

/**
 * Get the path to the AL Test Runner PowerShell module
 * This looks for the extension in common locations
 */
export function getALTestRunnerModulePath(): string | null {
  // Check environment variable first
  if (process.env.AL_TEST_RUNNER_PATH) {
    const modulePath = join(process.env.AL_TEST_RUNNER_PATH, 'PowerShell', 'ALTestRunner.psm1');
    if (existsSync(modulePath)) {
      return modulePath;
    }
  }

  // Common VS Code extension paths
  const possiblePaths = [
    // Windows user extensions
    join(process.env.USERPROFILE || '', '.vscode', 'extensions'),
    join(process.env.USERPROFILE || '', '.vscode-insiders', 'extensions'),
    // Windows Cursor extensions
    join(process.env.USERPROFILE || '', '.cursor', 'extensions'),
    // Linux/Mac
    join(process.env.HOME || '', '.vscode', 'extensions'),
    join(process.env.HOME || '', '.cursor', 'extensions'),
  ];

  for (const basePath of possiblePaths) {
    if (!existsSync(basePath)) continue;

    try {
      const dirs = readdirSync(basePath);
      const alTestRunnerDir = dirs.find((d: string) => 
        d.startsWith('jamespearson.al-test-runner-')
      );
      
      if (alTestRunnerDir) {
        const modulePath = join(basePath, alTestRunnerDir, 'PowerShell', 'ALTestRunner.psm1');
        if (existsSync(modulePath)) {
          return modulePath;
        }
      }
    } catch {
      continue;
    }
  }

  // Check if we're running from within the extension directory itself
  const localModulePath = join(__dirname, '..', '..', '..', 'PowerShell', 'ALTestRunner.psm1');
  if (existsSync(localModulePath)) {
    return localModulePath;
  }

  return null;
}

/**
 * Get the launch.json path
 */
export function getLaunchJsonPath(): string {
  return join(getProjectPath(), '.vscode', 'launch.json');
}

/**
 * Read launch.json and get configurations
 */
export function getLaunchConfigurations(): any[] {
  const launchPath = getLaunchJsonPath();
  
  if (!existsSync(launchPath)) {
    return [];
  }

  try {
    const data = readFileSync(launchPath, 'utf-8');
    // Remove comments carefully - only full-line comments to avoid breaking URLs like "http://server"
    // The old regex /\/\/.*$/gm would break "server": "http://bcserver/" by removing "//bcserver/"
    const cleanData = data
      .replace(/^\s*\/\/.*$/gm, '')      // Remove full-line // comments only
      .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove block /* */ comments
    const launch = JSON.parse(cleanData);
    return launch.configurations || [];
  } catch (error) {
    console.error('Error reading launch.json:', error);
    return [];
  }
}

/**
 * Get the selected launch configuration
 */
export function getSelectedLaunchConfig(): any | null {
  const config = getALTestRunnerConfig();
  const configs = getLaunchConfigurations();
  
  if (!config?.launchConfigName || configs.length === 0) {
    // Return first launch config if no specific one selected
    return configs.find(c => c.request === 'launch') || null;
  }

  return configs.find(c => c.name === config.launchConfigName) || null;
}

/**
 * Get app.json path
 */
export function getAppJsonPath(): string {
  return join(getProjectPath(), 'app.json');
}

/**
 * Read app.json
 */
export function getAppJson(): any | null {
  const appJsonPath = getAppJsonPath();
  
  if (!existsSync(appJsonPath)) {
    return null;
  }

  try {
    let data = readFileSync(appJsonPath, 'utf-8');
    // Remove BOM if present
    if (data.charCodeAt(0) === 0xfeff) {
      data = data.slice(1);
    }
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading app.json:', error);
    return null;
  }
}

/**
 * Get container name with priority resolution:
 * 1. MCP Settings (containerName)
 * 2. Environment variable (AL_CONTAINER_NAME)
 * 3. Launch configuration (from launch.json via server URL)
 * 4. AL Test Runner config (remoteContainerName)
 */
export function getContainerName(): string | null {
  const mcpSettings = getMCPSettings();
  
  // Priority 1: MCP Settings
  if (mcpSettings?.containerName) {
    return mcpSettings.containerName;
  }
  
  // Priority 2: Environment variable
  if (process.env.AL_CONTAINER_NAME) {
    return process.env.AL_CONTAINER_NAME;
  }
  
  // Priority 3: Launch configuration (extract from server URL)
  const launchConfig = getSelectedLaunchConfig();
  if (launchConfig?.server) {
    // Server URL format: http://containername/ or http://containername:port/
    const match = launchConfig.server.match(/https?:\/\/([^/:]+)/);
    if (match) {
      return match[1];
    }
  }
  
  // Priority 4: AL Test Runner config
  const altrConfig = getALTestRunnerConfig();
  if (altrConfig?.remoteContainerName) {
    return altrConfig.remoteContainerName;
  }
  
  return null;
}

/**
 * Get the output folder for .app files with priority resolution:
 * 1. MCP Settings (outputFolder)
 * 2. Default (.output)
 */
export function getOutputFolder(): string {
  const mcpSettings = getMCPSettings();
  const projectPath = getProjectPath();
  
  // Priority 1: MCP Settings
  if (mcpSettings?.outputFolder) {
    // If relative path, resolve from project path
    if (!mcpSettings.outputFolder.startsWith('/') && !mcpSettings.outputFolder.match(/^[A-Za-z]:/)) {
      return join(projectPath, mcpSettings.outputFolder);
    }
    return mcpSettings.outputFolder;
  }
  
  // Priority 2: Default .output folder
  return join(projectPath, '.output');
}

/**
 * Get explicit app file path from MCP settings (if configured)
 */
export function getConfiguredAppFilePath(): string | null {
  const mcpSettings = getMCPSettings();
  
  if (mcpSettings?.appFilePath) {
    // If relative path, resolve from project path
    if (!mcpSettings.appFilePath.startsWith('/') && !mcpSettings.appFilePath.match(/^[A-Za-z]:/)) {
      return join(getProjectPath(), mcpSettings.appFilePath);
    }
    return mcpSettings.appFilePath;
  }
  
  return null;
}

/**
 * Get the launch config name with priority resolution:
 * 1. MCP Settings (launchConfigName)
 * 2. AL Test Runner config (launchConfigName)
 */
export function getLaunchConfigName(): string | null {
  const mcpSettings = getMCPSettings();
  
  // Priority 1: MCP Settings
  if (mcpSettings?.launchConfigName) {
    return mcpSettings.launchConfigName;
  }
  
  // Priority 2: AL Test Runner config
  const altrConfig = getALTestRunnerConfig();
  if (altrConfig?.launchConfigName) {
    return altrConfig.launchConfigName;
  }
  
  return null;
}

/**
 * Get the selected launch configuration (updated to use priority resolution)
 */
export function getSelectedLaunchConfigWithPriority(): any | null {
  const configName = getLaunchConfigName();
  const configs = getLaunchConfigurations();
  
  if (configs.length === 0) {
    return null;
  }
  
  if (configName) {
    const found = configs.find(c => c.name === configName);
    if (found) {
      return found;
    }
  }
  
  // Fallback: Return first launch config
  return configs.find(c => c.request === 'launch') || configs[0] || null;
}

/**
 * Save MCP settings to .altestrunner/mcp-settings.json
 */
export function saveMCPSettings(settings: MCPSettings): { success: boolean; error?: string } {
  const settingsPath = getMCPSettingsPath();
  const settingsDir = dirname(settingsPath);
  
  try {
    // Ensure .altestrunner directory exists
    if (!existsSync(settingsDir)) {
      mkdirSync(settingsDir, { recursive: true });
    }
    
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    
    // Clear cache so new settings are picked up
    clearMCPSettingsCache();
    
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

/**
 * Get the path to the decoration trigger file
 * This file is used for IPC between the MCP server and the VS Code extension
 */
export function getDecorationTriggerPath(): string {
  return join(getALTestRunnerPath(), 'trigger-decorations');
}

/**
 * Trigger decoration updates in the VS Code extension
 * Writes a trigger file that the extension watches for
 * @returns Object with success status and optional error message
 */
export function triggerDecorations(): { success: boolean; error?: string } {
  const triggerPath = getDecorationTriggerPath();
  const triggerDir = dirname(triggerPath);
  
  try {
    // Ensure .altestrunner directory exists
    if (!existsSync(triggerDir)) {
      mkdirSync(triggerDir, { recursive: true });
    }
    
    // Write trigger file with timestamp
    writeFileSync(triggerPath, new Date().toISOString(), 'utf-8');
    
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

