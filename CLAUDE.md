# Godot MCP Server - Development Guide

This is an MCP (Model Context Protocol) server for Godot Engine that enables AI assistants to interact with Godot projects.

## Project Structure

```
godot-mcp-server/
├── src/
│   ├── index.ts           # Main MCP server entry point
│   ├── godot/
│   │   ├── executor.ts    # Command execution (run scripts, launch editor, etc.)
│   │   └── lsp-client.ts  # LSP integration for GDScript validation
│   ├── tools/
│   │   └── godot-tools.ts  # All MCP tools (26+ tools)
│   ├── types/
│   │   └── index.ts       # TypeScript type definitions
│   └── utils/
│       └── config.ts      # Configuration utilities
├── configs/                # MCP client configurations
│   ├── cline_mcp_settings.json
│   └── cursor_mcp.json
├── scripts/
│   └── godot_operations.gd # Bundled GDScript operations
└── dist/                  # Compiled JavaScript
```

## Available Tools

### Project Management
- godot_launch_editor - Launch Godot editor
- godot_run_project - Run the project
- godot_stop_project - Stop running project
- godot_get_project_info - Get project details
- godot_get_version - Get Godot version
- godot_list_projects - List projects in directory

### Script Management
- godot_list_scripts - List all scripts
- godot_read_script - Read script content
- godot_create_script - Create new script with template
- godot_analyze_script - Analyze script for issues
- godot_run_script - Execute a script
- godot_run_code - Execute inline GDScript

### Scene Management
- godot_list_scenes - List all scenes
- godot_get_scene_tree - Get scene hierarchy
- godot_create_scene - Create new scene
- godot_save_scene - Save current scene

### Node Management
- godot_find_nodes - Find nodes by name/type
- godot_get_node_properties - Get node properties

### Validation
- godot_validate_script - Validate via LSP
- godot_check_lSP - Check LSP connection

### Export
- godot_export_project - Export to platform
- godot_get_export_presets - List export presets

### Resources
- godot_list_resources - List .tres files

### Utility
- godot_execute - Arbitrary command
- godot_get_config - Get config
- godot_quit - Quit Godot

## Building

```bash
npm install
npm run build
```

## Running

```bash
# Development
npm run dev

# Production
npm start
```

## Configuration

Set these environment variables:
- GODOT_PATH - Path to Godot executable
- GODOT_PROJECT_PATH - Path to project
- GODOT_LSP_PORT - LSP port (default 6005)
- DEBUG - Enable debug logging

## Adding New Tools

1. Add tool definition to src/tools/godot-tools.ts
2. Export in the godotTools array
3. Rebuild with npm run build
