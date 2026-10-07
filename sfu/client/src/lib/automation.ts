import type { CallStatus, StatsSample } from './types';

export type AutomationGetters = {
  getReady: () => boolean;
  getStats: () => Promise<StatsSample>;
  getDebug: () => {
    identity: string;
    roomName: string;
    remoteCount: number;
    status: CallStatus;
  };
  getJoinTimeMs: () => number | null;
  waitUntilConnected: (nMinus1: number) => Promise<void>;
  leave: () => Promise<void>;
};

export function installAutomationApi(getters: AutomationGetters) {
  window.__webrtcReady = getters.getReady();
  window.__webrtcStats = () => getters.getStats();
  window.__sfuDebug = () => getters.getDebug();
  window.__getJoinTimeMs = () => getters.getJoinTimeMs();
  window.__waitUntilConnected = (n) => getters.waitUntilConnected(n);
  window.__leave = () => getters.leave();
}

export function uninstallAutomationApi() {
  delete window.__webrtcReady;
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
