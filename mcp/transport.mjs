import { createServer, connect } from 'node:net';
import { chmod, lstat, unlink } from 'node:fs/promises';
import { validateCommand } from './tools.mjs';

const LIMIT = 16 * 1024 * 1024;

// A Unix socket is accessible only to the current OS user. No TCP port,
// browser Origin, bearer token, or public-site endpoint is involved.
export async function startControlServer(socketPath, dispatch) {
  const existing = await lstat(socketPath).catch(() => null);
  if (existing) {
    if (!existing.isSocket() || existing.uid !== process.getuid()) throw new Error('Unexpected file at the Swingstr control socket path.');
    const live = await new Promise((resolve, reject) => {
      const probe = connect(socketPath);
      probe.once('connect', () => { probe.destroy(); resolve(true); });
      probe.once('error', (error) => {
        if (error.code === 'ECONNREFUSED') resolve(false);
        else reject(error);
      });
    });
    if (live) throw new Error('Another Swingstr control connection is already running.');
    // Only remove this app's abandoned IPC socket after a crash, never library data.
    await unlink(socketPath);
  }
  let queue = Promise.resolve();
  const server = createServer((socket) => {
    socket.setEncoding('utf8');
    let input = '';
    socket.setTimeout(20000, () => socket.destroy());
    socket.on('error', () => {});
    socket.on('data', (chunk) => {
      input += chunk.toString();
      if (input.length > LIMIT) return socket.destroy();
      const end = input.indexOf('\n');
      if (end < 0) return;
      socket.pause();
      const run = async () => {
        if (socket.destroyed) return;
        try {
          const { name, args } = JSON.parse(input.slice(0, end));
          const result = await dispatch(name, validateCommand(name, args));
          socket.end(JSON.stringify({ result }) + '\n');
        } catch (error) {
          socket.end(JSON.stringify({ error: error.message }) + '\n');
        }
      };
      queue = queue.then(run, run);
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(socketPath, resolve);
  });
  await chmod(socketPath, 0o600);
  return server;
}

export function callControl(socketPath, name, args = {}) {
  return new Promise((resolve, reject) => {
    const socket = connect(socketPath);
    socket.setEncoding('utf8');
    let input = '';
    const fail = (error) => { socket.destroy(); reject(error); };
    socket.setTimeout(20000, () => fail(new Error('Swingstr command timed out.')));
    socket.on('error', (error) => fail(new Error(`Cannot connect to Swingstr. Open the desktop app first. (${error.code})`)));
    socket.on('connect', () => socket.write(JSON.stringify({ name, args }) + '\n'));
    socket.on('data', (chunk) => {
      input += chunk.toString();
      if (input.length > LIMIT) return fail(new Error('Swingstr response too large.'));
      const end = input.indexOf('\n');
      if (end < 0) return;
      socket.destroy();
      try {
        const message = JSON.parse(input.slice(0, end));
        if (message.error) reject(new Error(message.error));
        else resolve(message.result);
      } catch (error) { reject(error); }
    });
    socket.on('end', () => { if (!input.includes('\n')) fail(new Error('Swingstr disconnected before responding.')); });
  });
}
