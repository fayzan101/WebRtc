import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createWaitUntilConnected,
  installAutomationApi,
  shouldAutojoin,
  uninstallAutomationApi,
} from '../lib/automation';
import { readQueryDefaults } from '../lib/query';
import { SfuRoomSession } from '../lib/sfuRoom';
import {
  collectLiveKitStats,
  countLiveKitPcs,
  emptySnapshot,
  sampleFromSnapshots,
  type StatsSnapshot,
} from '../lib/stats';
import { fetchRoomToken } from '../lib/token';
import type { CallStatus, RemoteMedia, StatsSample } from '../lib/types';

export function useSfuRoom() {
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

  const sessionRef = useRef<SfuRoomSession | null>(null);
  const roomIdRef = useRef(roomId);
  const peerIdRef = useRef(peerId);
  const remotesRef = useRef<RemoteMedia[]>([]);
  const statusRef = useRef<CallStatus>('idle');
  const joinStartRef = useRef<number | null>(null);
  const joinTimeMsRef = useRef<number | null>(null);
  const prevStatsRef = useRef<StatsSnapshot>(emptySnapshot());
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
    statusRef.current = status;
  }, [status]);

  const cleanup = useCallback(async () => {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) {
      try {
        await session.disconnect();
      } catch {
        // ignore
      }
    }
    setLocalStream(null);
    remotesRef.current = [];
    setRemotes([]);
    setPcCount(0);
    setStats(null);
    prevStatsRef.current = emptySnapshot();
  }, []);

  const leave = useCallback(async () => {
    await cleanup();
    statusRef.current = 'idle';
    setStatus('idle');
  }, [cleanup]);

  const join = useCallback(async () => {
    setError(null);
    statusRef.current = 'joining';
    setStatus('joining');
    joinStartRef.current = performance.now();
    joinTimeMsRef.current = null;

    try {
      const rid = roomIdRef.current.trim();
      const pid = peerIdRef.current.trim();
      if (!rid || !pid) throw new Error('Room ID and Peer ID are required');

      await cleanup();

      const { token, url } = await fetchRoomToken(rid, pid);

      const session = new SfuRoomSession({
        onRemoteMedia: (map) => setRemotes([...map.values()]),
        onError: (err) => {
          setError(err.message);
          statusRef.current = 'failed';
          setStatus('failed');
        },
        onConnected: () => {
          statusRef.current = 'connected';
          setStatus('connected');
          if (joinStartRef.current != null && joinTimeMsRef.current == null) {
            joinTimeMsRef.current = performance.now() - joinStartRef.current;
          }
        },
        onDisconnected: () => {
          if (statusRef.current === 'connected') {
            statusRef.current = 'idle';
            setStatus('idle');
          }
        },
      });
      sessionRef.current = session;

      await session.connect(url, token);
      await session.publishAudio();
      if (videoEnabled) {
        await session.setVideoEnabled(true);
      }
      setLocalStream(session.getLocalStream());
      setPcCount(countLiveKitPcs(session.room));
      statusRef.current = 'connected';
      setStatus('connected');
      if (joinStartRef.current != null && joinTimeMsRef.current == null) {
        joinTimeMsRef.current = performance.now() - joinStartRef.current;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await cleanup();
      setError(message);
      statusRef.current = 'failed';
      setStatus('failed');
    }
  }, [cleanup, videoEnabled]);

  const setVideoEnabled = useCallback(async (enabled: boolean) => {
    setVideoEnabledState(enabled);
    const session = sessionRef.current;
    if (session && statusRef.current === 'connected') {
      try {
        await session.setVideoEnabled(enabled);
        setLocalStream(session.getLocalStream());
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  }, []);

  useEffect(() => {
    if (status !== 'connected') return;
    let cancelled = false;
    const tick = async () => {
      const session = sessionRef.current;
      if (!session || cancelled) return;
      const next = await collectLiveKitStats(session.room);
      const sample = sampleFromSnapshots(
        prevStatsRef.current,
        next,
        remotesRef.current.length,
        countLiveKitPcs(session.room),
      );
      prevStatsRef.current = next;
      if (!cancelled) {
        setStats(sample);
        setPcCount(countLiveKitPcs(session.room));
      }
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
        const session = sessionRef.current;
        if (!session) return 0;
        const snap = await collectLiveKitStats(session.room);
        return snap.bytesReceived;
      },
    });

    installAutomationApi({
      getReady: () => statusRef.current === 'connected',
      getStats: async () => {
        const session = sessionRef.current;
        if (!session) {
          return sampleFromSnapshots(emptySnapshot(), emptySnapshot(), 0, 0);
        }
        const next = await collectLiveKitStats(session.room);
        const sample = sampleFromSnapshots(
          prevStatsRef.current,
          next,
          remotesRef.current.length,
          countLiveKitPcs(session.room),
        );
        prevStatsRef.current = next;
        return sample;
      },
      getDebug: () => ({
        identity: peerIdRef.current,
        roomName: roomIdRef.current,
        remoteCount: remotesRef.current.length,
        status: statusRef.current,
        mode: 'sfu',
      }),
      getJoinTimeMs: () => joinTimeMsRef.current,
      waitUntilConnected,
      leave,
    });
    return () => uninstallAutomationApi();
  }, [leave]);

  useEffect(() => {
    if (shouldAutojoin(window.location.search) && !autoJoinedRef.current) {
      autoJoinedRef.current = true;
      void join();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- autojoin once on mount
  }, []);

  useEffect(
    () => () => {
      void cleanup();
    },
    [cleanup],
  );

  return {
    status,
    error,
    roomId,
    peerId,
    videoEnabled,
    setRoomId,
    setPeerId,
    setVideoEnabled: (v: boolean) => {
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
