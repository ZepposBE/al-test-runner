#!/usr/bin/env node
/**
 * AL Test Runner MCP Server Entry Point
 * 
 * This file is the entry point when the MCP server is started as a child process.
 * It initializes the server with stdio transport for communication with Cursor.
 */

import { startServer } from './server';

// Start the server
startServer().catch((error) => {
  console.error('Fatal error starting MCP server:', error);
  process.exit(1);
});

