# Play Console — Data Safety form mapping (CriaLook)

**Audit date:** 2026-05-03
**Maintained by:** GSD Phase 7 plan 07-04 (D-09..D-12)
**Owner action:** YES — owner copies each row into Play Console at submission time

**Purpose.** This doc maps every Play Console "Data safety" form field to the actual data collection / sharing / handling reality of CriaLook. The doc is the **owner's copy-paste source** for filling out the Play Console form (D-11). The doc is reusable for re-submissions and serves as the audit trail.

**Source-of-truth alignment.** This doc MUST stay aligned with `crialook-app/lib/legal/content.ts` (the in-app privacy policy text). Drift between this doc, the in-app text, and the Play Console submission is a Google Play User Data Policy violation. Plan 07-07 wires a CI check for content.ts ↔ site drift; this doc is the third corner of the triangle (content.ts ↔ site ↔ Play Console).

**Audit cross-ref.** `.planning/audits/CRIALOOK-PLAY-READINESS.md` §1 "Data safety form alignment" (lines 45-53) — the category list below is derived from that audit. The 5th category (Device or other IDs) was added per `crialook-app/app.config.ts` plugins block (expo-notifications), which D-12 didn't enumerate but which honest disclosure requires.

**F-03 dependency.** Sentry DSN is currently absent from `eas.json` (F-03, fixed in Phase 5). Until that lands, the "App activity" category below is effectively NOT collected in the production AAB. Owner: re-validate this section before submission to match the AAB's actual behavior.

---

## Category 1: Photos and videos

- **Collected:** Yes
- **Shared with third parties:** Yes
  - Third party: Google Gemini (image processing for the AI generation pipeline) — see `.planning/codebase/ARCHITECTURE.md` for pipeline details
- **Why collected (purpose enumeration):**
  - User uploads garment photos to generate marketing campaign imagery (core product function)
  - User uploads optional face photos to create personalized "custom models" used in generated imagery
  - Both are required for the app's primary value proposition; neither is collected for advertising or analytics
- **Required or optional for use:** Required for generation (no campaigns without uploaded garments); optional for custom models (default catalog models work without uploading a face)
- **User control:**
  - Account-level deletion: `crialook-app/app/(tabs)/configuracoes.tsx:482` (`handleDeleteAccount`) — cascades all uploads
  - Per-model deletion: `crialook-app/components/ModelBottomSheet.tsx` trash icon (added by Phase 7 plan 07-01) — deletes the model + its face photo via the backend `DELETE /model/:id` endpoint
- **Data handling:**
  - In transit: HTTPS to crialook.com.br/api (TLS 1.2+) and Supabase Storage (TLS)
  - At rest: Supabase Storage with bucket-level ACLs; per-user RLS on database refs
  - Retention: until user deletes (no automatic GC for personal data); account deletion cascades immediately; per content.ts privacidade §6, removed within 30 days post-deletion
- **In-app text reference:** `lib/legal/content.ts` → `privacidade` → §1 "Dados que coletamos" (item: "Conteúdo: fotos enviadas, modelos virtuais cadastrados, campanhas geradas") + §4 "Compartilhamento"
- [ ] Owner: tick when copied into Play Console

---

## Category 2: Personal info — email

- **Collected:** Yes
- **Shared with third parties:** Yes
  - Third party: Clerk (auth provider) — Clerk is the identity store; we never store password hashes or PII outside Clerk
- **Why collected (purpose enumeration):**
  - Account creation (Clerk requires email for sign-in)
  - Transactional emails (purchase receipts via Mercado Pago / Play Billing — sent by the payment processor, not directly by us)
- **Required or optional for use:** Required (no anonymous use)
- **User control:**
  - Account deletion via `app/(tabs)/configuracoes.tsx:482` → backend webhook cascades Clerk deletion
  - Email change: via Clerk's hosted account UI (not embedded in app)
- **Data handling:**
  - In transit: TLS to Clerk
  - At rest: encrypted by Clerk (their managed responsibility)
  - Retention: as long as account exists; deleted on account deletion
- **In-app text reference:** `lib/legal/content.ts` → `privacidade` → §1 "Dados que coletamos" (item: "Conta: nome, e-mail, telefone (opcional)")
- [ ] Owner: tick when copied into Play Console

---

## Category 3: App activity — in-app actions / crashes

- **Collected:** Yes (CONDITIONAL — see F-03 status below)
- **Shared with third parties:** Yes
  - Third party: Sentry (error monitoring SaaS)
- **Why collected (purpose enumeration):**
  - Crash reports for stability triage (no PII in stack traces; we configure beforeSend filters per `crialook-app/lib/sentry.ts`)
  - Performance traces (Reanimated frame drops, slow API calls) for product debugging
- **Required or optional for use:** Optional (informational — no functional gate on telemetry)
- **User control:** None today — telemetry is always-on when SENTRY_DSN is configured. (Future improvement: opt-out toggle in `configuracoes.tsx`.)
- **Data handling:**
  - In transit: TLS to Sentry's ingest endpoint
  - At rest: Sentry's default 90-day retention; PII scrubbed via beforeSend (`lib/sentry.ts`)
  - Session Replay: explicitly disabled in 3 layers (sample rate 0 + integration filter + plugin note); no screen recording is captured
- **F-03 status:** Sentry DSN is currently NOT set in eas.json production profile (per CRIALOOK-PLAY-READINESS F-03). Until Phase 5 fixes F-03, the production AAB collects ZERO telemetry. **Owner: answer "Collected: No" on the Play Console form for the initial submission, then update post-F-03 to "Collected: Yes" and re-submit a Data Safety amendment.**
- **In-app text reference:** `lib/legal/content.ts` → `privacidade` → §1 (item: "Uso: telas visitadas, ações executadas, eventos de erro (via Sentry, anonimizados)")
- [ ] Owner: tick when copied into Play Console
- [ ] Owner: re-validate this section after Phase 5 closes F-03

---

## Category 4: Financial info — purchase history

- **Collected:** No (handled by Google Play Billing)
- **Shared with third parties:** N/A
- **Why collected:** N/A — purchases are processed by Google Play Billing; we receive opaque purchase tokens and verify them server-side. We do NOT receive card numbers, billing addresses, or payment instruments.
- **Required or optional for use:** N/A
- **User control:** Manage subscription via Play Store → Subscriptions; the app surfaces a deep link in `crialook-app/app/(tabs)/plano.tsx`
- **Data handling:** Purchase tokens stored server-side (Supabase) with hash binding to the Clerk user ID (per CRIALOOK-PLAY-READINESS §4 control 3); we never persist payment instruments
- **In-app text reference:** `lib/legal/content.ts` → `termos` → §6 "Pagamento e cancelamento"
- [ ] Owner: tick when copied into Play Console (mark as "Not collected" in form)

---

## Category 5: Device or other IDs — push token

- **Collected:** Yes
- **Shared with third parties:** Yes
  - Third party: Expo Push Notification service (token forwarding to FCM)
- **Why collected (purpose enumeration):**
  - Send push notifications when a generation completes (long-running pipeline; user backgrounds the app)
  - Re-engagement notifications (subject to user opt-in via `lib/pushOptInGate.ts`)
- **Required or optional for use:** Optional (push opt-in is gated; declining still allows full use)
- **User control:**
  - Decline at the in-app opt-in prompt (`lib/pushOptInGate.ts`)
  - Disable notifications at OS level (Android Settings → CriaLook → Notifications)
  - Account deletion clears the stored token from `stores.push_token` server-side
- **Data handling:**
  - In transit: TLS to Expo + Google FCM
  - At rest: token stored server-side; deleted on account deletion
- **Source code ref:** `crialook-app/app.config.ts:189-195` (expo-notifications plugin block)
- **In-app text reference:** `lib/legal/content.ts` → `privacidade` → notification disclosure (verify exists post-07-03 reconciliation; if absent, OWNER ACTION: add a "Notificações" disclosure paragraph to content.ts before submission)
- [ ] Owner: tick when copied into Play Console

---

## Owner action — Play Console submission checklist

Before promoting an AAB from Internal Testing to Production track:

- [ ] All 5 category sections above ticked
- [ ] In-app `lib/legal/content.ts` privacidade text reviewed and aligned with this doc (drift = policy violation)
- [ ] Plan 07-03 (legal drift reconciliation) signed off, including the OWNER ACTION P0 items in `LEGAL_DRIFT_RECONCILIATION.md`
- [ ] Plan 07-07 (CI drift script) green
- [ ] F-03 (Sentry DSN in eas.json) status confirmed AND Category 3 above reflects the current AAB behavior
- [ ] Privacy policy URL `https://crialook.com.br/privacidade` matches in-app text byte-for-byte (or per the Option A/B reconciliation chosen in 07-03)
- [ ] If any "OWNER ACTION: add" disclosure was flagged above (notification token, F-03 fix), `content.ts` updated and pushed to crialook.com.br BEFORE submission

## Versioning

| Date | Editor | Change |
|------|--------|--------|
| 2026-05-03 | Phase 7 plan 07-04 | Initial mapping for Play Store first submission; 5 categories enumerated |

## Why this doc exists

Per CRIALOOK-PLAY-READINESS.md §1, the Play Console "Data safety" form is the most-scrutinized policy surface in modern Play submissions. Drift between the form, the in-app privacy text, and what the app actually does → reviewer rejection. This doc forces the three to be ONE source of truth at submission time, and the markdown trail makes re-submissions trivial (owner re-reads the doc, ticks the rows, copies into form).
