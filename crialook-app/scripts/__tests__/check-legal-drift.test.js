// M2 Phase 02 D-03: unit + behavioural test for the Option B drift script.
//
// We exercise three layers:
//   1. The internal helpers (entity extraction, freshness parsing, RSC
//      escape decoding) — pure-function tests, fast.
//   2. The CLI in --dry-run against the checked-in fixtures — proves
//      the healthy state stays exit 0 with soft warns.
//   3. The CLI in --dry-run against deliberately broken fixtures
//      written into the same directory — proves hard-fail conditions
//      exit 1. We back up + restore the file in beforeAll/afterAll so
//      the repo stays clean even on assertion failure.
//
// We never hit the network. Live fetch is exercised manually via
// `npm run check:legal-drift` and in CI as a separate job.
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// The script under test is CommonJS — load it via createRequire so we
// can call its exported helpers directly (require.main check inside
// the script keeps the CLI side dormant during import).
const require = createRequire(import.meta.url);
const lib = require('../check-legal-drift.js');

const SCRIPT_PATH = path.join(__dirname, '..', 'check-legal-drift.js');
const FIXTURES = path.join(__dirname, '..', '__fixtures__');
const NODE = process.execPath;

function runDryRun() {
  // Returns { code, stdout, stderr } for an invocation in --dry-run
  // mode. spawnSync (rather than execFileSync) gives us stderr on both
  // success and failure paths; the script writes warns/errors to stderr
  // and the PASS line via console.warn for the soft case.
  const r = spawnSync(NODE, [SCRIPT_PATH, '--dry-run'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return {
    code: r.status ?? 1,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
  };
}

describe('check-legal-drift module exports', () => {
  it('extractEntities pulls emails and URLs from plain text', () => {
    const out = lib.extractEntities(
      'contact us at hello@example.com or https://example.com/policy',
    );
    expect([...out.emails]).toContain('hello@example.com');
    expect([...out.urls]).toContain('https://example.com/policy');
  });

  it('extractEntities decodes Next.js RSC escape sequences', () => {
    // Unicode-escape style: / → /
    const out = lib.extractEntities(
      'Veja https:\\u002f\\u002fcrialook.com.br\\u002fdpo e contato@crialook.com.br',
    );
    expect([...out.urls]).toContain('https://crialook.com.br/dpo');
    expect([...out.emails]).toContain('contato@crialook.com.br');
  });

  it('extractEntities strips trailing punctuation from URLs', () => {
    const out = lib.extractEntities('see https://x.com/y).');
    expect([...out.urls]).toContain('https://x.com/y');
  });

  it('readSiteVigenteDesde parses ISO and PT-BR dates', () => {
    const iso = lib.readSiteVigenteDesde('Vigente desde 2026-04-24');
    expect(iso.toISOString().slice(0, 10)).toBe('2026-04-24');
    const ptbr = lib.readSiteVigenteDesde('vigente desde 24 de abril de 2026');
    expect(ptbr.toISOString().slice(0, 10)).toBe('2026-04-24');
    expect(lib.readSiteVigenteDesde('no anchor here')).toBeNull();
  });

  it('readSiteVigenteDesde decodes RSC-escaped slashes inside dates', () => {
    // The site sometimes ships dates as "2026/04/24" inside RSC.
    const d = lib.readSiteVigenteDesde('Vigente desde 24\\u002f04\\u002f2026');
    expect(d.toISOString().slice(0, 10)).toBe('2026-04-24');
  });

  it('readInAppLastUpdated reads the PT-BR LAST_UPDATED constant', () => {
    const d = lib.readInAppLastUpdated();
    expect(d).toBeInstanceOf(Date);
    // Asserting the year alone keeps the test stable across LAST_UPDATED
    // bumps; the constant always lives in this calendar period.
    expect(d.getUTCFullYear()).toBeGreaterThanOrEqual(2026);
  });

  it('extractFromContentTs returns text with the export title prefixed', () => {
    const text = lib.extractFromContentTs('termos');
    expect(text).toContain('Termos de Uso');
    // Sanity: at least a few of the in-app paragraph fragments survive.
    expect(text.toLowerCase()).toContain('cancelar');
  });

  it('FRESHNESS_WINDOW_DAYS is the documented 30-day window', () => {
    expect(lib.FRESHNESS_WINDOW_DAYS).toBe(30);
  });
});

describe('check-legal-drift CLI (--dry-run, healthy fixtures)', () => {
  it('exits 0 against the checked-in fixtures', () => {
    const r = runDryRun();
    // Expect 0 + the "PASS with warnings" tail (5 soft mismatches are
    // expected because the in-app text is intentionally a summary).
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/Hard-fail:\s*0/);
    expect(r.stdout + r.stderr).toMatch(/PASS/);
  });
});

describe('check-legal-drift CLI (--dry-run, hard-fail fixtures)', () => {
  let backup;
  const target = path.join(FIXTURES, 'site-dpo.html');
  // Deliberately drops the canonical contato@crialook.com.br line and
  // FUTURE-dates the "vigente desde" anchor so the script trips both:
  //   - the entity check (in-app email not on site), and
  //   - the freshness check (in-app LAST_UPDATED is >30d older than
  //     the site's "vigente desde", which is set far in the future).
  const broken = '<html><body><main>Encarregado de Dados (DPO). Versão 1.0 · Vigente desde 2099-01-01. Sem contato.</main></body></html>';

  beforeAll(() => {
    backup = fs.readFileSync(target, 'utf8');
    fs.writeFileSync(target, broken, 'utf8');
  });
  afterAll(() => {
    fs.writeFileSync(target, backup, 'utf8');
  });

  it('exits 1 when in-app references an email the site no longer publishes', () => {
    const r = runDryRun();
    expect(r.code).toBe(1);
    expect(r.stdout + r.stderr).toMatch(/HARD: in-app references emails not on site/);
  });

  it('also hard-fails when in-app LAST_UPDATED is >30d older than site', () => {
    // Same broken fixture, second invocation — both gates trip together.
    const r = runDryRun();
    expect(r.stdout + r.stderr).toMatch(/older than site/);
  });
});

describe('check-legal-drift CLI (--dry-run, missing fixture)', () => {
  // Removing a fixture entirely should soft-warn (not hard-fail), so
  // a forgotten fixture in CI doesn't block the PR — the live fetch
  // is the authoritative path; --dry-run is a developer convenience.
  let backup;
  const target = path.join(FIXTURES, 'site-subprocessadores.html');

  beforeAll(() => {
    backup = fs.readFileSync(target, 'utf8');
    fs.unlinkSync(target);
  });
  afterAll(() => {
    fs.writeFileSync(target, backup, 'utf8');
  });

  it('soft-warns and exits 0 when a fixture is missing', () => {
    const r = runDryRun();
    expect(r.code).toBe(0);
    expect(r.stdout + r.stderr).toMatch(/missing fixture/);
  });
});
