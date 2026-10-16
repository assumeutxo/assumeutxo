// A plain JSON-RPC client from a bitcoin.conf: rpcport/rpcbind from the conf (its [chain] section wins), auth from rpcuser/rpcpassword
// or the chain's .cookie in the datadir. Nothing else.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
export const CHAIN_NETWORK = { main: 'btc', testnet3: 'tbtc3', testnet4: 'tbtc4', signet: 'signet' }; // Core's chain names to the record's labels
export function makeRpc(confPath, datadir) {
  const kv = {}; let section = '';
  for (const raw of readFileSync(confPath, 'utf8').split('\n')) { const l = raw.trim(); if (!l || l[0] === '#') continue; const m = l.match(/^\[(\w+)\]$/); if (m) { section = m[1]; continue; } const [k, ...v] = l.split('='); kv[k.trim()] = v.join('=').trim(); if (section) kv[`${section}.${k.trim()}`] = v.join('=').trim(); }
  const chain = kv.chain ?? (kv.testnet4 === '1' ? 'testnet4' : kv.signet === '1' ? 'signet' : kv.testnet === '1' ? 'testnet3' : kv.regtest === '1' ? 'regtest' : 'main');
  const sub = { main: '', testnet3: 'testnet3', testnet4: 'testnet4', signet: 'signet', regtest: 'regtest' }[chain];
  const get = (k) => kv[`${chain}.${k}`] ?? kv[k]; const port = get('rpcport') ?? { main: 8332, testnet3: 18332, testnet4: 48332, signet: 38332, regtest: 18443 }[chain];
  const dd = datadir ?? kv.datadir ?? dirname(resolve(confPath));
  const auth = kv.rpcuser ? `${kv.rpcuser}:${kv.rpcpassword}` : readFileSync(`${dd}${sub ? '/' + sub : ''}/.cookie`, 'utf8').trim();
  const rpc = async (method, ...params) => {
    const r = await fetch(`http://${get('rpcbind') ?? '127.0.0.1'}:${port}/`, { method: 'POST', headers: { authorization: 'Basic ' + Buffer.from(auth).toString('base64'), 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
    const j = await r.json(); if (j.error) throw new Error(`${method}: ${j.error.message}`); return j.result;
  };
  rpc.chain = chain; rpc.datadir = dd; return rpc;
}
