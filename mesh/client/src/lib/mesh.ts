import { isPolitePeer, shouldCreateOffer } from './polite';
import type { MeshSignaling } from './signaling';
import type { RemoteMedia, SignalingEnvelope } from './types';

export type MeshEngineOptions = {
  localPeerId: string;
  roomId: string;
  localStream: MediaStream;
  signaling: MeshSignaling;
  iceServers?: RTCIceServer[];
  onRemoteMedia: (remotes: Map<string, RemoteMedia>) => void;
  onError?: (err: Error) => void;
  onPcCount?: (count: number) => void;
};

type PeerState = {
  pc: RTCPeerConnection;
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
  /** Serialize renegotiation so concurrent createOffer calls cannot scramble m-lines. */
  negotiateChain: Promise<void>;
  /** Stable video sender so mute/unmute uses replaceTrack instead of removeTrack. */
  videoSender: RTCRtpSender | null;
};

/**
 * Manages N−1 RTCPeerConnections with polite glare handling.
 * Offers are driven only by `onnegotiationneeded` (Perfect Negotiation).
 */
export class MeshEngine {
  private opts: MeshEngineOptions;
  private peers = new Map<string, PeerState>();
  private remotes = new Map<string, RemoteMedia>();

  constructor(opts: MeshEngineOptions) {
    this.opts = opts;
  }

  get pcCount(): number {
    return this.peers.size;
  }

  getPeerConnections(): RTCPeerConnection[] {
    return [...this.peers.values()].map((p) => p.pc);
  }

  getRemotes(): Map<string, RemoteMedia> {
    return new Map(this.remotes);
  }

  /** Call after join ack with existing peer list. */
  async handleJoined(existingPeers: string[]) {
    for (const remoteId of existingPeers) {
      await this.ensurePeer(remoteId);
      // Impolite peer's addTrack fires negotiationneeded → offer.
    }
  }

  async handlePeerJoined(remoteId: string) {
    if (remoteId === this.opts.localPeerId) return;
    await this.ensurePeer(remoteId);
  }

  handlePeerLeft(remoteId: string) {
    this.closePeer(remoteId);
  }

  async handleOffer(msg: SignalingEnvelope) {
    const remoteId = msg.from;
    const state = await this.ensurePeer(remoteId);
    const polite = isPolitePeer(this.opts.localPeerId, remoteId);
    const readyForOffer =
      !state.makingOffer &&
      (state.pc.signalingState === 'stable' || state.isSettingRemoteAnswerPending);
    const offerCollision = !readyForOffer;

    state.ignoreOffer = !polite && offerCollision;
    if (state.ignoreOffer) {
      return;
    }

    try {
      await state.pc.setRemoteDescription({
        type: 'offer',
        sdp: String(msg.payload?.sdp ?? ''),
      });
      const answer = await state.pc.createAnswer();
      await state.pc.setLocalDescription(answer);
      this.opts.signaling.send({
        type: 'answer',
        roomId: this.opts.roomId,
        from: this.opts.localPeerId,
        to: remoteId,
        payload: { sdp: state.pc.localDescription?.sdp ?? '' },
      });
    } catch (err) {
      this.opts.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  async handleAnswer(msg: SignalingEnvelope) {
    const state = this.peers.get(msg.from);
    if (!state) return;
    try {
      state.isSettingRemoteAnswerPending = true;
      await state.pc.setRemoteDescription({
        type: 'answer',
        sdp: String(msg.payload?.sdp ?? ''),
      });
    } catch (err) {
      this.opts.onError?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      state.isSettingRemoteAnswerPending = false;
    }
  }

  async handleIce(msg: SignalingEnvelope) {
    const state = this.peers.get(msg.from);
    if (!state || state.ignoreOffer) return;
    const candidate = msg.payload?.candidate;
    try {
      if (candidate === null) {
        await state.pc.addIceCandidate(null);
        return;
      }
      if (candidate && typeof candidate === 'object') {
        await state.pc.addIceCandidate(candidate as RTCIceCandidateInit);
      } else if (typeof candidate === 'string' && candidate) {
        await state.pc.addIceCandidate({ candidate });
      }
    } catch (err) {
      if (!state.ignoreOffer) {
        this.opts.onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }

  async setVideoEnabled(enabled: boolean) {
    const stream = this.opts.localStream;
    const existing = stream.getVideoTracks()[0];

    if (enabled) {
      if (existing && existing.readyState === 'live') {
        existing.enabled = true;
        for (const state of this.peers.values()) {
          if (state.videoSender && state.videoSender.track !== existing) {
            await state.videoSender.replaceTrack(existing);
          } else if (!state.videoSender) {
            state.videoSender = state.pc.addTrack(existing, stream);
          }
        }
        return;
      }
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15 } },
        audio: false,
      });
      const track = videoStream.getVideoTracks()[0];
      if (!track) return;
      stream.addTrack(track);
      for (const state of this.peers.values()) {
        if (state.videoSender) {
          await state.videoSender.replaceTrack(track);
        } else {
          state.videoSender = state.pc.addTrack(track, stream);
        }
      }
      return;
    }

    // Keep video m-line; replaceTrack(null) avoids SDP order breakage from removeTrack.
    for (const track of stream.getVideoTracks()) {
      track.enabled = false;
      for (const state of this.peers.values()) {
        if (state.videoSender && state.videoSender.track === track) {
          await state.videoSender.replaceTrack(null);
        }
      }
      track.stop();
      stream.removeTrack(track);
    }
  }

  close() {
    for (const peerId of [...this.peers.keys()]) {
      this.closePeer(peerId);
    }
  }

  private async ensurePeer(remoteId: string): Promise<PeerState> {
    const existing = this.peers.get(remoteId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({
      iceServers: this.opts.iceServers ?? [],
    });

    const state: PeerState = {
      pc,
      makingOffer: false,
      ignoreOffer: false,
      isSettingRemoteAnswerPending: false,
      negotiateChain: Promise.resolve(),
      videoSender: null,
    };
    this.peers.set(remoteId, state);
    this.opts.onPcCount?.(this.peers.size);

    pc.onicecandidate = (ev) => {
      this.opts.signaling.send({
        type: 'ice-candidate',
        roomId: this.opts.roomId,
        from: this.opts.localPeerId,
        to: remoteId,
        payload: { candidate: ev.candidate ? ev.candidate.toJSON() : null },
      });
    };

    pc.ontrack = (ev) => {
      const stream = ev.streams[0] ?? new MediaStream([ev.track]);
      const prev = this.remotes.get(remoteId);
      const media: RemoteMedia = {
        peerId: remoteId,
        stream: prev?.stream ?? stream,
        hasAudio: false,
        hasVideo: false,
      };
      if (!prev) {
        media.stream = stream;
      } else if (!prev.stream.getTracks().includes(ev.track)) {
        prev.stream.addTrack(ev.track);
        media.stream = prev.stream;
      }
      media.hasAudio = media.stream.getAudioTracks().length > 0;
      media.hasVideo = media.stream.getVideoTracks().length > 0;
      this.remotes.set(remoteId, media);
      this.opts.onRemoteMedia(this.getRemotes());
    };

    // Attach before addTrack so the first negotiationneeded is handled once.
    pc.onnegotiationneeded = () => {
      void this.queueNegotiate(remoteId);
    };

    // Stable m-line order: audio, then video.
    for (const track of this.opts.localStream.getAudioTracks()) {
      pc.addTrack(track, this.opts.localStream);
    }
    for (const track of this.opts.localStream.getVideoTracks()) {
      state.videoSender = pc.addTrack(track, this.opts.localStream);
    }

    return state;
  }

  private queueNegotiate(remoteId: string) {
    if (!shouldCreateOffer(this.opts.localPeerId, remoteId)) return;

    const state = this.peers.get(remoteId);
    if (!state) return;

    state.negotiateChain = state.negotiateChain
      .then(() => this.makeOffer(remoteId))
      .catch((err) => {
        this.opts.onError?.(err instanceof Error ? err : new Error(String(err)));
      });
  }

  private async makeOffer(remoteId: string) {
    const state = this.peers.get(remoteId);
    if (!state) return;
    if (state.pc.signalingState !== 'stable') return;

    try {
      state.makingOffer = true;
      await state.pc.setLocalDescription();
      const desc = state.pc.localDescription;
      if (!desc?.sdp || desc.type !== 'offer') return;
      this.opts.signaling.send({
        type: 'offer',
        roomId: this.opts.roomId,
        from: this.opts.localPeerId,
        to: remoteId,
        payload: { sdp: desc.sdp },
      });
    } finally {
      state.makingOffer = false;
    }
  }

  private closePeer(remoteId: string) {
    const state = this.peers.get(remoteId);
    if (state) {
      state.pc.onicecandidate = null;
      state.pc.ontrack = null;
      state.pc.onnegotiationneeded = null;
      state.pc.close();
      this.peers.delete(remoteId);
      this.opts.onPcCount?.(this.peers.size);
    }
    this.remotes.delete(remoteId);
    this.opts.onRemoteMedia(this.getRemotes());
  }
}

export function iceServersFromSearch(search: string): RTCIceServer[] {
  const params = new URLSearchParams(search);
  if (params.get('stun') === '1') {
    return [{ urls: 'stun:stun.l.google.com:19302' }];
  }
  return [];
}

export function readQueryDefaults(search: string) {
  const params = new URLSearchParams(search);
  return {
    roomId: params.get('roomId') ?? '',
    peerId: params.get('peerId') ?? '',
    autojoin: params.get('autojoin') === '1',
    video: params.get('video') === '1',
    stun: params.get('stun') === '1',
  };
}
