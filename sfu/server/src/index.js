import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { createRoomToken } from './token.js';
import { validateLiveKitEnv, validateTokenRequest } from './validate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

// Load repo-root .env regardless of npm workspace cwd
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

const DEFAULT_PORT = Number(process.env.SFU_PORT || 3001);

/**
 * @param {{
 *   port?: number,
 *   apiKey?: string,
 *   apiSecret?: string,
 *   livekitUrl?: string,
 *   log?: (event: Record<string, unknown>) => void,
 *   createToken?: typeof createRoomToken,
 * }} [options]
 */
export function createSfuServer(options = {}) {
  const port = options.port ?? DEFAULT_PORT;
  const log = options.log ?? ((event) => console.log(JSON.stringify(event)));
  const mint = options.createToken ?? createRoomToken;

  const envCheck = validateLiveKitEnv({
    apiKey: options.apiKey ?? process.env.LIVEKIT_API_KEY,
    apiSecret: options.apiSecret ?? process.env.LIVEKIT_API_SECRET,
    livekitUrl: options.livekitUrl ?? process.env.LIVEKIT_URL,
  });

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '32kb' }));

  app.get('/health', (_req, res) => {
    res.status(200).json({
      ok: true,
      service: 'sfu-server',
      phase: 3,
      port,
      signaling: false,
      tokenApi: true,
      livekitConfigured: envCheck.ok,
      livekitUrl: envCheck.ok ? envCheck.livekitUrl : null,
    });
  });

  app.post('/token', async (req, res) => {
    if (!envCheck.ok) {
      res.status(503).json({ error: envCheck.error });
      return;
    }

    const parsed = validateTokenRequest(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    try {
      const token = await mint({
        apiKey: envCheck.apiKey,
        apiSecret: envCheck.apiSecret,
        roomName: parsed.roomName,
        identity: parsed.identity,
      });

      log({
        msg: 'token-issued',
        roomName: parsed.roomName,
        identity: parsed.identity,
      });

      res.status(200).json({
        token,
        url: envCheck.livekitUrl,
        roomName: parsed.roomName,
        identity: parsed.identity,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log({ msg: 'token-failed', error: message });
      res.status(500).json({ error: message });
    }
  });

  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));

  app.get('/', (_req, res) => {
    res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>SFU Token Server</title></head>
<body>
  <h1>SFU token server</h1>
  <p>Phase 3 — POST /token · GET /health</p>
  <p>React client: <code>npm run sfu:client</code></p>
</body>
</html>`);
  });

  const server = http.createServer(app);

  return {
    app,
    server,
    envCheck,
    start() {
      return new Promise((resolve, reject) => {
        server.once('error', (err) => {
          if (err && err.code === 'EADDRINUSE') {
            reject(
              new Error(
                `Port ${port} is already in use. Stop the other process or set SFU_PORT to a free port.`,
              ),
            );
            return;
          }
          reject(err);
        });
        server.listen(port, () => {
          const address = server.address();
          const bound = typeof address === 'object' && address ? address.port : port;
          log({
            msg: 'sfu-server listening',
            port: bound,
            phase: 3,
            livekitConfigured: envCheck.ok,
          });
          resolve({ port: bound });
        });
      });
    },
    stop() {
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    const sfu = createSfuServer();
    if (!sfu.envCheck.ok) {
      console.warn(JSON.stringify({ msg: 'env-warning', error: sfu.envCheck.error }));
      console.warn(
        'Copy .env.example to .env (LiveKit --dev defaults: LIVEKIT_API_KEY=devkey, LIVEKIT_API_SECRET=secret).',
      );
    }
    await sfu.start();
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
