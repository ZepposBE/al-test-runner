/**
 * AL Test Runner MCP Server - Extension Integration
 * 
 * This module provides the interface for the VS Code extension to start/stop
 * the MCP server. The MCP server runs as a child process using stdio transport.
 */

import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';

let mcpProcess: ChildProcess | null = null;

/**
 * Start the MCP server as a child process
 * 
 * The server is started as a separate Node.js process that communicates
 * via stdio, which is what Cursor expects for MCP servers.
 */
export function startMCPServer(extensionPath: string): void {
  if (mcpProcess) {
    console.log('MCP Server is already running');
    return;
  }

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
export function restartMCPServer(extensionPath: string): void {
  stopMCPServer();
  startMCPServer(extensionPath);
}

// Re-export types and utilities that might be useful
export * from './types';

