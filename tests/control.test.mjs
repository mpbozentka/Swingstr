import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { startControlServer, callControl } from '../mcp/transport.mjs';
import { validateCommand } from '../mcp/tools.mjs';
import { shapeFromCommand, shapeToVideo } from '../src/utils/controlShapes.js';

test('video coordinates round trip through letterboxing for every supported shape', () => {
  const rect = { x: 350, y: 0, w: 600, h: 900 };
  const points = [{ x: 0.2, y: 0.1 }, { x: 0.8, y: 0.9 }, { x: 0.4, y: 0.5 }];
  for (const type of ['line', 'vline', 'rect', 'circle', 'angle', 'free']) {
    const args = { type, points: type === 'angle' || type === 'free' ? points : points.slice(0, 2) };
    const result = shapeToVideo(shapeFromCommand(args, rect, { color: '#ef4444', width: 3 }), rect);
    assert.equal(result.type, type);
    assert.equal(result.color, '#ef4444');
    if (type === 'angle') assert.deepEqual([result.p1, result.p2, result.p3], points);
    else if (type === 'free') assert.deepEqual(result.points, points);
    else {
      assert.deepEqual(result.start, points[0]);
      assert.deepEqual(result.end, type === 'vline' ? { x: 0.2, y: 0.9 } : points[1]);
    }
  }
});

test('commands reject invalid coordinates, missing arguments and arbitrary actions', () => {
  assert.throws(() => validateCommand('execute_code', {}));
  assert.throws(() => validateCommand('playback', { action: 'seek' }));
  assert.throws(() => validateCommand('playback', { action: 'speed', rate: 100 }));
  assert.throws(() => validateCommand('draw_shape', { type: 'line', points: [{ x: -1, y: 0 }, { x: 1, y: 1 }] }));
  assert.throws(() => validateCommand('draw_shape', { type: 'angle', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }));
  assert.throws(() => validateCommand('get_state', { script: 'untrusted' }));
});

test('real MCP stdio client discovers tools and calls the private socket; invalid commands never dispatch', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'swingstr-control-'));
  const socketPath = path.join(directory, 'control.sock');
  const calls = [];
  const server = await startControlServer(socketPath, async (name, args) => {
    calls.push({ name, args });
    return { playing: false, time: 1.25 };
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  assert.equal((await stat(socketPath)).mode & 0o777, 0o600);
  const client = new Client({ name: 'swingstr-test', version: '1' });
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve('mcp/server.mjs')],
    env: { ...process.env, SWINGSTR_SOCKET: socketPath },
  }));
  t.after(() => client.close());
  assert.deepEqual((await client.listTools()).tools.map((tool) => tool.name).sort(), ['get_state', 'get_frame', 'list_swings', 'open_swing', 'playback', 'select_tool', 'set_style', 'configure_view', 'draw_shape', 'update_shape', 'set_marker', 'remove_marker', 'seek_position', 'set_segment', 'clear_segment', 'configure_comparison', 'remove_drawing', 'start_export', 'get_export_status', 'cancel_export'].sort());
  const response = await client.callTool({ name: 'get_state', arguments: {} });
  assert.deepEqual(JSON.parse(response.content[0].text), { playing: false, time: 1.25 });
  await assert.rejects(callControl(socketPath, 'draw_shape', { type: 'line', points: [] }));
  await assert.rejects(callControl(socketPath, 'save_students', {}));
  assert.equal(calls.length, 1);
  await assert.rejects(startControlServer(socketPath, () => {}), /already running/);
});
