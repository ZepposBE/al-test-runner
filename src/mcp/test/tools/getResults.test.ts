/**
 * Integration tests for getResults tool handler
 */

import * as assert from 'assert';
import {
    createTestDir,
    cleanupTestDir,
    createMockALProject,
    setTestEnv,
    clearTestEnv,
    fixtures,
} from '../testHelpers';
import { clearMCPSettingsCache } from '../../utils/config';
import { getTestResultsHandler } from '../../tools/getResults';

suite('Get Test Results Tool Tests', () => {
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

    suite('getTestResultsHandler', () => {
        test('returns error when no results file exists', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {}); // No last.xml
            
            const result = await getTestResultsHandler();
            
            assert.strictEqual(result.content.length, 1);
            const text = result.content[0].text;
            const parsed = JSON.parse(text);
            
            assert.strictEqual(parsed.error, 'No test results found');
            assert.ok(parsed.message.includes('Run tests first'));
        });

        test('returns summary for results with failures (default mode)', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { lastXml: fixtures.lastXml });
            
            const result = await getTestResultsHandler();
            
            assert.strictEqual(result.content.length, 1);
            const text = result.content[0].text;
            
            // Should be formatted text, not JSON
            assert.ok(text.includes('TEST(S) FAILED'));
            assert.ok(text.includes('Total: 4'));
            assert.ok(text.includes('Passed: 3'));
            assert.ok(text.includes('Failed: 1'));
            assert.ok(text.includes('TestFour'));
            assert.ok(text.includes('Assert.AreEqual failed'));
        });

        test('returns success summary for all-passing results', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { lastXml: fixtures.lastXmlAllPass });
            
            const result = await getTestResultsHandler();
            
            const text = result.content[0].text;
            
            assert.ok(text.includes('ALL TESTS PASSED'));
            assert.ok(text.includes('Total: 3'));
            assert.ok(text.includes('Passed: 3'));
            assert.ok(text.includes('Failed: 0'));
        });

        test('returns detailed results when detailed=true', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { lastXml: fixtures.lastXml });
            
            const result = await getTestResultsHandler({ detailed: true });
            
            assert.strictEqual(result.content.length, 1);
            const text = result.content[0].text;
            const parsed = JSON.parse(text);
            
            assert.strictEqual(parsed.success, true);
            assert.ok(parsed.assemblies);
            assert.strictEqual(parsed.assemblies.length, 1);
            
            const assembly = parsed.assemblies[0];
            assert.strictEqual(assembly.name, '50100 Test Codeunit');
            assert.strictEqual(assembly.total, 4);
            assert.strictEqual(assembly.collections.length, 1);
            assert.strictEqual(assembly.collections[0].tests.length, 4);
        });

        test('includes stack trace in failure details', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { lastXml: fixtures.lastXml });
            
            const result = await getTestResultsHandler();
            
            const text = result.content[0].text;
            
            assert.ok(text.includes('Stack:'));
            assert.ok(text.includes('line 45'));
        });

        test('shows run date and time', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { lastXml: fixtures.lastXml });
            
            const result = await getTestResultsHandler();
            
            const text = result.content[0].text;
            
            assert.ok(text.includes('Run:'));
            assert.ok(text.includes('2024-01-15'));
            assert.ok(text.includes('10:30:00'));
        });
    });
});

