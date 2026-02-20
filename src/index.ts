/**
 * Godot MCP Server - Main Entry Point
 * A Model Context Protocol server for Godot Engine
 * Enables AI assistants to interact with Godot projects
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getConfigFromEnv, validateConfig, DEFAULT_CONFIG } from './utils/config.js';
import { godotTools } from './tools/godot-tools.js';

// Get configuration
const config = {
  ...DEFAULT_CONFIG,
  ...getConfigFromEnv(),
};

// Validate configuration
const validation = validateConfig(config);
if (!validation.valid && !config.debugMode) {
  console.error('Configuration errors:', validation.errors.join(', '));
}

// Create MCP server instance
const server = new McpServer({
  name: 'Godot MCP Server',
  version: '1.0.0',
  description: 'MCP Server for Godot Engine - Enables AI assistants to interact with Godot projects',
});

// Register all Godot tools
for (const tool of godotTools) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server.tool(tool.name, {}, async (args: any) => {
    try {
      return await tool.handler(args || {});
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  });
}

// Register resources
server.resource(
  'godot-config',
  'godot://config',
  {
    description: 'Current Godot MCP server configuration',
    mimeType: 'application/json',
  },
  async () => {
    return {
      contents: [
        {
          uri: 'godot://config',
          mimeType: 'application/json',
          text: JSON.stringify(config, null, 2),
        },
      ],
    };
  }
);

// Connect to stdio transport
const transport = new StdioServerTransport();

async function main() {
  try {
    await server.connect(transport);
    console.error('Godot MCP Server started');
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

main();
