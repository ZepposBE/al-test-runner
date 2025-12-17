/**
 * PowerShell execution utilities for AL Test Runner
 */

import { spawn } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import type { PowerShellResult, RunTestsParams, PublishResult } from '../types';
import { 
  getALTestRunnerModulePath, 
  getProjectPath, 
  getALTestRunnerConfig,
  getSelectedLaunchConfig,
  getSelectedLaunchConfigWithPriority,
  getAppJson,
  getLastResultsPath,
  getALTestRunnerPath,
  getContainerName,
  getOutputFolder,
  getConfiguredAppFilePath,
  getMCPSettings,
  getCurrentProjectContext
} from './config';

/**
 * Execute a PowerShell command and return the result
 */
export async function executePowerShell(command: string): Promise<PowerShellResult> {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'powershell.exe' : 'pwsh';
    
    const args = [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      command,
    ];

    const proc = spawn(shell, args, {
      cwd: getProjectPath(),
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        success: code === 0,
        output: stdout,
        error: stderr || undefined,
        exitCode: code || 0,
      });
    });

    proc.on('error', (error) => {
      resolve({
        success: false,
        output: '',
        error: error.message,
        exitCode: -1,
      });
    });
  });
}

/**
 * Build the PowerShell command to run tests
 */
export function buildTestCommand(params: RunTestsParams): string {
  const modulePath = getALTestRunnerModulePath();
  const config = getALTestRunnerConfig();
  const launchConfig = getSelectedLaunchConfig();
  const appJson = getAppJson();
  const mcpSettings = getMCPSettings();
  const resultsPath = join(getProjectPath(), '.altestrunner');

  if (!modulePath) {
    throw new Error('AL Test Runner PowerShell module not found. Please ensure the AL Test Runner extension is installed.');
  }

  // Build the command
  let command = `
    Import-Module "${modulePath}" -DisableNameChecking -Force;
  `;

  // Build Invoke-ALTestRunner parameters
  const cmdParams: string[] = [];
  
  cmdParams.push(`-Tests ${params.scope}`);
  cmdParams.push(`-ResultsPath "${resultsPath}"`);

  // Add extension info with priority:
  // 1. MCP Settings (extensionId/extensionName)
  // 2. app.json
  const extensionId = mcpSettings?.extensionId || appJson?.id;
  const extensionName = mcpSettings?.extensionName || appJson?.name;
  
  if (extensionId) {
    cmdParams.push(`-ExtensionId "${extensionId}"`);
  }
  if (extensionName) {
    cmdParams.push(`-ExtensionName "${extensionName}"`);
  }

  // Add launch config
  if (launchConfig) {
    cmdParams.push(`-LaunchConfig '${JSON.stringify(launchConfig)}'`);
  }

  // Add filename if provided
  if (params.filename) {
    cmdParams.push(`-FileName "${params.filename}"`);
  }

  // Add selection start (line number) if provided
  if (params.selectionStart !== undefined) {
    cmdParams.push(`-SelectionStart ${params.selectionStart}`);
  }

  // Add code coverage flag
  if (params.getCodeCoverage) {
    cmdParams.push('-GetCodeCoverage');
  }

  command += `Invoke-ALTestRunner ${cmdParams.join(' ')}`;

  return command;
}

/**
 * Run tests and wait for results
 */
export async function runTests(params: RunTestsParams): Promise<{
  success: boolean;
  message: string;
  output?: string;
  error?: string;
}> {
  // Check prerequisites
  const modulePath = getALTestRunnerModulePath();
  if (!modulePath) {
    return {
      success: false,
      message: 'AL Test Runner PowerShell module not found. Please ensure the AL Test Runner extension is installed.',
    };
  }

  const config = getALTestRunnerConfig();
  if (!config) {
    return {
      success: false,
      message: 'AL Test Runner config not found. Please run tests from VS Code first to create the configuration.',
    };
  }

  const appJson = getAppJson();
  if (!appJson) {
    return {
      success: false,
      message: 'app.json not found. Please ensure you are in an AL project directory.',
    };
  }

  try {
    const command = buildTestCommand(params);
    
    // Delete existing last.xml to know when new results arrive
    const resultsPath = getLastResultsPath();
    
    // Execute the command
    const result = await executePowerShell(command);

    if (!result.success) {
      return {
        success: false,
        message: 'Test execution failed',
        output: result.output,
        error: result.error,
      };
    }

    // Check if results file was created
    if (existsSync(resultsPath)) {
      return {
        success: true,
        message: 'Tests completed successfully',
        output: result.output,
      };
    } else {
      return {
        success: false,
        message: 'Tests may have run but no results file was created',
        output: result.output,
        error: result.error,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Walk directory recursively to find .al files
 */
function walkDir(dir: string, files: string[] = []): string[] {
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
          walkDir(fullPath, files);
        } else if (entry.endsWith('.al')) {
          files.push(fullPath);
        }
      } catch {
        // Skip inaccessible files
      }
    }
  } catch {
    // Skip inaccessible directories
  }
  return files;
}

/**
 * Find test codeunits in the project
 */
export async function findTestCodeunits(): Promise<Array<{
  path: string;
  id: number;
  name: string;
  tests: string[];
}>> {
  const projectPath = getProjectPath();
  const alFiles = walkDir(projectPath);
  
  const testCodeunits: Array<{
    path: string;
    id: number;
    name: string;
    tests: string[];
  }> = [];

  for (const filePath of alFiles) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      
      // Check if it's a test codeunit
      if (!content.match(/Sub[tT]ype\s*=\s*[tT]est\s*;/)) {
        continue;
      }

      // Extract codeunit ID and name
      const codeunitMatch = content.match(/codeunit\s+(\d+)\s+"?([^"\n{]+)"?\s*\{?/i);
      if (!codeunitMatch) {
        continue;
      }

      const id = parseInt(codeunitMatch[1]);
      const name = codeunitMatch[2].trim().replace(/"$/, '');

      // Find test methods
      const tests: string[] = [];
      const testRegex = /\[Test\][\s\S]*?procedure\s+(\w+)\s*\(/gi;
      let testMatch;
      while ((testMatch = testRegex.exec(content)) !== null) {
        tests.push(testMatch[1]);
      }

      if (tests.length > 0) {
        testCodeunits.push({
          path: filePath,
          id,
          name,
          tests,
        });
      }
    } catch {
      // Skip files that can't be read
    }
  }

  return testCodeunits.sort((a, b) => a.id - b.id);
}

/**
 * Find the line number of a test method in a file
 */
export function findTestLineNumber(filePath: string, testName: string): number {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    // Look for [Test] followed by procedure testName
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/\[Test\]/i)) {
        // Look ahead for the procedure
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          const procMatch = lines[j].match(new RegExp(`procedure\\s+${testName}\\s*\\(`, 'i'));
          if (procMatch) {
            return j; // 0-based line number
          }
        }
      }
    }
    
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Find the .app file in the project with priority resolution:
 * 1. MCP Settings (appFilePath) - explicit path
 * 2. MCP Settings (outputFolder) - custom output folder
 * 3. Auto-detection from .output, output, or project root
 */
export function findAppFile(): string | null {
  // Priority 1: Check MCP settings for explicit app file path
  const configuredPath = getConfiguredAppFilePath();
  if (configuredPath && existsSync(configuredPath)) {
    return configuredPath;
  }

  const projectPath = getProjectPath();
  const appJson = getAppJson();
  
  if (!appJson) {
    return null;
  }

  // Construct expected app filename: Publisher_Name_Version.app
  const publisher = appJson.publisher?.replace(/[^a-zA-Z0-9]/g, '') || '';
  const name = appJson.name?.replace(/[^a-zA-Z0-9]/g, '') || '';
  const version = appJson.version || '1.0.0.0';
  const expectedFilename = `${publisher}_${name}_${version}.app`;

  // Priority 2: Check MCP settings output folder first
  const mcpOutputFolder = getOutputFolder();
  
  // Build list of output locations to check
  const outputLocations = [
    mcpOutputFolder, // From MCP settings or default .output
    join(projectPath, '.output'),
    join(projectPath, 'output'),
    projectPath,
  ];
  
  // Remove duplicates
  const uniqueLocations = [...new Set(outputLocations)];

  for (const location of uniqueLocations) {
    if (!existsSync(location)) continue;

    // First try exact match
    const exactPath = join(location, expectedFilename);
    if (existsSync(exactPath)) {
      return exactPath;
    }

    // Then look for any .app file (excluding dependencies)
    try {
      const files = readdirSync(location);
      for (const file of files) {
        if (file.endsWith('.app') && 
            !file.includes('dep.app') && 
            !file.includes('.alpackages')) {
          const fullPath = join(location, file);
          // Verify it's a file, not a directory
          if (statSync(fullPath).isFile()) {
            return fullPath;
          }
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Get the path to the publish completion file
 */
export function getPublishCompletionPath(): string {
  return join(getALTestRunnerPath(), 'publish.txt');
}

/**
 * Build the PowerShell command to publish an app
 * Uses priority resolution for container name and launch config
 */
export function buildPublishCommand(appFile: string): string {
  const modulePath = getALTestRunnerModulePath();
  const launchConfig = getSelectedLaunchConfigWithPriority();
  const completionPath = getPublishCompletionPath();
  const containerName = getContainerName();

  if (!modulePath) {
    throw new Error('AL Test Runner PowerShell module not found. Please ensure the AL Test Runner extension is installed.');
  }

  // Build the command using existing Publish-App function
  let command = `
    Import-Module "${modulePath}" -DisableNameChecking -Force;
  `;

  // Build Publish-App parameters
  const cmdParams: string[] = [];
  cmdParams.push(`-AppFile "${appFile}"`);
  cmdParams.push(`-CompletionPath "${completionPath}"`);

  // Add container name directly if available (from MCP settings or other sources)
  if (containerName) {
    cmdParams.push(`-ContainerName "${containerName}"`);
  }

  // Add launch config if available (provides additional context like credentials)
  if (launchConfig) {
    cmdParams.push(`-LaunchConfig '${JSON.stringify(launchConfig)}'`);
  }

  command += `Publish-App ${cmdParams.join(' ')}`;

  return command;
}

/**
 * Publish an app to the BC container
 * Uses priority resolution for all configuration
 */
export async function publishApp(appFile?: string): Promise<PublishResult> {
  // Find app file if not provided
  const targetAppFile = appFile || findAppFile();
  
  if (!targetAppFile) {
    return {
      success: false,
      message: 'No .app file found. Please compile your extension first (Ctrl+Shift+B in VS Code).',
    };
  }

  if (!existsSync(targetAppFile)) {
    return {
      success: false,
      message: `App file not found: ${targetAppFile}`,
    };
  }

  // Check prerequisites
  const modulePath = getALTestRunnerModulePath();
  if (!modulePath) {
    return {
      success: false,
      message: 'AL Test Runner PowerShell module not found. Please ensure the AL Test Runner extension is installed.',
    };
  }

  // Check for container name (using priority resolution)
  const containerName = getContainerName();
  const launchConfig = getSelectedLaunchConfigWithPriority();
  
  if (!containerName && !launchConfig) {
    const mcpSettings = getMCPSettings();
    
    if (mcpSettings) {
      // Settings file exists but missing container name
      return {
        success: false,
        message: 'Container name not configured. Add "containerName" to .altestrunner/mcp-settings.json',
        error: 'Missing containerName in MCP settings file',
      };
    } else {
      // No settings file and no launch.json
      return {
        success: false,
        message: 'No launch configuration found. Please ensure .vscode/launch.json exists or create .altestrunner/mcp-settings.json',
        error: 'Configuration missing: Create .altestrunner/mcp-settings.json with { "containerName": "your-container-name" }',
      };
    }
  }

  try {
    // Delete existing completion file
    const completionPath = getPublishCompletionPath();
    if (existsSync(completionPath)) {
      const { unlinkSync } = await import('fs');
      unlinkSync(completionPath);
    }

    // Build and execute the publish command
    const command = buildPublishCommand(targetAppFile);
    const result = await executePowerShell(command);

    // Check completion file for result
    // The Publish-App.ps1 script writes '1' on success, or the error message on failure
    if (existsSync(completionPath)) {
      const content = readFileSync(completionPath, 'utf-8').trim();
      if (content === '1') {
        return {
          success: true,
          message: 'Extension published successfully',
          appFile: targetAppFile,
        };
      } else {
        return {
          success: false,
          message: content || 'Publishing failed',
          appFile: targetAppFile,
          error: content,
        };
      }
    }

    // If no completion file, check PowerShell result
    if (!result.success) {
      return {
        success: false,
        message: 'Publishing failed',
        appFile: targetAppFile,
        error: result.error || result.output,
      };
    }

    return {
      success: false,
      message: 'Publishing may have failed - no completion file was created',
      appFile: targetAppFile,
      error: result.output,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      appFile: targetAppFile,
    };
  }
}

