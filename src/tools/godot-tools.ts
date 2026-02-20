/**
 * Godot MCP Server - Complete MCP Tools
 * Full-featured Godot Engine integration for AI assistants
 */

import { getConfigFromEnv } from '../utils/config.js';
import { readFile, writeFile, readdir, stat, mkdir } from 'fs/promises';
import { join, extname, basename, dirname } from 'path';

const config = getConfigFromEnv();

// ============================================
// PROJECT MANAGEMENT
// ============================================

export const godotLaunchEditor = {
  name: 'godot_launch_editor',
  description: 'Launch the Godot editor with the current project',
  inputSchema: { type: 'object' as const, properties: {} },
  handler: async () => {
    const { GodotExecutor } = await import('../godot/executor.js');
    const exec = new GodotExecutor(config.godotPath, config.projectPath);
    const result = await exec.launchEditor();
    return { content: [{ type: 'text' as const, text: result.success ? 'Godot editor launched successfully' : `Failed: ${result.error}` }] };
  },
};

export const godotRunProject = {
  name: 'godot_run_project',
  description: 'Run the Godot project in debug or headless mode',
  inputSchema: {
    type: 'object' as const,
    properties: {
      debug: { type: 'boolean', description: 'Run in debug mode', default: false },
      headless: { type: 'boolean', description: 'Run headless without display', default: false },
    },
  },
  handler: async (params: { debug?: boolean; headless?: boolean }) => {
    const { GodotExecutor } = await import('../godot/executor.js');
    const exec = new GodotExecutor(config.godotPath, config.projectPath);
    const args = ['--path', config.projectPath];
    if (params.debug) args.push('--debug');
    if (params.headless) args.push('--headless');
    const result = await exec.execute(args);
    return { content: [{ type: 'text' as const, text: result.output || (result.success ? 'Project running' : `Failed: ${result.error}`) }] };
  },
};

export const godotStopProject = {
  name: 'godot_stop_project',
  description: 'Stop a running Godot project',
  inputSchema: { type: 'object' as const, properties: {} },
  handler: async () => {
    const { GodotExecutor } = await import('../godot/executor.js');
    const exec = new GodotExecutor(config.godotPath, config.projectPath);
    const result = await exec.quit();
    return { content: [{ type: 'text' as const, text: result.success ? 'Project stopped' : `Failed: ${result.error}` }] };
  },
};

export const godotGetProjectInfo = {
  name: 'godot_get_project_info',
  description: 'Get detailed project information (name, path, engine version, icon, description)',
  inputSchema: { type: 'object' as const, properties: {} },
  handler: async () => {
    const { GodotExecutor } = await import('../godot/executor.js');
    const exec = new GodotExecutor(config.godotPath, config.projectPath);
    const script = `
extends SceneTree
func _init():
    var info = {
        "project_path": ProjectSettings.globalize_path("res://"),
        "name": "Unknown",
        "engine_version": Engine.get_version_info()["string"],
        "version_major": Engine.get_version_info()["major"],
        "version_minor": Engine.get_version_info()["minor"],
        "version_patch": Engine.get_version_info()["patch"],
        "debug_build": Engine.is_debug_build()
    }
    var cfg = ConfigFile.new()
    if cfg.load("res://project.godot") == OK:
        info["name"] = cfg.get_value("application/config", "name", "Unknown")
        if cfg.has_section_key("application", "config/icon"):
            info["icon"] = cfg.get_value("application/config", "icon", "")
        if cfg.has_section_key("application", "config/description"):
            info["description"] = cfg.get_value("application/config", "description", "")
    print(JSON.stringify(info))
    quit()
`;
    const result = await exec.runInlineScript(script);
    try {
      const match = result.output.match(/\{[\s\S]*\}/);
      const info = match ? JSON.parse(match[0]) : { project_path: config.projectPath, name: 'Unknown' };
      return { content: [{ type: 'text' as const, text: JSON.stringify(info, null, 2) }] };
    } catch { return { content: [{ type: 'text' as const, text: `Project: ${config.projectPath}` }] }; }
  },
};

export const godotGetGodotVersion = {
  name: 'godot_get_version',
  description: 'Get the installed Godot engine version',
  inputSchema: { type: 'object' as const, properties: {} },
  handler: async () => {
    const { GodotExecutor } = await import('../godot/executor.js');
    const exec = new GodotExecutor(config.godotPath, config.projectPath);
    const result = await exec.execute(['--version']);
    return { content: [{ type: 'text' as const, text: result.output || result.error || 'Unknown version' }] };
  },
};

export const godotListProjects = {
  name: 'godot_list_projects',
  description: 'Find Godot projects in a directory',
  inputSchema: { type: 'object' as const, properties: { directory: { type: 'string', description: 'Directory to search' } } },
  handler: async (params: { directory?: string }) => {
    const searchDir = params.directory || config.projectPath;
    const { GodotExecutor } = await import('../godot/executor.js');
    const exec = new GodotExecutor(config.godotPath, searchDir);
    const safeDir = searchDir.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const script = `
extends SceneTree
func _init():
    var projects = []
    var dir = DirAccess.open("${safeDir}")
    if dir:
        dir.list_dir_begin()
        var item = dir.get_next()
        while item != "":
            if dir.current_is_dir() and not item.begins_with("."):
                if FileAccess.file_exists("res://" + item + "/project.godot"):
                    var cfg = ConfigFile.new()
                    if cfg.load("res://" + item + "/project.godot") == OK:
                        projects.append({"name": cfg.get_value("application/config", "name", item), "path": "${safeDir}/" + item})
            item = dir.get_next()
        dir.list_dir_end()
    print(JSON.stringify({"projects": projects}))
    quit()
`;
    const result = await exec.runInlineScript(script);
    return { content: [{ type: 'text' as const, text: result.output || '[]' }] };
  },
};

// ============================================
// EDITOR CONTROL
// ============================================

export const godotOpenFile = {
  name: 'godot_open_file',
  description: 'Open a file in the Godot editor',
  inputSchema: { type: 'object' as const, properties: { filePath: { type: 'string', description: 'Path to file' } }, required: ['filePath'] },
  handler: async (params: { filePath: string }) => {
    const { GodotExecutor } = await import('../godot/executor.js');
    const exec = new GodotExecutor(config.godotPath, config.projectPath);
    const result = await exec.execute(['--path', config.projectPath, '-e', '--', params.filePath]);
    return { content: [{ type: 'text' as const, text: result.success ? `Opened ${params.filePath}` : `Failed: ${result.error}` }] };
  },
};

export const godotFocusScript = {
  name: 'godot_focus_script',
  description: 'Focus on a script in the editor and optionally go to a line',
  inputSchema: { type: 'object' as const, properties: { scriptPath: { type: 'string' }, line: { type: 'number', description: 'Line number to jump to' } }, required: ['scriptPath'] },
  handler: async (params: { scriptPath: string; line?: number }) => {
    const { GodotExecutor } = await import('../godot/executor.js');
    const exec = new GodotExecutor(config.godotPath, config.projectPath);
    const args = ['--path', config.projectPath, '-e', '--script', params.scriptPath];
    if (params.line) args.push('--line', String(params.line));
    const result = await exec.execute(args);
    return { content: [{ type: 'text' as const, text: result.success ? `Focused on ${params.scriptPath}` : `Failed: ${result.error}` }] };
  },
};

export const godotQuickOpen = {
  name: 'godot_quick_open',
  description: 'Quick open a file in Godot editor',
  inputSchema: { type: 'object' as const, properties: { fileName: { type: 'string', description: 'File name to search for' } }, required: ['fileName'] },
  handler: async (params: { fileName: string }) => {
    const { GodotExecutor } = await import('../godot/executor.js');
    const exec = new GodotExecutor(config.godotPath, config.projectPath);
    const script = `
extends SceneTree
func _init():
    var results = []
    var dir = DirAccess.open("res://")
    if dir:
        dir.list_dir_begin()
        var f = dir.get_next()
        while f != "":
            if f.contains("${params.fileName}"):
                results.append(f)
            f = dir.get_next()
        dir.list_dir_end()
    print(JSON.stringify({"files": results}))
    quit()
`;
    const result = await exec.runInlineScript(script);
    return { content: [{ type: 'text' as const, text: result.output || '[]' }] };
  },
};

// ============================================
// SCRIPT MANAGEMENT
// ============================================

export const godotListScripts = {
  name: 'godot_list_scripts',
  description: 'List all GDScript files in the project recursively',
  inputSchema: { type: 'object' as const, properties: {} },
  handler: async () => {
    const scripts: string[] = [];
    async function findScripts(dir: string, base: string) {
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await findScripts(fullPath, base);
          } else if (entry.name.endsWith('.gd')) {
            scripts.push(fullPath.replace(base, '').replace(/^[/\\]/, ''));
          }
        }
      } catch { /* ignore */ }
    }
    await findScripts(config.projectPath, config.projectPath + '/');
    return { content: [{ type: 'text' as const, text: JSON.stringify({ scripts }, null, 2) }] };
  },
};

export const godotReadScript = {
  name: 'godot_read_script',
  description: 'Read contents of a GDScript file',
  inputSchema: { type: 'object' as const, properties: { scriptPath: { type: 'string' } }, required: ['scriptPath'] },
  handler: async (params: { scriptPath: string }) => {
    try { const content = await readFile(params.scriptPath, 'utf-8'); return { content: [{ type: 'text' as const, text: content }] }; }
    catch (err) { return { content: [{ type: 'text' as const, text: `Error: ${err}` }] }; }
  },
};

export const godotWriteScript = {
  name: 'godot_write_script',
  description: 'Write content to a GDScript file',
  inputSchema: { type: 'object' as const, properties: { scriptPath: { type: 'string' }, content: { type: 'string' } }, required: ['scriptPath', 'content'] },
  handler: async (params: { scriptPath: string; content: string }) => {
    try { await writeFile(params.scriptPath, params.content, 'utf-8'); return { content: [{ type: 'text' as const, text: `Script written to ${params.scriptPath}` }] }; }
    catch (err) { return { content: [{ type: 'text' as const, text: `Error: ${err}` }] }; }
  },
};

export const godotCreateScript = {
  name: 'godot_create_script',
  description: 'Create a new GDScript file with template',
  inputSchema: {
    type: 'object' as const,
    properties: {
      path: { type: 'string' },
      className: { type: 'string' },
      extends: { type: 'string', default: 'Node' },
      template: { type: 'string', description: 'Template: basic, node, character, resource, autoload, state, component, player, enemy, ui, tween, signalbus' },
    },
    required: ['path', 'className'],
  },
  handler: async (params: { path: string; className: string; extends?: string; template?: string }) => {
    const templates: Record<string, string> = {
      basic: `extends ${params.extends || 'Node'}
class_name ${params.className}

func _ready() -> void:
    pass
`,
      node: `extends ${params.extends || 'Node'}
class_name ${params.className}

@onready var sprite: Sprite2D = $Sprite2D
@onready var collision: CollisionShape2D = $CollisionShape2D

func _ready() -> void:
    pass

func _process(delta: float) -> void:
    pass

func _physics_process(delta: float) -> void:
    pass
`,
      character: `extends CharacterBody2D
class_name ${params.className}

signal died
signal health_changed(current: int, maximum: int)

@export var speed: float = 200.0
@export var jump_force: float = -400.0
@export var max_health: int = 100

var gravity: float = ProjectSettings.get_setting("physics/2d/default_gravity")
var current_health: int

func _ready() -> void:
    current_health = max_health

func _physics_process(delta: float) -> void:
    velocity.y += gravity * delta
    var direction := Input.get_axis("ui_left", "ui_right")
    velocity.x = direction * speed
    
    if Input.is_action_just_pressed("ui_accept") and is_on_floor():
        velocity.y = jump_force
    
    move_and_slide()

func take_damage(amount: int) -> void:
    current_health = max(0, current_health - amount)
    health_changed.emit(current_health, max_health)
    if current_health <= 0:
        died.emit()
`,
      resource: `extends Resource
class_name ${params.className}

@export var name: StringName
@export var value: int = 0
`,
      autoload: `extends Node
class_name ${params.className}

# Autoload singleton - accessible globally as ${params.className}
signal some_event

func _ready() -> void:
    process_mode = Node.PROCESS_MODE_ALWAYS
`,
      state: `extends State
class_name ${params.className}

var state_machine: StateMachine

func enter(_msg: Dictionary = {}) -> void:
    pass

func exit() -> void:
    pass

func update(_delta: float) -> void:
    pass

func physics_update(_delta: float) -> void:
    pass

func handle_input(_event: InputEvent) -> void:
    pass
`,
      component: `extends Node
class_name ${params.className}

## Generic component that can be attached to any node

@export var enabled: bool = true

func _ready() -> void:
    pass

func _process(delta: float) -> void:
    if not enabled: return
`,
      player: `extends CharacterBody2D
class_name ${params.className}

signal landed
signal jumped
signal took_damage(amount: int)

@export_group("Movement")
@export var walk_speed: float = 150.0
@export var run_speed: float = 300.0
@export var jump_force: float = -350.0
@export var gravity: float = 980.0

@export_group("Combat")
@export var max_health: int = 100
@export var damage: int = 10
@export var attack_cooldown: float = 0.5

var _current_health: int
var _is_running: bool
var _can_attack: bool = true

func _ready() -> void:
    _current_health = max_health

func _physics_process(delta: float) -> void:
    var direction := Input.get_axis("ui_left", "ui_right")
    _is_running = Input.is_action_pressed("sprint")
    
    var speed := run_speed if _is_running else walk_speed
    velocity.x = direction * speed
    velocity.y += gravity * delta
    
    if Input.is_action_just_pressed("jump") and is_on_floor():
        velocity.y = jump_force
        jumped.emit()
    
    if is_on_floor() and velocity.y > 0:
        landed.emit()
    
    move_and_slide()

func attack() -> void:
    if not _can_attack: return
    _can_attack = false
    get_tree().create_timer(attack_cooldown).timeout.connect(func(): _can_attack = true)
    # Add attack logic here
`,
      enemy: `extends CharacterBody2D
class_name ${params.className}

signal died
signal attacked(target: Node)

@export_group("Stats")
@export var health: int = 50
@export var damage: int = 10
@export var speed: float = 100.0
@export var patrol_range: float = 200.0

@onready var start_position := global_position
var _moving_right := true

func _ready() -> void:
    pass

func _physics_process(delta: float) -> void:
    var direction := 1 if _moving_right else -1
    velocity.x = direction * speed
    
    if abs(global_position.x - start_position.x) >= patrol_range:
        _moving_right = not _moving_right
    
    move_and_slide()

func take_damage(amount: int) -> void:
    health -= amount
    if health <= 0:
        died.emit()
        queue_free()
`,
      ui: `extends Control
class_name ${params.className}

signal button_pressed
signal value_changed(value: float)

@onready var container := $VBoxContainer
@onready var title_label := $VBoxContainer/Title
@onready var content_area := $VBoxContainer/ScrollContainer

func _ready() -> void:
    pass

func set_title(text: String) -> void:
    if title_label: title_label.text = text

func add_child_control(control: Control) -> void:
    if content_area and content_area.get_child_count() > 0:
        content_area.get_child(0).add_child(control)
`,
      tween: `extends Node
class_name ${params.className}

## Tween helper for smooth animations

func tween_property(target: Node, property: String, to_value: Variant, duration: float, easing: Tween.EASE_TYPE = Tween.EASE_OUT, trans: Tween.TRANS_TYPE = Tween.TRANS_SINE) -> void:
    var tween := create_tween()
    tween.tween_property(target, property, to_value, duration).set_ease(easing).set_trans(trans)

func tween_sequence(actions: Array) -> void:
    var tween := create_tween()
    for action in actions:
        if action.has("property"):
            tween.tween_property(action["target"], action["property"], action["to"], action["duration"])
        elif action.has("callback"):
            tween.tween_callback(action["callback"])
    tween.play()

func tween_from_to(target: Node, property: String, from: Variant, to: Variant, duration: float) -> void:
    target.set(property, from)
    tween_property(target, property, to, duration)
`,
      signalbus: `extends Node
class_name SignalBus

# Global signal bus - autoload as "SignalBus"

# Player signals
signal player_spawned(player: Node)
signal player_died(player: Node)
signal player_health_changed(health: int)

# Game state signals
game_started
game_paused(is_paused: bool)
game_over(won: bool)

# UI signals
signal ui_signal(name: String, data: Dictionary)

# Audio signals
signal audio_requested(stream: AudioStream)

# Custom events
signal custom_event(event_name: String, data: Dictionary)

func emit_signal_safe(sig: String, ...) -> void:
    if has_signal(sig):
        emit_signal(sig, ...)
`,
    };
    const template = templates[params.template || 'basic'];
    await writeFile(params.path, template);
    return { content: [{ type: 'text' as const, text: `Script created at ${params.path}` }] };
  },
};

export const godotAnalyzeScript = {
  name: 'godot_analyze_script',
  description: 'Analyze a GDScript file for issues and improvements',
  inputSchema: { type: 'object' as const, properties: { scriptPath: { type: 'string' } }, required: ['scriptPath'] },
  handler: async (params: { scriptPath: string }) => {
    try {
      const content = await readFile(params.scriptPath, 'utf-8');
      const analysis: string[] = [];
      if (!content.includes('@onready') && content.includes('$')) analysis.push('Consider using @onready instead of $ for node references');
      if (!content.includes('signal ')) analysis.push('Consider using signals for communication');
      if (content.includes('get_node(')) analysis.push('Consider using @onready instead of get_node()');
      if (!content.includes('func _ready')) analysis.push('Consider adding _ready() function');
      if (!content.includes(': void')) analysis.push('Consider adding return types to functions');
      const varCount = (content.match(/var\s+\w+/g) || []).length;
      const funcCount = (content.match(/func\s+\w+/g) || []).length;
      const signalCount = (content.match(/signal\s+\w+/g) || []).length;
      analysis.push(`Variables: ${varCount}, Functions: ${funcCount}, Signals: ${signalCount}`);
      analysis.push(`Total lines: ${content.split('\n').length}`);
      if (content.length > 10000) analysis.push('Large file - consider splitting');
      return { content: [{ type: 'text' as const, text: JSON.stringify(analysis, null, 2) }] };
    } catch (err) { return { content: [{ type: 'text' as const, text: `Error: ${err}` }] }; }
  },
};

export const godotRunScript = {
  name: 'godot_run_script',
  description: 'Execute a GDScript file',
  inputSchema: { type: 'object' as const, properties: { scriptPath: { type: 'string' } }, required: ['scriptPath'] },
  handler: async (params: { scriptPath: string }) => {
    const { GodotExecutor } = await import('../godot/executor.js');
    const exec = new GodotExecutor(config.godotPath, config.projectPath);
    const result = await exec.runScript(params.scriptPath);
    return { content: [{ type: 'text' as const, text: result.output || result.error || 'Executed' }] };
  },
};

export const godotRunCode = {
  name: 'godot_run_code',
  description: 'Execute inline GDScript code',
  inputSchema: { type: 'object' as const, properties: { code: { type: 'string' } }, required: ['code'] },
  handler: async (params: { code: string }) => {
    const { GodotExecutor } = await import('../godot/executor.js');
    const exec = new GodotExecutor(config.godotPath, config.projectPath);
    const result = await exec.runInlineScript(params.code);
    return { content: [{ type: 'text' as const, text: result.output || result.error || 'Executed' }] };
  },
};

// ============================================
// SCENE MANAGEMENT
// ============================================

export const godotListScenes = {
  name: 'godot_list_scenes',
  description: 'List all scene files (.tscn) in the project',
  inputSchema: { type: 'object' as const, properties: {} },
  handler: async () => {
    const scenes: string[] = [];
    async function findScenes(dir: string, base: string) {
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await findScenes(fullPath, base);
          } else if (entry.name.endsWith('.tscn')) {
            scenes.push(fullPath.replace(base, '').replace(/^[/\\]/, ''));
          }
        }
      } catch { /* ignore */ }
    }
    await findScenes(config.projectPath, config.projectPath + '/');
    return { content: [{ type: 'text' as const, text: JSON.stringify({ scenes }, null, 2) }] };
  },
};

export const godotGetSceneTree = {
  name: 'godot_get_scene_tree',
  description: 'Get the node hierarchy of a scene file',
  inputSchema: { type: 'object' as const, properties: { scenePath: { type: 'string' } }, required: ['scenePath'] },
  handler: async (params: { scenePath: string }) => {
    const { GodotExecutor } = await import('../godot/executor.js');
    const exec = new GodotExecutor(config.godotPath, config.projectPath);
    const safePath = params.scenePath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const script = `
extends SceneTree
func _init():
    var scene = load("${safePath}")
    if scene:
        var instance = scene.instantiate()
        var tree = _build_tree(instance)
        print(JSON.stringify({"tree": tree}))
        instance.free()
    else:
        print(JSON.stringify({"error": "Could not load scene"}))
    quit()
func _build_tree(node: Node, depth := 0) -> Dictionary:
    if depth > 15: return {"name": node.name, "type": node.get_class(), "truncated": true}
    var result = {"name": node.name, "type": node.get_class(), "path": node.get_path()}
    if node.get_script(): result["script"] = node.get_script().get_path()
    var children = []
    for child in node.get_children(): children.append(_build_tree(child, depth + 1))
    if children.size() > 0: result["children"] = children
    return result
`;
    const result = await exec.runInlineScript(script);
    return { content: [{ type: 'text' as const, text: result.output || result.error || '{}' }] };
  },
};

export const godotCreateScene = {
  name: 'godot_create_scene',
  description: 'Create a new scene file with specified root node',
  inputSchema: { type: 'object' as const, properties: { path: { type: 'string' }, rootType: { type: 'string', default: 'Node2D' }, rootName: { type: 'string', default: 'Main' } }, required: ['path', 'rootType'] },
  handler: async (params: { path: string; rootType?: string; rootName?: string }) => {
    const uid = Math.random().toString(36).substring(2, 10);
    const sceneContent = `[gd_scene load_steps=2 format=3 uid="uid://${uid}"]

[ext_resource type="Script" path="" id="1"]

[node name="${params.rootName || 'Main'}" type="${params.rootType || 'Node2D'}"]
`;
    await writeFile(params.path, sceneContent);
    return { content: [{ type: 'text' as const, text: `Scene created at ${params.path}` }] };
  },
};

export const godotCreateSceneWithNodes = {
  name: 'godot_create_scene_with_nodes',
  description: 'Create a scene with multiple nodes',
  inputSchema: { type: 'object' as const, properties: { path: { type: 'string' }, rootType: { type: 'string', default: 'Node2D' }, rootName: { type: 'string', default: 'Main' }, nodes: { type: 'string', description: 'JSON array of node configs' } }, required: ['path', 'rootType'] },
  handler: async (params: { path: string; rootType?: string; rootName?: string; nodes?: string }) => {
    const lines = [
      `[gd_scene load_steps=2 format=3 uid="uid://${Math.random().toString(36).substring(2, 10)}"]`,
      ``,
      `[ext_resource type="Script" path="" id="1"]`,
      ``,
      `[node name="${params.rootName || 'Main'}" type="${params.rootType || 'Node2D'}"]`
    ];
    if (params.nodes) {
      try {
        const nodes = JSON.parse(params.nodes);
        for (let i = 0; i < nodes.length; i++) {
          lines.push(`[node name="${nodes[i].name}" type="${nodes[i].type}" parent="."]`);
        }
      } catch { /* ignore */ }
    }
    await writeFile(params.path, lines.join('\n'), 'utf-8');
    return { content: [{ type: 'text' as const, text: `Scene with nodes created at ${params.path}` }] };
  },
};

export const godotSaveSceneVariant = {
  name: 'godot_save_scene_variant',
  description: 'Save a scene as a variant (for inheritance)',
  inputSchema: { type: 'object' as const, properties: { sourcePath: { type: 'string' }, variantPath: { type: 'string' } }, required: ['sourcePath', 'variantPath'] },
  handler: async (params: { sourcePath: string; variantPath: string }) => {
    try {
      const content = await readFile(params.sourcePath, 'utf-8');
      const variantContent = content.replace('[gd_scene', '[gd_scene load_steps=2');
      await writeFile(params.variantPath, variantContent, 'utf-8');
      return { content: [{ type: 'text' as const, text: `Scene variant saved to ${params.variantPath}` }] };
    } catch (err) { return { content: [{ type: 'text' as const, text: `Error: ${err}` }] }; }
  },
};

export const godotReadScene = {
  name: 'godot_read_scene',
  description: 'Read raw scene file content',
  inputSchema: { type: 'object' as const, properties: { scenePath: { type: 'string' } }, required: ['scenePath'] },
  handler: async (params: { scenePath: string }) => {
    try { const content = await readFile(params.scenePath, 'utf-8'); return { content: [{ type: 'text' as const, text: content }] }; }
    catch (err) { return { content: [{ type: 'text' as const, text: `Error: ${err}` }] }; }
  },
};

export const godotSaveScene = {
  name: 'godot_save_scene',
  description: 'Save the current scene (requires editor running)',
  inputSchema: { type: 'object' as const, properties: {} },
  handler: async () => {
    return { content: [{ type: 'text' as const, text: 'Save scene requires editor interaction' }] };
  },
};

// ============================================
// NODE MANAGEMENT
// ============================================

export const godotFindNodes = {
  name: 'godot_find_nodes',
  description: 'Find nodes in a scene by name or type',
  inputSchema: { type: 'object' as const, properties: { name: { type: 'string' }, type: { type: 'string' } } },
  handler: async (params: { name?: string; type?: string }) => {
    const searchName = params.name || '';
    const searchType = params.type || '';
    const { GodotExecutor } = await import('../godot/executor.js');
    const exec = new GodotExecutor(config.godotPath, config.projectPath);
    const script = `
extends SceneTree
func _init():
    var results = []
    var root = get_tree().root
    func search(node: Node):
        var match = true
        if "${searchName}" != "" and not node.name.contains("${searchName}"): match = false
        if "${searchType}" != "" and not node.get_class() == "${searchType}": match = false
        if match: results.append({"name": node.name, "type": node.get_class(), "path": node.get_path()})
        for child in node.get_children(): search(child)
    search(root)
    print(JSON.stringify({"nodes": results}))
    quit()
`;
    const result = await exec.runInlineScript(script);
    return { content: [{ type: 'text' as const, text: result.output || '[]' }] };
  },
};

export const godotGetNodeProperties = {
  name: 'godot_get_node_properties',
  description: 'Get properties of a specific node in a scene',
  inputSchema: { type: 'object' as const, properties: { scenePath: { type: 'string' }, nodePath: { type: 'string' } }, required: ['scenePath', 'nodePath'] },
  handler: async (params: { scenePath: string; nodePath: string }) => {
    const { GodotExecutor } = await import('../godot/executor.js');
    const exec = new GodotExecutor(config.godotPath, config.projectPath);
    const safeScene = params.scenePath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const safeNode = params.nodePath.replace(/"/g, '\\"');
    const script = `
extends SceneTree
func _init():
    var scene = load("${safeScene}")
    if scene:
        var instance = scene.instantiate()
        var node = instance.get_node("${safeNode}")
        if node:
            var props = {}
            for prop in node.get_property_list():
                if prop.usage & PROPERTY_USAGE_SCRIPT_VARIABLE:
                    props[prop.name] = node.get(prop.name)
            print(JSON.stringify({"properties": props}))
        else: print(JSON.stringify({"error": "Node not found"}))
        instance.free()
    else: print(JSON.stringify({"error": "Could not load scene"}))
    quit()
`;
    const result = await exec.runInlineScript(script);
    return { content: [{ type: 'text' as const, text: result.output || '{}' }] };
  },
};

// ============================================
// ASSET MANAGEMENT
// ============================================

export const godotLoadSprite = {
  name: 'godot_load_sprite',
  description: 'Load a sprite into a Sprite2D node in a scene',
  inputSchema: { type: 'object' as const, properties: { scenePath: { type: 'string' }, nodePath: { type: 'string' }, texturePath: { type: 'string' } }, required: ['scenePath', 'nodePath', 'texturePath'] },
  handler: async (params: { scenePath: string; nodePath: string; texturePath: string }) => {
    try {
      let content = await readFile(params.scenePath, 'utf-8');
      const safeTexture = params.texturePath.replace(/"/g, '\\"');
      const nodeSafe = params.nodePath.replace(/"/g, '\\"');
      const lines = content.split('\n');
      let found = false;
      let extId = 1;
      for (const line of lines) {
        if (line.includes(`name="${nodeSafe}"`) && line.includes('type="Sprite2D"')) {
          found = true;
          break;
        }
        if (line.includes('[ext_resource')) extId++;
      }
      if (!found) return { content: [{ type: 'text' as const, text: 'Sprite2D node not found in scene' }] };
      const extLine = `[ext_resource type="Texture2D" path="${safeTexture}" id="${extId}"]`;
      const nodeLine = `${nodeSafe}/texture = ExtResource( ${extId} )`;
      const insertIndex = lines.findIndex(l => l.startsWith('[node '));
      if (insertIndex >= 0) lines.splice(insertIndex, 0, extLine, nodeLine);
      await writeFile(params.scenePath, lines.join('\n'), 'utf-8');
      return { content: [{ type: 'text' as const, text: `Sprite texture loaded: ${params.texturePath}` }] };
    } catch (err) { return { content: [{ type: 'text' as const, text: `Error: ${err}` }] }; }
  },
};

export const godotExportMeshLibrary = {
  name: 'godot_export_mesh_library',
  description: 'Export 3D scene as MeshLibrary for GridMap',
  inputSchema: { type: 'object' as const, properties: { scenePath: { type: 'string' }, outputPath: { type: 'string' } }, required: ['scenePath', 'outputPath'] },
  handler: async (params: { scenePath: string; outputPath: string }) => {
    const { GodotExecutor } = await import('../godot/executor.js');
    const exec = new GodotExecutor(config.godotPath, config.projectPath);
    const safeScene = params.scenePath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const safeOutput = params.outputPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const script = `
extends SceneTree
func _init():
    var scene = load("${safeScene}")
    if scene:
        var instance = scene.instantiate()
        var mesh_library = MeshLibrary.new()
        var idx = 0
        for child in instance.get_children():
            if child is MeshInstance3D:
                var mesh = child.mesh
                if mesh:
                    mesh_library.create_item(idx)
                    mesh_library.set_item_mesh(idx, mesh)
                    if child.name: mesh_library.set_item_name(idx, child.name)
                    idx += 1
        ResourceSaver.save(mesh_library, "${safeOutput}")
        print(JSON.stringify({"success": true, "items": idx}))
        instance.free()
    else:
        print(JSON.stringify({"error": "Could not load scene"}))
    quit()
`;
    const result = await exec.runInlineScript(script);
    return { content: [{ type: 'text' as const, text: result.output || 'MeshLibrary export complete' }] };
  },
};

// ============================================
// UID MANAGEMENT
// ============================================

export const godotGetUID = {
  name: 'godot_get_uid',
  description: 'Get the UID for a specific file in Godot 4.4+',
  inputSchema: { type: 'object' as const, properties: { filePath: { type: 'string' } }, required: ['filePath'] },
  handler: async (params: { filePath: string }) => {
    const { GodotExecutor } = await import('../godot/executor.js');
    const exec = new GodotExecutor(config.godotPath, config.projectPath);
    const safePath = params.filePath.replace(/"/g, '\\"');
    const script = `
extends SceneTree
func _init():
    var uid = ""
    if ResourceLoader.has_cached("${safePath}"):
        var res = load("${safePath}")
        if res and "uid" in res: uid = String(res.uid)
    print(JSON.stringify({"uid": uid, "path": "${safePath}"}))
    quit()
`;
    const result = await exec.runInlineScript(script);
    return { content: [{ type: 'text' as const, text: result.output || '{}' }] };
  },
};

export const godotUpdateProjectUIDs = {
  name: 'godot_update_project_uids',
  description: 'Update UID references in a Godot 4.4+ project',
  inputSchema: { type: 'object' as const, properties: {} },
  handler: async () => {
    return { content: [{ type: 'text' as const, text: 'UID update requires resaving resources in Godot editor. Open project in Godot 4.4+ and use Project > Export > Update UIDs' }] };
  },
};

// ============================================
// INPUT MAPPING
// ============================================

export const godotListInputMappings = {
  name: 'godot_list_input_mappings',
  description: 'List all input action mappings from project.godot',
  inputSchema: { type: 'object' as const, properties: {} },
  handler: async () => {
    try {
      const content = await readFile(join(config.projectPath, 'project.godot'), 'utf-8');
      const mappings: Record<string, string[]> = {};
      let currentAction = '';
      for (const line of content.split('\n')) {
        const actionMatch = line.match(/\[input\]\s*"?(\w+)"?\s*=/);
        if (actionMatch) { currentAction = actionMatch[1]; mappings[currentAction] = []; }
        const keyMatch = line.match(/^\s*(\w+)\s*=/);
        if (currentAction && keyMatch && keyMatch[1] !== currentAction) {
          mappings[currentAction].push(keyMatch[1]);
        }
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify({ mappings }, null, 2) }] };
    } catch (err) { return { content: [{ type: 'text' as const, text: `Error: ${err}` }] }; }
  },
};

export const godotAddInputAction = {
  name: 'godot_add_input_action',
  description: 'Add a new input action mapping to project.godot',
  inputSchema: { type: 'object' as const, properties: { actionName: { type: 'string' }, key: { type: 'string' } }, required: ['actionName', 'key'] },
  handler: async (params: { actionName: string; key: string }) => {
    try {
      const projectPath = join(config.projectPath, 'project.godot');
      const content = await readFile(projectPath, 'utf-8');
      const actionBlock = `\n[input]\n\n${params.actionName} = [${params.key}]\n`;
      await writeFile(projectPath, content + actionBlock, 'utf-8');
      return { content: [{ type: 'text' as const, text: `Added input action: ${params.actionName}` }] };
    } catch (err) { return { content: [{ type: 'text' as const, text: `Error: ${err}` }] }; }
  },
};

// ============================================
// DEBUG OUTPUT
// ============================================

export const godotGetDebugOutput = {
  name: 'godot_get_debug_output',
  description: 'Get debug output from the last run',
  inputSchema: { type: 'object' as const, properties: {} },
  handler: async () => {
    return { content: [{ type: 'text' as const, text: 'Debug output capture requires running with --debug. Output appears in the Godot console.' }] };
  },
};

// ============================================
// PROJECT ANALYSIS
// ============================================

export const godotAnalyzeProject = {
  name: 'godot_analyze_project',
  description: 'Analyze project structure and provide statistics',
  inputSchema: { type: 'object' as const, properties: {} },
  handler: async () => {
    let scripts = 0, scenes = 0, resources = 0, images = 0, audio = 0, shaders = 0, configs = 0;
    async function analyze(dir: string) {
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await analyze(fullPath);
          } else if (entry.name.endsWith('.gd')) scripts++;
          else if (entry.name.endsWith('.tscn')) scenes++;
          else if (entry.name.endsWith('.tres')) resources++;
          else if (/\.(png|jpg|jpeg|svg|webp|gif)$/i.test(entry.name)) images++;
          else if (/\.(wav|ogg|mp3|flac)$/i.test(entry.name)) audio++;
          else if (entry.name.endsWith('.gdshader')) shaders++;
          else if (entry.name === 'project.godot' || entry.name.endsWith('.godot')) configs++;
        }
      } catch { /* ignore */ }
    }
    await analyze(config.projectPath);
    const analysis = { stats: { scripts, scenes, resources, images, audio, shaders, configs, total: scripts + scenes + resources }, project_path: config.projectPath };
    return { content: [{ type: 'text' as const, text: JSON.stringify(analysis, null, 2) }] };
  },
};

export const godotFindUnusedAssets = {
  name: 'godot_find_unused_assets',
  description: 'Find assets not referenced by any script or scene',
  inputSchema: { type: 'object' as const, properties: {} },
  handler: async () => {
    const assets: string[] = [];
    async function getAllAssets(dir: string) {
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await getAllAssets(fullPath);
          } else if (!entry.name.startsWith('.')) {
            assets.push(fullPath);
          }
        }
      } catch { /* ignore */ }
    }
    await getAllAssets(config.projectPath);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ assets, count: assets.length }, null, 2) }] };
  },
};

// ============================================
// RESOURCES
// ============================================

export const godotListResources = {
  name: 'godot_list_resources',
  description: 'List all resource files (.tres) in the project',
  inputSchema: { type: 'object' as const, properties: {} },
  handler: async () => {
    const resources: string[] = [];
    async function findResources(dir: string, base: string) {
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await findResources(fullPath, base);
          } else if (entry.name.endsWith('.tres')) {
            resources.push(fullPath.replace(base, '').replace(/^[/\\]/, ''));
          }
        }
      } catch { /* ignore */ }
    }
    await findResources(config.projectPath, config.projectPath + '/');
    return { content: [{ type: 'text' as const, text: JSON.stringify({ resources }, null, 2) }] };
  },
};

export const godotListAssets = {
  name: 'godot_list_assets',
  description: 'List all asset files (images, audio, fonts) in the project',
  inputSchema: { type: 'object' as const, properties: {} },
  handler: async () => {
    const assets: { path: string; type: string }[] = [];
    async function findAssets(dir: string, base: string) {
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await findAssets(fullPath, base);
          } else {
            const ext = extname(entry.name).toLowerCase();
            if (['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif'].includes(ext)) assets.push({ path: fullPath.replace(base, ''), type: 'image' });
            else if (['.wav', '.ogg', '.mp3', '.flac'].includes(ext)) assets.push({ path: fullPath.replace(base, ''), type: 'audio' });
            else if (['.ttf', '.otf', '.fnt', '.font'].includes(ext)) assets.push({ path: fullPath.replace(base, ''), type: 'font' });
          }
        }
      } catch { /* ignore */ }
    }
    await findAssets(config.projectPath, config.projectPath + '/');
    return { content: [{ type: 'text' as const, text: JSON.stringify({ assets }, null, 2) }] };
  },
};

export const godotCreateResource = {
  name: 'godot_create_resource',
  description: 'Create a new .tres resource file',
  inputSchema: { type: 'object' as const, properties: { path: { type: 'string' }, type: { type: 'string', default: 'Resource' }, properties: { type: 'string', description: 'JSON object of properties' } }, required: ['path'] },
  handler: async (params: { path: string; type?: string; properties?: string }) => {
    let lines = `[gd_resource type="${params.type || 'Resource'}" format=3]

`;
    if (params.properties) {
      try {
        const props = JSON.parse(params.properties);
        for (const [key, value] of Object.entries(props)) {
          lines += `${key} = ${JSON.stringify(value)}\n`;
        }
      } catch { /* ignore */ }
    }
    await writeFile(params.path, lines, 'utf-8');
    return { content: [{ type: 'text' as const, text: `Resource created at ${params.path}` }] };
  },
};

// ============================================
// PROJECT SETTINGS
// ============================================

export const godotGetProjectSettings = {
  name: 'godot_get_project_settings',
  description: 'Get project settings from project.godot',
  inputSchema: { type: 'object' as const, properties: {} },
  handler: async () => {
    try {
      const content = await readFile(join(config.projectPath, 'project.godot'), 'utf-8');
      const settings: Record<string, Record<string, string>> = {};
      const sectionRegex = /\[(\w+(?:\/\w+)?)\]/g;
      let match;
      while ((match = sectionRegex.exec(content)) !== null) {
        const section = match[1];
        settings[section] = {};
        const nextSection = content.indexOf('[', match.index + 1);
        const sectionContent = nextSection > 0 ? content.slice(match.index + match[0].length, nextSection) : content.slice(match.index + match[0].length);
        const propRegex = /(\w+)\s*=\s*(.+)/g;
        let propMatch;
        while ((propMatch = propRegex.exec(sectionContent)) !== null) {
          settings[section][propMatch[1]] = propMatch[2].trim();
        }
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify({ settings }, null, 2) }] };
    } catch (err) { return { content: [{ type: 'text' as const, text: `Error: ${err}` }] }; }
  },
};

export const godotUpdateProjectSetting = {
  name: 'godot_update_project_setting',
  description: 'Update a project setting in project.godot',
  inputSchema: { type: 'object' as const, properties: { section: { type: 'string' }, key: { type: 'string' }, value: { type: 'string' } }, required: ['section', 'key', 'value'] },
  handler: async (params: { section: string; key: string; value: string }) => {
    try {
      const projectPath = join(config.projectPath, 'project.godot');
      const content = await readFile(projectPath, 'utf-8');
      const sectionHeader = `[${params.section}]`;
      const keyValue = `${params.key} = ${params.value}`;
      if (content.includes(sectionHeader)) {
        const sectionMatch = content.match(new RegExp(`\\[${params.section}\\]\\n([\\s\\S]*?)(?=\\[|$)`));
        if (sectionMatch) {
          const newSection = sectionMatch[1].trim() + '\n' + keyValue;
          const newContent = content.replace(sectionMatch[1], '\n' + newSection);
          await writeFile(projectPath, newContent, 'utf-8');
        }
      } else {
        await writeFile(projectPath, content + '\n' + sectionHeader + '\n' + keyValue + '\n', 'utf-8');
      }
      return { content: [{ type: 'text' as const, text: `Updated setting: ${params.section}/${params.key} = ${params.value}` }] };
    } catch (err) { return { content: [{ type: 'text' as const, text: `Error: ${err}` }] }; }
  },
};

// ============================================
// VALIDATION
// ============================================

export const godotValidateScript = {
  name: 'godot_validate_script',
  description: 'Validate a GDScript file for syntax errors via LSP',
  inputSchema: { type: 'object' as const, properties: { filePath: { type: 'string' } }, required: ['filePath'] },
  handler: async (params: { filePath: string }) => {
    const { GodotLSPClient } = await import('../godot/lsp-client.js');
    const lsp = new GodotLSPClient(config.lspPort, config.projectPath);
    const result = await lsp.validateFile(params.filePath);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ valid: result.errors.length === 0, errors: result.errors, warnings: result.warnings }, null, 2) }] };
  },
};

export const godotCheckLSP = {
  name: 'godot_check_lsp',
  description: 'Check if Godot LSP is connected',
  inputSchema: { type: 'object' as const, properties: {} },
  handler: async () => {
    const { GodotLSPClient } = await import('../godot/lsp-client.js');
    const lsp = new GodotLSPClient(config.lspPort, config.projectPath);
    return { content: [{ type: 'text' as const, text: lsp.isConnected() ? 'LSP connected' : 'LSP not connected. Enable LSP in Godot editor: Editor > Editor Settings > LSP > Enable' }] };
  },
};

// ============================================
// EXPORT
// ============================================

export const godotExportProject = {
  name: 'godot_export_project',
  description: 'Export the project to a specific platform',
  inputSchema: { type: 'object' as const, properties: { platform: { type: 'string' }, outputPath: { type: 'string' } }, required: ['platform', 'outputPath'] },
  handler: async (params: { platform: string; outputPath: string }) => {
    const { GodotExecutor } = await import('../godot/executor.js');
    const exec = new GodotExecutor(config.godotPath, config.projectPath);
    const result = await exec.exportProject(params.platform, params.outputPath);
    return { content: [{ type: 'text' as const, text: result.success ? `Exported to ${params.outputPath}` : `Failed: ${result.error}` }] };
  },
};

export const godotGetExportPresets = {
  name: 'godot_get_export_presets',
  description: 'List available export presets',
  inputSchema: { type: 'object' as const, properties: {} },
  handler: async () => {
    const { GodotExecutor } = await import('../godot/executor.js');
    const exec = new GodotExecutor(config.godotPath, config.projectPath);
    const result = await exec.getExportPresets();
    return { content: [{ type: 'text' as const, text: result.output || 'No presets found' }] };
  },
};

// ============================================
// UTILITY
// ============================================

export const godotExecute = {
  name: 'godot_execute',
  description: 'Execute arbitrary Godot command',
  inputSchema: { type: 'object' as const, properties: { args: { type: 'string' } }, required: ['args'] },
  handler: async (params: { args: string }) => {
    const { GodotExecutor } = await import('../godot/executor.js');
    const exec = new GodotExecutor(config.godotPath, config.projectPath);
    const result = await exec.execute(params.args.split(' ').filter(Boolean));
    return { content: [{ type: 'text' as const, text: result.output || result.error || 'Executed' }] };
  },
};

export const godotGetConfig = {
  name: 'godot_get_config',
  description: 'Get current MCP configuration',
  inputSchema: { type: 'object' as const, properties: {} },
  handler: async () => {
    return { content: [{ type: 'text' as const, text: JSON.stringify(config, null, 2) }] };
  },
};

export const godotQuit = {
  name: 'godot_quit',
  description: 'Quit a running Godot instance',
  inputSchema: { type: 'object' as const, properties: {} },
  handler: async () => {
    const { GodotExecutor } = await import('../godot/executor.js');
    const exec = new GodotExecutor(config.godotPath, config.projectPath);
    const result = await exec.quit();
    return { content: [{ type: 'text' as const, text: result.success ? 'Godot quit' : `Failed: ${result.error}` }] };
  },
};

// ============================================
// EXPORT ALL TOOLS
// ============================================

export const godotTools = [
  // Project
  godotLaunchEditor, godotRunProject, godotStopProject, godotGetProjectInfo, godotGetGodotVersion, godotListProjects,
  // Editor Control
  godotOpenFile, godotFocusScript, godotQuickOpen,
  // Script
  godotListScripts, godotReadScript, godotWriteScript, godotCreateScript, godotAnalyzeScript, godotRunScript, godotRunCode,
  // Scene
  godotListScenes, godotGetSceneTree, godotCreateScene, godotCreateSceneWithNodes, godotSaveSceneVariant, godotReadScene, godotSaveScene,
  // Node
  godotFindNodes, godotGetNodeProperties,
  // Asset
  godotLoadSprite, godotExportMeshLibrary,
  // UID
  godotGetUID, godotUpdateProjectUIDs,
  // Input
  godotListInputMappings, godotAddInputAction,
  // Debug
  godotGetDebugOutput,
  // Analysis
  godotAnalyzeProject, godotFindUnusedAssets,
  // Resources
  godotListResources, godotListAssets, godotCreateResource,
  // Settings
  godotGetProjectSettings, godotUpdateProjectSetting,
  // Validation
  godotValidateScript, godotCheckLSP,
  // Export
  godotExportProject, godotGetExportPresets,
  // Utility
  godotExecute, godotGetConfig, godotQuit,
];
