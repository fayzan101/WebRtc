import type { SignalingEnvelope } from './types';

export type SignalingHandlers = {
  onOpen?: () => void;
  onClose?: (ev: CloseEvent) => void;
  onError?: (err: Error) => void;
  onJoined?: (msg: SignalingEnvelope) => void;
  onPeerJoined?: (msg: SignalingEnvelope) => void;
  onPeerLeft?: (msg: SignalingEnvelope) => void;
  onOffer?: (msg: SignalingEnvelope) => void;
  onAnswer?: (msg: SignalingEnvelope) => void;
  onIce?: (msg: SignalingEnvelope) => void;
  onServerError?: (msg: SignalingEnvelope) => void;
};

function defaultWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

export class MeshSignaling {
  private ws: WebSocket | null = null;
  private handlers: SignalingHandlers;
  private url: string;
  private didReconnect = false;
  private intentionalClose = false;

  constructor(handlers: SignalingHandlers = {}, url = defaultWsUrl()) {
    this.handlers = handlers;
    this.url = url;
  }

  setHandlers(handlers: SignalingHandlers) {
    this.handlers = { ...this.handlers, ...handlers };
  }

  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  connect(): Promise<void> {
    this.intentionalClose = false;
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const ws = new WebSocket(this.url);
      this.ws = ws;

      const onOpen = () => {
        cleanupConnect();
        this.handlers.onOpen?.();
        resolve();
      };
      const onError = () => {
        cleanupConnect();
        const err = new Error(`WebSocket failed to connect to ${this.url}`);
        this.handlers.onError?.(err);
        reject(err);
      };
      const cleanupConnect = () => {
        ws.removeEventListener('open', onOpen);
        ws.removeEventListener('error', onError);
      };

      ws.addEventListener('open', onOpen);
      ws.addEventListener('error', onError);
      ws.addEventListener('message', (ev) => this.onMessage(ev));
      ws.addEventListener('close', (ev) => this.onClose(ev));
    });
  }

  private async onClose(ev: CloseEvent) {
    this.handlers.onClose?.(ev);
    if (this.intentionalClose || this.didReconnect) return;
    this.didReconnect = true;
    try {
      await this.connect();
    } catch (err) {
      this.handlers.onError?.(
        err instanceof Error ? err : new Error('WebSocket reconnect failed'),
      );
    }
  }

  private onMessage(ev: MessageEvent) {
    let msg: SignalingEnvelope;
    try {
      msg = JSON.parse(String(ev.data)) as SignalingEnvelope;
    } catch {
      return;
    }

    switch (msg.type) {
      case 'joined':
        this.handlers.onJoined?.(msg);
        break;
      case 'peer-joined':
        this.handlers.onPeerJoined?.(msg);
        break;
      case 'peer-left':
        this.handlers.onPeerLeft?.(msg);
        break;
      case 'offer':
        this.handlers.onOffer?.(msg);
        break;
      case 'answer':
        this.handlers.onAnswer?.(msg);
        break;
      case 'ice-candidate':
        this.handlers.onIce?.(msg);
        break;
      case 'error':
        this.handlers.onServerError?.(msg);
        break;
      default:
        break;
    }
  }

  send(message: SignalingEnvelope) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('signaling socket is not open');
    }
    this.ws.send(JSON.stringify(message));
  }

  join(roomId: string, peerId: string) {
    this.send({ type: 'join', roomId, from: peerId, payload: {} });
  }

  leave(roomId: string, peerId: string) {
    this.send({ type: 'leave', roomId, from: peerId, payload: {} });
  }

  close() {
    this.intentionalClose = true;
    this.ws?.close();
    this.ws = null;
  }
}
