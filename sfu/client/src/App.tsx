import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_ROOM_ID } from '@webrtc/shared';

type HealthState =
  | { status: 'pending' }
  | { status: 'ok'; data: Record<string, unknown> }
  | { status: 'error'; message: string };

export default function App() {
  const [health, setHealth] = useState<HealthState>({ status: 'pending' });

  const pingHealth = useCallback(async () => {
    setHealth({ status: 'pending' });
    try {
      const res = await fetch('/health');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as Record<string, unknown>;
      setHealth({ status: 'ok', data });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setHealth({
        status: 'error',
        message: `${message}. Start the SFU server with npm run sfu`,
      });
    }
  }, []);

  useEffect(() => {
    void pingHealth();
  }, [pingHealth]);

  return (
    <>
      <h1>SFU Call</h1>
      <p className="subtitle">
        Project 23 — LiveKit SFU path (Phase 0 scaffold). Default room{' '}
        <code>{DEFAULT_ROOM_ID}</code>. Token minting and LiveKit join land in
        Phase 3.
      </p>

      <section className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <strong>Backend health</strong>
          <button type="button" onClick={() => void pingHealth()}>
            Refresh
          </button>
        </div>
        <div style={{ marginTop: '0.85rem' }} data-testid="status">
          {health.status === 'pending' && (
            <span className="badge pending">
              <span className="dot" /> Checking…
            </span>
          )}
          {health.status === 'ok' && (
            <span className="badge ok">
              <span className="dot" /> Connected to sfu-server
            </span>
          )}
          {health.status === 'error' && (
            <span className="badge bad">
              <span className="dot" /> Unreachable
            </span>
          )}
        </div>
        {health.status === 'ok' && (
          <pre>{JSON.stringify(health.data, null, 2)}</pre>
        )}
        {health.status === 'error' && (
          <p className="subtitle" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
            {health.message}
          </p>
        )}
      </section>
    </>
  );
}
