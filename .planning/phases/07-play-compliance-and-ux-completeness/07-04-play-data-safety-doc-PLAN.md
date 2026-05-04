---
plan_id: 07-04
phase: 7
title: Author crialook-app/docs/PLAY_DATA_SAFETY.md structured per Play Console form sections — owner copies into Play Console (D-09..D-12)
wave: 1
depends_on: []
owner_action: true
files_modified:
  - crialook-app/docs/PLAY_DATA_SAFETY.md
autonomous: true
requirements: ["D-09", "D-10", "D-11", "D-12", "F-PLAY-§1-data-safety"]
must_haves:
  truths:
    - "doc lives at crialook-app/docs/PLAY_DATA_SAFETY.md (alongside other PLAY_*.md docs)"
    - "doc is structured per Play Console 'Data safety' form sections — Photos and videos / Personal info / App activity / Financial info / Device or other IDs (one section per category)"
    - "for EACH category, the doc records: collected (yes/no), shared (yes/no), required-vs-optional, why collected (purpose enumeration), data handling note (encrypted in transit yes/no, RLS at rest yes/no), user control (delete account flow, opt-out)"
    - "doc cross-references CRIALOOK-PLAY-READINESS.md §1 'Data safety form alignment' (lines 45-53) verbatim where category mapping is locked"
    - "doc enumerates the 4 confirmed categories from D-12: 'Photos and videos' (uploads), 'Personal info → email' (Clerk), 'App activity → in-app actions' (analytics/Sentry telemetry), 'Financial info → purchase history' (Play Billing)"
    - "doc also enumerates 'Device or other IDs' for push token (expo-notifications) — not in D-12 but called out by app.config.ts plugins block; honest answer per category"
    - "for the 'App activity' category, doc notes the Sentry caveat (F-03 from readiness audit): currently DSN is missing in eas.json so telemetry is effectively off in production AAB; once F-03 is fixed in Phase 5, this category should be 'collected: yes, optional: no (always-on when DSN configured)' and the doc records both states"
    - "doc lists the in-app delete-account flow at crialook-app/app/(tabs)/configuracoes.tsx:482 (handleDeleteAccount) AND the new model-delete affordance from plan 07-01 — proves user has working delete pathways for both account-level AND model-level (face-derived) data"
    - "doc lists data-handling notes: TLS 1.2+ everywhere (HTTPS to crialook.com.br/api), Supabase RLS at rest, Clerk session encryption, Play Billing managed by Google (we don't store payment data)"
    - "doc explicitly states 'Owner action: copy each row into the corresponding Play Console form field. This doc is a reusable audit trail; the Play Console form is the authoritative submission surface.' (D-11)"
    - "doc has a checklist at the bottom — owner ticks each row when copied into Play Console. Ten rows minimum: 5 categories × (collected + purpose + sharing + handling + control) condensed where possible"
    - "doc does NOT modify any code — pure documentation deliverable for the owner"
    - "doc references the in-app privacy policy at crialook-app/lib/legal/content.ts (the privacidade export) and notes that the Data Safety form must align with that text item-for-item — drift in either direction is a Play policy violation"
  acceptance:
    - "test -f crialook-app/docs/PLAY_DATA_SAFETY.md exits 0"
    - "wc -l crialook-app/docs/PLAY_DATA_SAFETY.md returns at least 100"
    - "grep -c '^## ' crialook-app/docs/PLAY_DATA_SAFETY.md returns at least 6 (header sections: intro + 5 categories + owner-action checklist)"
    - "grep -ic 'Photos and videos\\|Personal info\\|App activity\\|Financial info\\|Device or other IDs' crialook-app/docs/PLAY_DATA_SAFETY.md returns at least 5"
    - "grep -ic 'collected\\|shared\\|purpose\\|encrypted\\|user control\\|opt-out' crialook-app/docs/PLAY_DATA_SAFETY.md returns at least 10"
    - "grep -c 'CRIALOOK-PLAY-READINESS\\|§1\\|F-06\\|F-03' crialook-app/docs/PLAY_DATA_SAFETY.md returns at least 2 (cross-refs)"
    - "grep -c 'configuracoes.tsx\\|handleDeleteAccount\\|ModelBottomSheet\\|07-01' crialook-app/docs/PLAY_DATA_SAFETY.md returns at least 2 (delete pathway refs)"
    - "grep -ic 'owner action\\|copy.*play console\\|tick when copied' crialook-app/docs/PLAY_DATA_SAFETY.md returns at least 2"
    - "grep -c '- \\[ \\]' crialook-app/docs/PLAY_DATA_SAFETY.md returns at least 5 (owner checklist rows)"
---

# Plan 07-04: PLAY_DATA_SAFETY.md owner-action doc

## Objective

Per D-09..D-12: produce a markdown doc that maps every Play Console "Data safety" form field to the actual data collection / sharing / handling reality of the CriaLook app. The doc is the **owner's copy-paste source** for filling out the Play Console form (D-11) — the doc is reusable for re-submissions and serves as the audit trail.

The Play Console "Data safety" form has fixed sections (Photos and videos, Personal info, App activity, etc.) and within each, fixed fields (collected y/n, shared y/n, why, user control, encryption). This doc structures the answers per that schema so the owner can fill the form mechanically without re-deriving the rationale.

Per CRIALOOK-PLAY-READINESS.md §1 (lines 45-53), the categories are locked:
1. **Photos and videos** → User-provided + processed in cloud + shared with third-party AI providers (Gemini)
2. **Personal info → email** → Account management (Clerk)
3. **App activity → in-app actions** → Sentry telemetry (currently F-03-disabled)
4. **Financial info → purchase history** → Play Billing managed by Google

Plus one category not in D-12 but real per `app.config.ts:189-195` plugins block:
5. **Device or other IDs** → Expo push token (push notification delivery)

This is a **pure documentation deliverable** — owner-action: true. The executor writes the doc; the owner copies into Play Console manually.

## Truths the executor must respect

- Doc lives at `crialook-app/docs/PLAY_DATA_SAFETY.md` (consistent with the existing `crialook-app/docs/PLAY_RELEASE_CHECKLIST.md` location).
- Each section follows the **same template** so the owner can scan quickly:
  ```
  ### {Category name as it appears in Play Console}
  - **Collected:** Yes / No
  - **Shared with third parties:** Yes (list third party) / No
  - **Why collected:** {bullet list of legitimate purposes}
  - **Required or optional for use:** Required / Optional
  - **User control:** {how the user opts out, deletes, or controls; with code refs}
  - **Data handling:** {encryption in transit, at rest, retention period}
  - **In-app text reference:** content.ts privacidade section X
  - **Owner: tick when copied into Play Console** [ ]
  ```
- For each category, cite the source files and line numbers where the data is collected, sent, or stored. This makes the audit trail real (an LGPD inspector could trace a category back to a specific code path).
- **F-03 caveat for App activity:** Sentry DSN is currently missing from eas.json (per F-03 in CRIALOOK-PLAY-READINESS.md, blocking on Phase 5). Until F-03 is closed, the production AAB ships with effectively no telemetry collection. The doc must record BOTH the post-fix state ("collected: yes when DSN configured") AND the current shipping state ("collected: no — F-03 blocking"). This honesty matters: the Play Console form should reflect what the AAB actually does, not what the codebase intends to do. If F-03 lands before Play submission, owner toggles the form field; doc reminds them of the dependency.
- Cross-reference the new model-delete affordance from 07-01: the "Photos and videos" category's "User control" row must say "User can delete a model and its uploaded face photo via ModelBottomSheet trash icon (plan 07-01) — backend cascade-deletes the storage object." This proves the LGPD pathway end-to-end.
- Cross-reference the existing account-delete flow at `crialook-app/app/(tabs)/configuracoes.tsx:207` (`handleDeleteAccount`) and line 482 (the button) — that's the master kill-switch.
- Data handling notes are based on real backend / app behavior:
  - **In transit:** HTTPS to crialook.com.br (TLS 1.2+ via nginx default); Supabase Storage uses TLS; Clerk uses TLS; Google Play Billing handled by Google
  - **At rest:** Supabase Postgres + RLS (per .planning/codebase/STACK.md); Supabase Storage with bucket-level ACLs; Clerk encrypts session tokens; we never store payment card data (Play Billing is the boundary)
  - **Retention:** model uploads kept until user deletes (no automatic GC for personal data); error telemetry capped at 90d in Sentry default config; account deletion cascades all
- Doc is markdown, no code blocks needed beyond an optional code-ref block per category. Short and dense beats long and verbose — Play Console form fields have character limits.
- DO NOT pre-fill the Play Console form. The doc is the source; the owner copies row-by-row. The doc is also versioned (in git) for re-submissions; the form on Play Console is not.

## Tasks

### Task 1: Author the doc

<read_first>
- .planning/audits/CRIALOOK-PLAY-READINESS.md §1 lines 36-53 ("Privacy policy URL" + "Data safety form alignment")
- .planning/audits/CRIALOOK-PLAY-READINESS.md §3 (lines 124-165) for runtime stability + Sentry F-03 context
- crialook-app/lib/legal/content.ts (the privacidade export — lines 79-145; quote section refs)
- crialook-app/app.config.ts (lines 107-114 for usage description, 136-144 for permissions, 189-195 for expo-notifications plugin)
- crialook-app/app/(tabs)/configuracoes.tsx (lines 207, 482 — handleDeleteAccount)
- crialook-app/docs/PLAY_RELEASE_CHECKLIST.md (read for tone/style; this doc complements that one)
- .planning/phases/07-play-compliance-and-ux-completeness/07-CONTEXT.md (D-09..D-12)
- .planning/phases/07-play-compliance-and-ux-completeness/07-01-model-delete-trash-icon-PLAN.md (cross-ref the delete affordance)
</read_first>

<action>
Create `crialook-app/docs/PLAY_DATA_SAFETY.md` with this content (executor adapts language, but the structure + categories are fixed):

```markdown
# Play Console — Data Safety form mapping (CriaLook)

**Purpose:** This doc maps every Play Console "Data safety" form field to the actual data collection / sharing / handling reality of CriaLook. Owner copies each row into the form at submission time.

**Source of truth alignment:** This doc MUST stay aligned with `crialook-app/lib/legal/content.ts` (the in-app privacy policy text). Any drift between this doc, the in-app text, and the Play Console submission is a Google Play User Data Policy violation. Plan 07-07 wires a CI check for content.ts ↔ site drift; this doc is the third corner of the triangle (content.ts ↔ site ↔ Play Console).

**Audit cross-ref:** `.planning/audits/CRIALOOK-PLAY-READINESS.md` §1 "Data safety form alignment" (lines 45-53) — the category list below is derived from that audit.

**F-03 dependency:** Sentry DSN is currently absent from `eas.json` (F-03, fixed in Phase 5). Until that lands, the "App activity" category below is effectively NOT collected in production. Owner: re-validate this section before submission to match the AAB's actual behavior.

---

## Category 1: Photos and videos

- **Collected:** Yes
- **Shared with third parties:** Yes
  - Third parties: Google Gemini (image processing for the AI generation pipeline) — see `.planning/codebase/ARCHITECTURE.md` for pipeline details
- **Why collected:**
  - User uploads garment photos to generate marketing campaign imagery (core product function)
  - User uploads optional face photos to create personalized "custom models" used in generated imagery
  - Both are required for the app's primary value proposition; neither is collected for advertising or analytics
- **Required or optional for use:** Required for generation (no campaigns without uploaded garments); optional for custom models (default catalog models work without uploading a face)
- **User control:**
  - Account-level deletion: `crialook-app/app/(tabs)/configuracoes.tsx:482` (`handleDeleteAccount`) — cascades all uploads
  - Per-model deletion: `crialook-app/components/ModelBottomSheet.tsx` trash icon (added by Phase 7 plan 07-01) — deletes the model + its face photo
- **Data handling:**
  - In transit: HTTPS to crialook.com.br/api (TLS 1.2+) and Supabase Storage (TLS)
  - At rest: Supabase Storage with bucket-level ACLs; per-user RLS on database refs
  - Retention: until user deletes (no automatic GC); account deletion cascades immediately
- **In-app text reference:** content.ts → privacidade → "Quais dados coletamos" (block ~line 87-95)
- [ ] Owner: tick when copied into Play Console

---

## Category 2: Personal info — email

- **Collected:** Yes
- **Shared with third parties:** Yes
  - Third party: Clerk (auth provider) — Clerk is the identity store; we never store password hashes or PII outside Clerk
- **Why collected:**
  - Account creation (Clerk requires email for sign-in)
  - Transactional emails (purchase receipts via Mercado Pago / Play Billing — sent by the payment processor, not directly by us)
- **Required or optional for use:** Required (no anonymous use)
- **User control:**
  - Account deletion via configuracoes.tsx:482 → backend webhook cascades Clerk deletion
  - Email change: via Clerk's hosted account UI (not embedded in app)
- **Data handling:**
  - In transit: TLS to Clerk
  - At rest: encrypted by Clerk (their managed responsibility)
  - Retention: as long as account exists; deleted on account deletion
- **In-app text reference:** content.ts → privacidade → "Conta e identificação" (block ~line 95-100)
- [ ] Owner: tick when copied into Play Console

---

## Category 3: App activity — in-app actions / crashes

- **Collected:** Yes (CONDITIONAL — see F-03)
- **Shared with third parties:** Yes
  - Third party: Sentry (error monitoring SaaS)
- **Why collected:**
  - Crash reports for stability triage (no PII in stack traces; we configure beforeSend filters per `crialook-app/lib/sentry.ts`)
  - Performance traces (Reanimated frame drops, slow API calls) for product debugging
- **Required or optional for use:** Optional (informational — no functional gate on telemetry)
- **User control:** None today — telemetry is always-on when SENTRY_DSN is configured. (Future improvement: opt-out toggle in configuracoes.tsx)
- **Data handling:**
  - In transit: TLS to Sentry's ingest endpoint
  - At rest: Sentry's default 90-day retention; PII scrubbed via beforeSend (lib/sentry.ts:5,16-94 — referenced in PLAY-READINESS audit §3)
  - Session Replay: explicitly disabled in 3 layers (sample rate 0 + integration filter + plugin note); no screen recording is captured
- **F-03 status:** Sentry DSN is currently NOT set in eas.json production profile (per CRIALOOK-PLAY-READINESS F-03, line 17). Until Phase 5 fixes F-03, the production AAB collects ZERO telemetry — owner should answer "Collected: No" on the Play Console form for the initial submission, then update post-F-03 to "Collected: Yes".
- **In-app text reference:** content.ts → privacidade → "Telemetria e diagnóstico" (or section name per current content.ts; if absent, OWNER ACTION: add a Sentry disclosure paragraph to content.ts before submission)
- [ ] Owner: tick when copied into Play Console
- [ ] Owner: re-validate this section after Phase 5 closes F-03

---

## Category 4: Financial info — purchase history

- **Collected:** No (handled by Google)
- **Shared with third parties:** N/A
- **Why collected:** N/A — purchases are processed by Google Play Billing; we receive opaque purchase tokens and verify them server-side. We do NOT receive card numbers, billing addresses, or payment instruments.
- **Required or optional for use:** N/A
- **User control:** Manage subscription via Play Store → Subscriptions; we surface a deep link in `crialook-app/app/(tabs)/plano.tsx` (verify exact path)
- **Data handling:** Purchase tokens stored server-side (Supabase) with hash binding to the Clerk user ID per `lib/billing.ts:82-89` (CRIALOOK-PLAY-READINESS §4 control 3)
- **In-app text reference:** content.ts → termos → "Pagamento e cancelamento" (line ~54-58)
- [ ] Owner: tick when copied into Play Console (mark as "Not collected" in form)

---

## Category 5: Device or other IDs — push token

- **Collected:** Yes
- **Shared with third parties:** Yes
  - Third party: Expo Push Notification service (token forwarding to FCM/APNS)
- **Why collected:**
  - Send push notifications when a generation completes (long-running pipeline; user backgrounds the app)
  - Re-engagement notifications (subject to user opt-in via `lib/pushOptInGate.ts`)
- **Required or optional for use:** Optional (push opt-in is gated; declining still allows full use)
- **User control:**
  - Decline at the in-app opt-in prompt (lib/pushOptInGate.ts)
  - Disable notifications at OS level (Android Settings → CriaLook → Notifications)
  - Account deletion clears the stored token from `stores.push_token` server-side
- **Data handling:**
  - In transit: TLS to Expo + Google FCM
  - At rest: token stored server-side, deleted on account deletion
- **In-app text reference:** content.ts → privacidade → notification disclosure section (verify exists; if absent, OWNER ACTION: add)
- [ ] Owner: tick when copied into Play Console

---

## Owner action — Play Console submission checklist

Before promoting an AAB from Internal Testing to Production track:

- [ ] All 5 category sections above ticked
- [ ] In-app `lib/legal/content.ts` privacidade text reviewed and aligned with this doc (drift = policy violation)
- [ ] Plan 07-03 (legal drift reconciliation) signed off
- [ ] Plan 07-07 (CI drift script) green
- [ ] F-03 (Sentry DSN in eas.json) status confirmed and Category 3 reflects current AAB behavior
- [ ] Privacy policy URL `https://crialook.com.br/privacidade` matches in-app text byte-for-byte
- [ ] If any "OWNER ACTION: add" disclosure was flagged above, content.ts updated and pushed to crialook.com.br BEFORE submission

## Versioning

| Date | Editor | Change |
|------|--------|--------|
| YYYY-MM-DD | Phase 7 plan 07-04 | Initial mapping for Play Store first submission |

## Why this doc exists

Per CRIALOOK-PLAY-READINESS.md §1, the Play Console "Data safety" form is the most-scrutinized policy surface in modern Play submissions. Drift between the form, the in-app privacy text, and what the app actually does → reviewer rejection. This doc forces the three to be ONE source of truth at submission time, and the markdown trail makes re-submissions trivial (owner re-reads the doc, ticks the rows, copies into form).
```

Adapt the in-app text references (e.g., "block ~line 87-95") to the actual content.ts structure as it exists post-07-03 (the reconciliation may renumber things).
</action>

<verify>
```bash
test -f crialook-app/docs/PLAY_DATA_SAFETY.md && echo OK
wc -l crialook-app/docs/PLAY_DATA_SAFETY.md
# Expect at least 100 lines

grep -c "^## " crialook-app/docs/PLAY_DATA_SAFETY.md
# Expect at least 6

grep -c "Owner: tick" crialook-app/docs/PLAY_DATA_SAFETY.md
# Expect at least 5 (one per category)

grep -c "^- \[ \]" crialook-app/docs/PLAY_DATA_SAFETY.md
# Expect at least 5 (checkboxes)
```
</verify>

## Owner-action callout (D-11)

This plan is `owner_action: true`. The deliverable is the markdown doc; the owner is responsible for:

1. Reading the doc end-to-end before each Play Store submission.
2. Copying each section into the Play Console "Data safety" form.
3. Re-validating Category 3 ("App activity") whenever Sentry DSN status changes (F-03).
4. Ticking each `[ ]` checkbox in the doc as a per-submission audit log (commit the ticks back to git for audit trail).

## Files modified

- `crialook-app/docs/PLAY_DATA_SAFETY.md` — NEW; owner-action mapping doc

## Why this matters (risk if skipped)

Per CRIALOOK-PLAY-READINESS.md §1: the Data Safety form is the highest-friction policy surface in Play review. Misrepresenting any category (e.g., claiming "no third-party sharing" when the AI pipeline sends photos to Gemini) is a hard policy strike. Without this doc, the owner answers each form field from memory at submission time → drift between submissions → reviewer flags inconsistency → app rejected. This doc removes the per-submission cognitive load and creates an audit trail.
