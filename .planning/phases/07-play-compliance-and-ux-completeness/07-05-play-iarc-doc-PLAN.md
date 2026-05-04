---
plan_id: 07-05
phase: 7
title: Author crialook-app/docs/PLAY_IARC.md — IARC questionnaire answers + rationale for "Classificação 12" + AI-apparel advisory (D-13..D-16)
wave: 1
depends_on: []
owner_action: true
files_modified:
  - crialook-app/docs/PLAY_IARC.md
autonomous: true
requirements: ["D-13", "D-14", "D-15", "D-16", "F-PLAY-§1-content-rating"]
must_haves:
  truths:
    - "doc lives at crialook-app/docs/PLAY_IARC.md (alongside other PLAY_*.md)"
    - "doc records the locked rating decision per D-13: Classificação 12 (formerly 'Todos') + content advisory 'AI-generated apparel imagery, may include swimwear/lingerie/sleepwear'"
    - "doc explains the rationale per D-14 — honest default given fashion-catalog scope (swimwear/lingerie/sleepwear are legitimate apparel categories the model may render); reviewer-Play has zero ambiguity; UX impact mínima (12 still ample audience)"
    - "doc cites D-16 — commit 258380b (fix(ai/prompt): replace body-transformation examples with look-only language) as evidence the prompt was hardened against body-transformation; advisory text remains accurate ('AI generates clothing on uploaded photos, may include swimwear/lingerie/sleepwear')"
    - "doc enumerates each IARC questionnaire question + the answer to give, in submission order — Sex, Violence, Profanity, Drugs, Gambling, User-generated content, etc., with per-question rationale"
    - "doc lists the EXACT advisory text to enter in the Play Console content-advisory free-text field (so the owner copies verbatim — no paraphrasing risk)"
    - "doc has an owner-action checklist: (1) update IARC questionnaire in Play Console with the answers below, (2) confirm the new rating shows 'Classificação 12 + advisory' on the Store Listing preview, (3) update PLAY_STORE_LISTING.md per plan 07-06, (4) re-submit if changes apply to current track"
    - "doc provides re-submission audit trail per D-15: any future change to the AI prompt or the model catalog (adding new garment categories, e.g., underwear-only) triggers a re-read of this doc + potential re-questionnaire — the doc explicitly lists the triggers"
    - "doc cross-references store-assets/PLAY_STORE_LISTING.md line 60 ('Todos (sem conteúdo restrito)') — that line MUST be updated by plan 07-06 to match the new rating"
    - "doc cross-references CRIALOOK-PLAY-READINESS.md §1 'Content rating' (lines 78-81) verbatim where the risk analysis is locked"
    - "doc explicitly states D-15 — owner-action: 'Owner updates IARC questionnaire in Play Console manually. This doc is the audit trail for re-submissions; the questionnaire is the authoritative submission surface.'"
    - "doc does NOT modify any code — pure documentation deliverable for the owner"
  acceptance:
    - "test -f crialook-app/docs/PLAY_IARC.md exits 0"
    - "wc -l crialook-app/docs/PLAY_IARC.md returns at least 60"
    - "grep -c '^## ' crialook-app/docs/PLAY_IARC.md returns at least 4 (decision + questionnaire + advisory text + owner action)"
    - "grep -c 'Classificação 12' crialook-app/docs/PLAY_IARC.md returns at least 2"
    - "grep -ic 'swimwear\\|lingerie\\|sleepwear' crialook-app/docs/PLAY_IARC.md returns at least 2"
    - "grep -c '258380b' crialook-app/docs/PLAY_IARC.md returns at least 1 (commit ref for prompt hardening)"
    - "grep -c 'PLAY_STORE_LISTING\\|07-06' crialook-app/docs/PLAY_IARC.md returns at least 1"
    - "grep -ic 'owner action\\|owner updates\\|copy.*play console' crialook-app/docs/PLAY_IARC.md returns at least 2"
    - "grep -c '- \\[ \\]' crialook-app/docs/PLAY_IARC.md returns at least 4 (owner checklist rows)"
    - "grep -ic 'AI-generated apparel imagery' crialook-app/docs/PLAY_IARC.md returns at least 1 (the verbatim advisory text)"
---

# Plan 07-05: PLAY_IARC.md owner-action doc

## Objective

Per D-13..D-16: re-evaluate the IARC content rating given the AI-generated fashion imagery surface, document the new answers + rationale, and provide the owner with a copy-paste source for the Play Console content rating questionnaire.

**The decision is locked (D-13):** bump from "Todos (sem conteúdo restrito)" (current per `store-assets/PLAY_STORE_LISTING.md:60`) to **"Classificação 12"** + content advisory **"AI-generated apparel imagery, may include swimwear/lingerie/sleepwear"**.

**Rationale (D-14):** honest default given the fashion-catalog scope — swimwear, lingerie, and sleepwear are legitimate apparel categories the AI may render. A reviewer who flags AI-generated swimwear under a "Todos" rating triggers a hard policy strike. "Classificação 12" + advisory is a defensible, honest baseline; UX impact is minimal because Play Store's "12+" filter still covers a very broad audience and most CriaLook customers are adults running fashion businesses anyway.

**Prompt context (D-16):** commit `258380b` already hardened the AI prompt against body-transformation (`fix(ai/prompt): replace body-transformation examples with look-only language`). The advisory text reflects this — "AI generates clothing on uploaded photos" — not "AI generates bodies", because the model is constrained to clothing-only synthesis on top of the user-uploaded face.

This plan produces:
1. The questionnaire walkthrough (each question + answer + rationale).
2. The exact advisory text to paste.
3. An owner-action checklist for the Play Console submission.
4. A re-submission trigger list (when to re-run the questionnaire).

## Truths the executor must respect

- The doc is **owner-action**: the executor writes the doc; the owner manually updates the IARC questionnaire in Google Play Console (D-15). Per the project memory `project_clerk_client_trust.md` pattern, owner-action items must have explicit checklists with [ ] checkboxes the owner ticks.
- The IARC questionnaire is administered by Google as part of the Play Console submission flow. Questions are categorized: Violence, Sex, Crude humor, Profanity, Drugs/Alcohol/Tobacco, Gambling, User-generated content, Personal info sharing, Location sharing, Digital purchases. The doc lists the answer for EACH category with a one-line rationale.
- The "Classificação 12" rating in Brazil corresponds roughly to PEGI 12 / ESRB Everyone 10+ to Teen — adequate for fashion content with apparel categories that include intimate apparel as a legitimate sub-category.
- The advisory free-text field has a character limit (Google does not publish it explicitly, but historical limit is ~150 chars). The advisory text "AI-generated apparel imagery, may include swimwear/lingerie/sleepwear" is ~70 chars — fits with margin.
- The doc must reference commit `258380b` by hash (not by message text, which may be edited later) so the audit trail is stable. Use `git log --oneline | grep 258380b` to confirm hash if needed; per the gitStatus context, this is a recent commit on main.
- The doc cross-references plan 07-06 because that plan updates `store-assets/PLAY_STORE_LISTING.md:60` from "Todos (sem conteúdo restrito)" to "Classificação 12". The two changes MUST land together for consistency.
- Re-submission triggers (record explicitly): (a) any new garment category added to the catalog (e.g., adult-only categories — would trigger 16/18 rating), (b) any prompt change that loosens body-transformation constraints, (c) any new model gender/body type added, (d) any change to the AI provider that affects content moderation guarantees.
- Doc does NOT modify code. It is a markdown deliverable in `crialook-app/docs/`.

## Tasks

### Task 1: Author the doc

<read_first>
- .planning/audits/CRIALOOK-PLAY-READINESS.md §1 lines 78-81 ("Content rating") — risk analysis for AI-generated swimwear/lingerie
- crialook-app/store-assets/PLAY_STORE_LISTING.md (lines 32-38, 60) — current "Todos" claim + the categories that must change
- .planning/phases/07-play-compliance-and-ux-completeness/07-CONTEXT.md (D-13..D-16)
- .planning/phases/07-play-compliance-and-ux-completeness/07-06-play-store-listing-polish-PLAN.md (cross-ref the listing update)
- crialook-app/docs/PLAY_RELEASE_CHECKLIST.md (style/tone reference)
- Recent commit 258380b in main branch — confirm via git log
</read_first>

<action>
Create `crialook-app/docs/PLAY_IARC.md` with this content:

```markdown
# Play Console — IARC Content Rating audit trail (CriaLook)

**Purpose:** This doc records the IARC content rating decision for CriaLook + the questionnaire answers + the rationale, so the owner can update the Play Console questionnaire mechanically and re-submissions are auditable.

**Decision (locked Phase 7 D-13):**
- **Rating:** Classificação 12 (Brazil IARC equivalent of PEGI 12 / ESRB Teen-adjacent)
- **Content advisory:** "AI-generated apparel imagery, may include swimwear/lingerie/sleepwear"

**Previous rating:** "Todos (sem conteúdo restrito)" — per `crialook-app/store-assets/PLAY_STORE_LISTING.md:60` before Phase 7 plan 07-06 updates it.

---

## Rationale (D-14)

CriaLook generates fashion-catalog imagery via AI. Fashion catalogs legitimately include intimate apparel categories: swimwear, lingerie, sleepwear. The AI pipeline (Gemini VTO + Sonnet copywriter) is prompted to render the user-uploaded garment on a virtual model — and "garment" can include any apparel category the user uploads.

Three reasons "Todos (sem conteúdo restrito)" is the WRONG rating:

1. **Reviewer ambiguity.** A Play reviewer who flags AI-generated swimwear under a "Todos" rating issues a content-rating violation strike. Strikes accumulate; a strike on rating during initial review can delay submission by weeks while we re-questionnaire and re-submit. **Risk-adjusted cost of "honest 12" is far less than risk-adjusted cost of "optimistic Todos".**

2. **AI-generated nature.** Even if the underlying garments are tame, the AI synthesis surface itself attracts heightened policy scrutiny in 2025+. Google's content policies for AI apps (effective 2024 and tightened 2025) require explicit advisories when AI generates body imagery of any kind.

3. **The prompt is hardened but not invincible.** Commit `258380b` (`fix(ai/prompt): replace body-transformation examples with look-only language`) constrained the prompt against generating body transformations — only clothing synthesis on uploaded faces. But "look-only" still includes the apparel categories above, and prompt jailbreaks are an ever-present risk in any AI app. Advisory text honest-defaults to "may include swimwear/lingerie/sleepwear" so the rating survives a future prompt drift or jailbreak demonstration.

**UX impact analysis:** Classificação 12 still allows the app to appear in family-account browsing for users 12+. The Play Store "12+" content filter excludes only the strict-young-children user segment, which is NOT the CriaLook target demographic (we target adult lojistas running fashion e-commerce). Net audience impact: negligible.

---

## IARC questionnaire — answer-by-answer walkthrough

The owner re-takes the questionnaire in Play Console → App content → Content rating. For each category, give the answer below.

### Sexual content
- **Question:** "Does the app contain sexual content or nudity?"
- **Answer:** Yes — partial nudity context
- **Specifics:** "Implied/suggested intimate apparel imagery (swimwear, lingerie, sleepwear) generated by AI from user-uploaded fashion garments. No explicit nudity, no sexual acts, no romantic content."
- **Rationale:** Honest acknowledgment per D-13/D-14. Do NOT answer "No" — that's the violation pathway.

### Violence
- **Question:** "Does the app contain violence?"
- **Answer:** No
- **Rationale:** Pure fashion-catalog content; no violent imagery is generated.

### Crude humor / profanity
- **Question:** "Does the app contain profanity or crude humor?"
- **Answer:** No (in app UI / generated copy)
- **Rationale:** Sonnet copywriter is prompted for marketing-grade Brazilian Portuguese product copy. No profanity is in scope. If a future copy template introduces crude humor, re-run this questionnaire.

### Drugs, alcohol, tobacco
- **Question:** "Does the app reference drugs, alcohol, or tobacco?"
- **Answer:** No
- **Rationale:** Fashion-catalog scope only.

### Gambling
- **Question:** "Does the app contain gambling content or simulated gambling?"
- **Answer:** No
- **Rationale:** N/A.

### User-generated content
- **Question:** "Does the app allow users to upload, share, or generate content?"
- **Answer:** Yes
- **Specifics:** "Users upload garment photos and (optionally) face photos. The AI generates campaign imagery from these inputs. Users can share generated imagery via system share sheets to Instagram/WhatsApp."
- **Moderation:** Server-side prompt hardening (commit 258380b) + AI provider's own content moderation (Gemini policies). No real-time human moderation.
- **Rationale:** Honest acknowledgment. Combined with the partial-nudity answer above, this is the second pillar supporting Classificação 12.

### Personal information sharing
- **Question:** "Does the app share personal information with other users?"
- **Answer:** No
- **Rationale:** Generated imagery is private to the uploader's account; no in-app social features.

### Location sharing
- **Question:** "Does the app share user location?"
- **Answer:** No
- **Rationale:** No location collection at any level.

### Digital purchases
- **Question:** "Does the app contain digital purchases?"
- **Answer:** Yes (subscriptions via Google Play Billing)
- **Rationale:** Auto-renewing subscription tiers per `crialook-app/store-assets/PLAY_STORE_LISTING.md:40-44`.

---

## Content advisory — exact text to enter

In the Play Console "Content advisories" free-text field (after the questionnaire), enter VERBATIM:

```
AI-generated apparel imagery, may include swimwear/lingerie/sleepwear
```

(70 chars — well under any character limit.)

If Play Console requires a Brazilian Portuguese version separately, also enter:

```
Imagens de moda geradas por IA, podem incluir maiôs/lingerie/pijamas
```

---

## Owner action — Play Console submission checklist

- [ ] Owner: re-take the IARC questionnaire in Play Console → App content → Content rating, using the answers above
- [ ] Owner: confirm the resulting rating displays as "Classificação 12" (or the IARC equivalent for the territories Play Console summarizes)
- [ ] Owner: paste the advisory text verbatim into the Content advisories field
- [ ] Owner: confirm `crialook-app/store-assets/PLAY_STORE_LISTING.md` line 60 has been updated by plan 07-06 BEFORE submission (drift between this doc and the listing claim is itself a policy issue)
- [ ] Owner: if the AAB is already on a track (Internal/Closed/Production), the new rating may require resubmitting — check Play Console for the "Resubmit for review" prompt
- [ ] Owner: tick this checklist back to git as audit trail per submission cycle

---

## Re-submission triggers

This doc must be re-read and the questionnaire potentially re-taken when ANY of:

- A new garment category is added to the catalog that introduces content-rating risk (e.g., adult-only categories like fetish wear → would trigger Classificação 16 or 18)
- The AI prompt is loosened on body-transformation constraints (would weaken D-16 evidence)
- A new model body type or gender is added (re-validate "no sexual content" still holds)
- The AI provider changes (Gemini → other; new provider's content moderation guarantees may differ)
- Sonnet copywriter prompt is loosened on profanity / crude humor
- Any user-flagged content-rating concern surfaces in customer support

When any of those land, the owner edits the answer in the relevant section above, increments the version table, and re-takes the questionnaire.

---

## Versioning

| Date | Editor | Change |
|------|--------|--------|
| YYYY-MM-DD | Phase 7 plan 07-05 | Initial bump from "Todos" → "Classificação 12" + apparel advisory; rationale per D-14 |

## Cross-references

- `.planning/audits/CRIALOOK-PLAY-READINESS.md` §1 "Content rating" (lines 78-81) — risk analysis source
- `crialook-app/store-assets/PLAY_STORE_LISTING.md` line 60 — must change from "Todos" to "Classificação 12" via plan 07-06
- Commit `258380b` — `fix(ai/prompt): replace body-transformation examples with look-only language` — evidence the prompt is hardened
- `crialook-app/docs/PLAY_DATA_SAFETY.md` — companion doc for the Data Safety form (plan 07-04)
```

The date placeholder ("YYYY-MM-DD") should be replaced with the actual run date.
</action>

<verify>
```bash
test -f crialook-app/docs/PLAY_IARC.md && echo OK
wc -l crialook-app/docs/PLAY_IARC.md
# Expect at least 60 lines

grep -c "Classificação 12" crialook-app/docs/PLAY_IARC.md
# Expect at least 2

grep -c "258380b" crialook-app/docs/PLAY_IARC.md
# Expect at least 1

grep -c "^- \[ \]" crialook-app/docs/PLAY_IARC.md
# Expect at least 4
```
</verify>

## Owner-action callout (D-15)

This plan is `owner_action: true`. The deliverable is the markdown doc; the owner is responsible for:

1. Re-taking the IARC questionnaire in Play Console using the answers above.
2. Pasting the advisory text verbatim.
3. Confirming the resulting rating displays as expected on the Store Listing preview.
4. Re-validating the doc whenever a re-submission trigger fires.

The executor MUST NOT attempt to update Play Console programmatically — there is no API for the IARC questionnaire and the owner-action constraint is explicit per D-15.

## Files modified

- `crialook-app/docs/PLAY_IARC.md` — NEW; IARC audit trail + owner-action questionnaire walkthrough

## Why this matters (risk if skipped)

Per CRIALOOK-PLAY-READINESS.md §1 (lines 78-81): misrepresenting content rating is a hard Google Play policy violation. A reviewer who flags AI-generated swimwear/lingerie under a "Todos" rating issues a strike that delays submission and may force a track demotion. The honest "Classificação 12 + advisory" path costs nothing in audience reach and removes the entire risk vector. Without this doc, the questionnaire gets re-answered from memory at every re-submission, drift creeps in, and an unrelated re-submission can accidentally regress the rating.
