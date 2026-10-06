import { spawn } from 'node:child_process';

/**
 * Starts LiveKit in dev mode via Docker when available, else livekit-server binary.
 * Full SFU client work is Phase 3; this script is the Phase 0 root `livekit` entry.
 */
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
];

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
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
