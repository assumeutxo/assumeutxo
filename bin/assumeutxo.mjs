#!/usr/bin/env node
// assumeutxo: attest, verify and publish assumeUTXO snapshot attestations (NIP-332) from your own node. https://assumeutxo.com/
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { makeRpc, CHAIN_NETWORK } from '../lib/rpc.mjs';
import { publicKey, finalizeEvent, verifyEvent, leadingZeroBits, publish, DEFAULT_RELAYS } from '../lib/nostr.mjs';
import { loadKey } from '../lib/key.mjs';
import { STATEMENT, KIND, DISPUTE_KIND, jcs, checkRules, tagsFor, tagsAgree } from '../lib/statement.mjs';
const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const CLIENT = ['client', 'assumeutxo', 'https://www.npmjs.com/package/assumeutxo', VERSION];
const argv = process.argv.slice(2); const cmd = argv[0]; const has = (k) => argv.includes(k); const arg = (k, d) => { const i = argv.indexOf(k); return i > 0 && i + 1 < argv.length ? argv[i + 1] : d; };
const die = (m) => { console.error('assumeutxo: ' + m); process.exit(1); };
const sha256file = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const HELP = `assumeutxo ${VERSION} · https://assumeutxo.com/ · NIP-332

  assumeutxo attest  --rpc <bitcoin.conf> --height <h> [options]   attest the UTXO set hash at a height from your node's own output
  assumeutxo verify  <file> [--rpc <bitcoin.conf>]                 check an attestation: signature, statement, rules, tags; the block on the chain
  assumeutxo publish <file> [--relay wss://… …]                    send a signed attestation to relays
  assumeutxo key     [new] [--key <folder|file>]                   show (or make) the signing key's public side

attest options
  --network <label>    the record's label for the chain (btc, tbtc3, tbtc4, signet, xbt, txbt4); default from the node's chain
  --method <m>         recomputed (default: this node built the set from blocks) or loaded (started from the snapshot, validated)
  --key <folder|file>  the signing key: a folder with git config nostr.privkey, or a hex file; default ~/.config/assumeutxo/key
  --source <dir>       the tree the node was built from: adds build, commit and the binary's sha256 to the claim
  --note "…"           up to 200 characters, no links
  --out <dir>          where to write attestations/<network>-<height>/<pubkey>.json (default: here)
  --dump <path>        write the snapshot file here and keep it (default: next to --out, deleted after hashing; a set is gigabytes)
  --publish            also send the event to the default relays
  --dry                print the statement, sign nothing

Nothing is typed: the facts come from dumptxoutset (rolled back to the height), the chainstate from getchainstates, the
implementation from getnetworkinfo. The key is never printed.`;

async function attest() {
  const conf = arg('--rpc') || die('--rpc <bitcoin.conf> is required'); const height = Number(arg('--height')) || die('--height is required');
  const method = arg('--method', 'recomputed'); if (!['recomputed', 'loaded'].includes(method)) die('--method is recomputed or loaded');
  const note = arg('--note'); if (note && (note.length > 200 || /:\/\/|www\./i.test(note))) die('the note is at most 200 characters, no links');
  const rpc = makeRpc(conf, arg('--datadir'));
  const net = await rpc('getnetworkinfo'); const bc = await rpc('getblockchaininfo'); const cs = await rpc('getchainstates');
  const network = arg('--network', CHAIN_NETWORK[bc.chain]); if (!network) die(`the node is on chain "${bc.chain}": give --network`);
  const genesis = await rpc('getblockhash', 0);
  const active = cs.chainstates.at(-1); let chainstate = 'full'; if (active.snapshot_blockhash) chainstate = 'snapshot:' + (await rpc('getblockheader', active.snapshot_blockhash)).height; const validated = !!active.validated;
  if (bc.initialblockdownload) die(`the node is still syncing (at ${bc.blocks} of ${bc.headers})`);
  if (height > bc.blocks) die(`the node is at ${bc.blocks}, below ${height}`);
  // the facts: dumptxoutset rolled back to the height (the node writes the file; it must be able to write where --dump points)
  // the node writes the file where --dump says, else in --out (default: here); never in a temp filesystem, a set is gigabytes
  const keep = !!arg('--dump'); const dump = resolve(arg('--dump', `${arg('--out', '.')}/assumeutxo-${network}-${height}.dat`)); if (existsSync(dump)) die(`${dump} exists`);
  console.error(`dumptxoutset rollback=${height} on ${net.subversion} at ${bc.blocks} (${chainstate}, validated ${validated})…`); const t0 = Date.now();
  const d = await rpc('dumptxoutset', dump, 'rollback', { rollback: height }); const secs = Math.round((Date.now() - t0) / 1000);
  if (d.base_height !== height) die(`the dump is for ${d.base_height}, not ${height}`);
  const fileSha256 = sha256file(dump); const computedAt = new Date(statSync(dump).mtime).toISOString().slice(0, 19) + 'Z'; if (!keep) unlinkSync(dump);
  console.error(`${d.txoutset_hash} · ${d.coins_written} coins · ${secs} s${keep ? ' · kept ' + dump : ''}`);
  // the build, when the source tree is given
  let build, commit, binarySha256; const src = arg('--source');
  if (src) { build = execFileSync('git', ['-C', src, 'describe', '--tags', '--always', '--dirty'], { encoding: 'utf8' }).trim(); if (build.endsWith('-dirty')) die('the source tree is dirty: the commit would not describe the binary'); commit = execFileSync('git', ['-C', src, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); for (const b of ['build/bin/bitcoind', 'build/src/bitcoind', 'src/bitcoind']) if (existsSync(`${src}/${b}`)) { binarySha256 = sha256file(`${src}/${b}`); break; } }
  const st = { v: STATEMENT, '@type': 'Attestation',
    subject: { network, genesis, height, blockHash: d.base_hash, txoutsetHash: d.txoutset_hash, hashType: 'hash_serialized_3', coins: d.coins_written, chainTxCount: d.nchaintx, fileSha256 },
    claim: { method, chainstate, validated, implementation: net.subversion, ...(build ? { build } : {}), ...(commit ? { commit } : {}), ...(binarySha256 ? { binarySha256 } : {}), computedAt, ...(note ? { note } : {}) } };
  try { checkRules(st); } catch (e) { die(e.message); }
  console.log(JSON.stringify(st, null, 2));
  if (has('--dry')) { console.error('dry run: nothing signed'); return; }
  const { priv, from, created } = loadKey(arg('--key'), { create: true }); const pub = publicKey(priv); if (created) console.error(`made a new key at ${from}`);
  const ev = finalizeEvent({ kind: KIND, pubkey: pub, created_at: Math.floor(Date.now() / 1000), content: jcs(st), tags: tagsFor(st, CLIENT) }, priv);
  const dir = resolve(arg('--out', '.'), `attestations/${network}-${height}`); mkdirSync(dir, { recursive: true }); const file = `${dir}/${pub}.json`;
  if (existsSync(file)) die(`${file} exists: an attestation is not replaced; a correction is a new event that references it`);
  writeFileSync(file, JSON.stringify(ev, null, 2) + '\n');
  console.error(`signed by did:nostr:${pub} (${leadingZeroBits(pub)} bits of work) · event ${ev.id}\nwritten ${file}`);
  if (has('--publish')) await doPublish(ev, []);
}
async function verify() {
  const file = argv[1] || die('verify <file>'); const ev = JSON.parse(readFileSync(file, 'utf8')); const fail = (m) => { console.log('FAIL: ' + m); process.exit(1); };
  const { idOK, sigOK } = verifyEvent(ev); if (!idOK) fail('id does not match the event'); if (!sigOK) fail('signature invalid'); if (![KIND, DISPUTE_KIND].includes(ev.kind)) fail(`kind is ${ev.kind}, not ${KIND} or ${DISPUTE_KIND}`);
  let st; try { st = JSON.parse(ev.content); } catch { fail('content is not JSON'); } if (jcs(st) !== ev.content) fail('content is not canonical (RFC 8785)');
  try { checkRules(st); } catch (e) { fail(e.message); } const dis = tagsAgree(ev, st); if (dis) fail(dis);
  if ((st['@type'] === 'Dispute') !== (ev.kind === DISPUTE_KIND)) fail('a Dispute is kind 3331 and an Attestation is kind 3332');
  const s = st.subject, c = st.claim;
  if (arg('--rpc')) { const rpc = makeRpc(arg('--rpc'), arg('--datadir')); let h; try { h = await rpc('getblockheader', s.blockHash); } catch { fail(`block ${s.blockHash} is not known to this node`); }
    if (s.height !== undefined && h.height !== s.height) fail(`the block is at height ${h.height} on this node, not ${s.height}`); if (h.confirmations < 1) fail('the block is not on this node\'s best chain');
    const g = await rpc('getblockhash', 0); if (s.genesis !== undefined && g !== s.genesis) fail(`genesis differs from this node's: ${g}`); console.log(`on chain: ${s.blockHash.slice(0, 16)}… at ${h.height}, ${h.confirmations} confirmations`); }
  console.log(`ok: ${st['@type'] === 'Dispute' ? 'DISPUTE of ' + st.disputes.txoutsetHash + ' (' + st.disputes.attestations.length + ' attestations), this node got ' : ''}${s.network ?? '?'} ${s.height ?? '?'} ${s.txoutsetHash} ${c.method} by did:nostr:${ev.pubkey} (${leadingZeroBits(ev.pubkey)} bits; ${c.implementation ?? 'implementation not stated'}; ${c.chainstate}${c.computedAt ? '; computed ' + c.computedAt : ''})`);
}
async function doPublish(ev, relays) { const rs = relays.length ? relays : DEFAULT_RELAYS; const res = await publish(ev, rs); for (const r of res) console.error(`${r.ok ? 'ok ' : 'no '} ${r.url}${r.ok ? '' : ' (' + r.why + ')'}`); console.log(`event ${ev.id} accepted by ${res.filter((r) => r.ok).length} of ${rs.length} relays`); }
async function publishCmd() { const file = argv[1] || die('publish <file> [relays…]'); const ev = JSON.parse(readFileSync(file, 'utf8')); if (ev.kind !== KIND || !ev.sig) die('not a signed kind 3332 event'); const relays = argv.slice(2).filter((a) => a.startsWith('wss://')); await doPublish(ev, relays); }
function key() { const { priv, from, created } = loadKey(arg('--key'), { create: argv[1] === 'new' }); const pub = publicKey(priv); console.log(`${created ? 'made ' : ''}key at ${from}\ndid:nostr:${pub}\n${leadingZeroBits(pub)} leading zero bits of work${leadingZeroBits(pub) < 8 ? ' (a mined key, e.g. with rana, starts with more to show)' : ''}`); }
try { if (cmd === 'attest') await attest(); else if (cmd === 'verify') await verify(); else if (cmd === 'publish') await publishCmd(); else if (cmd === 'key') key(); else if (cmd === '--version' || cmd === '-v') console.log(VERSION); else console.log(HELP); } catch (e) { die(e.message); }
process.exit(0);
