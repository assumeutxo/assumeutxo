# assumeutxo

The command-line companion to [assumeutxo.com](https://assumeutxo.com/): every assumeUTXO snapshot we know of, and who verified it.

```
npx assumeutxo
```

Version 0.0.1 holds the name and says what it will be:

- `assumeutxo attest <network> <height>`: build a signed attestation from your node's own output (a Nostr event of kind 33332, or a GPG clearsign).
- `assumeutxo verify <file|event>`: check an attestation: signature, author, and that it states what the record states.
- `assumeutxo list [network]`: the snapshots the record knows, with txoutset hash, size, torrent and who attested.
- `assumeutxo node <network> <height>`: start a node from a snapshot and attest when background validation is done.

None of these exist yet. The design is in the open at
[assumeutxo/assumeutxo.github.io/issues](https://github.com/assumeutxo/assumeutxo.github.io/issues).

To attest today, informally, paste your node's `dumptxoutset` output on
[issue 5](https://github.com/assumeutxo/assumeutxo.github.io/issues/5).

MIT.
