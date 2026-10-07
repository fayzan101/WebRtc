import { useEffect, useState } from 'react';
import { MeshLogo } from './MeshLogo';

const MESSAGES = ['Contacting token API…', 'Connecting to SFU…', 'Ready'] as const;
const DURATION_MS = 2200;

type Props = {
  onDone: () => void;
};

export function SplashScreen({ onDone }: Props) {
  const [msgIndex, setMsgIndex] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const finish = () => {
      setExiting(true);
      window.setTimeout(onDone, reduce ? 120 : 420);
    };

    const skip = () => finish();
    window.addEventListener('keydown', skip);
    window.addEventListener('pointerdown', skip);

    const msgTimer = window.setInterval(() => {
      setMsgIndex((i) => Math.min(i + 1, MESSAGES.length - 1));
    }, reduce ? 400 : 700);

    const doneTimer = window.setTimeout(finish, reduce ? 600 : DURATION_MS);

    return () => {
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
      window.clearInterval(msgTimer);
      window.clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div
      id="splash-screen"
      className={`splash ${exiting ? 'splash-exit' : ''}`}
      role="dialog"
      aria-label="SFU Call loading"
      aria-modal="true"
    >
      <div className="splash-grid" aria-hidden />
      <div className="splash-glow" aria-hidden />
      <div className="splash-inner">
        <p className="splash-eyebrow">PROJECT 23 · SFU MODE</p>
        <MeshLogo size={112} animated />
        <h1 className="splash-title">SFU Call</h1>
        <p className="splash-tagline">One uplink · LiveKit selective forwarding</p>
        <div className="splash-progress" aria-hidden>
          <div className="splash-progress-bar" />
        </div>
        <p className="splash-status" aria-live="polite">
          {MESSAGES[msgIndex]}
        </p>
        <p className="splash-hint">Click or press any key to skip</p>
      </div>
    </div>
  );
}

export function shouldShowSplash(search = window.location.search): boolean {
  return new URLSearchParams(search).get('autojoin') !== '1';
}
