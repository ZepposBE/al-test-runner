/**
 * Unit tests for MCP config utilities
 */

import * as assert from 'assert';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import {
    createTestDir,
    cleanupTestDir,
    createMockALProject,
    setTestEnv,
    clearTestEnv,
    fixtures,
} from '../testHelpers';
import {
    getMCPSettingsPath,
    getMCPSettings,
    clearMCPSettingsCache,
    getProjectPath,
    getALTestRunnerPath,
    getConfigPath,
    getLastResultsPath,
    getCodeCoveragePath,
    getALTestRunnerConfig,
    getLaunchJsonPath,
    getLaunchConfigurations,
    getSelectedLaunchConfig,
    getAppJsonPath,
    getAppJson,
    getContainerName,
    getOutputFolder,
    getConfiguredAppFilePath,
    getLaunchConfigName,
    saveMCPSettings,
    triggerDecorations,
} from '../../utils/config';

suite('MCP Config Utils Tests', () => {
    let testDir: string;

    setup(() => {
        // Create a fresh test directory before each test
        testDir = createTestDir();
        clearMCPSettingsCache();
        clearTestEnv();
    });

    teardown(() => {
        // Clean up after each test
        clearMCPSettingsCache();
        clearTestEnv();
        cleanupTestDir(testDir);
    });

    suite('getMCPSettingsPath', () => {
        test('returns path based on AL_PROJECT_PATH environment variable', () => {
            setTestEnv(testDir);
            const result = getMCPSettingsPath();
            assert.strictEqual(result, join(testDir, '.altestrunner', 'mcp-settings.json'));
        });

        test('returns path based on cwd when no env var set', () => {
            // Without AL_PROJECT_PATH set, it uses cwd
            const result = getMCPSettingsPath();
            assert.ok(result.endsWith(join('.altestrunner', 'mcp-settings.json')));
        });
    });

    suite('getMCPSettings', () => {
        test('returns null when settings file does not exist', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {}); // No MCP settings
            
            const result = getMCPSettings();
            assert.strictEqual(result, null);
        });

        test('returns settings when file exists', () => {
            setTestEnv(testDir);
            const mcpSettings = { containerName: 'mycontainer', outputFolder: '.output' };
            createMockALProject(testDir, { mcpSettings });
            
            const result = getMCPSettings();
            assert.deepStrictEqual(result, mcpSettings);
        });

        test('caches settings after first read', () => {
            setTestEnv(testDir);
            const mcpSettings = { containerName: 'mycontainer' };
            createMockALProject(testDir, { mcpSettings });
            
            // First read
            const result1 = getMCPSettings();
            assert.deepStrictEqual(result1, mcpSettings);
            
            // Second read should return cached value
            const result2 = getMCPSettings();
            assert.strictEqual(result1, result2); // Same reference
        });

        test('clearMCPSettingsCache clears the cache', () => {
            setTestEnv(testDir);
            const mcpSettings = { containerName: 'mycontainer' };
            createMockALProject(testDir, { mcpSettings });
            
            getMCPSettings(); // Populate cache
            clearMCPSettingsCache();
            
            // After clearing, should read from file again
            const result = getMCPSettings();
            assert.deepStrictEqual(result, mcpSettings);
        });
    });

    suite('getProjectPath', () => {
        test('returns MCP settings projectPath when it exists', () => {
            setTestEnv(testDir);
            const mcpSettings = { projectPath: testDir };
            createMockALProject(testDir, { mcpSettings });
            
            const result = getProjectPath();
            assert.strictEqual(result, testDir);
        });

        test('returns AL_PROJECT_PATH when no MCP settings', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {}); // No MCP settings
            
            const result = getProjectPath();
            assert.strictEqual(result, testDir);
        });

        test('returns cwd when no env var or MCP settings', () => {
            const result = getProjectPath();
            assert.strictEqual(result, process.cwd());
        });
    });

    suite('Path utility functions', () => {
        test('getALTestRunnerPath returns correct path', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {});
            
            const result = getALTestRunnerPath();
            assert.strictEqual(result, join(testDir, '.altestrunner'));
        });

        test('getConfigPath returns correct path', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {});
            
            const result = getConfigPath();
            assert.strictEqual(result, join(testDir, '.altestrunner', 'config.json'));
        });

        test('getLastResultsPath returns correct path', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {});
            
            const result = getLastResultsPath();
            assert.strictEqual(result, join(testDir, '.altestrunner', 'last.xml'));
        });

        test('getLaunchJsonPath returns correct path', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {});
            
            const result = getLaunchJsonPath();
            assert.strictEqual(result, join(testDir, '.vscode', 'launch.json'));
        });

        test('getAppJsonPath returns correct path', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {});
            
            const result = getAppJsonPath();
            assert.strictEqual(result, join(testDir, 'app.json'));
        });
    });

    suite('getCodeCoveragePath', () => {
        test('returns default path when no config', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {});
            
            const result = getCodeCoveragePath();
            assert.strictEqual(result, join(testDir, '.altestrunner', 'codecoverage.json'));
        });

        test('returns config path when specified as relative', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {
                altestrunnerConfig: {
                    ...fixtures.altestrunnerConfig,
                    codeCoveragePath: '../tests/.altestrunner/codecoverage.json',
                },
            });
            
            const result = getCodeCoveragePath();
            assert.strictEqual(result, join(testDir, '../tests/.altestrunner/codecoverage.json'));
        });
    });

    suite('getALTestRunnerConfig', () => {
        test('returns null when config file does not exist', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {}); // No config
            
            const result = getALTestRunnerConfig();
            assert.strictEqual(result, null);
        });

        test('returns config when file exists', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { altestrunnerConfig: fixtures.altestrunnerConfig });
            
            const result = getALTestRunnerConfig();
            assert.deepStrictEqual(result, fixtures.altestrunnerConfig);
        });
    });

    suite('getLaunchConfigurations', () => {
        test('returns empty array when launch.json does not exist', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {}); // No launch.json
            
            const result = getLaunchConfigurations();
            assert.deepStrictEqual(result, []);
        });

        test('returns configurations when launch.json exists', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { launchJson: fixtures.launchJson });
            
            const result = getLaunchConfigurations();
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].name, 'Your own server');
        });
    });

    suite('getSelectedLaunchConfig', () => {
        test('returns first launch config when no specific one selected', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { launchJson: fixtures.launchJson });
            
            const result = getSelectedLaunchConfig();
            assert.strictEqual(result?.name, 'Your own server');
        });

        test('returns specified config from altestrunner config', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {
                launchJson: fixtures.launchJson,
                altestrunnerConfig: { ...fixtures.altestrunnerConfig, launchConfigName: 'Cloud sandbox' },
            });
            
            const result = getSelectedLaunchConfig();
            assert.strictEqual(result?.name, 'Cloud sandbox');
        });
    });

    suite('getAppJson', () => {
        test('returns null when app.json does not exist', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {});
            
            const result = getAppJson();
            assert.strictEqual(result, null);
        });

        test('returns parsed app.json when file exists', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { appJson: fixtures.appJson });
            
            const result = getAppJson();
            assert.strictEqual(result?.name, 'Test App');
            assert.strictEqual(result?.publisher, 'Test Publisher');
        });
    });

    suite('getContainerName', () => {
        test('returns MCP settings containerName first', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {
                mcpSettings: { containerName: 'mcp-container' },
                launchJson: fixtures.launchJson,
            });
            
            const result = getContainerName();
            assert.strictEqual(result, 'mcp-container');
        });

        test('returns AL_CONTAINER_NAME env var second', () => {
            setTestEnv(testDir);
            process.env.AL_CONTAINER_NAME = 'env-container';
            createMockALProject(testDir, { launchJson: fixtures.launchJson });
            
            const result = getContainerName();
            assert.strictEqual(result, 'env-container');
        });

        test('extracts container name from launch.json server URL', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { launchJson: fixtures.launchJson });
            
            const result = getContainerName();
            assert.strictEqual(result, 'bcserver');
        });

        test('returns null when no container name available', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {
                launchJson: {
                    version: '0.2.0',
                    configurations: [
                        { name: 'SaaS', request: 'launch', type: 'al' }, // No server URL
                    ],
                },
            });
            
            const result = getContainerName();
            assert.strictEqual(result, null);
        });
    });

    suite('getOutputFolder', () => {
        test('returns MCP settings outputFolder when specified', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {
                mcpSettings: { outputFolder: 'custom-output' },
            });
            
            const result = getOutputFolder();
            assert.strictEqual(result, join(testDir, 'custom-output'));
        });

        test('returns default .output when no MCP settings', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {});
            
            const result = getOutputFolder();
            assert.strictEqual(result, join(testDir, '.output'));
        });
    });

    suite('getConfiguredAppFilePath', () => {
        test('returns null when no appFilePath in MCP settings', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {});
            
            const result = getConfiguredAppFilePath();
            assert.strictEqual(result, null);
        });

        test('returns resolved path when appFilePath is relative', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {
                mcpSettings: { appFilePath: '.output/myapp.app' },
            });
            
            const result = getConfiguredAppFilePath();
            assert.strictEqual(result, join(testDir, '.output/myapp.app'));
        });
    });

    suite('getLaunchConfigName', () => {
        test('returns MCP settings launchConfigName first', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {
                mcpSettings: { launchConfigName: 'MCP Config' },
                altestrunnerConfig: { ...fixtures.altestrunnerConfig, launchConfigName: 'ALTR Config' },
            });
            
            const result = getLaunchConfigName();
            assert.strictEqual(result, 'MCP Config');
        });

        test('returns altestrunner config launchConfigName second', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {
                altestrunnerConfig: fixtures.altestrunnerConfig,
            });
            
            const result = getLaunchConfigName();
            assert.strictEqual(result, 'Your own server');
        });

        test('returns null when no launch config name available', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {});
            
            const result = getLaunchConfigName();
            assert.strictEqual(result, null);
        });
    });

    suite('saveMCPSettings', () => {
        test('creates settings file and directory if needed', () => {
            setTestEnv(testDir);
            
            const settings = { containerName: 'new-container' };
            const result = saveMCPSettings(settings);
            
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.error, undefined);
            
            const savedPath = join(testDir, '.altestrunner', 'mcp-settings.json');
            assert.strictEqual(existsSync(savedPath), true);
            
            const savedData = JSON.parse(readFileSync(savedPath, 'utf-8'));
            assert.deepStrictEqual(savedData, settings);
        });

        test('clears cache after saving', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { mcpSettings: { containerName: 'old' } });
            
            getMCPSettings(); // Populate cache
            
            const settings = { containerName: 'new' };
            saveMCPSettings(settings);
            
            // Should get new value after save
            const result = getMCPSettings();
            assert.strictEqual(result?.containerName, 'new');
        });
    });

    suite('triggerDecorations', () => {
        test('creates trigger file', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, {});
            
            const result = triggerDecorations();
            
            assert.strictEqual(result.success, true);
            
            const triggerPath = join(testDir, '.altestrunner', 'trigger-decorations');
            assert.strictEqual(existsSync(triggerPath), true);
        });
    });
});

