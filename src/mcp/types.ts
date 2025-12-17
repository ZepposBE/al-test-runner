/**
 * Types for AL Test Runner MCP Server
 */

// Test result types matching the XML structure from AL Test Runner
export interface TestAssembly {
  name: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  time: number;
  runDate: string;
  runTime: string;
  errors?: number;
  collections: TestCollection[];
}

export interface TestCollection {
  name: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  time: number;
  tests: TestResult[];
}

export interface TestResult {
  name: string;
  method: string;
  result: 'Pass' | 'Fail' | 'Skip';
  time: number;
  failure?: TestFailure;
}

export interface TestFailure {
  message: string;
  stackTrace: string;
}

// Code coverage types
export interface CodeCoverageLine {
  objectType: string;
  objectId: string;
  lineType: string;
  lineNo: string;
  noOfHits: string;
}

export interface CodeCoverageSummary {
  totalLines: number;
  coveredLines: number;
  coveragePercentage: number;
  objects: ObjectCoverage[];
}

export interface ObjectCoverage {
  objectType: string;
  objectId: number;
  objectName?: string;
  totalLines: number;
  coveredLines: number;
  coveragePercentage: number;
}

// AL Test Runner config types
export interface ALTestRunnerConfig {
  launchConfigName: string;
  containerResultPath: string;
  userName: string;
  securePassword: string;
  companyName: string;
  testSuiteName: string;
  vmUserName: string;
  vmSecurePassword: string;
  remoteContainerName: string;
  dockerHost: string;
  newPSSessionOptions: string;
  testRunnerServiceUrl: string;
  codeCoveragePath: string;
  culture: string;
}

// Test codeunit info
export interface TestCodeunit {
  id: number;
  name: string;
  path: string;
  testCount: number;
  tests: string[];
}

// Run test parameters
export interface RunTestsParams {
  scope: 'All' | 'Codeunit' | 'Test';
  filename?: string;
  selectionStart?: number;
  codeunitId?: number;
  testName?: string;
  getCodeCoverage?: boolean;
}

// PowerShell execution result
export interface PowerShellResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
}

// Publish result
export interface PublishResult {
  success: boolean;
  message: string;
  appFile?: string;
  error?: string;
}

// MCP Settings - stored in .altestrunner/mcp-settings.json
export interface MCPSettings {
  /** Explicit path to AL project root (where app.json is located) */
  projectPath?: string;
  /** Name of the launch configuration to use from launch.json */
  launchConfigName?: string;
  /** Explicit path to the .app file (overrides auto-detection) */
  appFilePath?: string;
  /** Direct container name (bypasses launch.json parsing) */
  containerName?: string;
  /** Folder to look for .app files (default: .output) */
  outputFolder?: string;
}

