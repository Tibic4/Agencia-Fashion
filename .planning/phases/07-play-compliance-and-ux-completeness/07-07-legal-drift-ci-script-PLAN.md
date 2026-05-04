---
plan_id: 07-07
phase: 7
title: Add scripts/check-legal-drift.js — fetches site URLs, diffs vs lib/legal/content.ts, fail-soft on 5xx (3 retries + warn), wired into CI as a job (D-06, D-07)
wave: 2
depends_on: ["07-03"]
owner_action: false
files_modified:
  - crialook-app/scripts/check-legal-drift.js
  - crialook-app/package.json
  - .github/workflows/ci.yml
autonomous: true
requirements: ["D-06", "D-07", "F-06"]
must_haves:
  truths:
    - "script lives at crialook-app/scripts/check-legal-drift.js (NOT root scripts/, since the comparison source content.ts is inside crialook-app)"
    - "script is plain Node.js (no TypeScript compile step in CI for this; uses built-in fetch from Node 18+; CI uses Node 24 per ci.yml lines 21,55,73)"
    - "script fetches the 3 URLs from CONTEXT.md D-06: https://crialook.com.br/privacidade, /termos, /dpo"
    - "script extracts the main content (skip nav/footer/cookie banners) using the same regex strategy as plan 07-03 Task 2 (match <main>...</main> first, fallback <article>, fallback <body>; strip tags + collapse whitespace)"
    - "script reads crialook-app/lib/legal/content.ts and extracts the privacidade/termos/dpo exports as flat text (concatenate every block.text + items joined; preserve order; strip markdown-style headings)"
    - "script normalizes both sides (lowercase, collapse whitespace, strip punctuation EXCEPT periods/commas) before diffing — punctuation/case differences should NOT trip the check"
    - "script does line-by-line diff: any line present in one side but not the other → records it. If diff count > 0 → exit 1 with the diff printed to stdout"
    - "script retries 3 times with backoff (10s, 20s, 40s) on 5xx OR network error before giving up on a URL"
    - "if a URL fails ALL 3 retries with 5xx OR network error (NOT 4xx — those indicate the URL was renamed/removed and IS a real drift), the script logs a WARN to stderr ('SITE UNREACHABLE: <url> after 3 retries — fail-soft, exit 0') and exits 0 (D-06 fail-soft on outage)"
    - "if a URL returns 4xx (404, 403, etc.), this IS a drift signal (URL renamed/gone) → exit 1"
    - "exit codes: 0 = no drift OR site outage fail-soft; 1 = real drift detected OR 4xx response"
    - "script prints a clear summary at the end: '✓ NO DRIFT' OR '✗ DRIFT FOUND in N URL(s)' OR '⚠ SITE UNREACHABLE — fail-soft' (so the CI log is scannable)"
    - "package.json adds a npm script: 'check:legal-drift': 'node scripts/check-legal-drift.js'"
    - ".github/workflows/ci.yml adds a NEW job 'legal-drift' that runs in the existing crialook-app working-directory pattern, runs npm ci + npm run check:legal-drift, runs ON pull_request (not just push, so PRs catch the drift before merge)"
    - "the new ci.yml job uses Node 24 + cache: npm + cache-dependency-path: crialook-app/package-lock.json (mirror the existing mobile-typecheck-test job)"
    - "no test file is added for the script itself (the script is its own integration; testing it requires mocking https.fetch which is overkill for a dev tool); but the script has a self-test mode 'node scripts/check-legal-drift.js --dry-run' that runs against fixture html files in scripts/__fixtures__/ to prove the diff logic without hitting the network"
    - "script handles offline / DNS failure same as 5xx (fail-soft + warn; don't break local dev when network is unavailable)"
  acceptance:
    - "test -f crialook-app/scripts/check-legal-drift.js exits 0"
    - "test -x crialook-app/scripts/check-legal-drift.js OR head -1 crialook-app/scripts/check-legal-drift.js | grep -q '#!/usr/bin/env node' (script is runnable)"
    - "wc -l crialook-app/scripts/check-legal-drift.js returns at least 80 (real implementation, not a stub)"
    - "grep -c 'crialook.com.br' crialook-app/scripts/check-legal-drift.js returns at least 3 (3 URLs hardcoded)"
    - "grep -c 'process.exit' crialook-app/scripts/check-legal-drift.js returns at least 2 (exit 0 + exit 1 paths)"
    - "grep -ic 'retry\\|backoff\\|fail-soft\\|SITE UNREACHABLE' crialook-app/scripts/check-legal-drift.js returns at least 3"
    - "grep -c 'check:legal-drift' crialook-app/package.json returns at least 1"
    - "grep -c 'legal-drift\\|check:legal-drift' .github/workflows/ci.yml returns at least 2 (job name + script invocation)"
    - "grep -c 'pull_request' .github/workflows/ci.yml returns at least 1 (PR trigger preserved)"
    - "node crialook-app/scripts/check-legal-drift.js --dry-run exits 0 (proves dry-run mode works; CI invocation is wet)"
    - "cd crialook-app && npm run check:legal-drift exits 0 (live run; depends on 07-03 baseline being clean — if not, it correctly fails with the diff)"
---

# Plan 07-07: scripts/check-legal-drift.js + CI wire

## Objective

Per D-06 and D-07: implement the automated drift detection that catches future divergence between the in-app legal text (`crialook-app/lib/legal/content.ts`) and the public site (`crialook.com.br/{privacidade,termos,dpo}`). After 07-03 establishes the day-zero baseline, this plan adds the CI gate so any future drift fails the build.

Behavioral spec (D-06):
- Fetch 3 URLs.
- Extract main content, normalize, diff against bundled exports.
- Exit 0 if equal; exit 1 if drift.
- 3 retries with exponential backoff on 5xx.
- Fail-soft on persistent site outage (exit 0 with warn) — site flake should not block PRs.
- 4xx (URL gone) IS drift → exit 1.

Wired into CI per D-07 as a new `legal-drift` job in `.github/workflows/ci.yml` triggered on `push` and `pull_request`.

## Truths the executor must respect

- The script is plain JavaScript (no TS), uses built-in `fetch` (Node 18+), and lives at `crialook-app/scripts/check-legal-drift.js`. Reasoning: the source-of-truth file (`content.ts`) is inside `crialook-app/`; root `scripts/` doesn't exist; placing the script next to its data minimizes cross-package coupling.
- Node version: CI uses Node 24 (per ci.yml lines 21, 55, 73). Built-in `fetch` is GA there. No `node-fetch` dependency needed.
- Reading `content.ts` to extract the legal text: the file is TypeScript with `export const X = { title, blocks: [...] }`. The script does NOT import it (would require ts-loader); instead it reads the file as a string and extracts each export's blocks via regex. This is fragile if the file shape changes — but the file shape is itself locked by content.ts:9 (`import type { LegalBlock } from '@/components/LegalPage';`) and won't change without intent. If the parse fails for any export, the script logs a parse error and exits 1 (treats parse failure as drift signal — a refactored content.ts must be matched by an updated script).
- Normalization: lowercase, collapse whitespace, strip non-essential punctuation (KEEP: . , ; : ? ! - ; STRIP: " ' " ' " " — quotes and dashes are typography that varies between text editors and shouldn't trip the check). Also normalize Unicode NFC.
- Line-by-line diff: split each side into "logical lines" by splitting on `. ` (period + space, sentence boundary). For each sentence on one side, check if the other side has a matching sentence (substring or fuzzy match within edit-distance ≤ 2). Misses → record as drift.
  - Simpler alternative for v1: split by sentence, sort, compare sets. Captures additions/removals; doesn't capture order changes. **Use this simpler diff for v1; document the limitation in the script header.**
- Exit codes:
  - 0: no drift detected, OR site unreachable fail-soft
  - 1: real drift detected, OR 4xx (URL renamed/removed), OR content.ts parse failure
- Retries: 3 attempts per URL, with backoff `[10000, 20000, 40000]` ms between attempts. Trigger retry on: HTTP 5xx, network error (ENOTFOUND, ECONNRESET, ETIMEDOUT), or fetch timeout (use `AbortController` with 30s timeout per attempt).
- Logging:
  - To stdout: per-URL fetch status, per-URL diff summary, final summary.
  - To stderr: warnings (5xx during retry, fail-soft trigger).
  - The CI log should be scannable — use `console.log('✓ ...')` and `console.log('✗ ...')` and `console.error('⚠ ...')` patterns.
- Dry-run mode: `node scripts/check-legal-drift.js --dry-run` reads from `crialook-app/scripts/__fixtures__/site-{privacidade,termos,dpo}.html` instead of fetching live URLs. This proves the diff logic offline. Add a tiny fixture: a single HTML file per URL with `<main>{content from current content.ts}</main>` so dry-run exits 0 against the day-zero baseline.
- The CI job uses the same Node version + cache pattern as the existing `mobile-typecheck-test` job (lines 62-89 of ci.yml). The job runs on `push` (main, audit/**) AND `pull_request` (main) per the existing trigger block.
- This script does NOT auto-fix drift. If drift is detected, the developer (or reviewer) reads the diff and either (a) updates content.ts to match site OR (b) updates the site to match content.ts — same decision matrix as 07-03.

## Tasks

### Task 1: Implement scripts/check-legal-drift.js

<read_first>
- crialook-app/lib/legal/content.ts (FULL FILE — to understand the export shape the script must parse)
- .github/workflows/ci.yml (FULL FILE — to understand the existing job pattern to mirror)
- crialook-app/package.json (the scripts block — to know where to add the new npm script)
- crialook-app/docs/LEGAL_DRIFT_RECONCILIATION.md (from 07-03 — to confirm the day-zero baseline state; the script must NOT regress from this baseline on first CI run)
- .planning/phases/07-play-compliance-and-ux-completeness/07-CONTEXT.md (D-06, D-07)
</read_first>

<action>
Create `crialook-app/scripts/check-legal-drift.js`:

```javascript
#!/usr/bin/env node
/**
 * check-legal-drift.js — Phase 7 plan 07-07 (D-06, D-07)
 *
 * Fetches the 3 public legal URLs at crialook.com.br and diffs each against
 * the corresponding export in lib/legal/content.ts. Fails CI if drift is
 * detected; fail-soft on persistent site outage so CDN flake doesn't block
 * PRs. After plan 07-03 established the day-zero baseline, this script is
 * the forever-after gate.
 *
 * Exit codes:
 *   0  no drift OR site unreachable fail-soft
 *   1  real drift detected OR 4xx (URL renamed/removed) OR content.ts parse error
 *
 * Flags:
 *   --dry-run   read from scripts/__fixtures__/site-*.html instead of fetching
 *
 * Diff approach (v1, simple):
 *   - Normalize both sides (lowercase, collapse whitespace, strip typographic
 *     punctuation, NFC unicode)
 *   - Split into sentence-ish chunks at '. '
 *   - Compare as sorted sets (additions + removals captured; order changes ignored)
 *
 * Limitation: order changes within a section are not flagged. Acceptable for
 * v1; if Play submission ever requires ordered checking, upgrade to
 * line-by-line edit-distance.
 */

const fs = require('fs');
const path = require('path');

const URLS = [
  { slug: 'privacidade', exportName: 'privacidade' },
  { slug: 'termos', exportName: 'termos' },
  { slug: 'dpo', exportName: 'dpo' },
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
  // Try <main>, fallback <article>, fallback <body>
  const main =
    html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] ||
    html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1] ||
    html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ||
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
    .toLowerCase()
    .replace(/[“”‘’–—"']/g, '')
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
  // Find the export block: `export const <name> = {` ... `};`
  const re = new RegExp(`export const ${exportName} = \\{([\\s\\S]*?)\\n\\};`, 'm');
  const m = src.match(re);
  if (!m) {
    throw new Error(
      `content.ts: could not find export const ${exportName} = { ... };`,
    );
  }
  const body = m[1];
  // Pull every string literal we can find inside `text:` and `items: [...]`.
  // Use a permissive matcher; this is a v1 heuristic.
  const out = [];
  for (const tm of body.matchAll(/text:\s*['"`]([\s\S]*?)['"`]/g)) {
    out.push(tm[1]);
  }
  for (const im of body.matchAll(/items:\s*\[([\s\S]*?)\]/g)) {
    for (const sm of im[1].matchAll(/['"`]([\s\S]*?)['"`]/g)) {
      out.push(sm[1]);
    }
  }
  // Also pull title/subtitle if present
  const title = body.match(/title:\s*['"`]([^'"`]*)['"`]/)?.[1];
  if (title) out.unshift(title);
  const subtitle = body.match(/subtitle:\s*['"`]([\s\S]*?)['"`]/)?.[1];
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
        throw new Error(`HTTP ${res.status}`);
      }
      if (res.status >= 400) {
        // 4xx is real drift (URL gone); do NOT retry, do NOT fail-soft
        return { ok: false, status: res.status, body: null, hardFail: true };
      }
      const body = await res.text();
      return { ok: true, status: res.status, body, hardFail: false };
    } catch (err) {
      clearTimeout(timer);
      if (attempt < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[attempt];
        console.error(
          `⚠ fetch ${url} attempt ${attempt + 1} failed (${err.message}); retrying in ${delay}ms...`,
        );
        await sleep(delay);
        continue;
      }
      // Exhausted retries on 5xx or network error → fail-soft trigger
      return { ok: false, status: 0, body: null, hardFail: false, err };
    }
  }
}

async function loadSiteContent(slug) {
  if (DRY_RUN) {
    const p = path.join(FIXTURES_DIR, `site-${slug}.html`);
    if (!fs.existsSync(p)) {
      console.error(`⚠ dry-run: missing fixture ${p}`);
      return { hardFail: false, soft: true, sentences: [] };
    }
    return {
      hardFail: false,
      soft: false,
      sentences: sentencize(stripHtml(fs.readFileSync(p, 'utf8'))),
    };
  }
  const url = `https://crialook.com.br/${slug}`;
  const r = await fetchWithRetry(url);
  if (r.hardFail) {
    console.error(`✗ ${url}: HTTP ${r.status} — URL changed or removed (hard drift)`);
    return { hardFail: true, soft: false, sentences: [] };
  }
  if (!r.ok) {
    console.error(`⚠ SITE UNREACHABLE: ${url} after retries — fail-soft`);
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
  console.log(`check-legal-drift.js (${DRY_RUN ? 'dry-run' : 'live'})`);
  let driftCount = 0;
  let hardFailCount = 0;
  let softFailCount = 0;

  for (const { slug, exportName } of URLS) {
    console.log(`\n--- ${slug} ---`);

    let tsSentences;
    try {
      tsSentences = extractFromContentTs(exportName);
    } catch (err) {
      console.error(`✗ content.ts parse error for ${exportName}: ${err.message}`);
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
      console.log(`✓ NO DRIFT (${tsSentences.length} sentences compared)`);
    } else {
      driftCount++;
      console.log(`✗ DRIFT FOUND`);
      if (d.onlyInSite.length) {
        console.log(`  Site has ${d.onlyInSite.length} sentence(s) not in content.ts:`);
        for (const s of d.onlyInSite.slice(0, 10)) console.log(`    + ${s.slice(0, 120)}`);
        if (d.onlyInSite.length > 10) console.log(`    ... (+${d.onlyInSite.length - 10} more)`);
      }
      if (d.onlyInTs.length) {
        console.log(`  content.ts has ${d.onlyInTs.length} sentence(s) not on site:`);
        for (const s of d.onlyInTs.slice(0, 10)) console.log(`    - ${s.slice(0, 120)}`);
        if (d.onlyInTs.length > 10) console.log(`    ... (+${d.onlyInTs.length - 10} more)`);
      }
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Drift:    ${driftCount} URL(s)`);
  console.log(`Hard-fail: ${hardFailCount} URL(s) (4xx)`);
  console.log(`Soft-fail: ${softFailCount} URL(s) (site unreachable)`);

  if (driftCount > 0 || hardFailCount > 0) {
    console.error(`\n✗ FAIL: drift or hard-fail detected. Reconcile per crialook-app/docs/LEGAL_DRIFT_RECONCILIATION.md.`);
    process.exit(1);
  }
  if (softFailCount > 0) {
    console.error(`\n⚠ Pass with caveats: ${softFailCount} URL(s) unreachable; re-run when site is back.`);
  }
  console.log(`\n✓ PASS`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`✗ uncaught error: ${err.stack || err.message}`);
  process.exit(1);
});
```

Then create the dry-run fixtures at `crialook-app/scripts/__fixtures__/site-{privacidade,termos,dpo}.html`. Each is a tiny HTML file whose `<main>` content is the concatenated text of the corresponding content.ts export AT THE BASELINE STATE (post-07-03). The simplest approach: re-use content.ts itself by reading + extracting the same way the script does, then wrapping in `<html><body><main>{text}</main></body></html>`. The executor MAY auto-generate these fixtures by running the live script once after 07-03 lands and saving the cleaned text — they're test fixtures, not user-facing content.

```bash
mkdir -p crialook-app/scripts/__fixtures__
# For each slug, reproduce the content.ts text in an HTML fixture:
node -e "
const fs=require('fs');
const path=require('path');
const SCRIPT=require('./crialook-app/scripts/check-legal-drift.js');
" 2>/dev/null || true
# Simpler: write each fixture by hand. For each of privacidade, termos, dpo:
#   echo '<html><body><main>' > crialook-app/scripts/__fixtures__/site-privacidade.html
#   (paste the cleaned text equivalent of content.ts privacidade)
#   echo '</main></body></html>' >> crialook-app/scripts/__fixtures__/site-privacidade.html
```

For brevity, the executor may write a quick generator inline:

```bash
node -e "
const fs=require('fs');
const path=require('path');
const src=fs.readFileSync('crialook-app/lib/legal/content.ts','utf8');
for (const name of ['privacidade','termos','dpo']) {
  const re=new RegExp('export const '+name+' = \\\\{([\\\\s\\\\S]*?)\\\\n\\\\};','m');
  const m=src.match(re); if(!m) continue;
  const body=m[1];
  const parts=[];
  const t=body.match(/title:\\s*['\\\"\\\`]([^'\\\"\\\`]*)/); if(t)parts.push(t[1]);
  for (const tm of body.matchAll(/text:\\s*['\\\"\\\`]([\\\\s\\\\S]*?)['\\\"\\\`]/g)) parts.push(tm[1]);
  for (const im of body.matchAll(/items:\\s*\\[([\\\\s\\\\S]*?)\\]/g))
    for (const sm of im[1].matchAll(/['\\\"\\\`]([\\\\s\\\\S]*?)['\\\"\\\`]/g)) parts.push(sm[1]);
  const out='<html><body><main>'+parts.join('. ')+'</main></body></html>';
  fs.writeFileSync('crialook-app/scripts/__fixtures__/site-'+name+'.html', out);
}
console.log('fixtures written');
"
```

This guarantees `node scripts/check-legal-drift.js --dry-run` exits 0 right after 07-03 lands.
</action>

<verify>
```bash
test -f crialook-app/scripts/check-legal-drift.js && echo OK
head -1 crialook-app/scripts/check-legal-drift.js | grep -q '#!/usr/bin/env node' && echo SHEBANG_OK
wc -l crialook-app/scripts/check-legal-drift.js
# Expect: at least 80

ls crialook-app/scripts/__fixtures__/
# Expect: 3 .html files

cd crialook-app
node scripts/check-legal-drift.js --dry-run
echo "exit=$?"
# Expect: ✓ PASS, exit=0
```
</verify>

### Task 2: Add npm script + wire into CI

<read_first>
- crialook-app/package.json (the `scripts` block)
- .github/workflows/ci.yml (FULL FILE — mirror the mobile-typecheck-test job pattern)
</read_first>

<action>
1. In `crialook-app/package.json`, add to the `scripts` block:
   ```json
   "check:legal-drift": "node scripts/check-legal-drift.js"
   ```
   Place it adjacent to existing test/lint scripts. Preserve the `_lock_warning` block and the `lock:fix` script unchanged.

2. In `.github/workflows/ci.yml`, add a new top-level job **after** `mobile-typecheck-test` (around line 89), preserving all existing jobs:

   ```yaml
     legal-drift:
       name: Legal content drift (crialook-app vs site)
       runs-on: ubuntu-latest
       defaults:
         run:
           working-directory: crialook-app
       steps:
         - uses: actions/checkout@v4

         - uses: actions/setup-node@v4
           with:
             node-version: "24"
             cache: "npm"
             cache-dependency-path: crialook-app/package-lock.json

         - name: Install dependencies
           run: npm ci --legacy-peer-deps

         # Phase 7 D-06/D-07: fetches https://crialook.com.br/{privacidade,termos,dpo}
         # and diffs against lib/legal/content.ts. Fail-soft on 5xx (site outage),
         # hard-fail on 4xx (URL renamed) or content drift. See plan 07-03 for the
         # day-zero baseline reconciliation and 07-07 for the script.
         - name: Check legal content drift
           run: npm run check:legal-drift
   ```

   Do NOT modify the existing jobs (lint-typecheck-build, test, mobile-typecheck-test) or the trigger block at lines 3-7.
</action>

<verify>
```bash
grep -c '"check:legal-drift"' crialook-app/package.json
# Expect: 1

grep -c "legal-drift:" .github/workflows/ci.yml
# Expect: 1 (the job header)

grep -c "check:legal-drift" .github/workflows/ci.yml
# Expect: 1 (npm script invocation)

# Lint the YAML (quick sanity):
node -e "const y=require('fs').readFileSync('.github/workflows/ci.yml','utf8'); console.log('jobs found:', (y.match(/^  [a-z-]+:$/gm)||[]).join(', '))"
# Expect: lint-typecheck-build, test, mobile-typecheck-test, legal-drift

cd crialook-app
npm run check:legal-drift
echo "exit=$?"
# Expect: live run; ideally ✓ PASS exit=0 (depends on 07-03 having reconciled drift first)
# If exit=1 with drift output, the diff is real — go fix content.ts to match site (and update LEGAL_DRIFT_RECONCILIATION.md).
# If exit=0 with ⚠ SITE UNREACHABLE warnings, the fail-soft path is working — acceptable for CI.
```
</verify>

## Files modified

- `crialook-app/scripts/check-legal-drift.js` — NEW; the drift detection script (~150 lines)
- `crialook-app/scripts/__fixtures__/site-{privacidade,termos,dpo}.html` — NEW; dry-run fixtures matching content.ts baseline
- `crialook-app/package.json` — adds `check:legal-drift` npm script
- `.github/workflows/ci.yml` — adds `legal-drift` job

## Why this matters (risk if skipped)

Per F-06: without an automated drift check, the in-app legal text and the public site WILL drift over time (engineer updates content.ts but not site, marketing updates site but not content.ts). Drift is a Google Play User Data policy violation (in-app disclosure must match the privacy URL). 07-03 closes the day-zero gap; this plan keeps it closed forever via CI. Fail-soft on 5xx is critical so that crialook.com.br outages (CDN flake, deploy in flight) don't block PRs — drift is real, site flake is noise.
