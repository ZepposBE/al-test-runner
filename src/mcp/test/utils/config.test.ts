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
    findProjectRootFromPath,
    setProjectContextFromFile,
    clearProjectContext,
    getCurrentProjectContext,
    getActiveProjectStatePath,
    readActiveProjectState,
    clearActiveProjectStateCache,
} from '../../utils/config';
import { writeFileSync, mkdirSync, unlinkSync } from 'fs';

suite('MCP Config Utils Tests', () => {
    let testDir: string;

    setup(() => {
        // Create a fresh test directory before each test
        testDir = createTestDir();
        clearMCPSettingsCache();
        clearProjectContext();
        clearTestEnv();
    });

    teardown(() => {
        // Clean up after each test
        clearMCPSettingsCache();
        clearProjectContext();
        clearTestEnv();
        cleanupTestDir(testDir);
    });

    suite('getMCPSettingsPath', () => {
        test('returns path based on project context', () => {
            createMockALProject(testDir, { appJson: fixtures.appJson });
            setTestEnv(testDir);
            const result = getMCPSettingsPath();
            assert.strictEqual(result, join(testDir, '.altestrunner', 'mcp-settings.json'));
        });

        test('returns path based on cwd when no context set', () => {
            // Without project context set, it uses cwd
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

        test('returns project context when no MCP settings', () => {
            createMockALProject(testDir, { appJson: fixtures.appJson }); // Need app.json for context to work
            setTestEnv(testDir);
            
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

    suite('findProjectRootFromPath', () => {
        test('finds project root when starting from file path', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { appJson: fixtures.appJson });
            
            const filePath = join(testDir, 'src', 'codeunit', 'TestCodeunit.codeunit.al');
            const result = findProjectRootFromPath(filePath);
            
            assert.strictEqual(result, testDir);
        });

        test('finds project root when starting from subdirectory', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { appJson: fixtures.appJson });
            
            const subDir = join(testDir, 'src', 'codeunit');
            const result = findProjectRootFromPath(subDir);
            
            assert.strictEqual(result, testDir);
        });

        test('returns null when no app.json found', () => {
            setTestEnv(testDir);
            // Don't create an AL project - no app.json
            
            const filePath = join(testDir, 'somefile.al');
            const result = findProjectRootFromPath(filePath);
            
            assert.strictEqual(result, null);
        });

        test('returns null for empty path', () => {
            const result = findProjectRootFromPath('');
            assert.strictEqual(result, null);
        });
    });

    suite('setProjectContextFromFile', () => {
        test('sets project context when valid file path provided', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { appJson: fixtures.appJson });
            
            const filePath = join(testDir, 'src', 'TestCodeunit.al');
            const result = setProjectContextFromFile(filePath);
            
            assert.strictEqual(result, testDir);
            assert.ok(getCurrentProjectContext()?.includes(testDir.toLowerCase()) || getCurrentProjectContext() === testDir);
        });

        test('returns null and does not set context for invalid path', () => {
            clearProjectContext();
            
            const filePath = '/nonexistent/path/to/file.al';
            const result = setProjectContextFromFile(filePath);
            
            assert.strictEqual(result, null);
        });
    });

    suite('getProjectPath with context', () => {
        // Helper to compare paths in a case-insensitive way (for Windows)
        function pathsEqual(a: string, b: string): boolean {
            if (process.platform === 'win32') {
                return a.toLowerCase() === b.toLowerCase();
            }
            return a === b;
        }

        test('uses context path when provided as parameter', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { appJson: fixtures.appJson });
            
            const filePath = join(testDir, 'src', 'TestCodeunit.al');
            const result = getProjectPath(filePath);
            
            assert.strictEqual(result, testDir);
        });

        test('uses current context when no parameter and context is set', () => {
            setTestEnv(testDir);
            createMockALProject(testDir, { appJson: fixtures.appJson });
            
            // Set context first
            setProjectContextFromFile(join(testDir, 'src', 'TestCodeunit.al'));
            
            // Then getProjectPath should use the context
            const result = getProjectPath();
            // On Windows, paths are normalized to lowercase for comparison
            assert.ok(pathsEqual(result, testDir), `Expected ${result} to equal ${testDir}`);
        });

        test('context takes priority over environment variable', () => {
            // Create two projects
            const project1Dir = createTestDir();
            const project2Dir = createTestDir();
            
            try {
                createMockALProject(project1Dir, { appJson: fixtures.appJson });
                createMockALProject(project2Dir, { appJson: { ...fixtures.appJson, name: 'Project 2' } });
                
                // Set env to point to project1
                setTestEnv(project1Dir);
                
                // But set context to project2
                setProjectContextFromFile(join(project2Dir, 'src', 'TestCodeunit.al'));
                
                // getProjectPath should use the context (project2)
                const result = getProjectPath();
                // On Windows, paths are normalized to lowercase for comparison
                assert.ok(pathsEqual(result, project2Dir), `Expected ${result} to equal ${project2Dir}`);
            } finally {
                cleanupTestDir(project1Dir);
                cleanupTestDir(project2Dir);
            }
        });
    });

    suite('getMCPSettings with context', () => {
        test('loads settings from context-specific project', () => {
            // Create two projects with different settings
            const project1Dir = createTestDir();
            const project2Dir = createTestDir();
            
            try {
                createMockALProject(project1Dir, { 
                    appJson: fixtures.appJson,
                    mcpSettings: { containerName: 'container1', extensionName: 'Project 1' }
                });
                createMockALProject(project2Dir, { 
                    appJson: { ...fixtures.appJson, name: 'Project 2' },
                    mcpSettings: { containerName: 'container2', extensionName: 'Project 2' }
                });
                
                // Set context to project2
                setProjectContextFromFile(join(project2Dir, 'src', 'TestCodeunit.al'));
                
                // getMCPSettings should load from project2
                const settings = getMCPSettings();
                assert.strictEqual(settings?.containerName, 'container2');
                assert.strictEqual(settings?.extensionName, 'Project 2');
            } finally {
                cleanupTestDir(project1Dir);
                cleanupTestDir(project2Dir);
            }
        });

        test('caches settings per project path', () => {
            // Create two projects
            const project1Dir = createTestDir();
            const project2Dir = createTestDir();
            
            try {
                createMockALProject(project1Dir, { 
                    appJson: fixtures.appJson,
                    mcpSettings: { containerName: 'container1' }
                });
                createMockALProject(project2Dir, { 
                    appJson: { ...fixtures.appJson, name: 'Project 2' },
                    mcpSettings: { containerName: 'container2' }
                });
                
                // Load settings for project1
                setProjectContextFromFile(join(project1Dir, 'src', 'Test.al'));
                const settings1 = getMCPSettings();
                assert.strictEqual(settings1?.containerName, 'container1');
                
                // Load settings for project2
                setProjectContextFromFile(join(project2Dir, 'src', 'Test.al'));
                const settings2 = getMCPSettings();
                assert.strictEqual(settings2?.containerName, 'container2');
                
                // Go back to project1 - should use cached settings
                setProjectContextFromFile(join(project1Dir, 'src', 'Test.al'));
                const settings1Again = getMCPSettings();
                assert.strictEqual(settings1Again?.containerName, 'container1');
            } finally {
                cleanupTestDir(project1Dir);
                cleanupTestDir(project2Dir);
            }
        });
    });

    suite('Multi-Root Workspace Scenario', () => {
        // This test simulates the exact issue reported by the user:
        // - Multiple projects in a workspace
        // - Each project has its own mcp-settings.json with different extensionName
        // - When running tests from project B, settings from project B should be used
        
        test('simulates multi-root workspace with different extension names', () => {
            // Create two projects simulating the user's scenario
            const advancedPricingDir = createTestDir();
            const reusablePackagingDir = createTestDir();
            
            try {
                // Project 1: Advanced Pricing (similar to user's setup)
                createMockALProject(advancedPricingDir, { 
                    appJson: { 
                        id: '11111111-1111-1111-1111-111111111111',
                        name: 'Dynavision Advanced Pricing',
                        publisher: 'Dynavision',
                        version: '1.0.0.0',
                    },
                    mcpSettings: { 
                        containerName: 'bcserver',
                        extensionName: 'Dynavision Advanced Pricing & Discounts-Test',
                        extensionId: '11111111-1111-1111-1111-111111111111'
                    }
                });
                
                // Project 2: Reusable Packaging (the target project)
                createMockALProject(reusablePackagingDir, { 
                    appJson: { 
                        id: '22222222-2222-2222-2222-222222222222',
                        name: 'Dynavision Reusable Packaging',
                        publisher: 'Dynavision',
                        version: '1.0.0.0',
                    },
                    mcpSettings: { 
                        containerName: 'bcserver',
                        extensionName: 'Dynavision Reusable Packaging-Test',
                        extensionId: 'ac1c49ee-fc75-4d5f-8411-4137010ae690'
                    }
                });
                
                // Simulate: Initially, context might be set to Advanced Pricing
                setProjectContextFromFile(join(advancedPricingDir, 'src', 'Test.al'));
                
                let settings = getMCPSettings();
                assert.strictEqual(settings?.extensionName, 'Dynavision Advanced Pricing & Discounts-Test');
                
                // Simulate: Now user runs test from Reusable Packaging via filename
                // This is exactly what run_test_codeunit does
                const testFilePath = join(reusablePackagingDir, 'src', 'ContainerDepositMgt', 'Warehouse', 'TestWhseReceiptPosting.codeunit.al');
                setProjectContextFromFile(testFilePath);
                
                // After setting context from the test file, settings should be from Reusable Packaging
                settings = getMCPSettings();
                assert.strictEqual(settings?.extensionName, 'Dynavision Reusable Packaging-Test');
                assert.strictEqual(settings?.extensionId, 'ac1c49ee-fc75-4d5f-8411-4137010ae690');
                
                // Also verify getProjectPath returns the correct project
                const projectPath = getProjectPath();
                assert.ok(
                    projectPath.toLowerCase().includes(reusablePackagingDir.toLowerCase()) ||
                    reusablePackagingDir.toLowerCase().includes(projectPath.toLowerCase()),
                    `Expected ${projectPath} to be ${reusablePackagingDir}`
                );
            } finally {
                cleanupTestDir(advancedPricingDir);
                cleanupTestDir(reusablePackagingDir);
            }
        });

        test('extensionName from mcp-settings takes priority over app.json', () => {
            const projectDir = createTestDir();
            
            try {
                // Create project where app.json has one name, but mcp-settings has a different name
                createMockALProject(projectDir, { 
                    appJson: { 
                        id: '33333333-3333-3333-3333-333333333333',
                        name: 'App Name From AppJson',
                        publisher: 'Test',
                        version: '1.0.0.0',
                    },
                    mcpSettings: { 
                        containerName: 'bcserver',
                        extensionName: 'Override Extension Name-Test',
                        extensionId: '44444444-4444-4444-4444-444444444444'
                    }
                });
                
                setProjectContextFromFile(join(projectDir, 'src', 'Test.al'));
                
                const settings = getMCPSettings();
                const appJson = getAppJson();
                
                // MCP settings should have the override name
                assert.strictEqual(settings?.extensionName, 'Override Extension Name-Test');
                
                // app.json should still have its original name
                assert.strictEqual(appJson?.name, 'App Name From AppJson');
                
                // The effective extension name should be from MCP settings (priority)
                const effectiveExtensionName = settings?.extensionName || appJson?.name;
                assert.strictEqual(effectiveExtensionName, 'Override Extension Name-Test');
            } finally {
                cleanupTestDir(projectDir);
            }
        });
    });

    suite('Active Project State Synchronization', () => {
        let stateFilePath: string;
        let originalEnv: string | undefined;

        setup(() => {
            // Save original env and set up state file path
            originalEnv = process.env.AL_ACTIVE_PROJECT_STATE_PATH;
            stateFilePath = join(testDir, '.altestrunner', 'active-project.json');
            mkdirSync(join(testDir, '.altestrunner'), { recursive: true });
            process.env.AL_ACTIVE_PROJECT_STATE_PATH = stateFilePath;
            clearActiveProjectStateCache();
        });

        teardown(() => {
            // Restore original env
            if (originalEnv === undefined) {
                delete process.env.AL_ACTIVE_PROJECT_STATE_PATH;
            } else {
                process.env.AL_ACTIVE_PROJECT_STATE_PATH = originalEnv;
            }
            clearActiveProjectStateCache();
        });

        test('getActiveProjectStatePath returns env var value', () => {
            const result = getActiveProjectStatePath();
            assert.strictEqual(result, stateFilePath);
        });

        test('getActiveProjectStatePath returns null when env var not set', () => {
            delete process.env.AL_ACTIVE_PROJECT_STATE_PATH;
            const result = getActiveProjectStatePath();
            assert.strictEqual(result, null);
        });

        test('readActiveProjectState returns null when file does not exist', () => {
            const result = readActiveProjectState();
            assert.strictEqual(result, null);
        });

        test('readActiveProjectState reads valid state file', () => {
            const projectDir = createTestDir();
            createMockALProject(projectDir, { appJson: fixtures.appJson });
            
            try {
                const state = {
                    projectPath: projectDir,
                    timestamp: new Date().toISOString()
                };
                writeFileSync(stateFilePath, JSON.stringify(state), 'utf-8');
                
                const result = readActiveProjectState();
                
                assert.ok(result);
                assert.strictEqual(result?.projectPath, projectDir);
                assert.ok(result?.timestamp);
            } finally {
                cleanupTestDir(projectDir);
            }
        });

        test('readActiveProjectState returns null for stale state (>5 minutes)', () => {
            const projectDir = createTestDir();
            createMockALProject(projectDir, { appJson: fixtures.appJson });
            
            try {
                // Create state with old timestamp (6 minutes ago)
                const oldTimestamp = new Date(Date.now() - 6 * 60 * 1000);
                const state = {
                    projectPath: projectDir,
                    timestamp: oldTimestamp.toISOString()
                };
                writeFileSync(stateFilePath, JSON.stringify(state), 'utf-8');
                
                const result = readActiveProjectState();
                
                // Should return null because state is too old
                assert.strictEqual(result, null);
            } finally {
                cleanupTestDir(projectDir);
            }
        });

        test('readActiveProjectState returns null when project path does not exist', () => {
            const state = {
                projectPath: '/nonexistent/project/path',
                timestamp: new Date().toISOString()
            };
            writeFileSync(stateFilePath, JSON.stringify(state), 'utf-8');
            
            const result = readActiveProjectState();
            
            assert.strictEqual(result, null);
        });

        test('getProjectPath uses active state when available', () => {
            const projectDir = createTestDir();
            createMockALProject(projectDir, { appJson: fixtures.appJson });
            
            try {
                // Clear any existing context
                clearProjectContext();
                clearMCPSettingsCache();
                
                // Write active state
                const state = {
                    projectPath: projectDir,
                    timestamp: new Date().toISOString()
                };
                writeFileSync(stateFilePath, JSON.stringify(state), 'utf-8');
                clearActiveProjectStateCache();
                
                // getProjectPath should now return the active state project
                const result = getProjectPath();
                
                assert.ok(
                    pathsEqual(result, projectDir),
                    `Expected ${result} to equal ${projectDir}`
                );
            } finally {
                cleanupTestDir(projectDir);
            }
        });

        test('active state takes priority over MCP settings projectPath', () => {
            const stateProjectDir = createTestDir();
            const settingsProjectDir = createTestDir();
            
            createMockALProject(stateProjectDir, { 
                appJson: { ...fixtures.appJson, name: 'State Project' }
            });
            createMockALProject(settingsProjectDir, { 
                appJson: { ...fixtures.appJson, name: 'Settings Project' },
                mcpSettings: { projectPath: settingsProjectDir }
            });
            
            try {
                // Set context to settings project (which has projectPath in mcp-settings)
                setProjectContextFromFile(join(settingsProjectDir, 'src', 'Test.al'));
                
                // Clear context but keep MCP settings loaded
                clearProjectContext();
                
                // Write active state to state project
                const state = {
                    projectPath: stateProjectDir,
                    timestamp: new Date().toISOString()
                };
                writeFileSync(stateFilePath, JSON.stringify(state), 'utf-8');
                clearActiveProjectStateCache();
                
                // getProjectPath should return state project (priority over MCP settings)
                const result = getProjectPath();
                
                assert.ok(
                    pathsEqual(result, stateProjectDir),
                    `Expected ${result} to equal ${stateProjectDir} (not ${settingsProjectDir})`
                );
            } finally {
                cleanupTestDir(stateProjectDir);
                cleanupTestDir(settingsProjectDir);
            }
        });
    });
});

/**
 * Helper function for case-insensitive path comparison on Windows
 */
function pathsEqual(path1: string, path2: string): boolean {
    if (process.platform === 'win32') {
        return path1.toLowerCase() === path2.toLowerCase();
    }
    return path1 === path2;
}

