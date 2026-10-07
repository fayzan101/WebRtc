import { spawn } from 'node:child_process';

/**
 * Starts LiveKit in dev mode via Docker when available, else livekit-server binary.
 */
// Bind 0.0.0.0 so Docker port-publish reaches the process; node-ip for host clients.
const dockerArgs = [
  'run',
  '--rm',
  '-p',
  '7880:7880',
  '-p',
  '7881:7881',
  '-p',
  '7882:7882/udp',
  'livekit/livekit-server',
  '--dev',
  '--bind',
  '0.0.0.0',
  '--node-ip',
  '127.0.0.1',
];

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('error', () => resolve(false));
    child.on('exit', (code) => resolve(code === 0));
  });
}

console.log('Starting LiveKit (--dev). Prefer Docker; falls back to livekit-server on PATH.');

const dockerOk = await run('docker', dockerArgs);
if (dockerOk) {
  process.exit(0);
}

console.warn('Docker run failed or unavailable; trying livekit-server --dev …');
const binOk = await run('livekit-server', ['--dev']);
if (!binOk) {
  console.error(
    'Could not start LiveKit. Install Docker or the livekit-server binary, then retry `npm run livekit`.',
  );
  process.exit(1);
}
