import { useEffect, useRef } from 'react';
import type { RemoteMedia as RemoteMediaType } from '../lib/types';

type Props = {
  remotes: RemoteMediaType[];
  localStream: MediaStream | null;
  localPeerId: string;
  videoEnabled: boolean;
  onJoinHint?: () => void;
};

function qualityFromStream(stream: MediaStream | null): 'good' | 'fair' | 'poor' {
  if (!stream) return 'poor';
  const live = stream.getTracks().some((t) => t.readyState === 'live' && t.enabled);
  return live ? 'good' : 'fair';
}

function MediaTile({
  id,
  label,
  stream,
  muted,
  mirror,
  isLocal,
}: {
  id: string;
  label: string;
  stream: MediaStream | null;
  muted?: boolean;
  mirror?: boolean;
  isLocal?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hasVideo = Boolean(stream?.getVideoTracks().length);
  const quality = qualityFromStream(stream);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = hasVideo ? stream : null;
    }
    if (audioRef.current) {
      audioRef.current.srcObject = stream;
    }
  }, [stream, hasVideo]);

  return (
    <article id={id} className={`media-tile ${isLocal ? 'is-local' : ''}`}>
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
            <span>{label.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || '??'}</span>
            <div className="waves" aria-hidden>
              <i /><i /><i /><i />
            </div>
          </div>
        )}
        {!hasVideo && (
          <audio ref={audioRef} autoPlay playsInline muted={muted} />
        )}
        <div className="tile-overlay">
          <span
            className={`quality-dot quality-${quality}`}
            title={`Connection ${quality}`}
            aria-label={`Connection ${quality}`}
          />
          <span className="tile-icon" aria-hidden>
            {muted || isLocal ? '🎙' : hasVideo ? '▶' : '🔊'}
          </span>
        </div>
      </div>
      <footer>
        <span className="tile-name">{label}</span>
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
  onJoinHint,
}: Props) {
  const count = remotes.length + (localStream ? 1 : 0);

  const empty = !localStream && remotes.length === 0;

  return (
    <section
      id="participants-card"
      className={`glass-panel media-panel card-enter card-delay-3 ${empty ? 'is-empty' : ''}`}
    >
      <div className="panel-header">
        <h2>Participants</h2>
        <span
          id="participant-count"
          className="count-badge"
          aria-live="polite"
        >
          {count} in room
        </span>
      </div>

      <div
        id="participants-grid"
        className={`media-grid ${empty ? 'media-grid-empty' : ''}`}
      >
        {localStream && (
          <MediaTile
            id="participant-local"
            label={`You (${localPeerId})`}
            stream={localStream}
            muted
            mirror={videoEnabled}
            isLocal
          />
        )}
        {remotes.map((remote) => (
          <MediaTile
            key={remote.peerId}
            id={`participant-${remote.peerId}`}
            label={remote.peerId}
            stream={remote.stream}
          />
        ))}
        {empty && (
          <div id="participants-empty" className="empty-media">
            <svg viewBox="0 0 200 120" className="empty-illu" aria-hidden>
              <circle cx="50" cy="60" r="14" fill="var(--accent)" opacity="0.3" />
              <circle cx="100" cy="36" r="16" fill="var(--accent)" opacity="0.55" />
              <circle cx="150" cy="64" r="14" fill="var(--accent)" opacity="0.3" />
              <circle cx="100" cy="88" r="11" fill="var(--accent)" opacity="0.4" />
              <line x1="62" y1="52" x2="86" y2="42" stroke="var(--accent)" strokeWidth="2.2" opacity="0.45" />
              <line x1="114" y1="42" x2="138" y2="58" stroke="var(--accent)" strokeWidth="2.2" opacity="0.45" />
              <line x1="62" y1="68" x2="90" y2="82" stroke="var(--accent)" strokeWidth="2" opacity="0.3" />
              <line x1="138" y1="70" x2="110" y2="82" stroke="var(--accent)" strokeWidth="2" opacity="0.3" />
            </svg>
            <p className="empty-title">Waiting for peers</p>
            <p className="helper">
              Open another window with a different Peer ID and the same Room ID.
            </p>
            {onJoinHint && (
              <button type="button" className="btn primary empty-cta" onClick={onJoinHint}>
                Join room
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
