# godot_operations.gd
# Bundled GDScript operations for Godot MCP Server
# This script handles complex operations requested via MCP

extends SceneTree

# Operation types
const OP_GET_PROJECT_INFO = "get_project_info"
const OP_LIST_SCENES = "list_scenes"
const OP_LIST_SCRIPTS = "list_scripts"
const OP_GET_SCENE_TREE = "get_scene_tree"
const OP_CREATE_NODE = "create_node"
const OP_FIND_NODES = "find_nodes"

var operation_result := {}

func _init() -> void:
    # Parse command line arguments for operation
    var args := OS.get_cmdline_args()
    
    if args.size() > 0:
        # Try to find operation parameter
        for i in range(args.size()):
            if args[i] == "--mcp-operation" and i + 1 < args.size():
                var operation := args[i + 1]
                execute_operation(operation)
                quit()
                return
    
    # Default: output basic info
    operation_result = {
        "status": "ready",
        "version": Engine.get_version_info()["string"]
    }
    print(JSON.stringify(operation_result))
    quit()

func execute_operation(operation_type: String) -> void:
    var result := {}
    
    match operation_type:
        OP_GET_PROJECT_INFO:
            result = _get_project_info()
        OP_LIST_SCENES:
            result = _list_scenes()
        OP_LIST_SCRIPTS:
            result = _list_scripts()
        OP_GET_SCENE_TREE:
            result = _get_scene_tree()
        OP_CREATE_NODE:
            result = {"status": "not_implemented"}
        OP_FIND_NODES:
            result = _find_nodes()
        _:
            result = {"error": "Unknown operation: " + operation_type}
    
    print(JSON.stringify(result))

func _get_project_info() -> Dictionary:
    var project := ProjectSettings.globalize_path("res://")
    var config := ConfigFile.new()
    var project_name := "Unknown"
    
    if config.load("res://project.godot") == OK:
        project_name = config.get_value("application/config", "name", "Unknown")
    
    return {
        "project_path": project,
        "name": project_name,
        "engine_version": Engine.get_version_info()["string"]
    }

func _list_scenes() -> Dictionary:
    var scenes: Array[String] = []
    var dir := DirAccess.open("res://")
    
    if dir:
        dir.list_dir_begin()
        var file_name := dir.get_next()
        
        while file_name != "":
            if file_name.ends_with(".tscn"):
                scenes.append("res://" + file_name)
            file_name = dir.get_next()
        
        dir.list_dir_end()
    
    return {"scenes": scenes}

func _list_scripts() -> Dictionary:
    var scripts: Array[String] = []
    var dir := DirAccess.open("res://")
    
    if dir:
        dir.list_dir_begin()
        var file_name := dir.get_next()
        
        while file_name != "":
            if file_name.ends_with(".gd"):
                scripts.append("res://" + file_name)
            file_name = dir.get_next()
        
        dir.list_dir_end()
    
    return {"scripts": scripts}

func _get_scene_tree() -> Dictionary:
    # Get first .tscn file in project
    var dir := DirAccess.open("res://")
    var first_scene := ""
    
    if dir:
        dir.list_dir_begin()
        var file_name := dir.get_next()
        
        while file_name != "":
            if file_name.ends_with(".tscn"):
                first_scene = "res://" + file_name
                break
            file_name = dir.get_next()
        
        dir.list_dir_end()
    
    if first_scene.is_empty():
        return {"error": "No scene files found"}
    
    var scene := load(first_scene)
    if scene:
        var instance := scene.instantiate()
        var tree := _build_node_tree(instance)
        instance.free()
        return {"scene": first_scene, "tree": tree}
    
    return {"error": "Could not load scene"}

func _build_node_tree(node: Node, depth := 0) -> Dictionary:
    if depth > 10:
        return {"name": node.name, "type": node.get_class(), "truncated": true}
    
    var result := {
        "name": node.name,
        "type": node.get_class(),
        "path": node.get_path()
    }
    
    if node.get_script():
        result["script"] = node.get_script().get_path()
    
    var children: Array[Dictionary] = []
    for child in node.get_children():
        children.append(_build_node_tree(child, depth + 1))
    
    if children.size() > 0:
        result["children"] = children
    
    return result

func _find_nodes() -> Dictionary:
    var results: Array[Dictionary] = []
    var root := get_tree().root
    
    func _search(node: Node) -> void:
        results.append({
            "name": node.name,
            "type": node.get_class(),
            "path": node.get_path()
        })
        for child in node.get_children():
            _search(child)
    
    _search(root)
    return {"nodes": results}
