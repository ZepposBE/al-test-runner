import * as path from 'path';
import Mocha from 'mocha';
import glob from 'glob';

export function run(): Promise<void> {
	// Create the mocha test
	const options: Mocha.MochaOptions = {
		ui: 'tdd',
	};
	
	// Support grep pattern from environment variable (set by runTest.ts)
	if (process.env.TEST_GREP) {
		options.grep = process.env.TEST_GREP;
	}
	
	const mocha = new Mocha(options);

	const testsRoot = path.resolve(__dirname, '..');

	return new Promise((c, e) => {
		glob('**/**.test.js', { cwd: testsRoot }, (err: Error | null, files: string[]) => {
			if (err) {
				return e(err);
			}

			// Add files to the test suite
			files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

			try {
				// Run the mocha test
				mocha.run((failures: number) => {
					if (failures > 0) {
						e(new Error(`${failures} tests failed.`));
					} else {
						c();
					}
				});
			} catch (err) {
				e(err);
			}
		});
	});
}
