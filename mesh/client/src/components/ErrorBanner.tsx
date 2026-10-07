type Props = {
  message: string | null;
  onDismiss?: () => void;
};

export function ErrorBanner({ message, onDismiss }: Props) {
  if (!message) return null;
  return (
    <div id="error-banner" className="error-banner card-enter" role="alert">
      <div>
        <strong>Something went wrong</strong>
        <p>{message}</p>
      </div>
      {onDismiss && (
        <button
          type="button"
          id="error-dismiss"
          className="btn ghost"
          onClick={onDismiss}
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
