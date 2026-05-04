#!/usr/bin/env node
/**
 * M3-01 — apply-clerk-keys.js
 *
 * Reads scripts/clerk-keys-mapping.md, validates the 3 Clerk publishable
 * keys per the rules listed in that doc, and writes them into
 * crialook-app/eas.json (build.<profile>.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY).
 *
 * Idempotent: if eas.json already matches the mapping, exits 0 with no write.
 *
 * Usage:
 *   node scripts/apply-clerk-keys.js          -> apply mapping to eas.json
 *   node scripts/apply-clerk-keys.js --check  -> validate mapping + assert eas.json in sync; exit 1 on drift
 *   node scripts/apply-clerk-keys.js --help   -> usage
 *
 * Exit codes:
 *   0 — apply succeeded (or no-op), or --check passed
 *   1 — validation failed, OR --check found drift
 *   2 — IO error (missing files etc.)
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SCRIPT_DIR = __dirname;
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const MAPPING_DOC = path.join(SCRIPT_DIR, 'clerk-keys-mapping.md');
const EAS_JSON = path.join(REPO_ROOT, 'crialook-app', 'eas.json');

const PROFILES = ['development', 'preview', 'production'];
const EXPECTED_PREFIX = {
  development: 'pk_test_',
  preview: 'pk_test_',
  production: 'pk_live_',
};

function usage() {
  process.stdout.write(
    [
      'Usage: node scripts/apply-clerk-keys.js [--check | --help]',
      '',
      '  (no flag) Read scripts/clerk-keys-mapping.md, validate, write into crialook-app/eas.json.',
      '  --check   Validate mapping + assert eas.json in sync. Exit 1 on drift.',
      '  --help    Show this message.',
      '',
      `Mapping doc: ${MAPPING_DOC}`,
      `Target:      ${EAS_JSON}`,
      '',
    ].join('\n'),
  );
}

function readFileOr(p, mode) {
  if (!fs.existsSync(p)) {
    process.stderr.write(`ERR: missing file ${p}\n`);
    process.exit(2);
  }
  return fs.readFileSync(p, mode);
}

/**
 * Parse the mapping table from the markdown doc.
 * Returns { development, preview, production } or throws.
 *
 * Table format (matches the doc):
 *   | Profile        | Bundle ID                    | Expected prefix | Value (paste here)                              |
 *   | -------------- | ---------------------------- | --------------- | ----------------------------------------------- |
 *   | `development`  | `com.crialook.app.dev`       | `pk_test_`      | <paste-dev-clerk-publishable-key>               |
 *   | ...
 */
function parseMapping(md) {
  const out = {};
  const lines = md.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith('|')) continue;
    if (line.startsWith('| ---')) continue;
    if (line.startsWith('| Profile')) continue;
    // Split on |, trim each cell.
    const cells = line.split('|').map((c) => c.trim()).filter((c) => c.length > 0);
    if (cells.length < 4) continue;
    // Cell 0 = profile (with backticks), cell 3 = value.
    const profile = cells[0].replace(/`/g, '').trim();
    const value = cells[3].trim();
    if (PROFILES.includes(profile)) {
      out[profile] = value;
    }
  }
  return out;
}

/**
 * Validate the mapping per the 7 rules in clerk-keys-mapping.md.
 * Returns null on success, or an array of error strings on failure.
 */
function validateMapping(mapping) {
  const errors = [];
  for (const p of PROFILES) {
    const v = mapping[p];
    if (typeof v !== 'string' || v.length === 0) {
      errors.push(`profile "${p}": missing or empty value in mapping doc`);
      continue;
    }
    if (v.includes('<paste-')) {
      errors.push(`profile "${p}": still contains "<paste-" placeholder — owner has not pasted the real key`);
    }
    if (v.includes('PLACEHOLDER')) {
      errors.push(`profile "${p}": value contains "PLACEHOLDER" — refusing to apply`);
    }
    const prefix = EXPECTED_PREFIX[p];
    if (!v.includes('<paste-') && !v.includes('PLACEHOLDER') && !v.startsWith(prefix)) {
      errors.push(`profile "${p}": value must start with "${prefix}" (got: "${v.slice(0, 12)}…")`);
    }
  }
  // Distinctness check (only meaningful if all three are non-placeholder).
  const realValues = PROFILES.map((p) => mapping[p]).filter(
    (v) => typeof v === 'string' && !v.includes('<paste-') && !v.includes('PLACEHOLDER'),
  );
  if (realValues.length === 3 && new Set(realValues).size !== 3) {
    errors.push('all three keys must be distinct (got duplicates)');
  }
  return errors.length === 0 ? null : errors;
}

function readEas() {
  const raw = readFileOr(EAS_JSON, 'utf8');
  let json;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    process.stderr.write(`ERR: eas.json is not valid JSON: ${err.message}\n`);
    process.exit(2);
  }
  return { raw, json };
}

function writeEas(json) {
  // Preserve 2-space indent + trailing newline (matching the existing file).
  const out = JSON.stringify(json, null, 2) + '\n';
  fs.writeFileSync(EAS_JSON, out);
}

function checkInSync(json, mapping) {
  const drift = [];
  for (const p of PROFILES) {
    const cur = json?.build?.[p]?.env?.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const want = mapping[p];
    if (cur !== want) {
      drift.push({ profile: p, current: cur, want });
    }
  }
  return drift;
}

function applyToEas(json, mapping) {
  for (const p of PROFILES) {
    if (!json.build?.[p]?.env) {
      process.stderr.write(`ERR: eas.json missing build.${p}.env block\n`);
      process.exit(2);
    }
    json.build[p].env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = mapping[p];
  }
  return json;
}

// ─────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────

const arg = process.argv[2] || '';

if (arg === '--help' || arg === '-h') {
  usage();
  process.exit(0);
}

if (arg !== '' && arg !== '--check' && arg !== '--write') {
  process.stderr.write(`unknown argument: ${arg}\n\n`);
  usage();
  process.exit(2);
}

const md = readFileOr(MAPPING_DOC, 'utf8');
const mapping = parseMapping(md);

const missing = PROFILES.filter((p) => !(p in mapping));
if (missing.length > 0) {
  process.stderr.write(
    `ERR: mapping doc parsed, but profile(s) not found: ${missing.join(', ')}\n` +
      `     Check the table format in ${MAPPING_DOC}\n`,
  );
  process.exit(2);
}

const validationErrors = validateMapping(mapping);
if (validationErrors) {
  process.stderr.write('VALIDATION FAILED:\n');
  for (const e of validationErrors) {
    process.stderr.write(`  - ${e}\n`);
  }
  process.stderr.write(
    `\nFix the value cells in ${MAPPING_DOC} and re-run.\n` +
      `See crialook-app/docs/CLERK_KEYS.md for how to obtain the keys.\n`,
  );
  process.exit(1);
}

const { json } = readEas();

if (arg === '--check') {
  const drift = checkInSync(json, mapping);
  if (drift.length === 0) {
    process.stdout.write('OK: eas.json in sync with mapping doc (3 profiles)\n');
    process.exit(0);
  }
  process.stderr.write('DRIFT: eas.json does not match mapping doc:\n');
  for (const d of drift) {
    const cur = d.current ? `"${String(d.current).slice(0, 16)}…"` : '<missing>';
    const want = `"${String(d.want).slice(0, 16)}…"`;
    process.stderr.write(`  - ${d.profile}: current=${cur}  want=${want}\n`);
  }
  process.stderr.write('\nRun without --check to apply.\n');
  process.exit(1);
}

// Apply mode (no flag or --write).
const drift = checkInSync(json, mapping);
if (drift.length === 0) {
  process.stdout.write('OK: eas.json already in sync (no-op)\n');
  process.exit(0);
}
applyToEas(json, mapping);
writeEas(json);
process.stdout.write(
  `wrote ${EAS_JSON}\n` +
    `  updated ${drift.length} profile env block(s): ${drift.map((d) => d.profile).join(', ')}\n`,
);
process.exit(0);
