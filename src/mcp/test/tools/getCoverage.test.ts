/**
 * Integration tests for getCoverage tool handler
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
import { getCodeCoverageHandler } from '../../tools/getCoverage';

suite('Get Code Coverage Tool Tests', () => {
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

    suite('getCodeCoverageHandler', () => {
        test('returns error when no coverage file exists', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {}); // No codecoverage.json
            
            const result = await getCodeCoverageHandler();
            
            assert.strictEqual(result.content.length, 1);
            const text = result.content[0].text;
            const parsed = JSON.parse(text);
            
            assert.strictEqual(parsed.error, 'No code coverage data found');
            assert.ok(parsed.message.includes('Run tests with code coverage enabled'));
        });

        test('returns formatted coverage summary', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { codeCoverage: fixtures.codeCoverage });
            
            const result = await getCodeCoverageHandler();
            
            const text = result.content[0].text;
            
            // Should contain coverage header with percentage
            assert.ok(text.includes('CODE COVERAGE:'), 'Should include CODE COVERAGE header');
            
            // Should show overall stats
            assert.ok(text.includes('Covered Lines:'), 'Should include Covered Lines');
            assert.ok(text.includes('Coverage:'), 'Should include Coverage percentage');
            
            // Should show by-object breakdown
            assert.ok(text.includes('By Object:'), 'Should include By Object section');
            assert.ok(text.includes('Codeunits:'), 'Should include Codeunits section');
        });

        test('filters by object type', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { codeCoverage: fixtures.codeCoverage });
            
            const result = await getCodeCoverageHandler({ objectType: 'Table' });
            
            const text = result.content[0].text;
            
            // Should only show Table coverage
            assert.ok(text.includes('Tables:'));
            // Should NOT show Codeunits section
            assert.ok(!text.includes('Codeunits:'));
        });

        test('filters by object ID', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { codeCoverage: fixtures.codeCoverage });
            
            const result = await getCodeCoverageHandler({ objectId: 50101 });
            
            const text = result.content[0].text;
            
            // Should show coverage data for object 50101
            // The exact format includes the ID and percentage
            assert.ok(text.includes('50101'), 'Should include object ID 50101');
            assert.ok(text.includes('100%'), 'Codeunit 50101 should have 100% coverage');
        });

        test('includes progress bar visualization', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { codeCoverage: fixtures.codeCoverage });
            
            const result = await getCodeCoverageHandler();
            
            const text = result.content[0].text;
            
            // Should contain progress bar characters
            assert.ok(text.includes('['));
            assert.ok(text.includes(']'));
        });
    });
});

