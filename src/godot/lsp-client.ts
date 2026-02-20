/**
 * Godot MCP Server - LSP Client
 * Handles Language Server Protocol communication for GDScript validation
 */

import net from 'net';
import { GodotProcessResult, LSPDiagnostics, GDScriptError, GDScriptWarning } from '../types/index.js';
import { getConfigFromEnv } from '../utils/config.js';

const config = getConfigFromEnv();

interface LSPMessage {
  jsonrpc: string;
  id?: number;
  method?: string;
  params?: unknown;
}

export class GodotLSPClient {
  private port: number;
  private client: net.Socket | null = null;
  private messageId = 0;
  private pendingRequests = new Map<number, { resolve: (value: unknown) => void; reject: (reason: unknown) => void }>();
  private projectPath: string;

  constructor(port?: number, projectPath?: string) {
    this.port = port || config.lspPort;
    this.projectPath = projectPath || config.projectPath;
  }

  /**
   * Connect to Godot LSP server
   */
  async connect(): Promise<boolean> {
    return new Promise((resolve) => {
      this.client = new net.Socket();
      
      this.client.connect(this.port, '127.0.0.1', () => {
        // Initialize LSP
        this.sendRequest('initialize', {
          processId: process.pid,
          rootUri: this.getFileUri(this.projectPath),
          capabilities: {},
        }).then(() => {
          this.sendNotification('initialized', {});
          resolve(true);
        }).catch(() => resolve(false));
      });

      this.client.on('error', () => {
        resolve(false);
      });

      this.client.on('data', (data) => {
        this.handleMessage(data.toString());
      });
    });
  }

  /**
   * Disconnect from LSP server
   */
  disconnect(): void {
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
  }

  /**
   * Check if LSP is connected
   */
  isConnected(): boolean {
    return this.client !== null && !this.client.destroyed;
  }

  /**
   * Validate a GDScript file
   */
  async validateFile(filePath: string): Promise<{ errors: GDScriptError[]; warnings: GDScriptWarning[] }> {
    if (!this.isConnected()) {
      await this.connect();
    }

    if (!this.isConnected()) {
      return { errors: [], warnings: [] };
    }

    try {
      const result = await this.sendRequest('textDocument/publishDiagnostics', {
        uri: this.getFileUri(filePath),
      });
      
      return this.parseDiagnostics(result);
    } catch {
      return { errors: [], warnings: [] };
    }
  }

  /**
   * Get completions at a position
   */
  async getCompletions(filePath: string, line: number, column: number): Promise<unknown[]> {
    if (!this.isConnected()) {
      await this.connect();
    }

    if (!this.isConnected()) {
      return [];
    }

    try {
      const result = await this.sendRequest('textDocument/completion', {
        textDocument: { uri: this.getFileUri(filePath) },
        position: { line, character: column },
      });
      return Array.isArray(result) ? result : (result as { items?: unknown[] })?.items || [];
    } catch {
      return [];
    }
  }

  /**
   * Get hover information
   */
  async getHover(filePath: string, line: number, column: number): Promise<string | null> {
    if (!this.isConnected()) {
      await this.connect();
    }

    if (!this.isConnected()) {
      return null;
    }

    try {
      const result = await this.sendRequest('textDocument/hover', {
        textDocument: { uri: this.getFileUri(filePath) },
        position: { line, character: column },
      });
      return (result as { contents?: string })?.contents || null;
    } catch {
      return null;
    }
  }

  /**
   * Find definitions
   */
  async findDefinitions(filePath: string, line: number, column: number): Promise<unknown[]> {
    if (!this.isConnected()) {
      await this.connect();
    }

    if (!this.isConnected()) {
      return [];
    }

    try {
      const result = await this.sendRequest('textDocument/definition', {
        textDocument: { uri: this.getFileUri(filePath) },
        position: { line, character: column },
      });
      return Array.isArray(result) ? result : [result];
    } catch {
      return [];
    }
  }

  private getFileUri(filePath: string): string {
    // Convert Windows path to file URI
    return 'file:///' + filePath.replace(/\\/g, '/');
  }

  private async sendRequest(method: string, params: unknown): Promise<unknown> {
    if (!this.client) {
      throw new Error('Not connected');
    }

    const id = ++this.messageId;
    const message: LSPMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.client?.write(JSON.stringify(message) + '\n');

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 10000);
    });
  }

  private sendNotification(method: string, params: unknown): void {
    if (!this.client) return;

    const message: LSPMessage = {
      jsonrpc: '2.0',
      method,
      params,
    };

    this.client.write(JSON.stringify(message) + '\n');
  }

  private handleMessage(data: string): void {
    try {
      const messages = data.split('\n').filter(Boolean);
      
      for (const msg of messages) {
        const parsed = JSON.parse(msg) as LSPMessage;
        
        if (parsed.id && this.pendingRequests.has(parsed.id)) {
          const { resolve } = this.pendingRequests.get(parsed.id)!;
          this.pendingRequests.delete(parsed.id);
          resolve(parsed.params);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  private parseDiagnostics(params: unknown): { errors: GDScriptError[]; warnings: GDScriptWarning[] } {
    const errors: GDScriptError[] = [];
    const warnings: GDScriptWarning[] = [];
    
    const diagnostics = (params as { diagnostics?: Array<{ range: { start: { line: number; column: number }; end: { line: number; column: number } }; message: string; severity: number }> })?.diagnostics || [];
    
    for (const diag of diagnostics) {
      const entry = {
        line: diag.range.start.line + 1,
        column: diag.range.start.column + 1,
        message: diag.message,
      };
      
      // Error = 1, Warning = 2, Information = 3, Hint = 4
      if (diag.severity === 1) {
        errors.push({ ...entry, severity: 'error' });
      } else if (diag.severity === 2) {
        warnings.push({ ...entry, severity: 'warning' });
      }
    }
    
    return { errors, warnings };
  }
}

export function createLSPClient(port?: number, projectPath?: string): GodotLSPClient {
  return new GodotLSPClient(port, projectPath);
}
