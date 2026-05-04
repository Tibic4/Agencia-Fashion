# Legal Content Drift Reconciliation

**Last revised:** 2026-05-04 (M2 Phase 02 — Option B landed)
**Audit date (baseline):** 2026-05-03 (M1 P7)
**Site URLs covered:** crialook.com.br/{privacidade,termos,dpo,subprocessadores,consentimento-biometrico}
**In-app source:** `crialook-app/lib/legal/content.ts`
**CI script:** `crialook-app/scripts/check-legal-drift.js` (run via `npm run check:legal-drift`)

---

## Decision: Option B (in-app summary + link to canonical site)

After M1 P7 surfaced major drift between the formal site V1.0 (Vigente
desde 2026-04-24, ~4000 words/page, named Controlador) and the
9-section friendly summary in the app, the owner picked **Option B**
over verbatim rewrite (A) and HTML-render hybrid (C).

In Option B:

- **Site** (`crialook.com.br/{slug}`) is the **canonical** legal text.
  Formal V1.0, full LGPD article-by-article mapping, named
  Controlador/DPO with full identifiers in the published RSC payload.
  This is the version a Play reviewer or a court will read.
- **In-app** (`lib/legal/content.ts`) is a **summary** for in-app UX:
  shorter, friendlier, easier to scan on mobile. Each legal screen
  renders a prominent "Versão completa" card at the top linking to
  the corresponding `crialook.com.br/{slug}` URL. Tap → external
  browser via `Linking.openURL`.
- **Drift script** validates **essence equivalence**, not byte-for-
  byte equality. Wording rewrites are expected and emitted as
  soft warnings; hard fails are reserved for material divergence.

This pattern is widely used by banking and payments apps in Brazil
and is acceptable under both the LGPD (the user can reach the
canonical text in one tap) and the Google Play User Data Policy
(in-app disclosures align with the published privacy URL on key
entities and contact channels).

### Why not Option A (verbatim rewrite)

The formal site text is ~5x longer than the current in-app summary
and reads like a contract clause. Pasting it verbatim into the app
would degrade onboarding scroll-time materially and make consent
tougher to skim. The legal value (a lay-reader can understand what
they're agreeing to) outweighs strict byte equivalence here, given
the canonical text is one tap away.

### Why not Option C (HTML render hybrid)

Shipping a markdown/HTML renderer plus the formal text would add
~80 KB to the bundle and replicate work the marketing site already
does well. The "open in browser" affordance achieves the same UX
without adding renderer code.

---

## What lives where

### `lib/legal/content.ts`

- 5 exports: `termos`, `privacidade`, `dpo`, `subprocessadores`,
  `consentimentoBiometrico`. Each carries `siteSlug` so the
  `LegalPage` renderer knows which canonical URL to link.
- `SITE_BASE` constant — exported so a domain change (e.g.
  staging.crialook.com.br for QA) is one edit.
- `LAST_UPDATED` constant — display string AND CI freshness anchor.
  Format: PT-BR ("4 de maio de 2026") or ISO ("2026-05-04"). Bump
  whenever the site policy text materially changes.

### `components/LegalPage.tsx`

Top of page renders, in order:
- "Atualizado em {LAST_UPDATED}" kicker.
- Title (H1 with `accessibilityRole="header"`).
- Subtitle.
- **"Versão completa" card** (M2-02): boxed, bordered, with the
  prominent link `crialook.com.br/{siteSlug}`. Pressable opens the
  URL via `Linking.openURL`; `accessibilityLabel` and
  `accessibilityHint` are set so the affordance is discoverable
  via TalkBack. Owner tested on Android only (project memory:
  Android-only Play release).
- Then the body blocks.

### `scripts/check-legal-drift.js`

Option B essence checks (2026-05-04 rewrite):

- **Hard-fail (exit 1):**
  - Site URL returns 4xx — URL renamed/removed.
  - In-app references an email the site does not also publish.
  - In-app references an external URL whose **hostname** the site
    does not also reference. Vendors flip `/legal/privacy` ↔
    `/privacy` paths over time, so we match by host (not full URL).
    `crialook.com.br` URLs are exempt (they're internal).
  - In-app `LAST_UPDATED` is more than 30 days older than the
    site's "vigente desde" anchor (parses ISO and PT-BR forms).
- **Soft-warn (exit 0, owner-info):**
  - Wording rewrites — expected by design for a summary.
  - Site briefly unreachable on retries (CDN flake).
  - Site has no "vigente desde" anchor (e.g. DPO and
    subprocessadores at time of writing).

Implementation note: the marketing site is Next.js App Router with
RSC streaming, so visible content lives inside `<script>` tags as
JSON-encoded strings, not plain DOM text. The script decodes
`/` and `\/` escapes before scanning so entity matching works
on the live site too. Tests in `scripts/__tests__/` cover both the
helpers and the CLI in --dry-run.

### `scripts/__fixtures__/site-*.html`

Five fixture files (one per surface) with the entities + freshness
anchor the live site provides. Used by `--dry-run` mode (in CI
without network and in vitest). Refresh manually if the site shape
changes — they're not auto-regenerated.

---

## Day-to-day owner workflow

When the marketing site updates a policy:

1. Update `lib/legal/content.ts` summary if the change is material
   (added entity, new contact channel, removed practice). Wording
   tweaks alone do NOT need an in-app change.
2. Bump `LAST_UPDATED` to today.
3. Run `npm run check:legal-drift` locally — expect exit 0.
4. If a hard-fail trips, follow its message:
   - Email/URL missing on site → either remove from in-app, or ping
     marketing to add to site.
   - Freshness window blown → bump `LAST_UPDATED`.
5. Commit + push.

The CI job runs the same script on every PR touching
`crialook-app/lib/legal/**` or `crialook-app/scripts/check-legal-drift.js`.

---

## Original M1 P7 baseline (kept for reference)

| Section | Site URL status | M1 P7 verdict | M2-02 outcome |
|---------|-----------------|---------------|---------------|
| Política de Privacidade | HTTP 200 (140 KB) | MAJOR DRIFT (formal V1.0 vs friendly summary) | OK under Option B |
| Termos de Uso | HTTP 200 (120 KB) | MAJOR DRIFT (Dec. 7.962/2013 + 13 numbered clauses vs 9 friendly sections) | OK under Option B |
| Encarregado (DPO) | HTTP 200 ( 96 KB) | MAJOR DRIFT (named DPO + CPF + endereço vs generic) | OK under Option B; in-app summary links to site for full identifiers |
| Subprocessadores | HTTP 200 (118 KB) | Owner review recommended | OK under Option B; entity-host check verifies vendor list parity |
| Consentimento Biométrico | HTTP 200 (105 KB) | Owner review recommended | OK under Option B |

The site is the canonical V1.0 (vigente desde 2026-04-24) with named
Controlador (Alton Jorge de Souza Vieira) and detailed LGPD article
references in the RSC payload. The in-app summary links to it; the
drift script enforces essence parity, not byte parity.

---

## Versioning

| Date | Editor | Change |
|------|--------|--------|
| 2026-05-03 | M1 P7 plan 07-03 | Initial baseline audit; recorded MAJOR DRIFT in 3 primary URLs; flagged owner action P0; bumped LAST_UPDATED |
| 2026-05-04 | M2 Phase 02 | Option B landed: in-app "Versão completa" link, drift script switched to essence semantics, fixtures for all 5 surfaces, vitest coverage, doc rewrite |
