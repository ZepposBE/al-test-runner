/**
 * Tool for getting code coverage from AL Test Runner
 */

import { getCodeCoverageSummary } from '../utils/xmlParser';
import { getCodeCoveragePath } from '../utils/config';
import { existsSync } from 'fs';

/**
 * Tool definition for get_code_coverage
 */
export const getCodeCoverageTool = {
  name: 'get_code_coverage',
  description: `Get code coverage data from the most recent test run. Returns:
- Overall coverage percentage
- Number of covered vs total lines
- Per-object breakdown (codeunits, tables, etc.)

Optionally filter by object type (Codeunit, Table, Page, etc.) or specific object ID.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      objectType: {
        type: 'string',
        description: 'Filter by object type (e.g., "Codeunit", "Table", "Page")',
      },
      objectId: {
        type: 'number',
        description: 'Filter by specific object ID',
      },
    },
    required: [],
  },
};

/**
 * Handler for get_code_coverage tool
 */
export async function getCodeCoverageHandler(args?: { objectType?: string; objectId?: number }) {
  const coveragePath = getCodeCoveragePath();
  
  if (!existsSync(coveragePath)) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            error: 'No code coverage data found',
            message: 'No code coverage file exists. Run tests with code coverage enabled first.',
            coveragePath,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }

  try {
    const summary = getCodeCoverageSummary(args?.objectType, args?.objectId);
    
    if (!summary) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              error: 'Failed to parse code coverage',
              message: 'The code coverage file exists but could not be parsed.',
            }, null, 2),
          },
        ],
        isError: true,
      };
    }

    // Format a nice summary
    let resultText = `📊 CODE COVERAGE: ${summary.coveragePercentage}%\n\n`;
    resultText += `Overall:\n`;
    resultText += `  Covered Lines: ${summary.coveredLines} / ${summary.totalLines}\n`;
    resultText += `  Coverage: ${summary.coveragePercentage}%\n`;

    if (summary.objects.length > 0) {
      resultText += `\nBy Object:\n`;
      
      // Group by type
      const byType = new Map<string, typeof summary.objects>();
      for (const obj of summary.objects) {
        if (!byType.has(obj.objectType)) {
          byType.set(obj.objectType, []);
        }
        byType.get(obj.objectType)!.push(obj);
      }

      for (const [type, objects] of byType) {
        resultText += `\n  ${type}s:\n`;
        for (const obj of objects) {
          const bar = getProgressBar(obj.coveragePercentage);
          resultText += `    ${obj.objectId}: ${bar} ${obj.coveragePercentage}% (${obj.coveredLines}/${obj.totalLines})\n`;
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
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            error: 'Error reading code coverage',
            message: error instanceof Error ? error.message : String(error),
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Create a simple progress bar
 */
function getProgressBar(percentage: number): string {
  const filled = Math.round(percentage / 10);
  const empty = 10 - filled;
  return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
}

