import type { CallStatus } from '../lib/types';

type Props = {
  roomId: string;
  peerId: string;
  videoEnabled: boolean;
  status: CallStatus;
  onRoomId: (v: string) => void;
  onPeerId: (v: string) => void;
  onVideoEnabled: (v: boolean) => void;
  onJoin: () => void;
  onLeave: () => void;
};

const STATUS_LABEL: Record<CallStatus, string> = {
  idle: 'Idle',
  joining: 'Connecting',
  connected: 'Live',
  failed: 'Error',
};

export function JoinForm({
  roomId,
  peerId,
  videoEnabled,
  status,
  onRoomId,
  onPeerId,
  onVideoEnabled,
  onJoin,
  onLeave,
}: Props) {
  const busy = status === 'joining';
  const inCall = status === 'connected' || status === 'joining';
  const leaveActive = status !== 'idle';

  return (
    <section id="session-card" className="glass-panel card-enter card-delay-1">
      <div className="panel-header">
        <h2>Session</h2>
        <span
          id="call-status"
          className={`status-pill status-${status}`}
          data-testid="status"
          data-status={status}
          aria-live="polite"
        >
          <span className="status-dot" />
          <span className="status-label">{STATUS_LABEL[status]}</span>
          <span className="status-raw" hidden>
            {status}
          </span>
        </span>
      </div>

      <div className="form-grid">
        <label className="field" htmlFor="room-id">
          <span>Room ID</span>
          <div className="input-wrap">
            <span className="input-icon" aria-hidden>
              #
            </span>
            <input
              id="room-id"
              value={roomId}
              onChange={(e) => onRoomId(e.target.value)}
              disabled={inCall}
              placeholder="project23"
              autoComplete="off"
            />
          </div>
          <small className="helper">Shared room name for all mesh peers</small>
        </label>

        <label className="field" htmlFor="peer-id">
          <span>Peer ID</span>
          <div className="input-wrap">
            <span className="input-icon" aria-hidden>
              @
            </span>
            <input
              id="peer-id"
              value={peerId}
              onChange={(e) => onPeerId(e.target.value)}
              disabled={inCall}
              placeholder="p1"
              autoComplete="off"
            />
          </div>
          <small className="helper">Unique per client (e.g. p1, p2, p3)</small>
        </label>
      </div>

      <div className="toggle-row">
        <div>
          <label htmlFor="video-toggle" className="toggle-label">
            Enable video (≤640×360)
          </label>
          <small className="helper">Optional; audio-only by default</small>
        </div>
        <button
          type="button"
          id="video-toggle"
          className={`toggle-switch ${videoEnabled ? 'on' : ''}`}
          role="switch"
          aria-checked={videoEnabled}
          aria-label="Enable low-res video 320 by 240"
          onClick={() => onVideoEnabled(!videoEnabled)}
        >
          <span className="toggle-knob" />
        </button>
      </div>

      <div className="btn-row">
        <button
          type="button"
          id="join-btn"
          className="btn primary"
          onClick={onJoin}
          disabled={busy || status === 'connected'}
        >
          {busy ? 'Joining…' : 'Join room'}
        </button>
        <button
          type="button"
          id="leave-btn"
          className={`btn leave ${leaveActive ? 'leave-active' : ''}`}
          onClick={onLeave}
          disabled={!leaveActive}
        >
          Leave
        </button>
      </div>
    </section>
  );
}
