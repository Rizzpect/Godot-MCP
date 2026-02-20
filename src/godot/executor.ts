/**
 * Godot MCP Server - Command Executor
 * Handles executing Godot commands and scripts
 */

import { spawn, type ChildProcess } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { GodotProcessResult, ExecutionOptions } from '../types/index.js';
import { getConfigFromEnv } from '../utils/config.js';

const config = getConfigFromEnv();

export class GodotExecutor {
  private godotPath: string;
  private projectPath: string;
  private currentProcess: ChildProcess | null = null;

  constructor(godotPath?: string, projectPath?: string) {
    this.godotPath = godotPath || config.godotPath;
    this.projectPath = projectPath || config.projectPath;
  }

  /**
   * Execute a Godot command with arguments
   */
  async execute(
    args: string[],
    options: ExecutionOptions = {}
  ): Promise<GodotProcessResult> {
    const { timeout = 30000, captureOutput = true, workingDirectory = this.projectPath } = options;

    return new Promise((resolve) => {
      const childProcess = spawn(this.godotPath, args, {
        cwd: workingDirectory,
        shell: true,
        env: { ...process.env, GODOT_PATH: this.godotPath },
      });

      let output = '';
      let errorOutput = '';

      if (captureOutput) {
        childProcess.stdout?.on('data', (data: Buffer) => {
          output += data.toString();
        });

        childProcess.stderr?.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });
      }

      const timeoutId = setTimeout(() => {
        childProcess.kill('SIGTERM');
        resolve({
          success: false,
          output,
          error: 'Process timed out',
          exitCode: -1,
        });
      }, timeout);

      childProcess.on('close', (code) => {
        clearTimeout(timeoutId);
        resolve({
          success: code === 0,
          output,
          error: errorOutput || undefined,
          exitCode: code ?? undefined,
        });
      });

      childProcess.on('error', (err: Error) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          output: '',
          error: err.message,
          exitCode: -1,
        });
      });
    });
  }

  /**
   * Launch Godot editor
   */
  async launchEditor(): Promise<GodotProcessResult> {
    return this.execute([
      '--path', this.projectPath,
      '-e',
    ]);
  }

  /**
   * Run the current project
   */
  async runProject(): Promise<GodotProcessResult> {
    return this.execute([
      '--path', this.projectPath,
    ]);
  }

  /**
   * Get project information
   */
  async getProjectInfo(): Promise<GodotProcessResult> {
    return this.execute([
      '--path', this.projectPath,
      '--headless',
      '--script', join(__dirname, 'get_project_info.gd'),
    ]);
  }

  /**
   * Execute a GDScript file
   */
  async runScript(scriptPath: string): Promise<GodotProcessResult> {
    return this.execute([
      '--path', this.projectPath,
      '--headless',
      '--script', scriptPath,
    ]);
  }

  /**
   * Execute inline GDScript code by writing to a temp file
   */
  async runInlineScript(code: string): Promise<GodotProcessResult> {
    const tempFile = join(tmpdir(), `godot_mcp_${randomUUID()}.gd`);
    
    try {
      await writeFile(tempFile, code, 'utf-8');
      const result = await this.runScript(tempFile);
      await unlink(tempFile);
      return result;
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        exitCode: -1,
      };
    }
  }

  /**
   * Export project to a platform
   */
  async exportProject(platform: string, outputPath: string): Promise<GodotProcessResult> {
    return this.execute([
      '--path', this.projectPath,
      '--headless',
      '--export-release', platform,
      outputPath,
    ]);
  }

  /**
   * Get list of available export presets
   */
  async getExportPresets(): Promise<GodotProcessResult> {
    return this.execute([
      '--path', this.projectPath,
      '--headless',
      '--export-presets',
    ]);
  }

  /**
   * Quit a running Godot instance
   */
  async quit(): Promise<GodotProcessResult> {
    return this.execute([
      '--path', this.projectPath,
      '--headless',
      '--quit',
    ]);
  }
}

export function createExecutor(godotPath?: string, projectPath?: string): GodotExecutor {
  return new GodotExecutor(godotPath, projectPath);
}
