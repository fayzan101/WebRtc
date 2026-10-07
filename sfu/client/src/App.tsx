import { useCallback, useEffect, useState } from 'react';
import { DevFooter } from './components/DevFooter';
import { ErrorBanner } from './components/ErrorBanner';
import { JoinForm } from './components/JoinForm';
import { MeshLogo } from './components/MeshLogo';
import { RemoteMedia } from './components/RemoteMedia';
import { SfuTopology } from './components/SfuTopology';
import { SplashScreen, shouldShowSplash } from './components/SplashScreen';
import { StatusPanel } from './components/StatusPanel';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { useSfuRoom } from './hooks/useSfuRoom';
import {
  applyThemeToDocument,
  persistTheme,
  readStoredTheme,
  type ThemeId,
} from './lib/theme';

export default function App() {
  const room = useSfuRoom();
  const [theme, setTheme] = useState<ThemeId>(() => readStoredTheme());
  const [showSplash, setShowSplash] = useState(() => shouldShowSplash());

  useEffect(() => {
    applyThemeToDocument(theme);
    persistTheme(theme);
  }, [theme]);

  const onThemeChange = useCallback((next: ThemeId) => {
    setTheme(next);
  }, []);

  const connectionLabel =
    room.status === 'connected'
      ? 'Live'
      : room.status === 'joining'
        ? 'Connecting'
        : room.status === 'failed'
          ? 'Error'
          : 'Idle';

  return (
    <>
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}

      <div
        id="app-shell"
        className={`app-shell ${showSplash ? 'is-behind-splash' : 'is-revealed app-ready'}`}
      >
        <div className="ambient ambient-a" aria-hidden />
        <div className="ambient ambient-b" aria-hidden />

        <header id="header-card" className="topbar glass-panel card-enter">
          <div className="topbar-brand">
            <MeshLogo size={40} animated={false} className="header-logo" />
            <div className="topbar-titles">
              <div className="title-row">
                <h1>SFU Call</h1>
                <span className="n1-chip" title="One publish uplink to the SFU">
                  1 uplink
                </span>
              </div>
              <p className="subtitle">
                LiveKit selective forwarding · Project 23
              </p>
            </div>
          </div>

          <div className="topbar-aside">
            <ThemeSwitcher theme={theme} onChange={onThemeChange} />
            <span
              id="connection-badge"
              className={`connection-badge status-${room.status}`}
              aria-live="polite"
            >
              <span className="status-dot" />
              {connectionLabel}
            </span>
          </div>
        </header>

        <ErrorBanner message={room.error} onDismiss={room.clearError} />

        <main id="app-main" className="layout">
          <aside className="col sidebar">
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
          </aside>

          <section className="col stage">
            <RemoteMedia
              remotes={room.remotes}
              localStream={room.localStream}
              localPeerId={room.peerId}
              roomId={room.roomId}
              videoEnabled={room.videoEnabled}
              onJoinHint={() => void room.join()}
            />
            <SfuTopology
              localPeerId={room.peerId}
              remotePeerIds={room.remotes.map((r) => r.peerId)}
              videoEnabled={room.videoEnabled}
              connected={room.status === 'connected'}
            />
          </section>
        </main>

        <DevFooter />
      </div>
    </>
  );
}
