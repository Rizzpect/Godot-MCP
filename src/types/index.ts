/**
 * Godot Engine MCP Server - Type Definitions
 */

export interface GodotConfig {
  godotPath: string;
  projectPath: string;
  lspPort: number;
  debugMode: boolean;
}

export interface GodotProjectInfo {
  name: string;
  path: string;
  version: string;
  engineVersion: string;
}

export interface GodotScene {
  path: string;
  name: string;
  rootNode: string;
  nodeCount: number;
}

export interface GodotNode {
  name: string;
  type: string;
  path: string;
  script?: string;
  children?: GodotNode[];
}

export interface GodotProcessResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode?: number;
}

export interface GodotToolResult {
  success: boolean;
  message: string;
  data?: unknown;
  error?: string;
}

export interface GDScriptValidation {
  file: string;
  valid: boolean;
  errors: GDScriptError[];
  warnings: GDScriptWarning[];
}

export interface GDScriptError {
  line: number;
  column: number;
  message: string;
  severity: 'error';
}

export interface GDScriptWarning {
  line: number;
  column: number;
  message: string;
  severity: 'warning';
}

export interface LSPDiagnostics {
  file: string;
  diagnostics: LSPDiagnostic[];
}

export interface LSPDiagnostic {
  range: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  message: string;
  severity: number;
}

export interface SceneTreeNode {
  name: string;
  type: string;
  path: string;
  script?: string;
  properties?: Record<string, unknown>;
  children: SceneTreeNode[];
}

export type GodotVersion = '3.x' | '4.x';

export interface ExecutionOptions {
  timeout?: number;
  captureOutput?: boolean;
  workingDirectory?: string;
}
