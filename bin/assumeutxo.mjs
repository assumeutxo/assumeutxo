#!/usr/bin/env node
// assumeutxo 0.0.1: the name, and what it will be. Nothing here signs, fetches or runs a node yet.
const cmd = process.argv[2];
const lines = [
  'assumeutxo 0.0.1 · https://assumeutxo.com/',
  '',
  'Every assumeUTXO snapshot we know of, and who verified it. This package will be the command-line companion:',
  '',
  '  assumeutxo attest   <network> <height>   build a signed attestation from your node\'s own output (kind 33332, or GPG)',
  '  assumeutxo verify   <file|event>         check an attestation: signature, author, and that it states what the record states',
  '  assumeutxo list     [network]            the snapshots the record knows, with txoutset hash, size, torrent and who attested',
  '  assumeutxo node     <network> <height>   start a node from a snapshot and attest when background validation is done',
  '',
  'None of these exist yet. The design is in the open:',
  '  https://github.com/assumeutxo/assumeutxo.github.io/issues',
  '',
  'To attest today, informally: paste your node\'s dumptxoutset output on',
  '  https://github.com/assumeutxo/assumeutxo.github.io/issues/5',
];
if (cmd && !['help', '-h', '--help', '--version', '-v'].includes(cmd)) lines.unshift(`assumeutxo: "${cmd}" is not here yet.`, '');
if (['--version', '-v'].includes(cmd)) { console.log('0.0.1'); process.exit(0); }
console.log(lines.join('\n'));
