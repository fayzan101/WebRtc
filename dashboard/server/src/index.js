import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import {
  buildRunCatalog,
  resolveRunPath,
  resolveSummaryCsv,
} from './catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config();

const DEFAULT_PORT = Number(process.env.DASHBOARD_PORT || 5180);

/**
 * @param {{
 *   port?: number,
 *   resultsDir?: string,
 *   fixturesDir?: string,
 *   log?: (event: Record<string, unknown>) => void,
 * }} [options]
 */
export function createDashboardServer(options = {}) {
  const port = options.port ?? DEFAULT_PORT;
  const resultsDir = options.resultsDir ?? path.join(repoRoot, process.env.RESULTS_DIR || 'results');
  const fixturesDir =
    options.fixturesDir ?? path.resolve(__dirname, '../../client/public/fixtures');
  const log = options.log ?? ((event) => console.log(JSON.stringify(event)));
  const roots = { resultsDir, fixturesDir };

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.status(200).json({
      ok: true,
      service: 'dashboard-server',
      phase: 9,
      resultsDir,
      fixturesDir,
    });
  });

  app.get('/api/runs', (req, res) => {
    try {
      let runs = buildRunCatalog(roots);
      const mode = typeof req.query.mode === 'string' ? req.query.mode : '';
      const cap = typeof req.query.cap === 'string' ? req.query.cap : '';
      const nRaw = typeof req.query.n === 'string' ? Number(req.query.n) : NaN;

      if (mode === 'mesh' || mode === 'sfu') {
        runs = runs.filter((r) => r.mode === mode);
      }
      if (cap) {
        runs = runs.filter((r) => r.uplinkCap === cap);
      }
      if (Number.isInteger(nRaw) && nRaw >= 2) {
        runs = runs.filter((r) => r.n === nRaw);
      }

      const fixtureOnly = runs.length > 0 && runs.every((r) => r.source === 'fixture');
      res.status(200).json({
        runs: runs.map(({ absolutePath: _a, ...rest }) => rest),
        counts: {
          total: runs.length,
          mesh: runs.filter((r) => r.mode === 'mesh').length,
          sfu: runs.filter((r) => r.mode === 'sfu').length,
          results: runs.filter((r) => r.source === 'results').length,
          fixtures: runs.filter((r) => r.source === 'fixture').length,
        },
        fixtureOnly,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/run', (req, res) => {
    try {
      const id = typeof req.query.id === 'string' ? req.query.id : '';
      if (!id) {
        res.status(400).json({ error: 'id query param required (e.g. mesh/n2-uncapped-001.json)' });
        return;
      }
      const resolved = resolveRunPath(roots, id);
      if (!resolved) {
        res.status(404).json({ error: `run not found: ${id}` });
        return;
      }
      const raw = fs.readFileSync(resolved.absolutePath, 'utf8');
      const data = JSON.parse(raw);
      res.status(200).json({
        id: id.replace(/\\/g, '/'),
        source: resolved.source,
        data,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/summary', (_req, res) => {
    try {
      const resolved = resolveSummaryCsv(roots);
      if (!resolved) {
        res.status(404).json({ error: 'summary CSV not found' });
        return;
      }
      const csv = fs.readFileSync(resolved.absolutePath, 'utf8');
      res.status(200).json({
        source: resolved.source,
        csv,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  const server = http.createServer(app);

  return {
    app,
    server,
    roots,
    start() {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, () => {
          const address = server.address();
          const bound = typeof address === 'object' && address ? address.port : port;
          log({ msg: 'dashboard-server listening', port: bound, phase: 9 });
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
    const dash = createDashboardServer();
    await dash.start();
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
