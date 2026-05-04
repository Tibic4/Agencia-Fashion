#!/usr/bin/env node
/**
 * check-legal-drift.js — Phase 7 plan 07-07 (D-06, D-07)
 *
 * Fetches the 3 public legal URLs at crialook.com.br and diffs each against
 * the corresponding export in lib/legal/content.ts. Fails CI if drift is
 * detected; fail-soft on persistent site outage so CDN flake does not
 * block PRs. After plan 07-03 established the day-zero baseline, this
 * script is the forever-after gate.
 *
 * Exit codes:
 *   0  no drift OR site unreachable fail-soft
 *   1  real drift detected OR 4xx (URL renamed/removed) OR content.ts parse error
 *
 * Flags:
 *   --dry-run   read from scripts/__fixtures__/site-*.html instead of fetching
 *
 * Diff approach (v1, simple):
 *   - Normalize both sides (lowercase, NFC unicode, collapse whitespace,
 *     strip typographic punctuation [smart quotes, em/en dashes, single
 *     quotes], CRLF → LF).
 *   - Split into sentence-ish chunks at '. ' (period + space).
 *   - Compare as sorted sets (additions + removals captured; order
 *     changes within a section are NOT flagged).
 *
 * Limitation: order changes are not flagged. Acceptable for v1; if Play
 * submission ever requires ordered checking, upgrade to line-by-line
 * edit-distance.
 */

const fs = require('fs');
const path = require('path');

// CONTEXT D-06 primary URLs:
//   https://crialook.com.br/privacidade
//   https://crialook.com.br/termos
//   https://crialook.com.br/dpo
const URLS = [
  { slug: 'privacidade', exportName: 'privacidade' },
  { slug: 'termos',      exportName: 'termos' },
  { slug: 'dpo',         exportName: 'dpo' },
];

const RETRY_DELAYS_MS = [10_000, 20_000, 40_000];
const FETCH_TIMEOUT_MS = 30_000;
const DRY_RUN = process.argv.includes('--dry-run');
const SCRIPT_DIR = __dirname;
const CONTENT_TS = path.join(SCRIPT_DIR, '..', 'lib', 'legal', 'content.ts');
const FIXTURES_DIR = path.join(SCRIPT_DIR, '__fixtures__');

// ─── Helpers ───────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function stripHtml(html) {
  // Try <main>, fallback <article>, fallback <body>, then raw.
  // Note: the marketing site (Next.js App Router + RSC) does not always emit
  // <main>; in that case the diff falls back to whole-body and the noise
  // floor goes up. We compensate via the sentence-length filter (>= 8 chars)
  // which drops short nav/footer fragments.
  const main =
    (html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) || [])[1] ||
    (html.match(/<article[^>]*>([\s\S]*?)<\/article>/i) || [])[1] ||
    (html.match(/<body[^>]*>([\s\S]*?)<\/body>/i) || [])[1] ||
    html;
  return main
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'");
}

function normalize(s) {
  return s
    .normalize('NFC')
    .replace(/\r\n/g, '\n')             // CRLF → LF (cross-OS source files)
    .toLowerCase()
    .replace(/[“”‘’–—"']/g, '') // smart quotes + dashes + plain quotes
    .replace(/\s+/g, ' ')
    .trim();
}

function sentencize(s) {
  return normalize(s)
    .split(/(?<=\.) /)
    .map((x) => x.trim())
    .filter((x) => x.length >= 8); // skip short fragments (numbers, headings)
}

function diff(siteSentences, ts) {
  const tsSet = new Set(ts);
  const siteSet = new Set(siteSentences);
  const onlyInSite = siteSentences.filter((s) => !tsSet.has(s));
  const onlyInTs = ts.filter((s) => !siteSet.has(s));
  return { onlyInSite, onlyInTs };
}

// Read content.ts as string and extract a given export's text content.
function extractFromContentTs(exportName) {
  const src = fs.readFileSync(CONTENT_TS, 'utf8');
  // Find the export block: `export const <name> = { ... \n};`
  const re = new RegExp('export const ' + exportName + ' = \\{([\\s\\S]*?)\\n\\};', 'm');
  const m = src.match(re);
  if (!m) {
    throw new Error('content.ts: could not find export const ' + exportName + ' = { ... };');
  }
  const body = m[1];
  const out = [];
  // Pull every string literal we can find inside `text:` and `items: [...]`.
  // v1 heuristic — fragile if content.ts shape changes without script update.
  for (const tm of body.matchAll(/text:\s*['"`]([\s\S]*?)['"`]/g)) {
    out.push(tm[1]);
  }
  for (const im of body.matchAll(/items:\s*\[([\s\S]*?)\]/g)) {
    for (const sm of im[1].matchAll(/['"`]([\s\S]*?)['"`]/g)) {
      out.push(sm[1]);
    }
  }
  // Also pull title/subtitle if present.
  const title = (body.match(/title:\s*['"`]([^'"`]*)['"`]/) || [])[1];
  if (title) out.unshift(title);
  const subtitle = (body.match(/subtitle:\s*['"`]([\s\S]*?)['"`]/) || [])[1];
  if (subtitle) out.unshift(subtitle);
  return sentencize(out.join('. '));
}

async function fetchWithRetry(url) {
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length + 1; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctl.signal, redirect: 'follow' });
      clearTimeout(timer);
      if (res.status >= 500) {
        throw new Error('HTTP ' + res.status);
      }
      if (res.status >= 400) {
        // 4xx is real drift (URL gone); do NOT retry, do NOT fail-soft.
        return { ok: false, status: res.status, body: null, hardFail: true };
      }
      const body = await res.text();
      return { ok: true, status: res.status, body, hardFail: false };
    } catch (err) {
      clearTimeout(timer);
      if (attempt < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[attempt];
        console.error(
          '⚠ fetch ' + url + ' attempt ' + (attempt + 1) +
          ' failed (' + err.message + '); retry/backoff in ' + delay + 'ms ...',
        );
        await sleep(delay);
        continue;
      }
      // Exhausted retries on 5xx or network error → fail-soft trigger.
      return { ok: false, status: 0, body: null, hardFail: false, err };
    }
  }
}

async function loadSiteContent(slug) {
  if (DRY_RUN) {
    const p = path.join(FIXTURES_DIR, 'site-' + slug + '.html');
    if (!fs.existsSync(p)) {
      console.error('⚠ dry-run: missing fixture ' + p);
      return { hardFail: false, soft: true, sentences: [] };
    }
    return {
      hardFail: false,
      soft: false,
      sentences: sentencize(stripHtml(fs.readFileSync(p, 'utf8'))),
    };
  }
  const url = 'https://crialook.com.br/' + slug;
  const r = await fetchWithRetry(url);
  if (r.hardFail) {
    console.error('✗ ' + url + ': HTTP ' + r.status + ' — URL changed or removed (hard drift)');
    return { hardFail: true, soft: false, sentences: [] };
  }
  if (!r.ok) {
    console.error('⚠ SITE UNREACHABLE: ' + url + ' after retries — fail-soft');
    return { hardFail: false, soft: true, sentences: [] };
  }
  return {
    hardFail: false,
    soft: false,
    sentences: sentencize(stripHtml(r.body)),
  };
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('check-legal-drift.js (' + (DRY_RUN ? 'dry-run' : 'live') + ')');
  let driftCount = 0;
  let hardFailCount = 0;
  let softFailCount = 0;

  for (const { slug, exportName } of URLS) {
    console.log('\n--- ' + slug + ' ---');

    let tsSentences;
    try {
      tsSentences = extractFromContentTs(exportName);
    } catch (err) {
      console.error('✗ content.ts parse error for ' + exportName + ': ' + err.message);
      driftCount++;
      continue;
    }

    const site = await loadSiteContent(slug);
    if (site.hardFail) {
      hardFailCount++;
      continue;
    }
    if (site.soft) {
      softFailCount++;
      continue;
    }

    const d = diff(site.sentences, tsSentences);
    if (d.onlyInSite.length === 0 && d.onlyInTs.length === 0) {
      console.log('✓ NO DRIFT (' + tsSentences.length + ' sentences compared)');
    } else {
      driftCount++;
      console.log('✗ DRIFT FOUND');
      if (d.onlyInSite.length) {
        console.log('  Site has ' + d.onlyInSite.length + ' sentence(s) not in content.ts:');
        for (const s of d.onlyInSite.slice(0, 10)) console.log('    + ' + s.slice(0, 120));
        if (d.onlyInSite.length > 10) {
          console.log('    ... (+' + (d.onlyInSite.length - 10) + ' more)');
        }
      }
      if (d.onlyInTs.length) {
        console.log('  content.ts has ' + d.onlyInTs.length + ' sentence(s) not on site:');
        for (const s of d.onlyInTs.slice(0, 10)) console.log('    - ' + s.slice(0, 120));
        if (d.onlyInTs.length > 10) {
          console.log('    ... (+' + (d.onlyInTs.length - 10) + ' more)');
        }
      }
    }
  }

  console.log('\n--- Summary ---');
  console.log('Drift:     ' + driftCount + ' URL(s)');
  console.log('Hard-fail: ' + hardFailCount + ' URL(s) (4xx)');
  console.log('Soft-fail: ' + softFailCount + ' URL(s) (site unreachable)');

  if (driftCount > 0 || hardFailCount > 0) {
    console.error('\n✗ FAIL: drift or hard-fail detected. Reconcile per crialook-app/docs/LEGAL_DRIFT_RECONCILIATION.md.');
    process.exit(1);
  }
  if (softFailCount > 0) {
    console.error('\n⚠ Pass with caveats: ' + softFailCount + ' URL(s) unreachable; re-run when site is back.');
  }
  console.log('\n✓ PASS');
  process.exit(0);
}

main().catch((err) => {
  console.error('✗ uncaught error: ' + (err.stack || err.message));
  process.exit(1);
});
