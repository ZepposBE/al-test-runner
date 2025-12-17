/**
 * Unit tests for MCP XML parser utilities
 */

import * as assert from 'assert';
import { join } from 'path';
import {
    createTestDir,
    cleanupTestDir,
    createMockALProject,
    setTestEnv,
    clearTestEnv,
    fixtures,
} from '../testHelpers';
import { clearMCPSettingsCache } from '../../utils/config';
import {
    parseTestResults,
    getTestResultsSummary,
    parseCodeCoverage,
    getCodeCoverageSummary,
} from '../../utils/xmlParser';

suite('XML Parser Tests', () => {
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

    suite('parseTestResults', () => {
        test('returns null when results file does not exist', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {}); // No last.xml
            
            const result = await parseTestResults();
            assert.strictEqual(result, null);
        });

        test('parses valid test results XML', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { lastXml: fixtures.lastXml });
            
            const result = await parseTestResults();
            
            assert.notStrictEqual(result, null);
            assert.strictEqual(result!.length, 1);
            
            const assembly = result![0];
            assert.strictEqual(assembly.name, '50100 Test Codeunit');
            assert.strictEqual(assembly.total, 4);
            assert.strictEqual(assembly.passed, 3);
            assert.strictEqual(assembly.failed, 1);
            assert.strictEqual(assembly.skipped, 0);
            assert.strictEqual(assembly.runDate, '2024-01-15');
            assert.strictEqual(assembly.runTime, '10:30:00');
        });

        test('parses all-passing test results', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { lastXml: fixtures.lastXmlAllPass });
            
            const result = await parseTestResults();
            
            assert.notStrictEqual(result, null);
            const assembly = result![0];
            assert.strictEqual(assembly.total, 3);
            assert.strictEqual(assembly.passed, 3);
            assert.strictEqual(assembly.failed, 0);
        });

        test('parses test collections correctly', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { lastXml: fixtures.lastXml });
            
            const result = await parseTestResults();
            
            const collection = result![0].collections[0];
            assert.strictEqual(collection.name, 'Test Codeunit');
            assert.strictEqual(collection.tests.length, 4);
        });

        test('parses individual test results', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { lastXml: fixtures.lastXml });
            
            const result = await parseTestResults();
            
            const tests = result![0].collections[0].tests;
            
            // Check passing test
            const passingTest = tests.find(t => t.method === 'TestOne');
            assert.notStrictEqual(passingTest, undefined);
            assert.strictEqual(passingTest!.result, 'Pass');
            assert.strictEqual(passingTest!.time, 0.1);
            assert.strictEqual(passingTest!.failure, undefined);
            
            // Check failing test
            const failingTest = tests.find(t => t.method === 'TestFour');
            assert.notStrictEqual(failingTest, undefined);
            assert.strictEqual(failingTest!.result, 'Fail');
            assert.notStrictEqual(failingTest!.failure, undefined);
            assert.ok(failingTest!.failure!.message.includes('Assert.AreEqual failed'));
            assert.ok(failingTest!.failure!.stackTrace.includes('TestFour line 45'));
        });
    });

    suite('getTestResultsSummary', () => {
        test('returns null when no results file exists', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {});
            
            const result = await getTestResultsSummary();
            assert.strictEqual(result, null);
        });

        test('calculates summary correctly for mixed results', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { lastXml: fixtures.lastXml });
            
            const summary = await getTestResultsSummary();
            
            assert.notStrictEqual(summary, null);
            assert.strictEqual(summary!.totalTests, 4);
            assert.strictEqual(summary!.passed, 3);
            assert.strictEqual(summary!.failed, 1);
            assert.strictEqual(summary!.skipped, 0);
            assert.strictEqual(summary!.runDate, '2024-01-15');
            assert.strictEqual(summary!.runTime, '10:30:00');
        });

        test('calculates summary correctly for all-passing results', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { lastXml: fixtures.lastXmlAllPass });
            
            const summary = await getTestResultsSummary();
            
            assert.notStrictEqual(summary, null);
            assert.strictEqual(summary!.totalTests, 3);
            assert.strictEqual(summary!.passed, 3);
            assert.strictEqual(summary!.failed, 0);
            assert.strictEqual(summary!.failedTests.length, 0);
        });

        test('includes failed test details', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { lastXml: fixtures.lastXml });
            
            const summary = await getTestResultsSummary();
            
            assert.strictEqual(summary!.failedTests.length, 1);
            
            const failedTest = summary!.failedTests[0];
            assert.strictEqual(failedTest.codeunit, '50100 Test Codeunit');
            assert.strictEqual(failedTest.test, 'TestFour');
            assert.ok(failedTest.message.includes('Assert.AreEqual failed'));
            assert.ok(failedTest.stackTrace.includes('line 45'));
        });

        test('calculates total time correctly', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { lastXml: fixtures.lastXml });
            
            const summary = await getTestResultsSummary();
            
            assert.strictEqual(summary!.totalTime, 1.234);
        });
    });

    suite('parseCodeCoverage', () => {
        test('returns null when coverage file does not exist', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {});
            
            const result = parseCodeCoverage();
            assert.strictEqual(result, null);
        });

        test('parses code coverage JSON correctly', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { codeCoverage: fixtures.codeCoverage });
            
            const result = parseCodeCoverage();
            
            assert.notStrictEqual(result, null);
            // 11 total entries: 5 for Codeunit 50100, 3 for Codeunit 50101, 3 for Table 50100
            assert.strictEqual(result!.length, 11);
            
            const firstLine = result![0];
            assert.strictEqual(firstLine.objectType, 'Codeunit');
            assert.strictEqual(firstLine.objectId, '50100');
            assert.strictEqual(firstLine.lineType, 'Code');
            assert.strictEqual(firstLine.lineNo, '10');
            assert.strictEqual(firstLine.noOfHits, '5');
        });
    });

    suite('getCodeCoverageSummary', () => {
        test('returns null when coverage file does not exist', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {});
            
            const result = getCodeCoverageSummary();
            assert.strictEqual(result, null);
        });

        test('calculates overall coverage correctly', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { codeCoverage: fixtures.codeCoverage });
            
            const summary = getCodeCoverageSummary();
            
            assert.notStrictEqual(summary, null);
            // Codeunit 50100: 4 code lines (2 covered)
            // Codeunit 50101: 3 code lines (3 covered)
            // Table 50100: 3 code lines (2 covered)
            // Total: 10 code lines, 7 covered = 70%
            assert.strictEqual(summary!.totalLines, 10);
            assert.strictEqual(summary!.coveredLines, 7);
            assert.strictEqual(summary!.coveragePercentage, 70);
        });

        test('groups coverage by object', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { codeCoverage: fixtures.codeCoverage });
            
            const summary = getCodeCoverageSummary();
            
            assert.notStrictEqual(summary, null);
            // Should have 3 objects: Codeunit 50100, Codeunit 50101, and Table 50100
            assert.strictEqual(summary!.objects.length, 3);
            
            // Check Codeunit 50100
            const codeunit50100 = summary!.objects.find(o => 
                o.objectType === 'Codeunit' && o.objectId === 50100
            );
            assert.notStrictEqual(codeunit50100, undefined);
            assert.strictEqual(codeunit50100!.totalLines, 4);
            assert.strictEqual(codeunit50100!.coveredLines, 2);
            assert.strictEqual(codeunit50100!.coveragePercentage, 50);
        });

        test('filters by object type', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { codeCoverage: fixtures.codeCoverage });
            
            const summary = getCodeCoverageSummary('Codeunit');
            
            assert.notStrictEqual(summary, null);
            // Should have 2 codeunits: 50100 and 50101
            assert.strictEqual(summary!.objects.length, 2);
            assert.ok(summary!.objects.every(o => o.objectType === 'Codeunit'));
        });

        test('filters by object ID', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { codeCoverage: fixtures.codeCoverage });
            
            const summary = getCodeCoverageSummary(undefined, 50101);
            
            assert.notStrictEqual(summary, null);
            // Codeunit 50101 has 3 code lines, all covered (100%)
            assert.strictEqual(summary!.objects.length, 1);
            assert.strictEqual(summary!.objects[0].objectId, 50101);
            assert.strictEqual(summary!.objects[0].totalLines, 3);
            assert.strictEqual(summary!.objects[0].coveredLines, 3);
            assert.strictEqual(summary!.objects[0].coveragePercentage, 100);
        });

        test('filters by both object type and ID', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { codeCoverage: fixtures.codeCoverage });
            
            const summary = getCodeCoverageSummary('Table', 50100);
            
            assert.notStrictEqual(summary, null);
            assert.strictEqual(summary!.objects.length, 1);
            assert.strictEqual(summary!.objects[0].objectType, 'Table');
            assert.strictEqual(summary!.objects[0].objectId, 50100);
        });
    });
});

