import { homedir } from 'node:os';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { toolDefinitions } from './tools.mjs';
import { callControl } from './transport.mjs';

const socketPath = process.env.SWINGSTR_SOCKET || path.join(homedir(), 'Library', 'Application Support', 'Swingstr', 'control', 'bridge.sock');
const server = new McpServer({ name: 'swingstr', version: '0.2.0' });
// Tools that replace drawings, checkpoints or saved data.
const DESTRUCTIVE = new Set(['open_swing', 'update_shape', 'save_annotations', 'load_annotations', 'save_template', 'apply_template']);
for (const [name, tool] of Object.entries(toolDefinitions)) {
  server.registerTool(name, {
    description: tool.description,
    inputSchema: tool.schema,
    annotations: { readOnlyHint: Boolean(tool.readOnly), destructiveHint: DESTRUCTIVE.has(name), openWorldHint: false },
  }, async (args) => {
    try {
      const result = await callControl(socketPath, name, args);
      if (typeof result?.dataUrl === 'string') {
        const { dataUrl, ...metadata } = result;
        return { content: [
          { type: 'text', text: JSON.stringify(metadata) },
          { type: 'image', mimeType: 'image/jpeg', data: dataUrl.split(',')[1] },
        ] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (error) {
      return { isError: true, content: [{ type: 'text', text: error.message }] };
    }
  });
}
await server.connect(new StdioServerTransport());
