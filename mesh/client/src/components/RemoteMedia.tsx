import { useEffect, useRef } from 'react';
import type { RemoteMedia as RemoteMediaType } from '../lib/types';

type Props = {
  remotes: RemoteMediaType[];
  localStream: MediaStream | null;
  localPeerId: string;
  videoEnabled: boolean;
};

function MediaTile({
  label,
  stream,
  muted,
  mirror,
}: {
  label: string;
  stream: MediaStream | null;
  muted?: boolean;
  mirror?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hasVideo = Boolean(stream?.getVideoTracks().length);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = hasVideo ? stream : null;
    }
    if (audioRef.current) {
      audioRef.current.srcObject = stream;
    }
  }, [stream, hasVideo]);

  return (
    <article className="media-tile">
      <div className={`media-frame ${hasVideo ? 'has-video' : 'audio-only'}`}>
        {hasVideo ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={muted}
            className={mirror ? 'mirror' : undefined}
          />
        ) : (
          <div className="avatar-wave">
            <span>{label.slice(0, 2).toUpperCase()}</span>
            <div className="waves" aria-hidden>
              <i /><i /><i /><i />
            </div>
          </div>
        )}
        {!hasVideo && (
          <audio ref={audioRef} autoPlay playsInline muted={muted} />
        )}
      </div>
      <footer>
        <span>{label}</span>
        <span className="chip">{hasVideo ? 'video' : 'audio'}</span>
      </footer>
    </article>
  );
}

export function RemoteMedia({
  remotes,
  localStream,
  localPeerId,
  videoEnabled,
}: Props) {
  return (
    <section className="glass-panel media-panel">
      <div className="panel-header">
        <h2>Participants</h2>
        <span className="muted">{remotes.length + (localStream ? 1 : 0)} in room</span>
      </div>
      <div className="media-grid">
        {localStream && (
          <MediaTile
            label={`You (${localPeerId})`}
            stream={localStream}
            muted
            mirror={videoEnabled}
          />
        )}
        {remotes.map((remote) => (
          <MediaTile
            key={remote.peerId}
            label={remote.peerId}
            stream={remote.stream}
          />
        ))}
        {!localStream && remotes.length === 0 && (
          <div className="empty-media">
            Join a room to start the mesh conference.
          </div>
        )}
      </div>
    </section>
  );
}
