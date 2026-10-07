import { useCallback, useEffect, useRef, useState } from 'react';
import { installAutomationApi, uninstallAutomationApi } from '../lib/automation';
import { iceServersFromSearch, MeshEngine, readQueryDefaults } from '../lib/mesh';
import { MeshSignaling } from '../lib/signaling';
import {
  collectPeerConnectionStats,
  emptySnapshot,
  sampleFromSnapshots,
  type StatsSnapshot,
} from '../lib/stats';
import type { CallStatus, RemoteMedia, StatsSample } from '../lib/types';

export type UseMeshRoomResult = {
  status: CallStatus;
  error: string | null;
  roomId: string;
  peerId: string;
  videoEnabled: boolean;
  setRoomId: (v: string) => void;
  setPeerId: (v: string) => void;
  setVideoEnabled: (v: boolean) => void;
  localStream: MediaStream | null;
  remotes: RemoteMedia[];
  pcCount: number;
  stats: StatsSample | null;
  join: () => Promise<void>;
  leave: () => Promise<void>;
  clearError: () => void;
};

export function useMeshRoom(): UseMeshRoomResult {
  const query = readQueryDefaults(window.location.search);

  const [status, setStatus] = useState<CallStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState(query.roomId || 'project23');
  const [peerId, setPeerId] = useState(query.peerId || 'p1');
  const [videoEnabled, setVideoEnabledState] = useState(query.video);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remotes, setRemotes] = useState<RemoteMedia[]>([]);
  const [pcCount, setPcCount] = useState(0);
  const [stats, setStats] = useState<StatsSample | null>(null);

  const signalingRef = useRef<MeshSignaling | null>(null);
  const engineRef = useRef<MeshEngine | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const roomIdRef = useRef(roomId);
  const peerIdRef = useRef(peerId);
  const joinStartRef = useRef<number | null>(null);
  const joinTimeMsRef = useRef<number | null>(null);
  const prevStatsRef = useRef<StatsSnapshot>(emptySnapshot());
  const remotesRef = useRef<RemoteMedia[]>([]);
  const pcCountRef = useRef(0);
  const statusRef = useRef<CallStatus>('idle');
  const autoJoinedRef = useRef(false);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);
  useEffect(() => {
    peerIdRef.current = peerId;
  }, [peerId]);
  useEffect(() => {
    remotesRef.current = remotes;
  }, [remotes]);
  useEffect(() => {
    pcCountRef.current = pcCount;
  }, [pcCount]);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const cleanupMedia = useCallback(() => {
    engineRef.current?.close();
    engineRef.current = null;
    signalingRef.current?.close();
    signalingRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLocalStream(null);
    setRemotes([]);
    setPcCount(0);
    setStats(null);
    prevStatsRef.current = emptySnapshot();
    joinStartRef.current = null;
    window.__webrtcReady = false;
  }, []);

  const leave = useCallback(async () => {
    try {
      if (signalingRef.current) {
        try {
          signalingRef.current.leave(roomIdRef.current, peerIdRef.current);
        } catch {
          // ignore
        }
      }
    } finally {
      cleanupMedia();
      setStatus('idle');
    }
  }, [cleanupMedia]);

  const join = useCallback(async () => {
    setError(null);
    setStatus('joining');
    joinStartRef.current = performance.now();
    joinTimeMsRef.current = null;

    try {
      const rid = roomIdRef.current.trim();
      const pid = peerIdRef.current.trim();
      if (!rid || !pid) {
        throw new Error('Room ID and Peer ID are required');
      }

      // Leave any prior session first
      cleanupMedia();

      const wantVideo = videoEnabled;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: wantVideo
          ? { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15 } }
          : false,
      });
      streamRef.current = stream;
      setLocalStream(stream);

      const signaling = new MeshSignaling();
      signalingRef.current = signaling;

      const engine = new MeshEngine({
        localPeerId: pid,
        roomId: rid,
        localStream: stream,
        signaling,
        iceServers: iceServersFromSearch(window.location.search),
        onRemoteMedia: (map) => setRemotes([...map.values()]),
        onPcCount: setPcCount,
        onError: (err) => setError(err.message),
      });
      engineRef.current = engine;

      signaling.setHandlers({
        onJoined: async (msg) => {
          const peers = Array.isArray(msg.payload?.peers)
            ? (msg.payload?.peers as string[])
            : [];
          await engine.handleJoined(peers);
          setStatus('connected');
          window.__webrtcReady = true;
          if (joinStartRef.current != null && joinTimeMsRef.current == null) {
            joinTimeMsRef.current = performance.now() - joinStartRef.current;
          }
        },
        onPeerJoined: async (msg) => {
          await engine.handlePeerJoined(msg.from);
        },
        onPeerLeft: (msg) => {
          engine.handlePeerLeft(msg.from);
        },
        onOffer: async (msg) => {
          await engine.handleOffer(msg);
        },
        onAnswer: async (msg) => {
          await engine.handleAnswer(msg);
        },
        onIce: async (msg) => {
          await engine.handleIce(msg);
        },
        onServerError: (msg) => {
          setError(String(msg.payload?.message ?? 'Signaling error'));
          setStatus('failed');
        },
        onError: (err) => {
          setError(err.message);
          setStatus('failed');
        },
      });

      await signaling.connect();
      signaling.join(rid, pid);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      cleanupMedia();
      setError(message);
      setStatus('failed');
    }
  }, [cleanupMedia, videoEnabled]);

  const setVideoEnabled = useCallback(
    async (enabled: boolean) => {
      setVideoEnabledState(enabled);
      if (engineRef.current && statusRef.current === 'connected') {
        try {
          await engineRef.current.setVideoEnabled(enabled);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    },
    [],
  );

  // Stats polling
  useEffect(() => {
    if (status !== 'connected') return;
    let cancelled = false;

    const tick = async () => {
      const engine = engineRef.current;
      if (!engine || cancelled) return;
      const next = await collectPeerConnectionStats(engine.getPeerConnections());
      const sample = sampleFromSnapshots(
        prevStatsRef.current,
        next,
        remotesRef.current.length,
        pcCountRef.current,
      );
      prevStatsRef.current = next;
      if (!cancelled) setStats(sample);
    };

    void tick();
    const id = window.setInterval(() => void tick(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [status]);

  // Automation API
  useEffect(() => {
    installAutomationApi({
      getReady: () => statusRef.current === 'connected',
      getStats: async () => {
        const engine = engineRef.current;
        if (!engine) {
          return sampleFromSnapshots(
            emptySnapshot(),
            emptySnapshot(),
            0,
            0,
          );
        }
        const next = await collectPeerConnectionStats(engine.getPeerConnections());
        const sample = sampleFromSnapshots(
          prevStatsRef.current,
          next,
          remotesRef.current.length,
          pcCountRef.current,
        );
        prevStatsRef.current = next;
        return sample;
      },
      getDebug: () => ({
        peerId: peerIdRef.current,
        roomId: roomIdRef.current,
        remoteCount: remotesRef.current.length,
        pcCount: pcCountRef.current,
        status: statusRef.current,
      }),
      getJoinTimeMs: () => joinTimeMsRef.current,
      waitUntilConnected: (nMinus1) =>
        new Promise((resolve, reject) => {
          const started = Date.now();
          const iv = window.setInterval(async () => {
            if (statusRef.current === 'failed') {
              window.clearInterval(iv);
              reject(new Error('call failed while waiting for remotes'));
              return;
            }
            if (
              statusRef.current === 'connected' &&
              remotesRef.current.length >= nMinus1
            ) {
              const engine = engineRef.current;
              if (engine) {
                const snap = await collectPeerConnectionStats(engine.getPeerConnections());
                if (snap.bytesReceived > 0 || nMinus1 === 0) {
                  window.clearInterval(iv);
                  resolve();
                  return;
                }
              }
            }
            if (Date.now() - started > 60_000) {
              window.clearInterval(iv);
              reject(new Error(`timeout waiting for ${nMinus1} remotes`));
            }
          }, 250);
        }),
      leave,
    });
    window.__webrtcReady = status === 'connected';
    return () => uninstallAutomationApi();
  }, [leave, status]);

  // Autojoin from query
  useEffect(() => {
    if (query.autojoin && !autoJoinedRef.current) {
      autoJoinedRef.current = true;
      void join();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- autojoin once on mount
  }, []);

  useEffect(() => () => {
    cleanupMedia();
  }, [cleanupMedia]);

  return {
    status,
    error,
    roomId,
    peerId,
    videoEnabled,
    setRoomId,
    setPeerId,
    setVideoEnabled: (v) => {
      void setVideoEnabled(v);
    },
    localStream,
    remotes,
    pcCount,
    stats,
    join,
    leave,
    clearError: () => setError(null),
  };
}
