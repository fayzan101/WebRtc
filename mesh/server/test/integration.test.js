import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { WebSocket } from 'ws';
import { createMeshServer } from '../src/index.js';
import { RoomRegistry } from '../src/rooms.js';

function onceMessage(ws, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout waiting for message')), timeoutMs);
    ws.once('message', (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(String(data)));
    });
  });
}

function connect(port) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

function send(ws, msg) {
  ws.send(JSON.stringify(msg));
}

describe('mesh signaling integration', () => {
  /** @type {Awaited<ReturnType<typeof createMeshServer>>} */
  let mesh;
  let port;

  before(async () => {
    mesh = createMeshServer({
      port: 0,
      rooms: new RoomRegistry(),
      log: () => {},
      heartbeatMs: 60_000,
    });
    await new Promise((resolve) => {
      mesh.server.listen(0, '127.0.0.1', () => {
        port = mesh.server.address().port;
        resolve();
      });
    });
  });

  after(async () => {
    await mesh.stop();
  });

  it('GET /health reports phase 1 signaling', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.phase, 1);
    assert.equal(body.signaling, true);
  });

  it('two clients join the same room and see each other', async () => {
    const a = await connect(port);
    const b = await connect(port);

    send(a, { type: 'join', roomId: 'lab', from: 'p1' });
    const joinedA = await onceMessage(a);
    assert.equal(joinedA.type, 'joined');
    assert.deepEqual(joinedA.payload.peers, []);

    const bJoinedPromise = onceMessage(b);
    const aPeerJoinedPromise = onceMessage(a);
    send(b, { type: 'join', roomId: 'lab', from: 'p2' });

    const joinedB = await bJoinedPromise;
    assert.equal(joinedB.type, 'joined');
    assert.deepEqual(joinedB.payload.peers, ['p1']);

    const peerJoined = await aPeerJoinedPromise;
    assert.equal(peerJoined.type, 'peer-joined');
    assert.equal(peerJoined.from, 'p2');

    a.close();
    b.close();
  });

  it('directed offer from A reaches only B', async () => {
    const a = await connect(port);
    const b = await connect(port);
    const c = await connect(port);

    send(a, { type: 'join', roomId: 'direct', from: 'p1' });
    await onceMessage(a);
    send(b, { type: 'join', roomId: 'direct', from: 'p2' });
    await onceMessage(b);
    await onceMessage(a); // peer-joined
    send(c, { type: 'join', roomId: 'direct', from: 'p3' });
    await onceMessage(c);
    await onceMessage(a);
    await onceMessage(b);

    const bOffer = onceMessage(b);
    let cGotOffer = false;
    c.once('message', () => {
      cGotOffer = true;
    });

    send(a, {
      type: 'offer',
      roomId: 'direct',
      from: 'p1',
      to: 'p2',
      payload: { sdp: 'v=0-offer' },
    });

    const offer = await bOffer;
    assert.equal(offer.type, 'offer');
    assert.equal(offer.to, 'p2');
    assert.equal(offer.payload.sdp, 'v=0-offer');

    await new Promise((r) => setTimeout(r, 50));
    assert.equal(cGotOffer, false);

    a.close();
    b.close();
    c.close();
  });

  it('relays answer and ice-candidate', async () => {
    const a = await connect(port);
    const b = await connect(port);
    send(a, { type: 'join', roomId: 'ice', from: 'p1' });
    await onceMessage(a);
    send(b, { type: 'join', roomId: 'ice', from: 'p2' });
    await onceMessage(b);
    await onceMessage(a);

    const aAnswer = onceMessage(a);
    send(b, {
      type: 'answer',
      roomId: 'ice',
      from: 'p2',
      to: 'p1',
      payload: { sdp: 'v=0-answer' },
    });
    assert.equal((await aAnswer).type, 'answer');

    const aIce = onceMessage(a);
    send(b, {
      type: 'ice-candidate',
      roomId: 'ice',
      from: 'p2',
      to: 'p1',
      payload: { candidate: null },
    });
    const ice = await aIce;
    assert.equal(ice.type, 'ice-candidate');
    assert.equal(ice.payload.candidate, null);

    a.close();
    b.close();
  });

  it('duplicate peerId is rejected with error', async () => {
    const a = await connect(port);
    const b = await connect(port);
    send(a, { type: 'join', roomId: 'dup', from: 'p1' });
    await onceMessage(a);
    send(b, { type: 'join', roomId: 'dup', from: 'p1' });
    const err = await onceMessage(b);
    assert.equal(err.type, 'error');
    assert.match(err.payload.message, /already joined/);
    a.close();
    b.close();
  });

  it('socket disconnect removes peer and notifies others', async () => {
    const a = await connect(port);
    const b = await connect(port);
    send(a, { type: 'join', roomId: 'bye', from: 'p1' });
    await onceMessage(a);
    send(b, { type: 'join', roomId: 'bye', from: 'p2' });
    await onceMessage(b);
    await onceMessage(a);

    const left = onceMessage(a);
    b.close();
    const msg = await left;
    assert.equal(msg.type, 'peer-left');
    assert.equal(msg.from, 'p2');
    a.close();
  });

  it('explicit leave notifies peers', async () => {
    const a = await connect(port);
    const b = await connect(port);
    send(a, { type: 'join', roomId: 'leave', from: 'p1' });
    await onceMessage(a);
    send(b, { type: 'join', roomId: 'leave', from: 'p2' });
    await onceMessage(b);
    await onceMessage(a);

    const left = onceMessage(b);
    send(a, { type: 'leave', roomId: 'leave', from: 'p1' });
    const msg = await left;
    assert.equal(msg.type, 'peer-left');
    assert.equal(msg.from, 'p1');
    a.close();
    b.close();
  });

  it('isolates rooms from each other', async () => {
    const a = await connect(port);
    const b = await connect(port);
    send(a, { type: 'join', roomId: 'room-a', from: 'p1' });
    await onceMessage(a);
    send(b, { type: 'join', roomId: 'room-b', from: 'p1' });
    const joinedB = await onceMessage(b);
    assert.deepEqual(joinedB.payload.peers, []);

    let leaked = false;
    a.once('message', () => {
      leaked = true;
    });
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(leaked, false);

    a.close();
    b.close();
  });
});
