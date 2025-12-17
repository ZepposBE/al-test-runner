/**
 * Progress reporting utilities for AL Test Runner MCP Server
 * 
 * Provides progress notifications during long-running operations
 * so users can see real-time status updates in Cursor.
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

/**
 * Progress reporter interface for sending status updates
 */
export interface ProgressReporter {
  /**
   * Report progress on a long-running operation
   * @param progress Current progress value (must increase monotonically)
   * @param total Total expected value for the operation
   * @param message Human-readable message describing current status
   */
  report: (progress: number, total: number, message: string) => void;
}

/**
 * Creates a progress reporter that sends MCP progress notifications
 * and logs to stderr for debugging
 * 
 * @param server The MCP server instance (optional)
 * @param progressToken Token to associate progress with the request (optional)
 * @returns ProgressReporter instance
 */
export function createProgressReporter(
  server?: Server,
  progressToken?: string | number
): ProgressReporter {
  return {
    report: (progress: number, total: number, message: string) => {
      // Always log to stderr for debugging/visibility
      console.error(`[Progress ${progress}/${total}] ${message}`);
      
      // If we have a server and progress token, send MCP notification
      if (server && progressToken !== undefined) {
        try {
          server.notification({
            method: 'notifications/progress',
            params: {
              progressToken,
              progress,
              total,
              message,
            },
          });
        } catch (error) {
          // Progress notifications are fire-and-forget, don't fail on errors
          console.error('Failed to send progress notification:', error);
        }
      }
    },
  };
}

/**
 * No-op progress reporter for when progress reporting is not needed
 */
export const noopProgressReporter: ProgressReporter = {
  report: () => {
    // Intentionally empty - used when progress is not needed
  },
};

/**
 * Console-only progress reporter that logs to stderr
 * Used as fallback when MCP progress notifications aren't available
 */
export const consoleProgressReporter: ProgressReporter = {
  report: (progress: number, total: number, message: string) => {
    console.error(`[Progress ${progress}/${total}] ${message}`);
  },
};

