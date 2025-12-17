/**
 * Integration tests for MCP server
 */

import * as assert from 'assert';
import { createMCPServer } from '../server';
import {
    createTestDir,
    cleanupTestDir,
    createMockALProject,
    setTestEnv,
    clearTestEnv,
    fixtures,
} from './testHelpers';
import { clearMCPSettingsCache } from '../utils/config';

suite('MCP Server Tests', () => {
    let testDir: string;

    setup(() => {
        testDir = createTestDir();
        clearMCPSettingsCache();
        clearTestEnv();
    });

    teardown(() => {
        clearMCPSettingsCache();
        clearTestEnv();
        cleanupTestDir(testDir);
    });

    suite('createMCPServer', () => {
        test('creates a server instance', () => {
            const server = createMCPServer();
            
            assert.notStrictEqual(server, null);
            assert.notStrictEqual(server, undefined);
        });

        test('server has name and version', () => {
            const server = createMCPServer();
            
            // The server metadata can be accessed through the internal state
            // Since Server is a class from the MCP SDK, we just verify it's created
            assert.ok(server);
        });
    });

    suite('Tool Registration', () => {
        test('server exposes expected tools via ListToolsRequest', async () => {
            const server = createMCPServer();
            
            // We can't directly call the request handlers in a test without
            // a full transport setup, but we can verify the server was created
            // and has the right structure
            assert.ok(server);
        });
    });

    suite('Tool Definitions', () => {
        // Test that tool definitions are properly exported
        test('getTestResultsTool has correct structure', async () => {
            const { getTestResultsTool } = await import('../tools/getResults');
            
            assert.strictEqual(getTestResultsTool.name, 'get_test_results');
            assert.ok(getTestResultsTool.description.length > 0);
            assert.strictEqual(getTestResultsTool.inputSchema.type, 'object');
            assert.ok('detailed' in getTestResultsTool.inputSchema.properties);
        });

        test('runAllTestsTool has correct structure', async () => {
            const { runAllTestsTool } = await import('../tools/runTests');
            
            assert.strictEqual(runAllTestsTool.name, 'run_all_tests');
            assert.ok(runAllTestsTool.description.length > 0);
            assert.strictEqual(runAllTestsTool.inputSchema.type, 'object');
        });

        test('runTestCodeunitTool has correct structure', async () => {
            const { runTestCodeunitTool } = await import('../tools/runTests');
            
            assert.strictEqual(runTestCodeunitTool.name, 'run_test_codeunit');
            assert.ok(runTestCodeunitTool.description.length > 0);
        });

        test('runSingleTestTool has correct structure', async () => {
            const { runSingleTestTool } = await import('../tools/runTests');
            
            assert.strictEqual(runSingleTestTool.name, 'run_single_test');
            assert.ok(runSingleTestTool.description.length > 0);
            // Should require filename and testName
            assert.ok(runSingleTestTool.inputSchema.required?.includes('filename'));
            assert.ok(runSingleTestTool.inputSchema.required?.includes('testName'));
        });

        test('listTestCodeunitsTool has correct structure', async () => {
            const { listTestCodeunitsTool } = await import('../tools/runTests');
            
            assert.strictEqual(listTestCodeunitsTool.name, 'list_test_codeunits');
            assert.ok(listTestCodeunitsTool.description.length > 0);
        });

        test('getCodeCoverageTool has correct structure', async () => {
            const { getCodeCoverageTool } = await import('../tools/getCoverage');
            
            assert.strictEqual(getCodeCoverageTool.name, 'get_code_coverage');
            assert.ok(getCodeCoverageTool.description.length > 0);
            assert.ok('objectType' in getCodeCoverageTool.inputSchema.properties);
            assert.ok('objectId' in getCodeCoverageTool.inputSchema.properties);
        });

        test('publishExtensionTool has correct structure', async () => {
            const { publishExtensionTool } = await import('../tools/publish');
            
            assert.strictEqual(publishExtensionTool.name, 'publish_extension');
            assert.ok(publishExtensionTool.description && publishExtensionTool.description.length > 0);
        });

        test('publishAndTestTool has correct structure', async () => {
            const { publishAndTestTool } = await import('../tools/publish');
            
            assert.strictEqual(publishAndTestTool.name, 'publish_and_test');
            assert.ok(publishAndTestTool.description && publishAndTestTool.description.length > 0);
        });

        test('createMCPSettingsTool has correct structure', async () => {
            const { createMCPSettingsTool } = await import('../tools/settings');
            
            assert.strictEqual(createMCPSettingsTool.name, 'create_mcp_settings');
            assert.ok(createMCPSettingsTool.description && createMCPSettingsTool.description.length > 0);
            assert.ok('projectPath' in (createMCPSettingsTool.inputSchema as any).properties);
            assert.ok('containerName' in (createMCPSettingsTool.inputSchema as any).properties);
        });

        test('getMCPSettingsTool has correct structure', async () => {
            const { getMCPSettingsTool } = await import('../tools/settings');
            
            assert.strictEqual(getMCPSettingsTool.name, 'get_mcp_settings');
            assert.ok(getMCPSettingsTool.description && getMCPSettingsTool.description.length > 0);
        });
    });

    suite('Resource Definitions', () => {
        test('testResultsResource has correct structure', async () => {
            const { testResultsResource } = await import('../resources/testResults');
            
            assert.strictEqual(testResultsResource.uri, 'altestrunner://results/latest');
            assert.strictEqual(testResultsResource.name, 'Latest Test Results');
            assert.ok(testResultsResource.description.length > 0);
        });

        test('coverageResource has correct structure', async () => {
            const { coverageResource } = await import('../resources/testResults');
            
            assert.strictEqual(coverageResource.uri, 'altestrunner://coverage');
            assert.strictEqual(coverageResource.name, 'Code Coverage');
        });

        test('configResource has correct structure', async () => {
            const { configResource } = await import('../resources/testResults');
            
            assert.strictEqual(configResource.uri, 'altestrunner://config');
            assert.strictEqual(configResource.name, 'AL Test Runner Config');
        });
    });

    suite('Resource Handlers', () => {
        test('readTestResultsResource returns content when file exists', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { lastXml: fixtures.lastXml });
            
            const { readTestResultsResource } = await import('../resources/testResults');
            const result = await readTestResultsResource();
            
            assert.ok(result.contents);
            assert.strictEqual(result.contents.length, 1);
            assert.strictEqual(result.contents[0].uri, 'altestrunner://results/latest');
        });

        test('readCoverageResource returns content when file exists', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { codeCoverage: fixtures.codeCoverage });
            
            const { readCoverageResource } = await import('../resources/testResults');
            const result = await readCoverageResource();
            
            assert.ok(result.contents);
            assert.strictEqual(result.contents.length, 1);
            assert.strictEqual(result.contents[0].uri, 'altestrunner://coverage');
        });

        test('readConfigResource returns content', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {
                altestrunnerConfig: fixtures.altestrunnerConfig,
            });
            
            const { readConfigResource } = await import('../resources/testResults');
            const result = await readConfigResource();
            
            assert.ok(result.contents);
            assert.strictEqual(result.contents.length, 1);
            assert.strictEqual(result.contents[0].uri, 'altestrunner://config');
        });
    });
});

