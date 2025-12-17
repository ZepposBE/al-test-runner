/**
 * MCP Test Runner Entry Point
 * 
 * Run MCP tests independently of VS Code for fast feedback.
 * Usage: npm run test:mcp
 */

import { run } from './index';

async function main() {
    try {
        await run();
        console.log('All MCP tests passed!');
        process.exit(0);
    } catch (err) {
        console.error('MCP tests failed:', err);
        process.exit(1);
    }
}

main();

