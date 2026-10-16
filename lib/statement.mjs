// The NIP-332 statement (0.0.1): subject and claim, canonical (RFC 8785); the rules; the event's tags.
export const STATEMENT = '0.0.1', KIND = 3332;
export const jcs = (v) => v === null || typeof v !== 'object' ? JSON.stringify(v) : Array.isArray(v) ? '[' + v.map(jcs).join(',') + ']' : '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + jcs(v[k])).join(',') + '}';
export function checkRules(st) {
  const s = st.subject, c = st.claim; const bad = (m) => { throw new Error(m); };
  if (st.v !== STATEMENT || st['@type'] !== 'Attestation') bad('not an Attestation statement ' + STATEMENT);
  for (const k of ['blockHash', 'txoutsetHash', 'hashType']) if (s?.[k] === undefined) bad('subject lacks ' + k);
  for (const k of ['method', 'chainstate', 'validated']) if (c?.[k] === undefined) bad('claim lacks ' + k);
  if (!/^[0-9a-f]{64}$/.test(s.blockHash) || !/^[0-9a-f]{64}$/.test(s.txoutsetHash)) bad('hashes must be 64 hex'); if (s.hashType !== 'hash_serialized_3') bad('hashType ' + s.hashType + ' is not one this verifier knows');
  if (!['recomputed', 'loaded'].includes(c.method)) bad('method ' + c.method);
  if (c.method === 'loaded' && !(c.validated && String(c.chainstate).startsWith('snapshot:'))) bad('loaded means: this node started from the snapshot and background validation finished; it reports chainstate ' + c.chainstate + ', validated ' + c.validated);
  if (c.method === 'recomputed' && !c.validated) bad('recomputed needs a validated chainstate');
  if (c.method === 'recomputed' && String(c.chainstate).startsWith('snapshot:') && s.height !== undefined && Number(c.chainstate.slice(9)) >= s.height) bad(`this node's chainstate came from a snapshot at ${c.chainstate.slice(9)}: it has not recomputed ${s.height}`);
  if (c.note !== undefined && (typeof c.note !== 'string' || c.note.length > 200 || /:\/\/|www\./i.test(c.note))) bad('the note is at most 200 characters and carries no links');
}
export function tagsFor(st, client) { const s = st.subject, c = st.claim; return [['v', st.v], ...(s.network ? [['network', s.network]] : []), ...(s.height !== undefined ? [['height', String(s.height)]] : []), ['hash', s.blockHash], ['txoutset_hash', s.txoutsetHash], ['method', c.method], ...(c.implementation ? [['implementation', c.implementation]] : []), client, ['t', 'attestation'], ['t', 'assumeutxo'], ...(s.network ? [['t', s.network]] : [])]; }
// tags repeat the subject; the content decides, and they must agree
export function tagsAgree(ev, st) { const s = st.subject, c = st.claim; const tag = (n) => ev.tags.find((t) => t[0] === n)?.[1]; const want = { v: st.v, network: s.network, height: s.height === undefined ? undefined : String(s.height), hash: s.blockHash, txoutset_hash: s.txoutsetHash, method: c.method, implementation: c.implementation }; for (const [k, v] of Object.entries(want)) if (tag(k) !== undefined && v !== undefined && tag(k) !== v) return 'tag ' + k + ' disagrees with the content'; return null; }
