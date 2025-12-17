/**
 * Publish tools for AL Test Runner MCP Server
 * 
 * Provides tools to publish AL extensions to BC containers,
 * leveraging existing PowerShell scripts from the AL Test Runner extension.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { publishApp, findAppFile, runTests } from '../utils/powershell';
import { getTestResultsSummary } from '../utils/xmlParser';
import { getLastResultsPath, getMCPSettings, getMCPSettingsPath, getContainerName, triggerDecorations } from '../utils/config';
import { existsSync } from 'fs';
import { type ProgressReporter, consoleProgressReporter } from '../utils/progress';

/**
 * Tool definition for publish_extension
 */
export const publishExtensionTool: Tool = {
  name: 'publish_extension',
  description: `Publish the AL extension (.app file) to the Business Central container.

Uses the existing AL Test Runner PowerShell scripts (Publish-App.ps1) to deploy
the compiled .app file to the configured BC container.

IMPORTANT: You must compile the extension first (Ctrl+Shift+B in VS Code) before publishing.
The MCP server cannot compile - it can only publish already-compiled .app files.

The tool will:
1. Find the .app file in .output/ or output/ folder (or use provided path)
2. Use credentials and container info from AL Test Runner config
3. Publish using Publish-BcContainerApp with -useDevEndpoint -skipVerification`,
  inputSchema: {
    type: 'object',
    properties: {
      appFile: {
        type: 'string',
        description: 'Path to .app file. If not provided, auto-detects from .output folder based on app.json',
      },
    },
  },
};

/**
 * Tool definition for publish_and_test
 */
export const publishAndTestTool: Tool = {
  name: 'publish_and_test',
  description: `Complete TDD workflow: Publish extension to BC container, then run all tests.

This is the recommended tool for verifying code changes. It:
1. Finds and publishes the compiled .app file to the BC container
2. Runs all tests in the extension
3. Returns the test results

IMPORTANT: You must compile the extension first (Ctrl+Shift+B in VS Code) before using this tool.

Use this when:
- User says they fixed a bug and want to verify
- You need to check if code changes work correctly
- Running a complete test cycle after modifications`,
  inputSchema: {
    type: 'object',
    properties: {
      getCodeCoverage: {
        type: 'boolean',
        description: 'Whether to collect code coverage data. Default: false.',
      },
    },
  },
};

/**
 * Build actionable error hints based on the error context
 */
function buildPublishErrorHints(result: { message: string; appFile?: string; error?: string }): {
  hint: string;
  action?: string;
  settingsFile?: string;
} {
  const mcpSettings = getMCPSettings();
  const containerName = getContainerName();
  const settingsPath = getMCPSettingsPath();

  // No app file found
  if (!result.appFile) {
    return {
      hint: 'No .app file found. Compile your extension first.',
      action: 'Press Ctrl+Shift+B in your IDE to compile, then try again.',
    };
  }

  // No launch config / container name
  if (result.message.includes('launch configuration') || result.message.includes('container')) {
    if (!mcpSettings) {
      return {
        hint: 'Container configuration not found. Create an MCP settings file.',
        action: 'Use the create_mcp_settings tool with your container name, or manually create the settings file.',
        settingsFile: `Create ${settingsPath} with: { "containerName": "your-container-name" }`,
      };
    } else if (!containerName) {
      return {
        hint: 'Container name not configured in MCP settings.',
        action: `Add "containerName" to ${settingsPath}`,
        settingsFile: settingsPath,
      };
    }
  }

  // Container not running or connection issues
  if (result.error?.includes('not running') || result.error?.includes('cannot be found')) {
    return {
      hint: `Container "${containerName || 'unknown'}" is not running or not accessible.`,
      action: 'Start your BC container and try again.',
    };
  }

  // Default hint
  return {
    hint: result.appFile 
      ? 'Make sure the BC container is running and accessible.'
      : 'Compile your extension first with Ctrl+Shift+B in VS Code.',
  };
}

/**
 * Handler for publish_extension tool
 */
export async function publishExtensionHandler(
  args?: { appFile?: string },
  progress: ProgressReporter = consoleProgressReporter
) {
  progress.report(1, 3, 'Finding .app file...');
  
  const appFile = args?.appFile || findAppFile();
  if (!appFile) {
    progress.report(3, 3, 'No .app file found');
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: 'No .app file found',
            hint: 'Compile your extension first with Ctrl+Shift+B in VS Code.',
          }, null, 2),
        },
      ],
      isError: true,
    };
  }

  progress.report(2, 3, `Publishing ${appFile.split(/[/\\]/).pop()} to container...`);
  const result = await publishApp(appFile);

  if (result.success) {
    const containerName = getContainerName();
    progress.report(3, 3, 'Extension published successfully');
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            message: result.message,
            appFile: result.appFile,
            container: containerName,
          }, null, 2),
        },
      ],
    };
  } else {
    progress.report(3, 3, 'Publishing failed');
    const hints = buildPublishErrorHints(result);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: result.message,
            details: result.error,
            appFile: result.appFile,
            ...hints,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Handler for publish_and_test tool
 */
export async function publishAndTestHandler(
  args?: { getCodeCoverage?: boolean },
  progress: ProgressReporter = consoleProgressReporter
) {
  const steps: string[] = [];
  const settingsPath = getMCPSettingsPath();
  const totalSteps = 5;
  
  // Step 1: Find the app file
  progress.report(1, totalSteps, 'Finding .app file...');
  const appFile = findAppFile();
  if (!appFile) {
    progress.report(totalSteps, totalSteps, 'Failed: No .app file found');
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: 'No .app file found',
            steps: ['❌ Find .app file - NOT FOUND'],
            hint: 'The extension needs to be compiled before it can be published.',
            action: 'Press Ctrl+Shift+B in VS Code/Cursor to compile your extension, then try again.',
            troubleshooting: [
              '1. Make sure app.json exists in your project root',
              '2. Compile with Ctrl+Shift+B',
              '3. Check .output folder for the .app file',
            ],
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
  const appFileName = appFile.split(/[/\\]/).pop() || appFile;
  steps.push(`✅ Found app file: ${appFileName}`);

  // Step 2: Publish the extension
  const containerName = getContainerName();
  progress.report(2, totalSteps, `Publishing ${appFileName} to ${containerName || 'container'}...`);
  const publishResult = await publishApp(appFile);
  if (!publishResult.success) {
    steps.push(`❌ Publish failed: ${publishResult.message}`);
    progress.report(totalSteps, totalSteps, 'Failed: Publishing error');
    const hints = buildPublishErrorHints(publishResult);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: 'Publishing failed',
            details: publishResult.error || publishResult.message,
            steps,
            ...hints,
            troubleshooting: [
              '1. Check if BC container is running',
              '2. Verify container name in settings',
              `3. Create/update ${settingsPath} if needed`,
              '4. Use get_mcp_settings to diagnose configuration',
            ],
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
  steps.push(`✅ Extension published to ${containerName || 'container'}`);

  // Step 3: Run all tests
  progress.report(3, totalSteps, 'Running tests (this may take a moment)...');
  const testResult = await runTests({
    scope: 'All',
    getCodeCoverage: args?.getCodeCoverage,
  });

  if (!testResult.success) {
    steps.push(`❌ Test execution failed: ${testResult.message}`);
    progress.report(totalSteps, totalSteps, 'Failed: Test execution error');
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: 'Test execution failed',
            details: testResult.error || testResult.message,
            steps,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
  steps.push('✅ Tests executed');

  // Step 4: Parse and return results
  progress.report(4, totalSteps, 'Parsing test results...');
  const resultsPath = getLastResultsPath();
  if (!existsSync(resultsPath)) {
    steps.push('⚠️ No results file found');
    progress.report(totalSteps, totalSteps, 'Complete (no results file)');
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            message: 'Tests completed but no results file was created',
            steps,
            output: testResult.output,
          }, null, 2),
        },
      ],
    };
  }

  const testResultsSummary = await getTestResultsSummary();
  
  // Trigger decoration update in VS Code extension
  triggerDecorations();
  
  if (!testResultsSummary) {
    steps.push('⚠️ Could not parse results');
    progress.report(totalSteps, totalSteps, 'Complete (results unparseable)');
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            message: 'Tests completed but results could not be parsed',
            steps,
            output: testResult.output,
          }, null, 2),
        },
      ],
    };
  }

  // Build summary
  const summary = {
    total: testResultsSummary.totalTests,
    passed: testResultsSummary.passed,
    failed: testResultsSummary.failed,
    skipped: testResultsSummary.skipped,
    time: testResultsSummary.totalTime,
    allPassed: testResultsSummary.failed === 0,
  };

  // Get failed test details
  const failedTests = testResultsSummary.failedTests.map(t => ({
    name: `${t.codeunit}.${t.test}`,
    error: t.message,
  }));

  // Step 5: Complete
  const resultMessage = summary.allPassed 
    ? `All ${summary.total} tests passed!` 
    : `${summary.failed} of ${summary.total} tests failed`;
  progress.report(totalSteps, totalSteps, resultMessage);

  steps.push(summary.allPassed 
    ? `✅ ${resultMessage}` 
    : `⚠️ ${resultMessage}`);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({
          success: true,
          steps,
          summary,
          failedTests: failedTests.length > 0 ? failedTests : undefined,
          appFile,
        }, null, 2),
      },
    ],
  };
}

