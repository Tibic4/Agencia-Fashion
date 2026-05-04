#!/usr/bin/env node
/**
 * Phase 5 / 05-03 — D-11: assetlinks.json drift detector + sync.
 *
 * Authoritative source: crialook-app/store-assets/assetlinks.json
 * Deploy target:        campanha-ia/public/.well-known/assetlinks.json
 *
 * Modes:
 *   node sync-assetlinks.js          -> sync source -> target, exit 0
 *   node sync-assetlinks.js --check  -> exit 0 if identical, exit 1 if drift (CI-friendly)
 *   node sync-assetlinks.js --help   -> usage
 *
 * Run from crialook-app/ (directory of package.json) — paths are relative to repo root,
 * so the script climbs one level (..) before resolving the campanha-ia copy.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '..', 'store-assets', 'assetlinks.json');
const TARGET = path.resolve(__dirname, '..', '..', 'campanha-ia', 'public', '.well-known', 'assetlinks.json');

function usage() {
  process.stdout.write(
    [
      'Usage: node scripts/sync-assetlinks.js [--check | --help]',
      '',
      '  (no flag) Copy authoritative source -> deploy target. Exit 0.',
      '  --check   Compare. Exit 0 if identical, exit 1 if drift detected.',
      '  --help    Show this message.',
      '',
      `Source: ${SOURCE}`,
      `Target: ${TARGET}`,
      '',
    ].join('\n'),
  );
}

function readBytes(p) {
  if (!fs.existsSync(p)) {
    process.stderr.write(`ERR: missing file ${p}\n`);
    process.exit(2);
  }
  return fs.readFileSync(p);
}

const arg = process.argv[2] || '';

if (arg === '--help' || arg === '-h') {
  usage();
  process.exit(0);
}

const sourceBytes = readBytes(SOURCE);

if (arg === '--check') {
  const targetBytes = readBytes(TARGET);
  if (sourceBytes.equals(targetBytes)) {
    process.stdout.write('assetlinks.json: in sync\n');
    process.exit(0);
  }
  process.stderr.write('DRIFT: source and target differ.\n');
  process.stderr.write(`  source: ${SOURCE}\n`);
  process.stderr.write(`  target: ${TARGET}\n`);
  process.stderr.write('Run `npm run assetlinks:sync` (without --check) to overwrite target with source.\n');
  process.exit(1);
}

if (arg === '' || arg === '--write') {
  fs.mkdirSync(path.dirname(TARGET), { recursive: true });
  fs.writeFileSync(TARGET, sourceBytes);
  process.stdout.write(`wrote ${TARGET} (${sourceBytes.length} bytes)\n`);
  process.exit(0);
}

process.stderr.write(`unknown argument: ${arg}\n\n`);
usage();
process.exit(2);
