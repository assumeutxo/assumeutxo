# assumeutxo

Attest, verify and publish assumeUTXO snapshot attestations ([NIP-332](https://nip-332.github.io/)) from your own node.
The command-line companion to [assumeutxo.com](https://assumeutxo.com/): every snapshot, and who verified it.

```
npx assumeutxo attest --rpc ~/.bitcoin/bitcoin.conf --height 840000
```

That rolls your node's UTXO set back to the height with `dumptxoutset`, reads the hash, the coin count and the chain's transaction
count from what the node printed, reads where your node's chainstate came from (`getchainstates`) and what software it runs
(`getnetworkinfo`), builds a canonical statement, signs it as a kind 3332 Nostr event, and writes
`attestations/<network>-<height>/<pubkey>.json`. Nothing is typed. The key is never printed.

## Commands

| command | what |
|---|---|
| `assumeutxo attest --rpc <bitcoin.conf> --height <h>` | attest the UTXO set hash at a height from your node's own output |
| `assumeutxo link --rpc <bitcoin.conf> --height <h>` | the same, but print a link to the sign page instead; sign in the browser with a NIP-07 extension, no key on disk |
| `assumeutxo verify <file> [--rpc <bitcoin.conf>]` | check an attestation: signature, canonical statement, the rules, tags against content; with a node, that the block is on its chain |
| `assumeutxo publish <file> [wss://relay …]` | send a signed attestation to relays |
| `assumeutxo key [new] [--key <folder or file>]` | show, or make, the signing key's public side |

## attest options

- `--network <label>`: the record's label for the chain: `btc`, `tbtc3`, `tbtc4`, `signet`, `xbt`, `txbt4`. Default from the node's chain.
- `--method recomputed|loaded`: `recomputed` (default) means this node built the set from blocks; `loaded` means it started from the snapshot and background validation finished. The tool refuses a claim the node's `getchainstates` does not support.
- `--key <folder or file>`: a folder whose git config holds `nostr.privkey` (the `npm init agent` convention), or a file with a hex key. Default `~/.config/assumeutxo/key`, made on first use. Your own key is the best key; a key mined with leading zeros ([rana](https://github.com/grunch/rana)) starts with something to show.
- `--source <dir>`: the tree the node was built from; adds the release tag, the commit and the binary's sha256 to the claim.
- `--note "…"`: up to 200 characters, no links.
- `--out <dir>`: where the attestation (and, while it is written, the dump) goes. Default: here. A set is gigabytes; do not point it at a small temp filesystem.
- `--dump <path>`: keep the snapshot file.
- `--publish`: also send the event to the default relays.
- `--dry`: print the statement and sign nothing.

The node must be unpruned to roll back, and the tool must run where the node can write the dump file.

## Without a key on disk

```
npx assumeutxo link --rpc ~/.bitcoin/bitcoin.conf --height 965000
```

Same node work, nothing signed: it prints a link to the [sign page](https://play-grounds.github.io/assumeutxo/sign/) that carries
what the node printed. Open it in a browser with a NIP-07 extension (Podkey, nos2x, Alby), check the statement the page shows,
sign, download the event file, publish. The link holds the dump output, your node's chainstate and software, the file hash and
any note; keep it to yourself if those are private. `link` takes the attest options except `--key`, `--out`, `--publish` and `--dry`.

## Then

Publish the event, or open a pull request adding the file to
[assumeutxo/assumeutxo.github.io](https://github.com/assumeutxo/assumeutxo.github.io) under `attestations/`. The record shows it
on the snapshot's page with its checks run in the browser.

## The statement

See [NIP-332](https://nip-332.github.io/spec/). In short: a `subject` (block hash, txoutset hash and its hash function, coins, chain
transaction count, the file's sha256) and a `claim` (method, where the node's chainstate came from and whether it is validated, the
implementation, build and commit as the node and its source report them, when it was computed). Signed as a regular Nostr event:
an attestation is never replaced; a correction is a new event.

MIT.

## Changes

- 0.0.3: `link` prints a prefilled sign-page link instead of signing, for signing in the browser with a NIP-07 extension and no key on disk.
- 0.0.2: `verify` accepts a Dispute (kind 3331); a node still syncing may attest its exact tip; the snapshot file is hashed in a stream, so mainnet files past 2 GiB work.
- 0.0.1: attest, verify, publish, key.
