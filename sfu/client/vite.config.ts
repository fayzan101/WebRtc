import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export default defineConfig(({ mode }) => {
  // Repo-root .env (SFU_PORT may differ when 3001 is taken by Docker/WSL)
  const env = {
    ...loadEnv(mode, repoRoot, ''),
    ...loadEnv(mode, process.cwd(), ''),
  };
  const port = Number(env.SFU_VITE_PORT || process.env.SFU_VITE_PORT || 5174);
  const sfuPort = Number(env.SFU_PORT || process.env.SFU_PORT || 3001);

  return {
    plugins: [react()],
    server: {
      port,
      proxy: {
        '/health': `http://127.0.0.1:${sfuPort}`,
        '/token': `http://127.0.0.1:${sfuPort}`,
      },
    },
  };
});
