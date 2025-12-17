/**
 * Tools for running AL tests
 */

import { runTests, findTestCodeunits, findTestLineNumber, publishApp } from '../utils/powershell';
import { getTestResultsSummary } from '../utils/xmlParser';
import { getAppJson, triggerDecorations } from '../utils/config';
import { type ProgressReporter, consoleProgressReporter } from '../utils/progress';

/**
 * Tool definition for run_all_tests
 */
export const runAllTestsTool = {
  name: 'run_all_tests',
  description: `Run all AL tests in the current Business Central extension.

This will:
1. Connect to the BC container
2. Run all test codeunits in the extension
3. Save results to .altestrunner/last.xml

After running, use get_test_results to see the results.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      extensionId: {
        type: 'string',
        description: 'Extension ID (GUID). If not provided, reads from app.json.',
      },
      extensionName: {
        type: 'string',
        description: 'Extension name. If not provided, reads from app.json.',
      },
      getCodeCoverage: {
        type: 'boolean',
        description: 'Whether to collect code coverage data. Default: false.',
      },
      publishFirst: {
        type: 'boolean',
        description: 'Publish the extension before running tests. Requires the app to be compiled first. Default: false.',
      },
    },
    required: [],
  },
};

/**
 * Tool definition for run_test_codeunit
 */
export const runTestCodeunitTool = {
  name: 'run_test_codeunit',
  description: `Run all tests in a specific test codeunit.

Provide either:
- filename: Path to the .al file containing the test codeunit
- codeunitId: The numeric ID of the test codeunit

After running, use get_test_results to see the results.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      filename: {
        type: 'string',
        description: 'Path to the .al file containing the test codeunit',
      },
      codeunitId: {
        type: 'number',
        description: 'The numeric ID of the test codeunit',
      },
      getCodeCoverage: {
        type: 'boolean',
        description: 'Whether to collect code coverage data. Default: false.',
      },
      publishFirst: {
        type: 'boolean',
        description: 'Publish the extension before running tests. Requires the app to be compiled first. Default: false.',
      },
    },
    required: [],
  },
};

/**
 * Tool definition for run_single_test
 */
export const runSingleTestTool = {
  name: 'run_single_test',
  description: `Run a single test function.

Requires:
- filename: Path to the .al file containing the test
- testName: Name of the test procedure to run

After running, use get_test_results to see the results.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      filename: {
        type: 'string',
        description: 'Path to the .al file containing the test',
      },
      testName: {
        type: 'string',
        description: 'Name of the test procedure to run',
      },
      getCodeCoverage: {
        type: 'boolean',
        description: 'Whether to collect code coverage data. Default: false.',
      },
      publishFirst: {
        type: 'boolean',
        description: 'Publish the extension before running tests. Requires the app to be compiled first. Default: false.',
      },
    },
    required: ['filename', 'testName'],
  },
};

/**
 * Tool definition for list_test_codeunits
 */
export const listTestCodeunitsTool = {
  name: 'list_test_codeunits',
  description: `List all test codeunits discovered in the current AL project.

Returns:
- Codeunit ID and name
- File path
- List of test methods in each codeunit

Use this to discover available tests before running them.`,
  inputSchema: {
    type: 'object' as const,
    properties: {},
    required: [],
  },
};

/**
 * Handler for run_all_tests
 */
export async function runAllTestsHandler(
  args?: { 
    extensionId?: string; 
    extensionName?: string; 
    getCodeCoverage?: boolean;
    publishFirst?: boolean;
  },
  progress: ProgressReporter = consoleProgressReporter
) {
  try {
    const hasPublish = args?.publishFirst;
    const totalSteps = hasPublish ? 4 : 3;
    let currentStep = 1;

    // Publish first if requested
    if (hasPublish) {
      progress.report(currentStep++, totalSteps, 'Publishing extension to container...');
      const publishResult = await publishApp();
      if (!publishResult.success) {
        progress.report(totalSteps, totalSteps, 'Failed: Publishing error');
        return {
          content: [
            {
              type: 'text' as const,
              text: `❌ Publishing failed before running tests\n\nError: ${publishResult.message}\n\n${publishResult.error || ''}\n\nHint: Make sure the extension is compiled (Ctrl+Shift+B) and the BC container is running.`,
            },
          ],
          isError: true,
        };
      }
    }

    progress.report(currentStep++, totalSteps, 'Running all tests (this may take a moment)...');
    const result = await runTests({
      scope: 'All',
      getCodeCoverage: args?.getCodeCoverage,
    });

    if (!result.success) {
      progress.report(totalSteps, totalSteps, 'Failed: Test execution error');
      return {
        content: [
          {
            type: 'text' as const,
            text: `❌ Test execution failed\n\nError: ${result.message}\n\n${result.error || ''}`,
          },
        ],
        isError: true,
      };
    }

    // Get the results summary
    progress.report(currentStep++, totalSteps, 'Parsing test results...');
    const summary = await getTestResultsSummary();
    
    // Trigger decoration update in VS Code extension
    triggerDecorations();
    
    if (summary) {
      const status = summary.failed === 0 ? '✅ ALL TESTS PASSED' : `❌ ${summary.failed} TEST(S) FAILED`;
      const resultMessage = summary.failed === 0 
        ? `All ${summary.totalTests} tests passed!` 
        : `${summary.failed} of ${summary.totalTests} tests failed`;
      progress.report(totalSteps, totalSteps, resultMessage);
      
      let resultText = `${status}\n\n`;
      resultText += `Summary: ${summary.passed}/${summary.totalTests} passed in ${summary.totalTime.toFixed(2)}s\n`;
      
      if (summary.failedTests.length > 0) {
        resultText += `\nFailed Tests:\n`;
        for (const test of summary.failedTests) {
          resultText += `  ❌ ${test.codeunit} > ${test.test}\n`;
          resultText += `     ${test.message}\n`;
        }
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: resultText,
          },
        ],
      };
    }

    progress.report(totalSteps, totalSteps, 'Tests completed');
    return {
      content: [
        {
          type: 'text' as const,
          text: `✅ Tests completed\n\n${result.output || 'Use get_test_results to see detailed results.'}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `❌ Error running tests: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Handler for run_test_codeunit
 */
export async function runTestCodeunitHandler(
  args?: { 
    filename?: string; 
    codeunitId?: number;
    getCodeCoverage?: boolean;
    publishFirst?: boolean;
  },
  progress: ProgressReporter = consoleProgressReporter
) {
  if (!args?.filename && !args?.codeunitId) {
    return {
      content: [
        {
          type: 'text' as const,
          text: '❌ Please provide either filename or codeunitId',
        },
      ],
      isError: true,
    };
  }

  try {
    const hasPublish = args?.publishFirst;
    const totalSteps = hasPublish ? 4 : 3;
    let currentStep = 1;

    // Publish first if requested
    if (hasPublish) {
      progress.report(currentStep++, totalSteps, 'Publishing extension to container...');
      const publishResult = await publishApp();
      if (!publishResult.success) {
        progress.report(totalSteps, totalSteps, 'Failed: Publishing error');
        return {
          content: [
            {
              type: 'text' as const,
              text: `❌ Publishing failed before running tests\n\nError: ${publishResult.message}\n\n${publishResult.error || ''}\n\nHint: Make sure the extension is compiled (Ctrl+Shift+B) and the BC container is running.`,
            },
          ],
          isError: true,
        };
      }
    }

    let filename = args.filename;
    
    // If codeunitId provided, find the file
    if (!filename && args.codeunitId) {
      progress.report(currentStep, totalSteps, `Finding codeunit ${args.codeunitId}...`);
      const codeunits = await findTestCodeunits();
      const codeunit = codeunits.find(c => c.id === args.codeunitId);
      if (!codeunit) {
        progress.report(totalSteps, totalSteps, 'Failed: Codeunit not found');
        return {
          content: [
            {
              type: 'text' as const,
              text: `❌ Test codeunit with ID ${args.codeunitId} not found`,
            },
          ],
          isError: true,
        };
      }
      filename = codeunit.path;
    }

    const codeunitName = filename?.split(/[/\\]/).pop()?.replace('.al', '') || 'codeunit';
    progress.report(currentStep++, totalSteps, `Running tests in ${codeunitName}...`);
    
    const result = await runTests({
      scope: 'Codeunit',
      filename,
      selectionStart: 0,
      getCodeCoverage: args?.getCodeCoverage,
    });

    if (!result.success) {
      progress.report(totalSteps, totalSteps, 'Failed: Test execution error');
      return {
        content: [
          {
            type: 'text' as const,
            text: `❌ Test execution failed\n\nError: ${result.message}\n\n${result.error || ''}`,
          },
        ],
        isError: true,
      };
    }

    // Get the results summary
    progress.report(currentStep++, totalSteps, 'Parsing test results...');
    const summary = await getTestResultsSummary();
    
    // Trigger decoration update in VS Code extension
    triggerDecorations();
    
    if (summary) {
      const status = summary.failed === 0 ? '✅ ALL TESTS PASSED' : `❌ ${summary.failed} TEST(S) FAILED`;
      const resultMessage = summary.failed === 0 
        ? `All ${summary.totalTests} tests passed!` 
        : `${summary.failed} of ${summary.totalTests} tests failed`;
      progress.report(totalSteps, totalSteps, resultMessage);
      
      let resultText = `${status}\n\n`;
      resultText += `Summary: ${summary.passed}/${summary.totalTests} passed in ${summary.totalTime.toFixed(2)}s\n`;
      
      if (summary.failedTests.length > 0) {
        resultText += `\nFailed Tests:\n`;
        for (const test of summary.failedTests) {
          resultText += `  ❌ ${test.test}: ${test.message}\n`;
        }
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: resultText,
          },
        ],
      };
    }

    progress.report(totalSteps, totalSteps, 'Tests completed');
    return {
      content: [
        {
          type: 'text' as const,
          text: `✅ Tests completed\n\n${result.output || 'Use get_test_results to see detailed results.'}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `❌ Error running tests: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Handler for run_single_test
 */
export async function runSingleTestHandler(
  args: { 
    filename: string; 
    testName: string;
    getCodeCoverage?: boolean;
    publishFirst?: boolean;
  },
  progress: ProgressReporter = consoleProgressReporter
) {
  if (!args.filename || !args.testName) {
    return {
      content: [
        {
          type: 'text' as const,
          text: '❌ Both filename and testName are required',
        },
      ],
      isError: true,
    };
  }

  try {
    const hasPublish = args?.publishFirst;
    const totalSteps = hasPublish ? 4 : 3;
    let currentStep = 1;

    // Publish first if requested
    if (hasPublish) {
      progress.report(currentStep++, totalSteps, 'Publishing extension to container...');
      const publishResult = await publishApp();
      if (!publishResult.success) {
        progress.report(totalSteps, totalSteps, 'Failed: Publishing error');
        return {
          content: [
            {
              type: 'text' as const,
              text: `❌ Publishing failed before running tests\n\nError: ${publishResult.message}\n\n${publishResult.error || ''}\n\nHint: Make sure the extension is compiled (Ctrl+Shift+B) and the BC container is running.`,
            },
          ],
          isError: true,
        };
      }
    }

    // Find the line number of the test
    const lineNumber = findTestLineNumber(args.filename, args.testName);

    progress.report(currentStep++, totalSteps, `Running test: ${args.testName}...`);
    const result = await runTests({
      scope: 'Test',
      filename: args.filename,
      selectionStart: lineNumber,
      getCodeCoverage: args?.getCodeCoverage,
    });

    if (!result.success) {
      progress.report(totalSteps, totalSteps, 'Failed: Test execution error');
      return {
        content: [
          {
            type: 'text' as const,
            text: `❌ Test execution failed\n\nError: ${result.message}\n\n${result.error || ''}`,
          },
        ],
        isError: true,
      };
    }

    // Get the results summary
    progress.report(currentStep++, totalSteps, 'Parsing test results...');
    const summary = await getTestResultsSummary();
    
    // Trigger decoration update in VS Code extension
    triggerDecorations();
    
    if (summary) {
      const testResult = summary.failedTests.find(t => t.test === args.testName);
      
      if (testResult) {
        progress.report(totalSteps, totalSteps, `Test failed: ${args.testName}`);
        return {
          content: [
            {
              type: 'text' as const,
              text: `❌ TEST FAILED: ${args.testName}\n\nError: ${testResult.message}\n\nStack Trace:\n${testResult.stackTrace}`,
            },
          ],
        };
      } else if (summary.passed > 0) {
        progress.report(totalSteps, totalSteps, `Test passed: ${args.testName}`);
        return {
          content: [
            {
              type: 'text' as const,
              text: `✅ TEST PASSED: ${args.testName} (${summary.totalTime.toFixed(2)}s)`,
            },
          ],
        };
      }
    }

    progress.report(totalSteps, totalSteps, 'Test completed');
    return {
      content: [
        {
          type: 'text' as const,
          text: `✅ Test completed\n\n${result.output || 'Use get_test_results to see detailed results.'}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `❌ Error running test: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Handler for list_test_codeunits
 */
export async function listTestCodeunitsHandler() {
  try {
    const codeunits = await findTestCodeunits();

    if (codeunits.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'No test codeunits found in the project.\n\nMake sure:\n- You have .al files with Subtype = Test\n- The AL_PROJECT_PATH environment variable is set correctly',
          },
        ],
      };
    }

    let resultText = `📋 Found ${codeunits.length} test codeunit(s):\n\n`;

    for (const codeunit of codeunits) {
      resultText += `📦 ${codeunit.id} "${codeunit.name}"\n`;
      resultText += `   Path: ${codeunit.path}\n`;
      resultText += `   Tests (${codeunit.tests.length}):\n`;
      for (const test of codeunit.tests) {
        resultText += `     • ${test}\n`;
      }
      resultText += '\n';
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: resultText,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `❌ Error listing test codeunits: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

