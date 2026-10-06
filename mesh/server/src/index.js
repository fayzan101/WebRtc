import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.MESH_PORT || 3000);

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'mesh-server',
    phase: 0,
    port: PORT,
  });
});

const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));

app.get('/', (_req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Mesh Server</title></head>
<body>
  <h1>Mesh signaling server</h1>
  <p>Phase 0 health OK. React client: <code>npm run mesh:client</code></p>
  <p><a href="/health">/health</a></p>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(JSON.stringify({ msg: 'mesh-server listening', port: PORT }));
});
