import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
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
