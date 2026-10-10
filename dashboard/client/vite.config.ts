import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export default defineConfig(({ mode }) => {
  const env = {
    ...loadEnv(mode, repoRoot, ''),
    ...loadEnv(mode, process.cwd(), ''),
  };
  const port = Number(env.DASHBOARD_VITE_PORT || process.env.DASHBOARD_VITE_PORT || 5181);
  const apiPort = Number(env.DASHBOARD_PORT || process.env.DASHBOARD_PORT || 5180);

  return {
    plugins: [react()],
    server: {
      port,
      proxy: {
        '/api': `http://127.0.0.1:${apiPort}`,
      },
    },
  };
});
