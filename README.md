# AL Test Runner

AL Test Runner adds features to help you write and run Microsoft Dynamics 365 Business Central tests.

- Run tests
- Debug tests
- Enable code coverage to see which lines are covered by your tests
- See which tests call methods in your codeunits and tables

All without leaving VS Code and integrated with VS Code's Testing pane. For more information see the documentation at: [https://jimmymcp.github.io/al-test-runner-docs/](https://jimmymcp.github.io/al-test-runner-docs/)
## Testing Pane
View, run and debug your tests and test codeunits directly from VS Code's Testing pane.

![](https://jimmymcp.github.io/al-test-runner-docs/images/20220613191553.png)

## Toggle Code Coverage
Toggle code coverage to highlight the lines which are being hit by your test code.

![](https://jimmymcp.github.io/al-test-runner-docs/images/toggle-code-coverage.gif)

## Test Coverage
See which tests hit the methods in your codeunits and tables. Run those tests from a code action in the editor.

![](https://jimmymcp.github.io/al-test-runner-docs/images/show-tests-code-lens.gif)

## AI Assistant Integration (MCP)

AL Test Runner includes an optional MCP (Model Context Protocol) server that enables AI assistants to run tests, publish extensions, and interact with your Business Central development workflow directly from your IDE.

### Quick Start

#### Step 1: Enable the MCP Server in VS Code/Cursor

Add this to your VS Code/Cursor settings (`settings.json`):

```json
"al-test-runner.enableMCP": true
```

#### Step 2: Configure Cursor to Connect to the MCP Server

Add this to your Cursor MCP configuration file (`~/.cursor/mcp.json` or workspace `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "al-test-runner": {
      "command": "node",
      "args": ["<path-to-extension>/out/mcp/serverEntry.js"]
    }
  }
}
```

**Finding the extension path:**
- Windows: `%USERPROFILE%\.vscode\extensions\jamespearson.al-test-runner-<version>`
- macOS/Linux: `~/.vscode/extensions/jamespearson.al-test-runner-<version>`
- For Cursor: Replace `.vscode` with `.cursor`

Example for Windows:
```json
{
  "mcpServers": {
    "al-test-runner": {
      "command": "node",
      "args": ["C:/Users/YourName/.cursor/extensions/jamespearson.al-test-runner-10.17.0/out/mcp/serverEntry.js"]
    }
  }
}
```

#### Step 3: Restart Your IDE

Restart VS Code/Cursor after changing settings.

#### Step 4: Start Using AI-Assisted Testing

1. **Switch to Agent Mode** in Cursor (or use GitHub Copilot Chat in VS Code)
2. **Open an `.al` file** in your project - this tells the MCP which project to use
3. **Ask naturally** - the AI can now run tests, publish extensions, and more!

### How Project Detection Works

The MCP automatically knows which project you're working on:

1. When you open an `.al` file, the extension detects the project root (by finding `app.json`)
2. This information is shared with the MCP server
3. When switching between projects, just open a file in the new project

This means you can work across multiple BC projects without manual configuration!

### Usage Examples

Once enabled, you can use natural language prompts with your AI assistant:

**Running Tests**
- "Run all the tests in this project"
- "Run the tests in the current codeunit"
- "Run just the TestCustomerValidation test"

**TDD Workflow**
- "Publish my extension and run all tests" (uses `publish_and_test`)
- "I fixed the bug - verify the tests pass now"

**Checking Results**
- "What were the test results?"
- "Show me which tests failed and why"
- "What's the code coverage?"

**Discovery**
- "List all test codeunits in this project"
- "What tests are available?"

**Configuration**
- "Show me the current MCP settings"
- "Configure the MCP to use container 'bcserver'"

### Available Tools

| Tool | Description |
|------|-------------|
| `get_test_results` | Get results from the most recent test run |
| `run_all_tests` | Run all tests in the extension |
| `run_test_codeunit` | Run tests in a specific codeunit (by file or ID) |
| `run_single_test` | Run a single test by name |
| `list_test_codeunits` | Discover available test codeunits in the project |
| `get_code_coverage` | Get code coverage data with filtering options |
| `publish_extension` | Publish the .app file to the BC container |
| `publish_and_test` | Publish and run all tests (ideal for TDD) |
| `create_mcp_settings` | Configure MCP settings for multi-root workspaces |
| `get_mcp_settings` | View current configuration and diagnostics |
| `debug_project_context` | Troubleshoot multi-root workspace issues |
| `update_test_decorations` | Trigger VS Code to refresh test decorations |

### Requirements for MCP

- **Cursor Agent Mode** or **VS Code with GitHub Copilot** (or compatible AI extension)
- **Compiled extension** - Press `Ctrl+Shift+B` to compile before publishing
- **Running BC container** - Required for test execution
- **Standard AL Test Runner setup** - launch.json and .altestrunner/config.json configured

### Configuration (Optional)

Most settings are auto-detected from your `launch.json` and `app.json`. However, you can create `.altestrunner/mcp-settings.json` to override specific values:

```json
{
  "containerName": "your-bc-container-name",
  "outputFolder": ".output",
  "extensionName": "Your Extension Name-Test",
  "extensionId": "your-extension-guid"
}
```

**When to use `mcp-settings.json`:**

| Setting | When Needed |
|---------|-------------|
| `containerName` | When container name differs from `launch.json` server URL |
| `extensionName` | When your test extension has a different name than `app.json` (e.g., "MyApp-Test") |
| `extensionId` | When you need to override the extension ID from `app.json` |
| `outputFolder` | When your `.app` files are in a non-standard location |

**Typical Setup:**

For most projects, no `mcp-settings.json` is needed. The MCP will:
1. Read the container name from `launch.json` server URL
2. Read extension name/ID from `app.json`
3. Look for `.app` files in `.output/` folder

**Multi-Root Workspaces:**

Each project in a multi-root workspace can have its own `.altestrunner/mcp-settings.json`. The MCP automatically uses the correct settings based on which file you have open.

### Troubleshooting

**Tests running against wrong extension?**

Use the `debug_project_context` tool to see what's happening:
- Ask: *"Debug project context for this file"*
- This shows the detected project, loaded settings, and effective extension name

**MCP not responding?**

1. Ensure `"al-test-runner.enableMCP": true` is set
2. Restart your IDE
3. Open an `.al` file in your project before running MCP commands
4. Check the Output panel for "AL Test Runner" errors

## Requirements
- A Business Central Docker container that you can publish your extension into and run your tests against. As of v0.2.0, Docker can either be running locally or on a remote server. If remote, you must be able to execute PowerShell commands against the host with ps-remoting.
- Alternatively you can use VS Code remote development to execute local PowerShell commands on the host with this extension installed on the host 
- [AL Language extension](https://marketplace.visualstudio.com/items?itemName=ms-dynamics-smb.al) for VS Code
- [navcontainerhelper PowerShell module](https://freddysblog.com/category/navcontainerhelper/) (minimum version 0.6.4.18)