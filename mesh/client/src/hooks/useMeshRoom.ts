import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createWaitUntilConnected,
  installAutomationApi,
  shouldAutojoin,
  uninstallAutomationApi,
} from '../lib/automation';
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
    remotesRef.current = [];
    pcCountRef.current = 0;
    setRemotes([]);
    setPcCount(0);
    setStats(null);
    prevStatsRef.current = emptySnapshot();
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
      joinStartRef.current = null;
      statusRef.current = 'idle';
      setStatus('idle');
    }
  }, [cleanupMedia]);

  const join = useCallback(async () => {
    setError(null);
    statusRef.current = 'joining';
    setStatus('joining');
    joinTimeMsRef.current = null;

    try {
      const rid = roomIdRef.current.trim();
      const pid = peerIdRef.current.trim();
      if (!rid || !pid) {
        throw new Error('Room ID and Peer ID are required');
      }

      // Leave any prior session first
      cleanupMedia();
      joinStartRef.current = performance.now();

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
          statusRef.current = 'connected';
          setStatus('connected');
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
          statusRef.current = 'failed';
          setStatus('failed');
        },
        onError: (err) => {
          setError(err.message);
          statusRef.current = 'failed';
          setStatus('failed');
        },
      });

      await signaling.connect();
      signaling.join(rid, pid);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      cleanupMedia();
      setError(message);
      statusRef.current = 'failed';
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

  // Automation API (stable Puppeteer contract — Phase 4)
  useEffect(() => {
    const waitUntilConnected = createWaitUntilConnected({
      getStatus: () => statusRef.current,
      getRemoteCount: () => remotesRef.current.length,
      getBytesReceived: async () => {
        const engine = engineRef.current;
        if (!engine) return 0;
        const snap = await collectPeerConnectionStats(engine.getPeerConnections());
        return snap.bytesReceived;
      },
    });

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
        mode: 'mesh',
      }),
      getJoinTimeMs: () => joinTimeMsRef.current,
      waitUntilConnected,
      leave,
    });
    return () => uninstallAutomationApi();
  }, [leave]);

  // Autojoin from query (requires room + peer)
  useEffect(() => {
    if (shouldAutojoin(window.location.search) && !autoJoinedRef.current) {
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
