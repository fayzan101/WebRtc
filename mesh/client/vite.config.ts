import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(env.MESH_VITE_PORT || process.env.MESH_VITE_PORT || 5173);
  const meshPort = Number(env.MESH_PORT || process.env.MESH_PORT || 3000);

  return {
    plugins: [react()],
    server: {
      port,
      proxy: {
        '/health': `http://127.0.0.1:${meshPort}`,
        '/ws': {
          target: `ws://127.0.0.1:${meshPort}`,
          ws: true,
        },
      },
    },
  };
});
