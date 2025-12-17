/**
 * AL Test Runner MCP Server - Extension Integration
 * 
 * This module provides the interface for the VS Code extension to start/stop
 * the MCP server. The MCP server runs as a child process using stdio transport.
 */

import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { existsSync, readdirSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';

let mcpProcess: ChildProcess | null = null;
let activeProjectStatePath: string | null = null;

/**
 * Find all .altestrunner folders in the workspace
 */
function findAltestrunnerFolders(): string[] {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return [];
  }

  const altestrunnerPaths: string[] = [];
  
  for (const folder of workspaceFolders) {
    const altestrunnerPath = path.join(folder.uri.fsPath, '.altestrunner');
    if (existsSync(altestrunnerPath)) {
      altestrunnerPaths.push(altestrunnerPath);
    }
  }

  return altestrunnerPaths;
}

/**
 * Get the path for the active project state file
 * If multiple .altestrunner folders exist, prompts user to select one
 */
async function getActiveProjectStatePath(context?: vscode.ExtensionContext): Promise<string | null> {
  const altestrunnerPaths = findAltestrunnerFolders();

  if (altestrunnerPaths.length === 0) {
    // No .altestrunner folder found - use first workspace folder
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      console.log('[MCP] No workspace folders found');
      return null;
    }
    const defaultPath = path.join(workspaceFolders[0].uri.fsPath, '.altestrunner');
    // Create the folder if it doesn't exist
    if (!existsSync(defaultPath)) {
      try {
        mkdirSync(defaultPath, { recursive: true });
      } catch (e) {
        console.error(`[MCP] Failed to create .altestrunner folder: ${e}`);
        return null;
      }
    }
    return path.join(defaultPath, 'active-project.json');
  }

  if (altestrunnerPaths.length === 1) {
    // Single .altestrunner folder - use it automatically
    return path.join(altestrunnerPaths[0], 'active-project.json');
  }

  // Multiple .altestrunner folders - check for saved selection or prompt user
  let selectedPath: string | undefined;
  
  if (context) {
    selectedPath = context.workspaceState.get<string>('selectedAltestrunnerPath');
    if (selectedPath && altestrunnerPaths.includes(selectedPath)) {
      return path.join(selectedPath, 'active-project.json');
    }
  }

  // Prompt user to select
  const items = altestrunnerPaths.map(p => ({
    label: path.basename(path.dirname(p)),
    description: p,
    path: p
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Multiple test projects found. Select which one to use for MCP:',
    canPickMany: false
  });

  if (selected) {
    // Save selection
    if (context) {
      await context.workspaceState.update('selectedAltestrunnerPath', selected.path);
    }
    return path.join(selected.path, 'active-project.json');
  }

  // User cancelled - use first one
  return path.join(altestrunnerPaths[0], 'active-project.json');
}

/**
 * Write the active project state file
 */
export function writeActiveProjectState(projectPath: string): void {
  if (!activeProjectStatePath) {
    return;
  }

  try {
    const state = {
      projectPath: projectPath,
      timestamp: new Date().toISOString()
    };
    writeFileSync(activeProjectStatePath, JSON.stringify(state, null, 2), 'utf-8');
  } catch (e) {
    console.error(`[MCP] Failed to write active project state: ${e}`);
  }
}

/**
 * Clear the active project state file
 */
export function clearActiveProjectState(): void {
  if (activeProjectStatePath && existsSync(activeProjectStatePath)) {
    try {
      unlinkSync(activeProjectStatePath);
    } catch (e) {
      // Ignore errors when deleting
    }
  }
}

/**
 * Get the current active project state path (for external use)
 */
export function getActiveProjectStatePathSync(): string | null {
  return activeProjectStatePath;
}

/**
 * Start the MCP server as a child process
 * 
 * The server is started as a separate Node.js process that communicates
 * via stdio, which is what Cursor expects for MCP servers.
 * 
 * @param extensionPath - Path to the extension
 * @param context - Optional VS Code extension context for workspace state
 */
export async function startMCPServer(extensionPath: string, context?: vscode.ExtensionContext): Promise<void> {
  if (mcpProcess) {
    console.log('MCP Server is already running');
    return;
  }

  // Get the active project state path (may prompt user if multiple .altestrunner folders)
  activeProjectStatePath = await getActiveProjectStatePath(context);
  
  // Path to the compiled server entry point
  const serverPath = path.join(extensionPath, 'out', 'mcp', 'serverEntry.js');
  
  try {
    // Spawn the MCP server as a child process
    mcpProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Pass the extension path so the server can find PowerShell modules
        AL_TEST_RUNNER_PATH: extensionPath,
        // Pass the active project state file path
        AL_ACTIVE_PROJECT_STATE_PATH: activeProjectStatePath || '',
      },
    });

    mcpProcess.stdout?.on('data', (data) => {
      console.log(`[MCP Server] ${data.toString()}`);
    });

    mcpProcess.stderr?.on('data', (data) => {
      console.error(`[MCP Server] ${data.toString()}`);
    });

    mcpProcess.on('error', (error) => {
      console.error(`[MCP Server] Failed to start: ${error.message}`);
      mcpProcess = null;
    });

    mcpProcess.on('exit', (code, signal) => {
      console.log(`[MCP Server] Exited with code ${code}, signal ${signal}`);
      mcpProcess = null;
    });

    console.log('AL Test Runner MCP Server started');
    if (activeProjectStatePath) {
      console.log(`[MCP] Active project state path: ${activeProjectStatePath}`);
    }
  } catch (error) {
    console.error(`Failed to start MCP server: ${error instanceof Error ? error.message : String(error)}`);
    mcpProcess = null;
  }
}

/**
 * Stop the MCP server
 */
export function stopMCPServer(): void {
  if (mcpProcess) {
    mcpProcess.kill();
    mcpProcess = null;
    console.log('AL Test Runner MCP Server stopped');
  }
}

/**
 * Check if the MCP server is running
 */
export function isMCPRunning(): boolean {
  return mcpProcess !== null && !mcpProcess.killed;
}

/**
 * Restart the MCP server
 */
export async function restartMCPServer(extensionPath: string, context?: vscode.ExtensionContext): Promise<void> {
  stopMCPServer();
  await startMCPServer(extensionPath, context);
}

// Re-export types and utilities that might be useful
export * from './types';

