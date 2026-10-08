import type { CallStatus, StatsSample } from './types';
import {
  createWaitUntilConnected,
  type WaitUntilConnectedDeps,
  type WaitUntilConnectedFn,
} from './waitUntilConnected';

export type { WaitUntilConnectedDeps, WaitUntilConnectedFn };
export { createWaitUntilConnected };

export type AutomationDebug = {
  identity: string;
  roomName: string;
  remoteCount: number;
  status: CallStatus;
  mode: 'sfu';
};

export type AutomationGetters = {
  getReady: () => boolean;
  getStats: () => Promise<StatsSample>;
  getDebug: () => AutomationDebug;
  getJoinTimeMs: () => number | null;
  waitUntilConnected: WaitUntilConnectedFn;
  leave: () => Promise<void>;
};

const READY_KEY = '__webrtcReady';

function defineReadyGetter(getReady: () => boolean) {
  try {
    delete (window as Window & { [READY_KEY]?: boolean })[READY_KEY];
  } catch {
    // ignore
  }
  Object.defineProperty(window, READY_KEY, {
    configurable: true,
    enumerable: true,
    get: () => getReady(),
  });
}

function clearReadyGetter() {
  try {
    delete (window as Window & { [READY_KEY]?: boolean })[READY_KEY];
  } catch {
    // ignore
  }
}

/** Install Puppeteer-facing hooks. `__webrtcReady` stays live via getter. */
export function installAutomationApi(getters: AutomationGetters) {
  defineReadyGetter(getters.getReady);
  window.__webrtcStats = () => getters.getStats();
  window.__sfuDebug = () => getters.getDebug();
  window.__getJoinTimeMs = () => getters.getJoinTimeMs();
  window.__waitUntilConnected = (n) => getters.waitUntilConnected(n);
  window.__leave = () => getters.leave();
}

export function uninstallAutomationApi() {
  clearReadyGetter();
  delete window.__webrtcStats;
  delete window.__sfuDebug;
  delete window.__getJoinTimeMs;
  delete window.__waitUntilConnected;
  delete window.__leave;
}

export function formatBitrate(bps: number): string {
  if (!Number.isFinite(bps) || bps <= 0) return '0 kbps';
  if (bps < 1000) return `${bps.toFixed(0)} bps`;
  if (bps < 1_000_000) return `${(bps / 1000).toFixed(1)} kbps`;
  return `${(bps / 1_000_000).toFixed(2)} Mbps`;
}

/** True when automation should auto-join from the query string. */
export function shouldAutojoin(search: string): boolean {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (params.get('autojoin') !== '1') return false;
  const room = params.get('roomId') ?? params.get('roomName') ?? '';
  const peer = params.get('peerId') ?? params.get('identity') ?? '';
  return Boolean(room.trim() && peer.trim());
}
