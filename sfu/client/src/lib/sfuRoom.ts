import {
  createLocalAudioTrack,
  createLocalVideoTrack,
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  type LocalTrack,
  type RemoteTrack,
  type RemoteTrackPublication,
  type RemoteParticipant,
} from 'livekit-client';
import type { RemoteMedia } from './types';

export type SfuRoomCallbacks = {
  onRemoteMedia: (remotes: Map<string, RemoteMedia>) => void;
  onStatus?: (message: string) => void;
  onError?: (err: Error) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
};

/**
 * Thin wrapper around LiveKit Room: connect, publish, subscribe, leave.
 */
export class SfuRoomSession {
  readonly room = new Room({
    adaptiveStream: true,
    dynacast: true,
  });

  private remotes = new Map<string, RemoteMedia>();
  private localTracks: LocalTrack[] = [];
  private callbacks: SfuRoomCallbacks;
  private videoTrack: LocalTrack | null = null;

  constructor(callbacks: SfuRoomCallbacks) {
    this.callbacks = callbacks;
    this.bindRoomEvents();
  }

  get remoteCount(): number {
    return this.remotes.size;
  }

  async connect(url: string, token: string) {
    await this.room.connect(url, token);
    this.callbacks.onConnected?.();
  }

  async publishAudio() {
    const track = await createLocalAudioTrack();
    this.localTracks.push(track);
    await this.room.localParticipant.publishTrack(track);
  }

  async setVideoEnabled(enabled: boolean) {
    if (enabled) {
      if (this.videoTrack && !this.videoTrack.isMuted) {
        await this.videoTrack.unmute();
        return;
      }
      if (this.videoTrack) {
        await this.room.localParticipant.publishTrack(this.videoTrack);
        return;
      }
      const track = await createLocalVideoTrack({
        resolution: VideoPresets.h360.resolution,
      });
      this.videoTrack = track;
      this.localTracks.push(track);
      await this.room.localParticipant.publishTrack(track);
      return;
    }

    if (this.videoTrack) {
      await this.room.localParticipant.unpublishTrack(this.videoTrack);
      this.videoTrack.stop();
      this.localTracks = this.localTracks.filter((t) => t !== this.videoTrack);
      this.videoTrack = null;
    }
  }

  getLocalStream(): MediaStream | null {
    const tracks = this.localTracks
      .map((t) => t.mediaStreamTrack)
      .filter(Boolean) as MediaStreamTrack[];
    if (!tracks.length) return null;
    return new MediaStream(tracks);
  }

  async disconnect() {
    for (const track of this.localTracks) {
      try {
        await this.room.localParticipant.unpublishTrack(track);
      } catch {
        // ignore
      }
      track.stop();
    }
    this.localTracks = [];
    this.videoTrack = null;
    this.remotes.clear();
    this.callbacks.onRemoteMedia(new Map());
    await this.room.disconnect();
    this.callbacks.onDisconnected?.();
  }

  private bindRoomEvents() {
    this.room.on(
      RoomEvent.TrackSubscribed,
      (track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
        this.attachRemoteTrack(participant.identity, track);
      },
    );

    this.room.on(
      RoomEvent.TrackUnsubscribed,
      (track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
        this.detachRemoteTrack(participant.identity, track);
      },
    );

    this.room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      this.remotes.delete(participant.identity);
      this.callbacks.onRemoteMedia(new Map(this.remotes));
    });

    this.room.on(RoomEvent.Disconnected, () => {
      this.remotes.clear();
      this.callbacks.onRemoteMedia(new Map());
      this.callbacks.onDisconnected?.();
    });
  }

  private attachRemoteTrack(peerId: string, track: RemoteTrack) {
    let media = this.remotes.get(peerId);
    if (!media) {
      media = {
        peerId,
        stream: new MediaStream(),
        hasAudio: false,
        hasVideo: false,
      };
      this.remotes.set(peerId, media);
    }
    media.stream.addTrack(track.mediaStreamTrack);
    media.hasAudio = media.stream.getAudioTracks().length > 0;
    media.hasVideo = media.stream.getVideoTracks().length > 0;
    if (track.kind === Track.Kind.Audio || track.kind === Track.Kind.Video) {
      // ensure playback element path sees updates
    }
    this.callbacks.onRemoteMedia(new Map(this.remotes));
  }

  private detachRemoteTrack(peerId: string, track: RemoteTrack) {
    const media = this.remotes.get(peerId);
    if (!media) return;
    media.stream.removeTrack(track.mediaStreamTrack);
    media.hasAudio = media.stream.getAudioTracks().length > 0;
    media.hasVideo = media.stream.getVideoTracks().length > 0;
    if (!media.hasAudio && !media.hasVideo) {
      this.remotes.delete(peerId);
    }
    this.callbacks.onRemoteMedia(new Map(this.remotes));
  }
}
