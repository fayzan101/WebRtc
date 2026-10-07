import { useEffect, useRef, type CSSProperties } from 'react';
import { peerGradient } from '../lib/peerStyle';
import type { RemoteMedia as RemoteMediaType } from '../lib/types';

type Props = {
  remotes: RemoteMediaType[];
  localStream: MediaStream | null;
  localPeerId: string;
  roomId: string;
  videoEnabled: boolean;
  onJoinHint?: () => void;
};

function qualityFromStream(stream: MediaStream | null): 'good' | 'fair' | 'poor' {
  if (!stream) return 'poor';
  const live = stream.getTracks().some((t) => t.readyState === 'live' && t.enabled);
  return live ? 'good' : 'fair';
}

function MicIcon({ muted }: { muted?: boolean }) {
  return (
    <svg className="mic-icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden>
      {muted ? (
        <>
          <path
            d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.3V12a3 3 0 0 1-.1.78"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M5 12a7 7 0 0 0 11.5 5.3M19 12a7 7 0 0 0-.4-2.3M12 19v3M8 22h8M4 4l16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <rect x="9" y="3" width="6" height="10" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" opacity="0.5" />
        </>
      ) : (
        <>
          <rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M5 12a7 7 0 0 0 14 0M12 19v3M8 22h8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

function MediaTile({
  id,
  label,
  peerKey,
  stream,
  muted,
  mirror,
  isLocal,
}: {
  id: string;
  label: string;
  peerKey: string;
  stream: MediaStream | null;
  muted?: boolean;
  mirror?: boolean;
  isLocal?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hasVideo = Boolean(stream?.getVideoTracks().length);
  const quality = qualityFromStream(stream);
  const initials =
    label.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || '??';

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = hasVideo ? stream : null;
    }
    if (audioRef.current) {
      audioRef.current.srcObject = stream;
    }
  }, [stream, hasVideo]);

  return (
    <article
      id={id}
      className={`media-tile ${isLocal ? 'is-local' : ''}`}
      style={{ '--peer-wash': peerGradient(peerKey) } as CSSProperties}
    >
      <div
        className={`media-frame ${hasVideo ? 'has-video' : 'audio-only'}`}
        style={!hasVideo ? { backgroundImage: 'var(--peer-wash)' } : undefined}
      >
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
            <span className="avatar-initials">{initials}</span>
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
          <span className={`tile-icon ${muted || isLocal ? 'is-muted' : ''}`} aria-hidden>
            <MicIcon muted={muted || isLocal} />
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
  roomId,
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
            peerKey={localPeerId}
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
            peerKey={remote.peerId}
            stream={remote.stream}
          />
        ))}
        {localStream && (
          <article id="participant-waiting" className="media-tile waiting-tile">
            <div className="media-frame waiting-frame">
              <span className="waiting-plus" aria-hidden>
                +
              </span>
              <p className="waiting-title">Waiting for more peers</p>
              <p className="helper">
                Share room <strong>{roomId || '…'}</strong> so others can join.
              </p>
            </div>
          </article>
        )}
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
