# M2 Phase 02 — Legal drift reconciliation (Option B)

**Status:** complete (2026-05-04)
**Owner decision:** Option B (summary in-app + link to canonical site).
See `crialook-app/docs/LEGAL_DRIFT_RECONCILIATION.md` for the full
write-up; this file just records the phase-level deltas for the M2
manifest.

## Tasks

1. (m2-02-01) Add prominent "Versão completa" card to each legal
   screen via `LegalPage` component. Each in-app legal export now
   carries a `siteSlug` so the link is data-driven; new exported
   `SITE_BASE` constant lets the marketing domain change in one edit.
   `LAST_UPDATED` bumped to `4 de maio de 2026`.
2. (m2-02-02) Switched `scripts/check-legal-drift.js` from
   byte-for-byte sentence comparison to essence-equivalence: hard
   fails on URL 4xx, missing email/host, or LAST_UPDATED >30d behind
   site. Soft warns on wording diffs. Decodes Next.js RSC payload
   (`/`, `\/`) so entity matching works on the live site.
   Fixtures regenerated + new files for subprocessadores +
   consentimento-biometrico.
3. (m2-02-03) Vitest coverage for the script: 12 new tests across
   helpers + healthy CLI + hard-fail CLI + missing-fixture CLI.
   `vitest.config.ts` include glob extended to `scripts/__tests__/`.
4. (m2-02-04) Rewrote `LEGAL_DRIFT_RECONCILIATION.md` to document
   the chosen option, the script semantics, and owner workflow.

## Outcomes

- `npm run check:legal-drift` exit 0 in dry-run AND live (verified
  locally 2026-05-04).
- Mobile vitest 89 → 101 (+12).
- Mobile typecheck clean. No web touch.
- 5 UI screens unchanged at the screen level (siteSlug spreads via
  `<LegalPage {...export} />`); 1 component (`LegalPage.tsx`) gained
  the "Versão completa" card.

## Blockers / surprises

- The marketing site is RSC-streamed, so visible text lives inside
  `<script>` tags as JSON. The first script run hard-failed on every
  URL because stripHtml stripped the scripts; fixed by scanning the
  raw body (with RSC escape decoding) for entity checks while still
  using stripped text for the wording-diff path.
- Subprocessadores: the live site uses slightly different vendor
  privacy paths than the in-app references (`clerk.com/privacy` vs
  `clerk.com/legal/privacy`, etc.). Switched URL matching to
  hostname-only so vendor path drift is a wording-diff (soft warn),
  not a missing-vendor failure. Documented in the script comments.
- `Linking.openURL` was already imported in `LegalPage.tsx` (used by
  the existing `link` block type), so the new "Versão completa"
  affordance reused the import — no new modules added.

## Repo state

```
b112680 feat(m2-02-01): add Versão completa link to legal screens (Option B)
c113775 refactor(m2-02-02): switch drift script to Option B essence semantics
4bf23d3 test(m2-02-03): cover Option B drift script with unit + behavioural tests
+ docs commit (m2-02-04) — this file + LEGAL_DRIFT_RECONCILIATION.md rewrite
```
