/**
 * Test Helpers for MCP Tests
 * 
 * Provides utilities for setting up test environments and fixtures.
 */

import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import * as os from 'os';

/** Base temp directory for MCP tests */
const MCP_TEST_BASE = join(os.tmpdir(), 'mcp-test-runner');

/** Counter for unique test directories */
let testDirCounter = 0;

/**
 * Create a unique temporary directory for a test
 */
export function createTestDir(): string {
    const testDir = join(MCP_TEST_BASE, `test-${Date.now()}-${testDirCounter++}`);
    mkdirSync(testDir, { recursive: true });
    return testDir;
}

/**
 * Clean up a test directory
 */
export function cleanupTestDir(testDir: string): void {
    if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
    }
}

/**
 * Create a mock AL project structure in a test directory
 */
export function createMockALProject(testDir: string, options: {
    appJson?: object;
    launchJson?: object;
    altestrunnerConfig?: object;
    mcpSettings?: object;
    lastXml?: string;
    codeCoverage?: object[];
} = {}): void {
    // Create .vscode directory
    const vscodeDir = join(testDir, '.vscode');
    mkdirSync(vscodeDir, { recursive: true });

    // Create .altestrunner directory
    const altestrunnerDir = join(testDir, '.altestrunner');
    mkdirSync(altestrunnerDir, { recursive: true });

    // Write app.json
    if (options.appJson) {
        writeFileSync(
            join(testDir, 'app.json'),
            JSON.stringify(options.appJson, null, 2),
            'utf-8'
        );
    }

    // Write launch.json
    if (options.launchJson) {
        writeFileSync(
            join(vscodeDir, 'launch.json'),
            JSON.stringify(options.launchJson, null, 2),
            'utf-8'
        );
    }

    // Write AL Test Runner config
    if (options.altestrunnerConfig) {
        writeFileSync(
            join(altestrunnerDir, 'config.json'),
            JSON.stringify(options.altestrunnerConfig, null, 2),
            'utf-8'
        );
    }

    // Write MCP settings
    if (options.mcpSettings) {
        writeFileSync(
            join(altestrunnerDir, 'mcp-settings.json'),
            JSON.stringify(options.mcpSettings, null, 2),
            'utf-8'
        );
    }

    // Write last.xml test results
    if (options.lastXml) {
        writeFileSync(
            join(altestrunnerDir, 'last.xml'),
            options.lastXml,
            'utf-8'
        );
    }

    // Write code coverage
    if (options.codeCoverage) {
        writeFileSync(
            join(altestrunnerDir, 'codecoverage.json'),
            JSON.stringify(options.codeCoverage, null, 2),
            'utf-8'
        );
    }
}

/**
 * Set up project context for a test
 * This simulates setting the current project path for tests
 */
export function setTestEnv(projectPath: string): void {
    // Import here to avoid circular dependencies
    const { setProjectContext } = require('../utils/config');
    // Directly set project context (doesn't require app.json to exist)
    setProjectContext(projectPath);
}

/**
 * Clear test environment variables
 */
export function clearTestEnv(): void {
    delete process.env.AL_CONTAINER_NAME;
    delete process.env.AL_TEST_RUNNER_PATH;
}

/**
 * Standard test fixtures
 */
export const fixtures = {
    appJson: {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Test App',
        publisher: 'Test Publisher',
        version: '1.0.0.0',
        platform: '24.0.0.0',
        application: '24.0.0.0',
        runtime: '14.0',
    },

    launchJson: {
        version: '0.2.0',
        configurations: [
            {
                name: 'Your own server',
                request: 'launch',
                type: 'al',
                server: 'http://bcserver/',
                serverInstance: 'BC',
                authentication: 'UserPassword',
                startupObjectId: 22,
                startupObjectType: 'Page',
            },
            {
                name: 'Cloud sandbox',
                request: 'launch',
                type: 'al',
                environmentType: 'Sandbox',
                environmentName: 'MySandbox',
                startupObjectId: 22,
                startupObjectType: 'Page',
            },
        ],
    },

    altestrunnerConfig: {
        launchConfigName: 'Your own server',
        containerResultPath: 'C:\\ProgramData\\BcContainerHelper\\Extensions\\bcserver',
        userName: 'admin',
        securePassword: '',
        companyName: 'CRONUS USA, Inc.',
        testSuiteName: 'DEFAULT',
    },

    /** Sample test results XML with 3 passing and 1 failing test */
    lastXml: `<?xml version="1.0" encoding="utf-8"?>
<assemblies>
  <assembly name="50100 Test Codeunit" run-date="2024-01-15" run-time="10:30:00" total="4" passed="3" failed="1" skipped="0" time="1.234">
    <collection name="Test Codeunit" total="4" passed="3" failed="1" skipped="0" time="1.234">
      <test name="Test Codeunit.TestOne" method="TestOne" result="Pass" time="0.100" />
      <test name="Test Codeunit.TestTwo" method="TestTwo" result="Pass" time="0.200" />
      <test name="Test Codeunit.TestThree" method="TestThree" result="Pass" time="0.300" />
      <test name="Test Codeunit.TestFour" method="TestFour" result="Fail" time="0.634">
        <failure>
          <message>Assert.AreEqual failed. Expected: &lt;100&gt; Actual: &lt;0&gt;</message>
          <stack-trace>"Test Codeunit"(CodeUnit 50100).TestFour line 45</stack-trace>
        </failure>
      </test>
    </collection>
  </assembly>
</assemblies>`,

    /** Sample test results XML with all passing tests */
    lastXmlAllPass: `<?xml version="1.0" encoding="utf-8"?>
<assemblies>
  <assembly name="50100 Test Codeunit" run-date="2024-01-15" run-time="10:30:00" total="3" passed="3" failed="0" skipped="0" time="0.600">
    <collection name="Test Codeunit" total="3" passed="3" failed="0" skipped="0" time="0.600">
      <test name="Test Codeunit.TestOne" method="TestOne" result="Pass" time="0.100" />
      <test name="Test Codeunit.TestTwo" method="TestTwo" result="Pass" time="0.200" />
      <test name="Test Codeunit.TestThree" method="TestThree" result="Pass" time="0.300" />
    </collection>
  </assembly>
</assemblies>`,

    /** Sample code coverage data
     * - Codeunit 50100: 4 Code lines (2 covered, 2 not covered)
     * - Codeunit 50101: 3 Code lines (3 covered - 100%)
     * - Table 50100: 3 Code lines (2 covered, 1 not covered)
     * Total: 10 code lines, 7 covered = 70%
     */
    codeCoverage: [
        { ObjectType: 'Codeunit', ObjectID: '50100', LineType: 'Code', LineNo: '10', NoOfHits: '5' },
        { ObjectType: 'Codeunit', ObjectID: '50100', LineType: 'Code', LineNo: '11', NoOfHits: '5' },
        { ObjectType: 'Codeunit', ObjectID: '50100', LineType: 'Code', LineNo: '12', NoOfHits: '0' },
        { ObjectType: 'Codeunit', ObjectID: '50100', LineType: 'Code', LineNo: '13', NoOfHits: '0' },
        { ObjectType: 'Codeunit', ObjectID: '50100', LineType: 'Empty', LineNo: '14', NoOfHits: '0' },
        { ObjectType: 'Codeunit', ObjectID: '50101', LineType: 'Code', LineNo: '5', NoOfHits: '10' },
        { ObjectType: 'Codeunit', ObjectID: '50101', LineType: 'Code', LineNo: '6', NoOfHits: '10' },
        { ObjectType: 'Codeunit', ObjectID: '50101', LineType: 'Code', LineNo: '7', NoOfHits: '10' },
        { ObjectType: 'Table', ObjectID: '50100', LineType: 'Code', LineNo: '5', NoOfHits: '10' },
        { ObjectType: 'Table', ObjectID: '50100', LineType: 'Code', LineNo: '6', NoOfHits: '10' },
        { ObjectType: 'Table', ObjectID: '50100', LineType: 'Code', LineNo: '7', NoOfHits: '0' },
    ],
};

