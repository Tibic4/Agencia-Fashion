#!/usr/bin/env node
/**
 * check-legal-drift.js — M2 Phase 2 (Option B)
 *
 * Validates ESSENCE alignment between the in-app legal summary
 * (lib/legal/content.ts) and the canonical site policies at
 * crialook.com.br/{slug}. Replaces the M1 P7 byte-for-byte sentence
 * comparison (which fired on every wording rewrite) with an
 * essence-equivalence check tailored to the Option B model where:
 *
 *   - Site is the canonical source of truth (formal V1.0 LGPD).
 *   - In-app is a friendly SUMMARY linking to the site.
 *   - Both must agree on key entities (controlador, contato, slugs)
 *     and the in-app must not be older than the site by >30 days.
 *
 * Exit codes:
 *   0  healthy state OR soft mismatch (warnings printed, CI green)
 *   1  HARD-FAIL: site 4xx, in-app references entity not on site,
 *      or in-app LAST_UPDATED >30 days older than site "vigente desde"
 *
 * Hard-fail conditions (block CI):
 *   1. Site URL returns 4xx (URL renamed/removed).
 *   2. In-app summary mentions an email/URL that the site does not
 *      also mention (in-app cannot promise something site does not).
 *   3. In-app LAST_UPDATED is >30 days older than the site's
 *      "vigente desde YYYY-MM-DD" anchor.
 *
 * Soft-warn conditions (CI green, printed for owner awareness):
 *   1. Wording rewrites between the two surfaces (expected by design).
 *   2. Site briefly unreachable on retries (network flake, fail-soft).
 *   3. Site does not advertise a "vigente desde" date — freshness
 *      window cannot be checked.
 *
 * Flags:
 *   --dry-run   read from scripts/__fixtures__/site-*.html instead of
 *               fetching, useful in CI without network or in tests.
 */

const fs = require('fs');
const path = require('path');

// All five legal surfaces are tracked. Each lists the slug used both
// for the public URL and the fixture filename. The exportName matches
// the variable name in lib/legal/content.ts so the parser can find it.
const URLS = [
  { slug: 'privacidade',            exportName: 'privacidade' },
  { slug: 'termos',                 exportName: 'termos' },
  { slug: 'dpo',                    exportName: 'dpo' },
  { slug: 'subprocessadores',       exportName: 'subprocessadores' },
  { slug: 'consentimento-biometrico', exportName: 'consentimentoBiometrico' },
];

const RETRY_DELAYS_MS = [10_000, 20_000, 40_000];
const FETCH_TIMEOUT_MS = 30_000;
const FRESHNESS_WINDOW_DAYS = 30;
const DRY_RUN = process.argv.includes('--dry-run');
const SCRIPT_DIR = __dirname;
const CONTENT_TS = path.join(SCRIPT_DIR, '..', 'lib', 'legal', 'content.ts');
const FIXTURES_DIR = path.join(SCRIPT_DIR, '__fixtures__');

// Tracks the global verdict so main() can sum hard vs soft outcomes.
const result = {
  hardFail: 0,
  softWarn: 0,
  ok: 0,
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function stripHtml(html) {
  // Same shape as the M1 P7 stripper. We only need the visible body
  // text — entities, URLs and emails — not the structural markup.
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
    .replace(/\r\n/g, '\n')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Pull every email + URL we can find. Used to enforce that in-app does
// not promise the user a contact channel the site does not also list.
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const URL_RE = /https?:\/\/[^\s"'<>)]+/gi;

// Returns the lower-case hostname for a URL or null if unparseable.
// Used by the entity check so vendor URL matching is host-scoped
// (vendors flip `/legal/privacy` ↔ `/privacy` paths over time, and
// requiring exact-URL match created false positives in M2-02 testing).
function safeHost(u) {
  try {
    return new URL(u).hostname.toLowerCase();
  } catch (_e) {
    return null;
  }
}

function extractEntities(text) {
  // Decode the two common Next.js RSC escape forms before scanning so
  // entity matching works against the raw streamed payload too:
  //   - "/" → "/"  (URLs in RSC chunks come back as JSON strings)
  //   - "\\/"    → "/"  (some payloads escape only the slashes)
  const t = text
    .replace(/\\u002[fF]/g, '/')
    .replace(/\\\//g, '/')
    .toLowerCase();
  const emails = new Set((t.match(EMAIL_RE) || []).map((s) => s.replace(/\.$/, '')));
  // Strip trailing punctuation/path-fragments that grabbing greedy URLs
  // may have caught (e.g. "https://x.com/y).") so equality holds across
  // surfaces with different surrounding markup.
  const urls = new Set(
    (t.match(URL_RE) || []).map((s) => s.replace(/[.,);:!?\\]+$/, '')),
  );
  return { emails, urls };
}

// Read content.ts as plain text and pull every string literal we can.
// Same heuristic as M1 P7 with one addition: also surface the file's
// LAST_UPDATED constant so the freshness check has an anchor.
function extractFromContentTs(exportName) {
  const src = fs.readFileSync(CONTENT_TS, 'utf8');
  const re = new RegExp('export const ' + exportName + ' = \\{([\\s\\S]*?)\\n\\};', 'm');
  const m = src.match(re);
  if (!m) {
    throw new Error('content.ts: could not find export const ' + exportName + ' = { ... };');
  }
  const body = m[1];
  const out = [];
  for (const tm of body.matchAll(/text:\s*['"`]([\s\S]*?)['"`]/g)) {
    out.push(tm[1]);
  }
  for (const lm of body.matchAll(/label:\s*['"`]([\s\S]*?)['"`]/g)) {
    out.push(lm[1]);
  }
  for (const hm of body.matchAll(/href:\s*['"`]([\s\S]*?)['"`]/g)) {
    out.push(hm[1]);
  }
  for (const im of body.matchAll(/items:\s*\[([\s\S]*?)\]/g)) {
    for (const sm of im[1].matchAll(/['"`]([\s\S]*?)['"`]/g)) {
      out.push(sm[1]);
    }
  }
  const title = (body.match(/title:\s*['"`]([^'"`]*)['"`]/) || [])[1];
  if (title) out.unshift(title);
  const subtitle = (body.match(/subtitle:\s*['"`]([\s\S]*?)['"`]/) || [])[1];
  if (subtitle) out.unshift(subtitle);
  return out.join(' \n ');
}

// Returns the in-app LAST_UPDATED date as a JS Date, or null if the
// constant is missing/unparseable. Accepts both the PT-BR display
// form ("4 de maio de 2026") and the ISO form ("2026-05-04") — the
// repo currently uses PT-BR.
const PT_MONTHS = {
  janeiro: 0, fevereiro: 1, 'março': 2, marco: 2, abril: 3, maio: 4, junho: 5,
  julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
};

function readInAppLastUpdated() {
  const src = fs.readFileSync(CONTENT_TS, 'utf8');
  const m = src.match(/const LAST_UPDATED\s*=\s*['"`]([^'"`]+)['"`]/);
  if (!m) return null;
  const raw = m[1].trim().toLowerCase();
  // ISO?
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  }
  // PT-BR "4 de maio de 2026"
  const pt = raw.match(/^(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})$/);
  if (pt) {
    const month = PT_MONTHS[pt[2]];
    if (month !== undefined) {
      return new Date(Date.UTC(Number(pt[3]), month, Number(pt[1])));
    }
  }
  return null;
}

// Looks for the site's "Vigente desde YYYY-MM-DD" anchor (case
// insensitive, hyphens or slashes). Returns null if absent — the
// soft-warn path will note that freshness cannot be enforced.
function readSiteVigenteDesde(rawText) {
  // Same RSC-escape decode as extractEntities so the anchor is reachable
  // when the input is the streamed Next.js payload.
  const text = rawText.replace(/\\u002[fF]/g, '/').replace(/\\\//g, '/');
  // "vigente desde 2026-04-24" or "vigente desde 24/04/2026" or
  // "vigente desde 24 de abril de 2026"
  const iso = text.match(/vigente\s+desde\s+(\d{4})[-/](\d{2})[-/](\d{2})/i);
  if (iso) {
    return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  }
  const br = text.match(/vigente\s+desde\s+(\d{1,2})[-/](\d{1,2})[-/](\d{4})/i);
  if (br) {
    return new Date(Date.UTC(Number(br[3]), Number(br[2]) - 1, Number(br[1])));
  }
  const pt = text.toLowerCase().match(/vigente\s+desde\s+(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/);
  if (pt) {
    const month = PT_MONTHS[pt[2]];
    if (month !== undefined) {
      return new Date(Date.UTC(Number(pt[3]), month, Number(pt[1])));
    }
  }
  return null;
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
      return { ok: false, status: 0, body: null, hardFail: false, err };
    }
  }
}

async function loadSiteContent(slug) {
  if (DRY_RUN) {
    const p = path.join(FIXTURES_DIR, 'site-' + slug + '.html');
    if (!fs.existsSync(p)) {
      console.error('⚠ dry-run: missing fixture ' + p);
      return { hardFail: false, soft: true, text: '', body: '' };
    }
    const body = fs.readFileSync(p, 'utf8');
    return {
      hardFail: false,
      soft: false,
      text: stripHtml(body),
      body,
    };
  }
  const url = 'https://crialook.com.br/' + slug;
  const r = await fetchWithRetry(url);
  if (r.hardFail) {
    console.error('✗ ' + url + ': HTTP ' + r.status + ' — URL changed or removed (hard drift)');
    return { hardFail: true, soft: false, text: '', body: '' };
  }
  if (!r.ok) {
    console.error('⚠ SITE UNREACHABLE: ' + url + ' after retries — fail-soft');
    return { hardFail: false, soft: true, text: '', body: '' };
  }
  return {
    hardFail: false,
    soft: false,
    text: stripHtml(r.body),
    body: r.body,
  };
}

// ─── Per-slug check ────────────────────────────────────────────────────────

function checkSlug(slug, exportName, site, inAppLastUpdated) {
  console.log('\n--- ' + slug + ' ---');

  if (site.hardFail) {
    result.hardFail++;
    return;
  }

  let inAppText;
  try {
    inAppText = extractFromContentTs(exportName);
  } catch (err) {
    console.error('✗ content.ts parse error for ' + exportName + ': ' + err.message);
    result.hardFail++;
    return;
  }

  if (site.soft) {
    console.warn('⚠ site soft-fail (unreachable / fixture missing) — skipping essence check');
    result.softWarn++;
    return;
  }

  const inAppEntities = extractEntities(inAppText);
  // Site entity check looks at the RAW HTML body, not the stripped
  // visible text. The marketing site is Next.js App Router + RSC, so
  // the visible content is delivered as JSON inside <script> tags;
  // stripping <script> for the wording diff (line below) is correct,
  // but for entity equivalence we must also see what RSC ships.
  const siteEntities = extractEntities(site.body || site.text);

  // ── Hard check #1: every email the in-app advertises must be on the
  // site. The in-app cannot promise a contact channel the site does
  // not also publish (would diverge from the canonical disclosure).
  const emailsMissingOnSite = [...inAppEntities.emails].filter(
    (e) => !siteEntities.emails.has(e),
  );
  // ── Hard check #2: every external URL the in-app references must
  // map to a host the site also references. We match by HOSTNAME, not
  // by full URL — vendors (Clerk, Anthropic, Google) sometimes shuffle
  // their `/legal/privacy` ↔ `/privacy` path; that's a wording-level
  // drift, not a missing-vendor drift, and would be a soft-warn (it
  // gets surfaced in the wording-diff path below if material).
  const siteHosts = new Set(
    [...siteEntities.urls].map((u) => safeHost(u)).filter(Boolean),
  );
  const urlsMissingOnSite = [...inAppEntities.urls].filter((u) => {
    if (u.includes('crialook.com.br')) return false;
    const host = safeHost(u);
    if (!host) return false;
    return !siteHosts.has(host);
  });

  let local = { hard: false, soft: false };

  if (emailsMissingOnSite.length > 0) {
    console.error(
      '✗ HARD: in-app references emails not on site: ' +
        emailsMissingOnSite.join(', '),
    );
    local.hard = true;
  }
  if (urlsMissingOnSite.length > 0) {
    console.error(
      '✗ HARD: in-app references URLs not on site: ' +
        urlsMissingOnSite.slice(0, 5).join(', ') +
        (urlsMissingOnSite.length > 5 ? ', …' : ''),
    );
    local.hard = true;
  }

  // ── Hard check #3: in-app LAST_UPDATED freshness vs site "vigente
  // desde". If in-app is more than FRESHNESS_WINDOW_DAYS older than
  // the site, the summary may be referring to a previous policy
  // version — owner action needed. Like entities above, we scan the
  // raw body so the RSC payload is reachable.
  const siteVigente = readSiteVigenteDesde(site.body || site.text);
  if (!siteVigente) {
    console.warn('⚠ soft: site has no "vigente desde" anchor — freshness check skipped');
    local.soft = true;
  } else if (!inAppLastUpdated) {
    console.error('✗ HARD: in-app LAST_UPDATED missing or unparseable');
    local.hard = true;
  } else {
    const siteMs = siteVigente.getTime();
    const appMs = inAppLastUpdated.getTime();
    const driftDays = Math.floor((siteMs - appMs) / (1000 * 60 * 60 * 24));
    if (driftDays > FRESHNESS_WINDOW_DAYS) {
      console.error(
        '✗ HARD: in-app LAST_UPDATED is ' + driftDays + ' days older than site (>' +
          FRESHNESS_WINDOW_DAYS + 'd window). Bump LAST_UPDATED in lib/legal/content.ts.',
      );
      local.hard = true;
    } else if (driftDays > 0) {
      console.log('  freshness: in-app is ' + driftDays + 'd behind site (within window).');
    } else {
      console.log('  freshness: in-app ≥ site vigente date.');
    }
  }

  // ── Soft-warn: report wording differences as info only. Owner can
  // eyeball whether anything material was lost in translation.
  const inAppWords = new Set(
    normalize(inAppText).split(/\W+/).filter((w) => w.length >= 5),
  );
  const siteWords = new Set(
    normalize(site.text).split(/\W+/).filter((w) => w.length >= 5),
  );
  const inAppOnly = [...inAppWords].filter((w) => !siteWords.has(w));
  if (inAppOnly.length > 0) {
    console.warn(
      '⚠ soft: ' + inAppOnly.length + ' in-app word(s) not in site sample — wording diff (expected for summary).',
    );
    if (inAppOnly.length <= 8) {
      console.warn('    in-app-only: ' + inAppOnly.join(', '));
    }
    local.soft = true;
  }

  if (local.hard) {
    result.hardFail++;
  } else if (local.soft) {
    result.softWarn++;
  } else {
    console.log('✓ essence-aligned (' + inAppEntities.emails.size + ' email(s), ' +
                inAppEntities.urls.size + ' url(s) cross-checked)');
    result.ok++;
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('check-legal-drift.js (' + (DRY_RUN ? 'dry-run' : 'live') + ', Option B essence mode)');
  const inAppLastUpdated = readInAppLastUpdated();
  if (inAppLastUpdated) {
    console.log('in-app LAST_UPDATED: ' + inAppLastUpdated.toISOString().slice(0, 10));
  } else {
    console.warn('⚠ could not parse LAST_UPDATED from content.ts');
  }

  for (const { slug, exportName } of URLS) {
    const site = await loadSiteContent(slug);
    checkSlug(slug, exportName, site, inAppLastUpdated);
  }

  console.log('\n--- Summary ---');
  console.log('OK:        ' + result.ok + ' URL(s)');
  console.log('Soft-warn: ' + result.softWarn + ' URL(s)');
  console.log('Hard-fail: ' + result.hardFail + ' URL(s)');

  if (result.hardFail > 0) {
    console.error('\n✗ FAIL: hard drift detected. See LEGAL_DRIFT_RECONCILIATION.md.');
    process.exit(1);
  }
  if (result.softWarn > 0) {
    console.warn('\n⚠ PASS with warnings: ' + result.softWarn + ' soft mismatch(es). Review and ack.');
  } else {
    console.log('\n✓ PASS');
  }
  process.exit(0);
}

// Exported for unit tests in scripts/__tests__/. Wrapped behind a
// require.main check so the script still runs as a CLI when invoked
// directly via `node scripts/check-legal-drift.js`.
module.exports = {
  extractEntities,
  extractFromContentTs,
  readInAppLastUpdated,
  readSiteVigenteDesde,
  stripHtml,
  normalize,
  FRESHNESS_WINDOW_DAYS,
};

if (require.main === module) {
  main().catch((err) => {
    console.error('✗ uncaught error: ' + (err.stack || err.message));
    process.exit(1);
  });
}
