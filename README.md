# Godot MCP Server

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?style=flat&logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue?style=flat&logo=typescript)](https://typescriptlang.org)
[![MIT License](https://img.shields.io/badge/License-MIT-red?style=flat)](LICENSE)
[![Godot](https://img.shields.io/badge/Made%20with-Godot-478cbf?style=flat&logo=godot)](https://godotengine.org)

A comprehensive Model Context Protocol (MCP) server for Godot Engine that enables AI assistants to interact with Godot projects. Provides powerful tools for project management, script execution, scene manipulation, asset management, and more.

## Features

- 🚀 **Project Management** - Launch editor, run projects, manage multiple projects
- 📜 **Script Management** - Create, read, analyze GDScript with templates
- 🎬 **Scene Management** - List, inspect, create scenes
- 🔍 **Node Operations** - Find nodes, get properties
- 📊 **Project Analysis** - Statistics, unused assets detection
- 🎨 **Asset Management** - List images, audio, fonts
- ⚙️ **Project Settings** - Read project.godot configuration
- ✅ **Validation** - GDScript validation via LSP
- 📦 **Export** - Export to Windows, Linux, macOS, Android, Web
- 🔧 **UID Management** - Godot 4.4+ UID support

## Requirements

- [Node.js](https://nodejs.org/) 18+
- [Godot Engine](https://godotengine.org/download) 4.x (recommended)
- npm

## Quick Start

```bash
# Clone and install
git clone https://github.com/godot-mcp/godot-mcp.git
cd godot-mcp
npm install
npm run build
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GODOT_PATH` | Path to Godot executable | Auto-detected |
| `GODOT_PROJECT_PATH` | Path to Godot project | Current directory |
| `GODOT_LSP_PORT` | LSP port | 6005 |
| `DEBUG` | Enable debug logging | false |

### Claude Desktop

```json
{
  "mcpServers": {
    "godot": {
      "command": "node",
      "args": ["/path/to/godot-mcp/dist/index.js"],
      "env": {
        "GODOT_PATH": "/path/to/godot",
        "GODOT_PROJECT_PATH": "/path/to/project"
      }
    }
  }
}
```

### Cline

See `configs/cline_mcp_settings.json` for full auto-approve list.

### Cursor

Create `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "godot": {
      "command": "node",
      "args": ["/path/to/godot-mcp/dist/index.js"]
    }
  }
}
```

## Available Tools (35+)

### Project Management
| Tool | Description |
|------|-------------|
| `godot_launch_editor` | Launch Godot editor |
| `godot_run_project` | Run project (debug/headless) |
| `godot_stop_project` | Stop running project |
| `godot_get_project_info` | Get project details |
| `godot_get_version` | Get Godot version |
| `godot_list_projects` | Find projects in directory |
| `godot_quit` | Quit Godot |

### Script Management
| Tool | Description |
|------|-------------|
| `godot_list_scripts` | List all .gd files |
| `godot_read_script` | Read script content |
| `godot_create_script` | Create with template |
| `godot_analyze_script` | Analyze for issues |
| `godot_run_script` | Execute script file |
| `godot_run_code` | Execute inline code |

### Scene Management
| Tool | Description |
|------|-------------|
| `godot_list_scenes` | List all .tscn files |
| `godot_get_scene_tree` | Get node hierarchy |
| `godot_create_scene` | Create new scene |
| `godot_save_scene` | Save current scene |

### Node Operations
| Tool | Description |
|------|-------------|
| `godot_find_nodes` | Find nodes by name/type |
| `godot_get_node_properties` | Get node properties |

### UID Management (Godot 4.4+)
| Tool | Description |
|------|-------------|
| `godot_get_uid` | Get UID for a file |
| `godot_update_project_uids` | Update UID references |

### Debug
| Tool | Description |
|------|-------------|
| `godot_get_debug_output` | Capture debug output |

### Project Analysis
| Tool | Description |
|------|-------------|
| `godot_analyze_project` | Get project statistics |
| `godot_find_unused_assets` | Find unused assets |

### Asset Management
| Tool | Description |
|------|-------------|
| `godot_list_resources` | List .tres files |
| `godot_list_assets` | List images, audio, fonts |

### Project Settings
| Tool | Description |
|------|-------------|
| `godot_get_project_settings` | Read project.godot |

### Validation
| Tool | Description |
|------|-------------|
| `godot_validate_script` | Validate via LSP |
| `godot_check_lsp` | Check LSP connection |

### Export
| Tool | Description |
|------|-------------|
| `godot_export_project` | Export to platform |
| `godot_get_export_presets` | List export presets |

### Utility
| Tool | Description |
|------|-------------|
| `godot_execute` | Arbitrary command |
| `godot_get_config` | Get configuration |

## Script Templates

When creating scripts, use the `template` parameter:

- `basic` - Basic Node script
- `node` - Node with @onready
- `character` - CharacterBody2D with movement
- `resource` - Custom Resource
- `autoload` - Autoload singleton
- `state` - State pattern

## Example Prompts

```
"Launch the Godot editor for my project"
"Create a Player script with character template"
"Analyze my project and show statistics"
"Find all scenes in my project"
"Export my project for Windows"
"What scripts are in my project?"
"Get the scene tree of Main.tscn"
```

## Development

```bash
npm run dev    # Development with hot reload
npm run build  # Build TypeScript
npm start      # Run production
```

## License

MIT - See [LICENSE](LICENSE)
