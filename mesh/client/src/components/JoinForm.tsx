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

  return (
    <section className="glass-panel">
      <div className="panel-header">
        <h2>Session</h2>
        <span className={`status-pill status-${status}`} data-testid="status">
          <span className="status-dot" />
          {status}
        </span>
      </div>

      <div className="form-grid">
        <label className="field">
          <span>Room ID</span>
          <input
            value={roomId}
            onChange={(e) => onRoomId(e.target.value)}
            disabled={inCall}
            placeholder="project23"
            autoComplete="off"
          />
        </label>
        <label className="field">
          <span>Peer ID</span>
          <input
            value={peerId}
            onChange={(e) => onPeerId(e.target.value)}
            disabled={inCall}
            placeholder="p1"
            autoComplete="off"
          />
        </label>
      </div>

      <label className="check-row">
        <input
          type="checkbox"
          checked={videoEnabled}
          onChange={(e) => onVideoEnabled(e.target.checked)}
        />
        <span>Enable low-res video (320×240)</span>
      </label>

      <div className="btn-row">
        <button
          type="button"
          className="btn primary"
          onClick={onJoin}
          disabled={busy || status === 'connected'}
        >
          {busy ? 'Joining…' : 'Join room'}
        </button>
        <button
          type="button"
          className="btn danger"
          onClick={onLeave}
          disabled={status === 'idle'}
        >
          Leave
        </button>
      </div>
    </section>
  );
}
