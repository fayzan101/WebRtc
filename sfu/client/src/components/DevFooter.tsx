async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // ignore
  }
}

function CodeChip({ id, label, value }: { id: string; label: string; value: string }) {
  return (
    <div className="dev-chip" id={id}>
      <span className="dev-chip-label">{label}</span>
      <code>{value}</code>
      <button
        type="button"
        className="btn-copy"
        aria-label={`Copy ${label}`}
        onClick={() => void copyText(value)}
      >
        Copy
      </button>
    </div>
  );
}

export function DevFooter() {
  return (
    <footer id="dev-footer" className="dev-footer card-enter card-delay-4">
      <div className="dev-chips">
        <CodeChip id="chip-token" label="Token" value="POST /token" />
        <CodeChip id="chip-livekit" label="LiveKit" value="ws://127.0.0.1:7880" />
        <CodeChip
          id="chip-autojoin"
          label="Auto"
          value="?autojoin=1&roomId=&peerId="
        />
      </div>
    </footer>
  );
}
