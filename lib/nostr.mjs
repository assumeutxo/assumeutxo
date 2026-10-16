// Nostr: id, Schnorr signature (BIP 340, audited noble), verification, and a small relay publisher.
import { createHash, randomBytes } from 'node:crypto';
import { schnorr } from '@noble/curves/secp256k1';
import WebSocket from 'ws';
export const hex = (b) => Buffer.from(b).toString('hex');
export const sha256 = (s) => createHash('sha256').update(s).digest();
export const publicKey = (privHex) => hex(schnorr.getPublicKey(Buffer.from(privHex, 'hex')));
export const newPrivateKey = () => hex(randomBytes(32));
export const eventId = (ev) => hex(sha256(JSON.stringify([0, ev.pubkey, ev.created_at, ev.kind, ev.tags, ev.content])));
export function finalizeEvent(ev, privHex) { const id = eventId(ev); return { ...ev, id, sig: hex(schnorr.sign(Buffer.from(id, 'hex'), Buffer.from(privHex, 'hex'))) }; }
export function verifyEvent(ev) { const idOK = eventId(ev) === ev.id; let sigOK = false; try { sigOK = idOK && schnorr.verify(Buffer.from(ev.sig, 'hex'), Buffer.from(ev.id, 'hex'), Buffer.from(ev.pubkey, 'hex')); } catch {} return { idOK, sigOK }; }
export const leadingZeroBits = (pubHex) => { let b = 0; for (const c of pubHex) { const n = parseInt(c, 16); if (n === 0) { b += 4; continue; } b += Math.clz32(n) - 28; break; } return b; };
export const DEFAULT_RELAYS = ['wss://nos.lol', 'wss://relay.damus.io', 'wss://nostr.mom', 'wss://relay.primal.net', 'wss://relay.nostr.band', 'wss://nostr.oxtr.dev'];
// publish one event to each relay; resolves with { url, ok, why } per relay, never throws
export function publish(ev, relays = DEFAULT_RELAYS, timeoutMs = 10000) {
  return Promise.all(relays.map((url) => new Promise((res) => {
    const done = (ok, why) => { try { ws.close(); } catch {} res({ url, ok, why }); }; const t = setTimeout(() => done(false, 'timeout'), timeoutMs);
    const ws = new WebSocket(url); ws.on('open', () => ws.send(JSON.stringify(['EVENT', ev])));
    ws.on('message', (m) => { try { const d = JSON.parse(m); if (d[0] === 'OK' && d[1] === ev.id) { clearTimeout(t); done(!!d[2], d[3] || ''); } } catch {} });
    ws.on('error', (e) => { clearTimeout(t); done(false, e.message); }); ws.on('close', () => { clearTimeout(t); res({ url, ok: false, why: 'closed' }); });
  })));
}
