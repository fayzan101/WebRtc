import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { WebSocketServer } from 'ws';
import { RoomRegistry } from './rooms.js';
import { attachSignaling } from './signaling.js';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = Number(process.env.MESH_PORT || 3000);
const DEFAULT_HEARTBEAT_MS = Number(process.env.MESH_HEARTBEAT_MS || 30_000);

/**
 * @param {{
 *   port?: number,
 *   heartbeatMs?: number,
 *   rooms?: RoomRegistry,
 *   log?: (event: Record<string, unknown>) => void,
 * }} [options]
 */
export function createMeshServer(options = {}) {
  const port = options.port ?? DEFAULT_PORT;
  const heartbeatMs = options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;
  const registry = options.rooms ?? new RoomRegistry();
  const log = options.log ?? ((event) => console.log(JSON.stringify(event)));

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({
      ok: true,
      service: 'mesh-server',
      phase: 1,
      port,
      rooms: registry.roomCount(),
      signaling: true,
    });
  });

  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));

  app.get('/', (_req, res) => {
    res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Mesh Signaling</title></head>
<body>
  <h1>Mesh signaling server</h1>
  <p>Phase 1 — WebSocket signaling on the same port as HTTP.</p>
  <p><a href="/health">/health</a></p>
  <p>React client: <code>npm run mesh:client</code></p>
</body>
</html>`);
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });
  const signaling = attachSignaling(wss, {
    rooms: registry,
    log,
    heartbeatMs,
  });

  return {
    app,
    server,
    wss,
    rooms: registry,
    signaling,
    start() {
      return new Promise((resolve) => {
        server.listen(port, () => {
          const address = server.address();
          const boundPort = typeof address === 'object' && address ? address.port : port;
          log({ msg: 'mesh-server listening', port: boundPort, phase: 1, wsPath: '/ws' });
          resolve({ port: boundPort });
        });
      });
    },
    async stop() {
      clearInterval(signaling.heartbeatInterval);
      await new Promise((resolve) => wss.close(() => resolve()));
      await new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const mesh = createMeshServer();
  await mesh.start();
}
