---
plan_id: 07-03
phase: 7
title: Manual one-time diff of crialook-app/lib/legal/content.ts vs https://crialook.com.br/{privacidade,termos,dpo}; reconcile drift to a single source of truth (D-08)
wave: 1
depends_on: []
owner_action: false
files_modified:
  - crialook-app/lib/legal/content.ts
  - crialook-app/docs/LEGAL_DRIFT_RECONCILIATION.md
autonomous: true
requirements: ["D-08", "F-06"]
must_haves:
  truths:
    - "executor performs a real fetch of https://crialook.com.br/privacidade, https://crialook.com.br/termos, https://crialook.com.br/dpo (3 URLs) using curl or node fetch and saves the raw HTML transcript into the LEGAL_DRIFT_RECONCILIATION.md doc as fenced code blocks (or refs to a tmp file if too large)"
    - "for each of the 3 URLs, the executor extracts the main legal content (skipping nav/footer/cookie banners) and diffs against the corresponding exported constant in crialook-app/lib/legal/content.ts (termos, privacidade, dpo)"
    - "the doc LEGAL_DRIFT_RECONCILIATION.md enumerates each diff as a triple: (section heading, in-app text, site text, decision)"
    - "for each diff: the decision is one of EITHER (a) update content.ts to match site (default — site is the user-facing source of record) OR (b) flag for owner-action note in the doc 'site needs update to match in-app' (only when the in-app text is more correct, e.g., recent legal correction not yet pushed to the marketing site)"
    - "after reconciliation, content.ts LAST_UPDATED constant is bumped from '27 de abril de 2026' to today's ISO date in PT-BR format ('3 de maio de 2026' or whatever the actual run date is)"
    - "if there is ZERO drift across all 3 URLs, the doc still records the verification with ✅ NO DRIFT and content.ts LAST_UPDATED IS bumped (proves the audit ran)"
    - "the doc reproduces the exact timestamp of each fetch (so a future audit knows what site version was compared)"
    - "the doc records the diff approach (manual visual diff of the cleaned text vs html-stripped fetch — the AUTOMATED scripts/check-legal-drift.js comes in 07-07, this is the manual baseline)"
    - "the executor MUST gracefully handle site unreachability: if a fetch returns 5xx OR times out after 30s on retry, the doc records 'SITE UNREACHABLE — re-run reconciliation when site is back; gating Phase 7 plan 07-07 (CI script) until baseline is established'"
    - "no other field in content.ts is restructured (the LegalBlock shape, the export names, the import paths) — only the human-readable string content of paragraphs/list items/headings inside the existing 5 exported constants"
    - "if the doc records ANY 'flag for owner-action — site needs update' decisions, those decisions are also surfaced as `OWNER ACTION` checklist items at the bottom of the doc, with a note that the owner must update the site BEFORE 07-07's CI check is wired in (otherwise CI fails on day 1)"
  acceptance:
    - "test -f crialook-app/docs/LEGAL_DRIFT_RECONCILIATION.md exits 0"
    - "wc -l crialook-app/docs/LEGAL_DRIFT_RECONCILIATION.md returns at least 40 (header + per-URL section + decisions + sign-off)"
    - "grep -c 'crialook.com.br/privacidade\\|crialook.com.br/termos\\|crialook.com.br/dpo' crialook-app/docs/LEGAL_DRIFT_RECONCILIATION.md returns at least 3"
    - "grep -c '^### \\|^## ' crialook-app/docs/LEGAL_DRIFT_RECONCILIATION.md returns at least 4 (sections per URL + summary)"
    - "grep -E 'LAST_UPDATED = ' crialook-app/lib/legal/content.ts returns a line whose date string is NOT '27 de abril de 2026' anymore"
    - "node -e \"const c=require('fs').readFileSync('crialook-app/lib/legal/content.ts','utf8'); const m=c.match(/LAST_UPDATED = '([^']+)'/); const ok=m && !m[1].includes('27 de abril'); process.exit(ok?0:1)\" exits 0"
    - "node -e \"const c=require('fs').readFileSync('crialook-app/lib/legal/content.ts','utf8'); const exports=['export const termos','export const privacidade','export const dpo','export const subprocessadores','export const consentimentoBiometrico']; const ok=exports.every(e=>c.includes(e)); process.exit(ok?0:1)\" exits 0"
    - "cd crialook-app && npm run typecheck exits 0 (no shape regressions in content.ts)"
---

# Plan 07-03: Manual legal content drift reconciliation

## Objective

Per D-08 (CONTEXT.md) and F-06 (CRIALOOK-PLAY-READINESS.md): the in-app legal screens (`app/(legal)/{privacidade,termos,dpo,subprocessadores,consentimento-biometrico}.tsx`) all render from `crialook-app/lib/legal/content.ts`. The site copies live at `https://crialook.com.br/{privacidade,termos,dpo}`. The comment block at content.ts:5-7 admits drift risk; **no diff has ever been performed**. Per Google Play Developer Program Policies (User Data — disclosure must match in-app and policy URL), drift between the two surfaces is a Play policy violation waiting to happen.

This plan establishes the **baseline** by:
1. Manually fetching each of the 3 site URLs (privacidade/termos/dpo).
2. Diffing each against the corresponding `content.ts` export (privacidade/termos/dpo).
3. Producing `crialook-app/docs/LEGAL_DRIFT_RECONCILIATION.md` enumerating every diff with a decision per row.
4. Updating `content.ts` to match the site (default) or flagging owner-action where the site needs to update (rare).
5. Bumping the `LAST_UPDATED` constant.

After this plan, 07-07 wires the automated `scripts/check-legal-drift.js` into CI and any future drift fails the build. This plan establishes the day-zero parity.

**Note on scope:** `subprocessadores` and `consentimento-biometrico` exist as in-app exports but the site URLs called out in CONTEXT D-06 are only `privacidade/termos/dpo`. If the site has separate `/subprocessadores` and `/consentimento-biometrico` URLs, audit those too and add to the doc; if they don't exist on the site, record that in the doc (in-app-only content is acceptable as long as the doc captures intent).

## Truths the executor must respect

- The site is the source of record for user-facing legal text (it's what regulators and Google Play reviewers see first). The default decision per diff is **update content.ts to match site**.
- Exception: if the in-app text reads as a **legal correction** (more accurate, more current, more clearly worded) that the site simply hasn't received yet, flag it in the doc as `OWNER ACTION — site needs update`. This is the rare path and should be justified in writing.
- The fetch can be done with `curl -sL https://crialook.com.br/privacidade -o /tmp/site-privacidade.html` followed by manual extraction (via grep/awk/node script ad-hoc), OR `node -e "fetch('https://crialook.com.br/privacidade').then(r=>r.text()).then(t=>require('fs').writeFileSync('/tmp/site-privacidade.html',t))"`. Either is fine; record the command used in the doc.
- Site unreachability is a real risk (CDN flake, deploy in flight, etc.). If a URL returns 5xx OR times out after 30s with 3 retries (10s backoff each), the doc records **SITE UNREACHABLE — re-run reconciliation when site is back**, and 07-07 (the CI script) is gated until the baseline is established. The executor surfaces this as a blocker in the plan's verification report. **Do NOT fake the diff** — an empty / placeholder reconciliation guarantees a CI false-positive on day 1.
- The diff must be SECTION-BY-SECTION. content.ts uses `LegalBlock[]` with `type: 'heading' | 'paragraph' | 'list'` — line items in lists matter. A drift like "the site says 'fotos profissionais' and in-app says 'fotos de moda'" is a real diff and must be captured.
- DO NOT change the LegalBlock shape, the export names (`termos`, `privacidade`, `dpo`, `subprocessadores`, `consentimentoBiometrico`), the import path of `LegalBlock`, or the `LAST_UPDATED` constant name. Only the string content inside the exports is in scope.
- Bump `LAST_UPDATED` from `'27 de abril de 2026'` to today's date in the same PT-BR format. Use `LC_TIME=pt_BR.UTF-8 date '+%-d de %B de %Y'` if available, OR write the date by hand (e.g., '3 de maio de 2026' for 2026-05-03). The format matters because the in-app screens render this string verbatim.
- The doc lives at `crialook-app/docs/LEGAL_DRIFT_RECONCILIATION.md` (alongside the existing CLERK_*.md, EAS_*.md, PLAY_*.md docs). Markdown structure mirrors the existing CLERK_TRUST_COMPENSATING_CONTROLS.md doc style for consistency.
- This plan does NOT add the CI script — that's 07-07. This plan ESTABLISHES THE BASELINE.

## Tasks

### Task 1: Fetch the 3 site URLs and capture raw HTML

<read_first>
- crialook-app/lib/legal/content.ts (FULL FILE — all 284 lines; understand the LegalBlock structure and the 5 exports)
- .planning/audits/CRIALOOK-PLAY-READINESS.md §1 "Privacy policy URL" (lines 36-43; F-06 background)
- .planning/phases/07-play-compliance-and-ux-completeness/07-CONTEXT.md (D-06, D-07, D-08)
</read_first>

<action>
From any working directory:

```bash
mkdir -p /tmp/legal-drift
for url in privacidade termos dpo; do
  echo "=== Fetching $url ==="
  for attempt in 1 2 3; do
    if curl -sSL --max-time 30 "https://crialook.com.br/$url" -o "/tmp/legal-drift/$url.html"; then
      echo "OK on attempt $attempt"
      break
    fi
    echo "Attempt $attempt failed; sleeping 10s before retry..."
    sleep 10
  done
done

# Optional: also fetch the two extra URLs if they exist (404 is fine and recorded)
for url in subprocessadores consentimento-biometrico; do
  curl -sI --max-time 15 "https://crialook.com.br/$url" -o "/tmp/legal-drift/$url.headers"
  echo "$url: $(grep -i '^HTTP' /tmp/legal-drift/$url.headers || echo 'no response')"
done

ls -la /tmp/legal-drift/
```

If any of the 3 primary URLs (privacidade/termos/dpo) returned 5xx or timed out after 3 attempts, record this in the doc and surface as a blocker — do NOT proceed to Task 2 with stale/placeholder data.
</action>

<verify>
```bash
ls -la /tmp/legal-drift/
# Expect: privacidade.html, termos.html, dpo.html each non-empty (>10KB typical for a Next.js SSR page)

# Quick sanity check that we got real content not a 503 page:
for f in privacidade termos dpo; do
  echo "=== $f ==="
  grep -ic "<main\|<article\|política\|termos\|dpo" "/tmp/legal-drift/$f.html" || echo "WARN: no main/article tag found"
done
```
</verify>

### Task 2: Extract main content text from each fetched HTML

<read_first>
- /tmp/legal-drift/privacidade.html, termos.html, dpo.html (the just-fetched files)
</read_first>

<action>
For each URL, extract the readable text content (skip nav/footer/cookie banner). A simple approach using node:

```bash
node -e "
const fs=require('fs');
for (const url of ['privacidade','termos','dpo']) {
  const html = fs.readFileSync('/tmp/legal-drift/'+url+'.html','utf8');
  // Extract <main>...</main> first, fallback to <article>, fallback to <body>
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1]
            || html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1]
            || html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]
            || '';
  // Strip tags + collapse whitespace
  const text = main
    .replace(/<script[\s\S]*?<\/script>/gi,'')
    .replace(/<style[\s\S]*?<\/style>/gi,'')
    .replace(/<nav[\s\S]*?<\/nav>/gi,'')
    .replace(/<footer[\s\S]*?<\/footer>/gi,'')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/g,' ')
    .replace(/&amp;/g,'&')
    .replace(/\s+/g,' ')
    .trim();
  fs.writeFileSync('/tmp/legal-drift/'+url+'.text', text);
  console.log(url+': '+text.length+' chars extracted');
}
"
```

Then for each URL, side-by-side compare with the corresponding content.ts export by re-rendering it as flat text:

```bash
node -e "
const c=require('./crialook-app/lib/legal/content.ts');
// content.ts is TS; this won't directly require — instead read the file
// and grep for the constant block, OR use ts-node:
" 2>&1 || true

# Practical approach: open content.ts in your editor, the relevant export
# (termos / privacidade / dpo) starts and ends are clearly marked by
# `export const X = {` and `};`. Manually compare blocks against
# /tmp/legal-drift/X.text. Use diff or visual inspection.
```

For efficiency, the executor may use a node script to dump each export as plain text by reading the source file and reconstructing the block-by-block string concatenation. This is a one-time audit; rough fidelity is acceptable.
</action>

<verify>
```bash
ls -la /tmp/legal-drift/*.text
# Expect 3 files, each non-empty (>1KB; the site privacy policy is typically 4-10KB of text)
```
</verify>

### Task 3: Author LEGAL_DRIFT_RECONCILIATION.md with diff decisions

<read_first>
- /tmp/legal-drift/{privacidade,termos,dpo}.text (the cleaned site content from Task 2)
- crialook-app/lib/legal/content.ts (the 5 exports — the 3 we're diffing today + the 2 in-app-only ones)
- crialook-app/docs/CLERK_TRUST_COMPENSATING_CONTROLS.md (style template for the new doc — header structure, table format)
</read_first>

<action>
Create `crialook-app/docs/LEGAL_DRIFT_RECONCILIATION.md` with this structure:

```markdown
# Legal Content Drift Reconciliation — Phase 7 Baseline (F-06)

**Audit date:** YYYY-MM-DD (use today)
**Audited by:** GSD Phase 7 plan 07-03
**Site URLs audited:** crialook.com.br/{privacidade,termos,dpo}
**In-app source:** crialook-app/lib/legal/content.ts (LAST_UPDATED → bumped this run)
**Method:** manual fetch + section-by-section visual diff. Automated CI check lands in plan 07-07.

## Summary

| Section | Diff count | Decision direction |
|---------|-----------|-------------------|
| Termos de Uso | N | content.ts ← site / site needs update |
| Política de Privacidade | N | ... |
| Encarregado (DPO) | N | ... |

Total: N diffs across 3 sections; M reconciled to site, K flagged for site update.

## Fetch transcript

For each URL, the raw fetch metadata:

### https://crialook.com.br/privacidade
- Fetched: YYYY-MM-DD HH:MM:SS UTC
- HTTP status: 200
- Content-Length: NNNNN bytes
- Extracted text length: NNNN chars

### https://crialook.com.br/termos
- ...

### https://crialook.com.br/dpo
- ...

## Diff: Termos de Uso

For each section heading in either source, list:

### Section: "1. Sobre o CriaLook"
- **In-app (content.ts:20):** "O CriaLook é uma plataforma de inteligência artificial..."
- **Site:** "O CriaLook é uma plataforma de inteligência artificial..."
- **Diff:** ✅ NO DRIFT
  OR
- **Diff:** ❌ in-app uses "X" but site uses "Y"
- **Decision:** content.ts ← site (default; updated this run)
  OR
- **Decision:** site needs update (in-app text is the corrected legal version; OWNER ACTION required before 07-07 CI lands)

(Repeat per section.)

## Diff: Política de Privacidade
(...)

## Diff: Encarregado (DPO)
(...)

## In-app-only sections (no corresponding site URL)

### subprocessadores (content.ts:187)
- Site URL crialook.com.br/subprocessadores: 404 / 200 (record actual)
- If 404: in-app-only, no drift check possible
- If 200: add a section to this doc

### consentimentoBiometrico (content.ts:237)
- Site URL crialook.com.br/consentimento-biometrico: 404 / 200 (record actual)
- (same logic)

## Owner action items

(List any "site needs update" decisions here. If none, write "None — all diffs reconciled by updating content.ts to match site.")

- [ ] Update site /privacidade section X to match in-app correction (rationale: ...)

## Sign-off

- [x] All 3 primary URLs successfully fetched
- [x] Diffs enumerated section-by-section
- [x] content.ts updated to match site (or owner-action flagged)
- [x] LAST_UPDATED constant bumped to YYYY-MM-DD
- [x] 07-07 CI script unblocked (no pending site-side updates) / blocked (owner action above)
```

Fill in the actual diffs from Task 2's extracted text. If the diff count is high (>15 per section), summarize ("13 punctuation differences, 2 wording differences in section 4") and only enumerate the wording diffs in detail.

If the executor finds ZERO drift across all 3 URLs, the doc still gets written with all the diff sections marked ✅ NO DRIFT and the LAST_UPDATED bump still happens (proves the audit ran).
</action>

<verify>
```bash
test -f crialook-app/docs/LEGAL_DRIFT_RECONCILIATION.md && echo OK
wc -l crialook-app/docs/LEGAL_DRIFT_RECONCILIATION.md
# Expect at least 40 lines

grep -c "crialook.com.br/" crialook-app/docs/LEGAL_DRIFT_RECONCILIATION.md
# Expect at least 3
```
</verify>

### Task 4: Apply reconciliation to content.ts and bump LAST_UPDATED

<read_first>
- crialook-app/lib/legal/content.ts (the constant LAST_UPDATED on line 11 + the 5 exports + the LegalBlock import)
- crialook-app/docs/LEGAL_DRIFT_RECONCILIATION.md (the doc just written — apply each "content.ts ← site" decision)
</read_first>

<action>
1. For each diff in the doc with decision "content.ts ← site": edit the corresponding string in content.ts to match the site exactly. Preserve the LegalBlock shape (`type`, `text`, `items` arrays).

2. Bump the `LAST_UPDATED` constant on line 11 from `'27 de abril de 2026'` to today's date in PT-BR format (e.g., `'3 de maio de 2026'`).

3. If the doc records ZERO diffs needing reconciliation, STILL bump LAST_UPDATED — the audit happened today, the constant must reflect that.

4. Run `npm run typecheck` from `crialook-app/` to confirm the LegalBlock shape didn't break.
</action>

<verify>
```bash
cd crialook-app
grep -n "LAST_UPDATED = " lib/legal/content.ts
# Expect: a single line with today's date in PT-BR, NOT '27 de abril de 2026'

npm run typecheck 2>&1 | tail -5
# Expect: 0 errors
```
</verify>

## Files modified

- `crialook-app/lib/legal/content.ts` — string content updates per reconciliation, LAST_UPDATED bump
- `crialook-app/docs/LEGAL_DRIFT_RECONCILIATION.md` — NEW; baseline audit + diff log + owner-action checklist

## Why this matters (risk if skipped)

Per F-06 (Medium): without a manual baseline, when 07-07 wires `scripts/check-legal-drift.js` into CI, the **first CI run will fail** with whatever the current drift is, blocking all PRs until someone manually reconciles. Establishing the baseline first turns 07-07 from "instant CI breakage" into "drift detection going forward". And per Google Play User Data policy, undisclosed drift between the in-app and policy-URL surfaces is a hard policy strike — so the baseline also doubles as our audit trail showing we verified parity at submission time.
