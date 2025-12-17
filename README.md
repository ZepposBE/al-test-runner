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

1. **Enable the MCP server** in your VS Code/Cursor settings:
   ```json
   "al-test-runner.enableMCP": true
   ```

2. **Restart your IDE** after changing this setting.

3. **Switch to Agent Mode** in Cursor (or use GitHub Copilot Chat in VS Code).

4. **Start using AI-assisted testing** - just ask naturally!

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
| `update_test_decorations` | Trigger VS Code to refresh test decorations |

### Requirements for MCP

- **Cursor Agent Mode** or **VS Code with GitHub Copilot** (or compatible AI extension)
- **Compiled extension** - Press `Ctrl+Shift+B` to compile before publishing
- **Running BC container** - Required for test execution
- **Standard AL Test Runner setup** - launch.json and .altestrunner/config.json configured

### Configuration (Optional)

For multi-root workspaces or when automatic detection fails, create `.altestrunner/mcp-settings.json`:

```json
{
  "containerName": "your-bc-container-name",
  "projectPath": "C:/path/to/your/al/project",
  "outputFolder": ".output"
}
```

Or use the AI assistant: *"Configure the MCP settings for container 'bcserver'"*

## Requirements
- A Business Central Docker container that you can publish your extension into and run your tests against. As of v0.2.0, Docker can either be running locally or on a remote server. If remote, you must be able to execute PowerShell commands against the host with ps-remoting.
- Alternatively you can use VS Code remote development to execute local PowerShell commands on the host with this extension installed on the host 
- [AL Language extension](https://marketplace.visualstudio.com/items?itemName=ms-dynamics-smb.al) for VS Code
- [navcontainerhelper PowerShell module](https://freddysblog.com/category/navcontainerhelper/) (minimum version 0.6.4.18)