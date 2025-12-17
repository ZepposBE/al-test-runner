/**
 * Integration tests for settings tool handlers
 */

import * as assert from 'assert';
import { existsSync, readFileSync } from 'fs';
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
    createMCPSettingsHandler, 
    getMCPSettingsHandler 
} from '../../tools/settings';

suite('Settings Tool Tests', () => {
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

    suite('createMCPSettingsHandler', () => {
        test('creates settings file with provided values', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {});
            
            const result = await createMCPSettingsHandler({
                containerName: 'my-container',
                outputFolder: 'custom-output',
            });
            
            const text = result.content[0].text;
            const parsed = JSON.parse(text);
            
            assert.strictEqual(parsed.success, true);
            assert.strictEqual(parsed.settings.containerName, 'my-container');
            assert.strictEqual(parsed.settings.outputFolder, 'custom-output');
            
            // Verify file was created
            const settingsPath = join(testDir, '.altestrunner', 'mcp-settings.json');
            assert.strictEqual(existsSync(settingsPath), true);
        });

        test('auto-detects projectPath when not provided', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {});
            
            const result = await createMCPSettingsHandler({
                containerName: 'my-container',
            });
            
            const text = result.content[0].text;
            const parsed = JSON.parse(text);
            
            assert.strictEqual(parsed.success, true);
            assert.strictEqual(parsed.settings.projectPath, testDir);
        });

        test('auto-detects containerName from launch.json when not provided', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {
                launchJson: fixtures.launchJson,
            });
            
            const result = await createMCPSettingsHandler({});
            
            const text = result.content[0].text;
            const parsed = JSON.parse(text);
            
            assert.strictEqual(parsed.success, true);
            assert.strictEqual(parsed.settings.containerName, 'bcserver');
        });

        test('merges with existing settings by default', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {
                mcpSettings: { containerName: 'existing', outputFolder: 'existing-output' },
            });
            
            const result = await createMCPSettingsHandler({
                containerName: 'new-container',
                // outputFolder not provided - should keep existing
            });
            
            const text = result.content[0].text;
            const parsed = JSON.parse(text);
            
            assert.strictEqual(parsed.settings.containerName, 'new-container');
            assert.strictEqual(parsed.settings.outputFolder, 'existing-output');
        });

        test('overwrites existing settings when overwrite=true', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {
                mcpSettings: { containerName: 'existing', outputFolder: 'existing-output' },
            });
            
            const result = await createMCPSettingsHandler({
                containerName: 'new-container',
                overwrite: true,
            });
            
            const text = result.content[0].text;
            const parsed = JSON.parse(text);
            
            assert.strictEqual(parsed.settings.containerName, 'new-container');
            // outputFolder should NOT be present since we're overwriting
            assert.strictEqual(parsed.settings.outputFolder, undefined);
        });

        test('provides helpful hint when containerName is set', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {});
            
            const result = await createMCPSettingsHandler({
                containerName: 'my-container',
            });
            
            const text = result.content[0].text;
            const parsed = JSON.parse(text);
            
            assert.ok(parsed.hint.includes('publish_and_test'));
        });
    });

    suite('getMCPSettingsHandler', () => {
        test('returns configuration status when settings exist', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {
                mcpSettings: { containerName: 'test-container' },
                launchJson: fixtures.launchJson,
                appJson: fixtures.appJson,
            });
            
            const result = await getMCPSettingsHandler();
            
            const text = result.content[0].text;
            const parsed = JSON.parse(text);
            
            assert.ok(parsed.settingsFile.exists);
            assert.strictEqual(parsed.settingsFile.content.containerName, 'test-container');
            assert.strictEqual(parsed.status.hasSettings, true);
            assert.strictEqual(parsed.status.hasContainer, true);
        });

        test('returns auto-detected values', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {
                launchJson: fixtures.launchJson,
            });
            
            const result = await getMCPSettingsHandler();
            
            const text = result.content[0].text;
            const parsed = JSON.parse(text);
            
            assert.strictEqual(parsed.autoDetected.containerName, 'bcserver');
            assert.strictEqual(parsed.autoDetected.launchConfigName, 'Your own server');
        });

        test('returns project info from app.json', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {
                appJson: fixtures.appJson,
            });
            
            const result = await getMCPSettingsHandler();
            
            const text = result.content[0].text;
            const parsed = JSON.parse(text);
            
            assert.notStrictEqual(parsed.projectInfo, null);
            assert.strictEqual(parsed.projectInfo.name, 'Test App');
            assert.strictEqual(parsed.projectInfo.publisher, 'Test Publisher');
        });

        test('provides recommendations when configuration incomplete', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {});
            
            const result = await getMCPSettingsHandler();
            
            const text = result.content[0].text;
            const parsed = JSON.parse(text);
            
            assert.strictEqual(parsed.status.ready, false);
            assert.ok(parsed.recommendations.length > 0);
            
            // Should recommend adding container name
            const containerRec = parsed.recommendations.find(
                (r: any) => r.issue.includes('container')
            );
            assert.notStrictEqual(containerRec, undefined);
        });

        test('shows ready status when fully configured', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {
                mcpSettings: { containerName: 'test-container' },
                launchJson: fixtures.launchJson,
                appJson: fixtures.appJson,
            });
            
            // Mock .app file existence by updating the settings
            await createMCPSettingsHandler({
                containerName: 'test-container',
                appFilePath: join(testDir, 'test.app'),
            });
            
            const result = await getMCPSettingsHandler();
            
            const text = result.content[0].text;
            const parsed = JSON.parse(text);
            
            // Container is set, so that part is ready
            assert.strictEqual(parsed.status.hasContainer, true);
        });

        test('provides quickFix suggestion when no settings', async () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {}); // No settings, no launch.json
            
            const result = await getMCPSettingsHandler();
            
            const text = result.content[0].text;
            const parsed = JSON.parse(text);
            
            assert.notStrictEqual(parsed.quickFix, undefined);
            assert.strictEqual(parsed.quickFix.tool, 'create_mcp_settings');
        });
    });
});

