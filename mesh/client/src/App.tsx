import { ErrorBanner } from './components/ErrorBanner';
import { JoinForm } from './components/JoinForm';
import { RemoteMedia } from './components/RemoteMedia';
import { StatusPanel } from './components/StatusPanel';
import { useMeshRoom } from './hooks/useMeshRoom';

export default function App() {
  const room = useMeshRoom();

  return (
    <div className="app-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <header className="topbar glass-panel">
        <div>
          <p className="eyebrow">Project 23 · Mesh mode</p>
          <h1>Mesh Call</h1>
          <p className="subtitle">
            Full-mesh WebRTC — each client maintains <strong>N−1</strong> peer
            connections over P2P UDP.
          </p>
        </div>
        <div className="topbar-meta">
          <span className="meta-chip">Obsidian Glass</span>
          <span className="meta-chip steel">Blue Steel</span>
        </div>
      </header>

      <ErrorBanner message={room.error} onDismiss={room.clearError} />

      <main className="layout">
        <div className="col">
          <JoinForm
            roomId={room.roomId}
            peerId={room.peerId}
            videoEnabled={room.videoEnabled}
            status={room.status}
            onRoomId={room.setRoomId}
            onPeerId={room.setPeerId}
            onVideoEnabled={room.setVideoEnabled}
            onJoin={() => void room.join()}
            onLeave={() => void room.leave()}
          />
          <StatusPanel
            pcCount={room.pcCount}
            remoteCount={room.remotes.length}
            stats={room.stats}
          />
        </div>
        <div className="col wide">
          <RemoteMedia
            remotes={room.remotes}
            localStream={room.localStream}
            localPeerId={room.peerId}
            videoEnabled={room.videoEnabled}
          />
        </div>
      </main>

      <footer className="footer muted">
        Signaling <code>/ws</code> · optional <code>?stun=1</code> · automation{' '}
        <code>?autojoin=1&amp;roomId=&amp;peerId=</code>
      </footer>
    </div>
  );
}
