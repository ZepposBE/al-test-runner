/**
 * Settings tools for AL Test Runner MCP Server
 * 
 * Provides tools to create and manage MCP settings for multi-root workspace support.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { 
  getMCPSettings, 
  getMCPSettingsPath, 
  saveMCPSettings,
  getProjectPath,
  getContainerName,
  getSelectedLaunchConfigWithPriority,
  getAppJson,
  getOutputFolder,
  getCurrentProjectContext,
  setProjectContextFromFile,
  getALTestRunnerPath
} from '../utils/config';
import { findAppFile } from '../utils/powershell';
import { existsSync } from 'fs';
import type { MCPSettings } from '../types';

/**
 * Tool definition for create_mcp_settings
 */
export const createMCPSettingsTool: Tool = {
  name: 'create_mcp_settings',
  description: `Create or update the MCP settings file (.altestrunner/mcp-settings.json).

This tool helps configure the AL Test Runner MCP for multi-root workspaces or when 
launch.json cannot be found. It will auto-detect values where possible.

The settings file allows you to explicitly configure:
- projectPath: Path to the AL project root
- containerName: BC container name (bypasses launch.json)
- launchConfigName: Which launch configuration to use
- appFilePath: Explicit path to .app file
- outputFolder: Where to look for .app files
- extensionId: Extension ID (GUID) - overrides app.json
- extensionName: Extension name - overrides app.json (useful for test extensions)

Use this when:
- Publishing fails because launch.json wasn't found
- You're in a multi-root workspace
- You want to override auto-detected values
- You need to specify a different extension name (e.g., for test extensions)`,
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Explicit path to AL project root. If not provided, uses current detected path.',
      },
      containerName: {
        type: 'string',
        description: 'BC container name. If not provided, attempts to detect from launch.json.',
      },
      launchConfigName: {
        type: 'string',
        description: 'Name of launch configuration to use.',
      },
      appFilePath: {
        type: 'string',
        description: 'Explicit path to .app file.',
      },
      outputFolder: {
        type: 'string',
        description: 'Folder containing .app files (default: .output).',
      },
      extensionId: {
        type: 'string',
        description: 'Extension ID (GUID). Overrides the id from app.json.',
      },
      extensionName: {
        type: 'string',
        description: 'Extension name. Overrides the name from app.json (useful for test extensions).',
      },
      overwrite: {
        type: 'boolean',
        description: 'If true, overwrites existing settings. If false, merges with existing. Default: false.',
      },
    },
  },
};

/**
 * Tool definition for get_mcp_settings
 */
export const getMCPSettingsTool: Tool = {
  name: 'get_mcp_settings',
  description: `Get the current MCP settings and detected configuration values.

Returns:
- Current MCP settings (if mcp-settings.json exists)
- Auto-detected values for all settings
- Effective values (what will actually be used)

Use this to diagnose configuration issues or see what values are being used.`,
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

/**
 * Tool definition for debug_project_context
 */
export const debugProjectContextTool: Tool = {
  name: 'debug_project_context',
  description: `Debug tool for troubleshooting multi-root workspace issues.

This tool provides detailed diagnostic information about:
- Current project context (internal state)
- MCP settings being used
- Path resolution for a given file
- Extension info that would be used for tests

Use this when tests are running against the wrong extension or project.`,
  inputSchema: {
    type: 'object',
    properties: {
      testFilePath: {
        type: 'string',
        description: 'Optional: A file path to test project detection with. If provided, will show what project would be detected from this path.',
      },
    },
  },
};

/**
 * Handler for create_mcp_settings tool
 */
export async function createMCPSettingsHandler(args?: {
  projectPath?: string;
  containerName?: string;
  launchConfigName?: string;
  appFilePath?: string;
  outputFolder?: string;
  extensionId?: string;
  extensionName?: string;
  overwrite?: boolean;
}) {
  try {
    // Get existing settings if not overwriting
    const existingSettings = args?.overwrite ? null : getMCPSettings();
    
    // Build new settings, merging with existing if applicable
    const newSettings: MCPSettings = {
      ...(existingSettings || {}),
    };

    // Apply provided values
    if (args?.projectPath !== undefined) {
      newSettings.projectPath = args.projectPath;
    }
    if (args?.containerName !== undefined) {
      newSettings.containerName = args.containerName;
    }
    if (args?.launchConfigName !== undefined) {
      newSettings.launchConfigName = args.launchConfigName;
    }
    if (args?.appFilePath !== undefined) {
      newSettings.appFilePath = args.appFilePath;
    }
    if (args?.outputFolder !== undefined) {
      newSettings.outputFolder = args.outputFolder;
    }
    if (args?.extensionId !== undefined) {
      newSettings.extensionId = args.extensionId;
    }
    if (args?.extensionName !== undefined) {
      newSettings.extensionName = args.extensionName;
    }

    // Auto-detect values for any missing required settings
    if (!newSettings.projectPath) {
      newSettings.projectPath = getProjectPath();
    }
    
    if (!newSettings.containerName) {
      const detectedContainer = getContainerName();
      if (detectedContainer) {
        newSettings.containerName = detectedContainer;
      }
    }

    // Save the settings
    const result = saveMCPSettings(newSettings);
    
    if (!result.success) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: `Failed to save settings: ${result.error}`,
            }, null, 2),
          },
        ],
        isError: true,
      };
    }

    const settingsPath = getMCPSettingsPath();
    
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            message: `MCP settings saved to ${settingsPath}`,
            settings: newSettings,
            hint: newSettings.containerName 
              ? 'Settings are ready. Try running publish_and_test now.'
              : 'Please add "containerName" to the settings file with your BC container name.',
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Handler for get_mcp_settings tool
 */
export async function getMCPSettingsHandler() {
  try {
    const settingsPath = getMCPSettingsPath();
    const currentSettings = getMCPSettings();
    
    // Get auto-detected values
    const projectPath = getProjectPath();
    const containerName = getContainerName();
    const launchConfig = getSelectedLaunchConfigWithPriority();
    const appJson = getAppJson();
    const appFile = findAppFile();
    const outputFolder = getOutputFolder();
    
    // Build response
    const response = {
      settingsFile: {
        path: settingsPath,
        exists: existsSync(settingsPath),
        content: currentSettings,
      },
      autoDetected: {
        projectPath,
        containerName,
        launchConfigName: launchConfig?.name || null,
        appFilePath: appFile,
        outputFolder,
        extensionId: appJson?.id || null,
        extensionName: appJson?.name || null,
      },
      effective: {
        projectPath: currentSettings?.projectPath || projectPath,
        containerName: currentSettings?.containerName || containerName,
        launchConfigName: currentSettings?.launchConfigName || launchConfig?.name || null,
        appFilePath: currentSettings?.appFilePath || appFile,
        outputFolder: currentSettings?.outputFolder || outputFolder,
        extensionId: currentSettings?.extensionId || appJson?.id || null,
        extensionName: currentSettings?.extensionName || appJson?.name || null,
      },
      projectInfo: appJson ? {
        name: appJson.name,
        publisher: appJson.publisher,
        version: appJson.version,
        id: appJson.id,
      } : null,
      status: {
        hasSettings: !!currentSettings,
        hasContainer: !!(currentSettings?.containerName || containerName),
        hasLaunchConfig: !!launchConfig,
        hasAppFile: !!appFile,
        ready: !!(currentSettings?.containerName || containerName) && !!appFile,
      },
    };

    // Add actionable recommendations if not ready
    const recommendations: Array<{ issue: string; action: string; priority: number }> = [];
    
    if (!response.status.hasContainer) {
      recommendations.push({
        issue: 'No container name configured',
        action: `Run: create_mcp_settings with containerName="your-container-name"`,
        priority: 1,
      });
    }
    
    if (!response.status.hasAppFile) {
      recommendations.push({
        issue: 'No .app file found',
        action: 'Press Ctrl+Shift+B in VS Code/Cursor to compile your extension',
        priority: 2,
      });
    }
    
    if (!response.status.hasSettings && !response.status.hasLaunchConfig) {
      recommendations.push({
        issue: 'No configuration found (neither mcp-settings.json nor launch.json)',
        action: `Create ${settingsPath} with: { "containerName": "your-container-name" }`,
        priority: 1,
      });
    }

    // Sort by priority
    recommendations.sort((a, b) => a.priority - b.priority);

    // Build a summary message
    let summaryMessage = '';
    if (response.status.ready) {
      summaryMessage = '✅ Configuration is complete. Ready to publish and test.';
    } else if (recommendations.length > 0) {
      summaryMessage = `⚠️ Configuration incomplete. ${recommendations.length} issue(s) to resolve.`;
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            summary: summaryMessage,
            ...response,
            recommendations: recommendations.length > 0 ? recommendations : undefined,
            quickFix: !response.status.hasContainer && !response.status.hasSettings
              ? {
                  description: 'Create settings file with your container name',
                  tool: 'create_mcp_settings',
                  args: { containerName: 'YOUR_CONTAINER_NAME_HERE' },
                }
              : undefined,
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Handler for debug_project_context tool
 */
export async function debugProjectContextHandler(args?: { testFilePath?: string }) {
  try {
    // Capture state BEFORE any test path operations
    const currentContextBefore = getCurrentProjectContext();
    const projectPathBefore = getProjectPath();
    const mcpSettingsPathBefore = getMCPSettingsPath();
    const mcpSettingsBefore = getMCPSettings();
    const appJsonBefore = getAppJson();
    
    // If a test file path is provided, simulate what would happen
    let testPathAnalysis = null;
    if (args?.testFilePath) {
      // Set context from the test file
      const detectedProject = setProjectContextFromFile(args.testFilePath);
      
      // Capture state AFTER setting context
      const currentContextAfter = getCurrentProjectContext();
      const projectPathAfter = getProjectPath();
      const mcpSettingsPathAfter = getMCPSettingsPath();
      const mcpSettingsAfter = getMCPSettings();
      const appJsonAfter = getAppJson();
      const altestrunnerPath = getALTestRunnerPath();
      
      testPathAnalysis = {
        inputPath: args.testFilePath,
        detectedProjectRoot: detectedProject,
        contextChanged: currentContextBefore !== currentContextAfter,
        stateAfterDetection: {
          currentProjectContext: currentContextAfter,
          projectPath: projectPathAfter,
          mcpSettingsPath: mcpSettingsPathAfter,
          mcpSettingsExists: existsSync(mcpSettingsPathAfter),
          mcpSettingsContent: mcpSettingsAfter,
          altestrunnerPath,
          altestrunnerExists: existsSync(altestrunnerPath),
          appJson: appJsonAfter ? {
            name: appJsonAfter.name,
            id: appJsonAfter.id,
            publisher: appJsonAfter.publisher,
          } : null,
        },
        effectiveExtensionInfo: {
          extensionId: mcpSettingsAfter?.extensionId || appJsonAfter?.id || null,
          extensionName: mcpSettingsAfter?.extensionName || appJsonAfter?.name || null,
          source: mcpSettingsAfter?.extensionName ? 'mcp-settings.json' : (appJsonAfter?.name ? 'app.json' : 'not found'),
        },
      };
    }
    
    // Build diagnostic output
    const diagnostics = {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      cwd: process.cwd(),
      environmentVariables: {
        AL_PROJECT_PATH: process.env.AL_PROJECT_PATH || null,
        AL_CONTAINER_NAME: process.env.AL_CONTAINER_NAME || null,
        AL_TEST_RUNNER_PATH: process.env.AL_TEST_RUNNER_PATH || null,
      },
      stateBefore: {
        currentProjectContext: currentContextBefore,
        projectPath: projectPathBefore,
        mcpSettingsPath: mcpSettingsPathBefore,
        mcpSettingsExists: existsSync(mcpSettingsPathBefore),
        mcpSettingsContent: mcpSettingsBefore,
        appJson: appJsonBefore ? {
          name: appJsonBefore.name,
          id: appJsonBefore.id,
          publisher: appJsonBefore.publisher,
        } : null,
      },
      testPathAnalysis,
      recommendations: [] as string[],
    };

    // Add recommendations based on diagnostics
    if (testPathAnalysis && !testPathAnalysis.detectedProjectRoot) {
      diagnostics.recommendations.push(
        `Could not find app.json by walking up from ${args?.testFilePath}. Ensure the file path is correct and app.json exists in a parent directory.`
      );
    }
    
    if (testPathAnalysis?.stateAfterDetection.mcpSettingsExists === false) {
      diagnostics.recommendations.push(
        `No mcp-settings.json found at ${testPathAnalysis.stateAfterDetection.mcpSettingsPath}. Create this file with extensionName and extensionId for multi-root workspace support.`
      );
    }
    
    if (testPathAnalysis?.effectiveExtensionInfo.source === 'not found') {
      diagnostics.recommendations.push(
        `No extension info found. Ensure app.json exists or create mcp-settings.json with extensionId and extensionName.`
      );
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(diagnostics, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            error: 'Debug tool failed',
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
}

