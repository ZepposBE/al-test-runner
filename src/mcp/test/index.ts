/**
 * MCP Test Suite - Mocha setup and test runner
 * 
 * This is a standalone test suite for MCP functionality that runs
 * without VS Code, enabling fast feedback during development.
 */

import * as path from 'path';
import Mocha from 'mocha';
import glob from 'glob';

export function run(): Promise<void> {
    const mocha = new Mocha({
        ui: 'tdd',
        timeout: 10000,
    });

    const testsRoot = __dirname;

    return new Promise((resolve, reject) => {
        glob('**/*.test.js', { cwd: testsRoot }, (err: Error | null, files: string[]) => {
            if (err) {
                return reject(err);
            }

            // Add files to the test suite
            files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

            try {
                // Run the mocha test
                mocha.run((failures: number) => {
                    if (failures > 0) {
                        reject(new Error(`${failures} tests failed.`));
                    } else {
                        resolve();
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    });
}

