import { homedir } from 'node:os';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { toolDefinitions } from './tools.mjs';
import { callControl } from './transport.mjs';

const socketPath = process.env.SWINGSTR_SOCKET || path.join(homedir(), 'Library', 'Application Support', 'Swingstr', 'control', 'bridge.sock');
const server = new McpServer({ name: 'swingstr', version: '0.1.0' });
for (const [name, tool] of Object.entries(toolDefinitions)) {
  server.registerTool(name, {
    description: tool.description,
    inputSchema: tool.schema,
    annotations: { readOnlyHint: Boolean(tool.readOnly), destructiveHint: name === 'open_swing' || name === 'update_shape', openWorldHint: false },
  }, async (args) => {
    try {
      const result = await callControl(socketPath, name, args);
      if (name === 'get_frame') {
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
