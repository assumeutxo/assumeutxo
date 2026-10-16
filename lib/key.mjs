// The signing key: a 64-hex private key in a folder's git config (nostr.privkey, the create-agent convention) when --key names a folder,
// a hex key in a file when --key names a file, or ~/.config/assumeutxo/key by default (made on first use, mode 600). Never printed.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { statSync } from 'node:fs';
import { newPrivateKey } from './nostr.mjs';
const DEFAULT = `${process.env.XDG_CONFIG_HOME ?? homedir() + '/.config'}/assumeutxo/key`;
export function loadKey(where, { create = false } = {}) {
  if (where && existsSync(where) && statSync(where).isDirectory()) { const k = execFileSync('git', ['-C', where, 'config', '--get', 'nostr.privkey'], { encoding: 'utf8' }).trim(); if (!/^[0-9a-f]{64}$/.test(k)) throw new Error('no nostr.privkey in the git config of ' + where); return { priv: k, from: where + ' (git config nostr.privkey)' }; }
  const file = where ?? DEFAULT;
  if (existsSync(file)) { const k = readFileSync(file, 'utf8').trim(); if (!/^[0-9a-f]{64}$/.test(k)) throw new Error('not a 64-hex key: ' + file); return { priv: k, from: file }; }
  if (!create) throw new Error(`no key at ${file}: run \`assumeutxo key new\` or give --key <folder or file>`);
  mkdirSync(file.slice(0, file.lastIndexOf('/')), { recursive: true, mode: 0o700 }); const k = newPrivateKey(); writeFileSync(file, k + '\n', { mode: 0o600 }); return { priv: k, from: file, created: true };
}
