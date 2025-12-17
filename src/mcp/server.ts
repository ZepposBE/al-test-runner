/**
 * AL Test Runner MCP Server
 * 
 * Exposes AL Test Runner functionality as MCP tools for AI-driven testing workflows.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { getTestResultsTool, getTestResultsHandler } from './tools/getResults';
import { 
  runAllTestsTool, 
  runTestCodeunitTool, 
  runSingleTestTool,
  listTestCodeunitsTool,
  runAllTestsHandler,
  runTestCodeunitHandler,
  runSingleTestHandler,
  listTestCodeunitsHandler
} from './tools/runTests';
import { 
  getCodeCoverageTool,
  getCodeCoverageHandler
} from './tools/getCoverage';
import {
  publishExtensionTool,
  publishAndTestTool,
  publishExtensionHandler,
  publishAndTestHandler
} from './tools/publish';
import {
  createMCPSettingsTool,
  getMCPSettingsTool,
  debugProjectContextTool,
  createMCPSettingsHandler,
  getMCPSettingsHandler,
  debugProjectContextHandler
} from './tools/settings';
import {
  updateDecorationsTool,
  updateDecorationsHandler
} from './tools/updateDecorations';
import {
  testResultsResource,
  coverageResource,
  configResource,
  readTestResultsResource,
  readCoverageResource,
  readConfigResource
} from './resources/testResults';
import { createProgressReporter, type ProgressReporter } from './utils/progress';

let server: Server | null = null;

/**
 * Create and configure the MCP server
 */
export function createMCPServer(): Server {
  const mcpServer = new Server(
    {
      name: 'al-test-runner-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Register tool list handler
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        getTestResultsTool,
        runAllTestsTool,
        runTestCodeunitTool,
        runSingleTestTool,
        listTestCodeunitsTool,
        getCodeCoverageTool,
        publishExtensionTool,
        publishAndTestTool,
        createMCPSettingsTool,
        getMCPSettingsTool,
        debugProjectContextTool,
        updateDecorationsTool,
      ],
    };
  });

  // Register tool call handler
  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args, _meta } = request.params;
    
    // Create progress reporter for this request
    // The progressToken comes from _meta if the client supports progress notifications
    const progressToken = _meta?.progressToken;
    const progress: ProgressReporter = createProgressReporter(mcpServer, progressToken);

    switch (name) {
      case 'get_test_results':
        return getTestResultsHandler(args as { detailed?: boolean });

      case 'run_all_tests':
        return runAllTestsHandler(
          args as { extensionId?: string; extensionName?: string; getCodeCoverage?: boolean; publishFirst?: boolean },
          progress
        );

      case 'run_test_codeunit':
        return runTestCodeunitHandler(
          args as { filename?: string; codeunitId?: number; getCodeCoverage?: boolean; publishFirst?: boolean },
          progress
        );

      case 'run_single_test':
        return runSingleTestHandler(
          args as { filename: string; testName: string; getCodeCoverage?: boolean; publishFirst?: boolean },
          progress
        );

      case 'list_test_codeunits':
        return listTestCodeunitsHandler();

      case 'get_code_coverage':
        return getCodeCoverageHandler(args as { objectType?: string; objectId?: number });

      case 'publish_extension':
        return publishExtensionHandler(args as { appFile?: string }, progress);

      case 'publish_and_test':
        return publishAndTestHandler(args as { getCodeCoverage?: boolean }, progress);

      case 'create_mcp_settings':
        return createMCPSettingsHandler(args as { 
          projectPath?: string; 
          containerName?: string; 
          launchConfigName?: string;
          appFilePath?: string;
          outputFolder?: string;
          extensionId?: string;
          extensionName?: string;
          overwrite?: boolean;
        });

      case 'get_mcp_settings':
        return getMCPSettingsHandler();

      case 'debug_project_context':
        return debugProjectContextHandler(args as { testFilePath?: string });

      case 'update_test_decorations':
        return updateDecorationsHandler();

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  // Register resource list handler
  mcpServer.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        testResultsResource,
        coverageResource,
        configResource,
      ],
    };
  });

  // Register resource read handler
  mcpServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    switch (uri) {
      case 'altestrunner://results/latest':
        return readTestResultsResource();

      case 'altestrunner://coverage':
        return readCoverageResource();

      case 'altestrunner://config':
        return readConfigResource();

      default:
        throw new Error(`Unknown resource: ${uri}`);
    }
  });

  return mcpServer;
}

/**
 * Start the MCP server with stdio transport
 */
export async function startServer(): Promise<void> {
  if (server) {
    console.error('MCP Server is already running');
    return;
  }

  server = createMCPServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('AL Test Runner MCP Server running on stdio');
}

/**
 * Stop the MCP server
 */
export async function stopServer(): Promise<void> {
  if (server) {
    await server.close();
    server = null;
    console.error('AL Test Runner MCP Server stopped');
  }
}

/**
 * Check if the MCP server is running
 */
export function isServerRunning(): boolean {
  return server !== null;
}

/**
 * Get the server instance (for testing)
 */
export function getServer(): Server | null {
  return server;
}

