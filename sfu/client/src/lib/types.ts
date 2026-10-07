export type CallStatus = 'idle' | 'joining' | 'connected' | 'failed';

export type StatsSample = {
  ts: number;
  remoteCount: number;
  uplinkBitrateBps: number;
  downlinkBitrateBps: number;
  rttMs: number;
  jitterMs: number;
  lossRatio: number;
  bytesSent: number;
  bytesReceived: number;
  pcCount: number;
};

export type RemoteMedia = {
  peerId: string;
  stream: MediaStream;
  hasAudio: boolean;
  hasVideo: boolean;
};

declare global {
  interface Window {
    __webrtcReady?: boolean;
    __webrtcStats?: () => Promise<StatsSample>;
    __sfuDebug?: () => {
      identity: string;
      roomName: string;
      remoteCount: number;
      status: CallStatus;
    };
    __waitUntilConnected?: (nMinus1: number) => Promise<void>;
    __getJoinTimeMs?: () => number | null;
    __leave?: () => Promise<void>;
  }
}

export {};
