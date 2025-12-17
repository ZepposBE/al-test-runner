/**
 * Tool for getting test results from AL Test Runner
 */

import { parseTestResults, getTestResultsSummary } from '../utils/xmlParser';
import { getLastResultsPath } from '../utils/config';
import { existsSync } from 'fs';

/**
 * Tool definition for get_test_results
 */
export const getTestResultsTool = {
  name: 'get_test_results',
  description: `Get the results from the most recent AL test run. Returns a summary including:
- Total tests, passed, failed, skipped counts
- Total execution time
- Run date and time
- Details of any failed tests including error messages and stack traces

Use this after running tests to see results, or to check the current test status.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      detailed: {
        type: 'boolean',
        description: 'If true, returns full test results including all individual tests. If false (default), returns summary with failed tests only.',
      },
    },
    required: [],
  },
};

/**
 * Handler for get_test_results tool
 */
export async function getTestResultsHandler(args?: { detailed?: boolean }) {
  const resultsPath = getLastResultsPath();
  
  if (!existsSync(resultsPath)) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            error: 'No test results found',
            message: 'No test results file exists. Run tests first using run_all_tests, run_test_codeunit, or run_single_test.',
            resultsPath,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }

  try {
    if (args?.detailed) {
      // Return full results
      const results = await parseTestResults();
      
      if (!results) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                error: 'Failed to parse test results',
                message: 'The test results file exists but could not be parsed.',
              }, null, 2),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              assemblies: results,
            }, null, 2),
          },
        ],
      };
    } else {
      // Return summary
      const summary = await getTestResultsSummary();
      
      if (!summary) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                error: 'Failed to parse test results',
                message: 'The test results file exists but could not be parsed.',
              }, null, 2),
            },
          ],
          isError: true,
        };
      }

      // Format a nice summary
      const status = summary.failed === 0 ? '✅ ALL TESTS PASSED' : `❌ ${summary.failed} TEST(S) FAILED`;
      
      let resultText = `${status}\n\n`;
      resultText += `Summary:\n`;
      resultText += `  Total: ${summary.totalTests}\n`;
      resultText += `  Passed: ${summary.passed}\n`;
      resultText += `  Failed: ${summary.failed}\n`;
      resultText += `  Skipped: ${summary.skipped}\n`;
      resultText += `  Time: ${summary.totalTime.toFixed(2)}s\n`;
      resultText += `  Run: ${summary.runDate} ${summary.runTime}\n`;

      if (summary.failedTests.length > 0) {
        resultText += `\nFailed Tests:\n`;
        for (const test of summary.failedTests) {
          resultText += `\n  ❌ ${test.codeunit} > ${test.test}\n`;
          resultText += `     Error: ${test.message}\n`;
          if (test.stackTrace) {
            resultText += `     Stack: ${test.stackTrace}\n`;
          }
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
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            error: 'Error reading test results',
            message: error instanceof Error ? error.message : String(error),
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
}

