/**
 * MCP Resources for AL Test Runner
 */

import { parseTestResults, parseCodeCoverage, getCodeCoverageSummary } from '../utils/xmlParser';
import { getALTestRunnerConfig, getLastResultsPath, getCodeCoveragePath, getConfigPath } from '../utils/config';
import { existsSync, statSync } from 'fs';

/**
 * Resource definition for test results
 */
export const testResultsResource = {
  uri: 'altestrunner://results/latest',
  name: 'Latest Test Results',
  description: 'The most recent AL test run results in JSON format',
  mimeType: 'application/json',
};

/**
 * Resource definition for code coverage
 */
export const coverageResource = {
  uri: 'altestrunner://coverage',
  name: 'Code Coverage',
  description: 'Code coverage data from the most recent test run',
  mimeType: 'application/json',
};

/**
 * Resource definition for config
 */
export const configResource = {
  uri: 'altestrunner://config',
  name: 'AL Test Runner Config',
  description: 'Current AL Test Runner configuration',
  mimeType: 'application/json',
};

/**
 * Read test results resource
 */
export async function readTestResultsResource() {
  const resultsPath = getLastResultsPath();
  
  if (!existsSync(resultsPath)) {
    return {
      contents: [
        {
          uri: 'altestrunner://results/latest',
          mimeType: 'application/json',
          text: JSON.stringify({
            error: 'No test results found',
            path: resultsPath,
          }, null, 2),
        },
      ],
    };
  }

  try {
    const results = await parseTestResults();
    const stat = statSync(resultsPath);
    
    return {
      contents: [
        {
          uri: 'altestrunner://results/latest',
          mimeType: 'application/json',
          text: JSON.stringify({
            lastModified: stat.mtime.toISOString(),
            path: resultsPath,
            assemblies: results,
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      contents: [
        {
          uri: 'altestrunner://results/latest',
          mimeType: 'application/json',
          text: JSON.stringify({
            error: 'Failed to parse test results',
            message: error instanceof Error ? error.message : String(error),
          }, null, 2),
        },
      ],
    };
  }
}

/**
 * Read code coverage resource
 */
export async function readCoverageResource() {
  const coveragePath = getCodeCoveragePath();
  
  if (!existsSync(coveragePath)) {
    return {
      contents: [
        {
          uri: 'altestrunner://coverage',
          mimeType: 'application/json',
          text: JSON.stringify({
            error: 'No code coverage data found',
            path: coveragePath,
          }, null, 2),
        },
      ],
    };
  }

  try {
    const summary = getCodeCoverageSummary();
    const stat = statSync(coveragePath);
    
    return {
      contents: [
        {
          uri: 'altestrunner://coverage',
          mimeType: 'application/json',
          text: JSON.stringify({
            lastModified: stat.mtime.toISOString(),
            path: coveragePath,
            summary,
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      contents: [
        {
          uri: 'altestrunner://coverage',
          mimeType: 'application/json',
          text: JSON.stringify({
            error: 'Failed to parse code coverage',
            message: error instanceof Error ? error.message : String(error),
          }, null, 2),
        },
      ],
    };
  }
}

/**
 * Read config resource
 */
export async function readConfigResource() {
  const configPath = getConfigPath();
  
  if (!existsSync(configPath)) {
    return {
      contents: [
        {
          uri: 'altestrunner://config',
          mimeType: 'application/json',
          text: JSON.stringify({
            error: 'No config file found',
            path: configPath,
            message: 'Run tests from VS Code first to create the configuration.',
          }, null, 2),
        },
      ],
    };
  }

  try {
    const config = getALTestRunnerConfig();
    
    // Redact sensitive fields
    const safeConfig = config ? {
      ...config,
      securePassword: config.securePassword ? '[REDACTED]' : '',
      vmSecurePassword: config.vmSecurePassword ? '[REDACTED]' : '',
    } : null;
    
    return {
      contents: [
        {
          uri: 'altestrunner://config',
          mimeType: 'application/json',
          text: JSON.stringify({
            path: configPath,
            config: safeConfig,
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      contents: [
        {
          uri: 'altestrunner://config',
          mimeType: 'application/json',
          text: JSON.stringify({
            error: 'Failed to read config',
            message: error instanceof Error ? error.message : String(error),
          }, null, 2),
        },
      ],
    };
  }
}

