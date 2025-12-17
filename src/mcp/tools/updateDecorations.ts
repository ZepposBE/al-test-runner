/**
 * Tool for triggering inline test error decorations in VS Code
 */

import { triggerDecorations, getDecorationTriggerPath } from '../utils/config';

/**
 * Tool definition for update_test_decorations
 */
export const updateDecorationsTool = {
  name: 'update_test_decorations',
  description: `Trigger inline error decorations in test files for failed test lines.

This will show red lines and error markers for any failed tests based on the most recent test results.
The decorations will appear in the VS Code editor for:
- Test method signatures (green for passing, red for failing, gray for untested)
- The specific line that caused the failure (if 'Highlight Failing Line' setting is enabled)

Note: This requires the 'Decorate Test Methods' setting to be enabled in VS Code.
If the setting is disabled, the trigger will be ignored.

Use this after running tests to visually highlight failures in the editor.`,
  inputSchema: {
    type: 'object' as const,
    properties: {},
    required: [],
  },
};

/**
 * Handler for update_test_decorations tool
 */
export async function updateDecorationsHandler() {
  const triggerPath = getDecorationTriggerPath();
  const result = triggerDecorations();
  
  if (result.success) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `✅ Decoration update triggered successfully.

Trigger file written to: ${triggerPath}

The VS Code extension will update inline test decorations based on the most recent test results.

Note: Decorations will only appear if:
- The 'Decorate Test Methods' setting is enabled
- There are test results available (.altestrunner/Results/*.xml)
- A test file is open in the editor
- The extension is watching the same .altestrunner folder`,
        },
      ],
    };
  } else {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            error: 'Failed to trigger decoration update',
            message: result.error || 'Unknown error occurred while writing trigger file',
            triggerPath,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
}

