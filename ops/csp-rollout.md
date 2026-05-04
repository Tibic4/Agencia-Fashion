# CSP Rollout — Report-Only → Enforced (Owner Action)

**Phase 8 plan 08-06 (D-08..D-11).** Decision authority: owner.

This doc is the operating manual for transitioning the CriaLook nginx CSP header from `Content-Security-Policy-Report-Only` to enforced `Content-Security-Policy`. The transition is OWNER ACTION — single nginx edit + reload; not automatable from the codebase.

---

## Context

`nginx-crialook.conf` ships the CSP header in **Report-Only** mode (per plan 08-02). Browsers compute violations against the policy but do NOT block resources — they POST a violation report to `/api/csp-report` (this same Phase 8 plan), which forwards to Sentry as a `warning`-level message with `tag: csp_violation=true`.

The 2-week zero-violation observation window (D-09) exists because:
- The CSP source-list covers Clerk, Sentry, Mercado Pago, PostHog, Supabase, Fashn, plus inline scripts/styles. Any one of them shipping a new CDN URL or migrating to a different host would trigger a violation. Enforcement BEFORE 2 weeks risks breaking auth, payments, or analytics in production.
- A continuous 14-day zero-violation window across all directives is empirical proof the source-list is complete enough to enforce.

---

## Phase 0 — Verify the report endpoint is alive

Before starting the observation window, confirm `/api/csp-report` is wired correctly:

```bash
# From any machine that can reach crialook.com.br:
curl -X POST \
  -H 'Content-Type: application/csp-report' \
  -d '{"csp-report":{"document-uri":"https://crialook.com.br/","violated-directive":"script-src","effective-directive":"script-src","blocked-uri":"https://test.example.com/x.js"}}' \
  https://crialook.com.br/api/csp-report \
  -o /dev/null -w 'HTTP %{http_code}\n'
# Expected: HTTP 204
```

Then check Sentry → search for `csp_violation:true directive:script-src blocked:test.example.com` — should see the test report within ~30s.

If the test report doesn't appear in Sentry: troubleshoot before starting observation. Likely causes:
- `SENTRY_DSN` env not loaded on server → check `pm2 logs crialook | grep '\[boot\] env loaded'`
- Endpoint returning 401 → middleware.ts not exempting `/api/csp-report` (verify the auth-exempt pattern matches `/api/health`)
- Sentry quota exhausted → check Sentry billing

---

## Phase 1 — Observation window (14 days)

Mark the start date in this doc:

- [ ] **Observation start date:** ____________ (YYYY-MM-DD)
- [ ] **Observation end date:** ____________ (start + 14 days, inclusive)

During the window, monitor Sentry daily:

```
Sentry filter:
  project: crialook (or your project name)
  level: warning
  tag: csp_violation:true
  date: last 24h
```

For each violation that appears:
1. Triage: is the blocked URL a legitimate dependency that should be added to the CSP source-list, or is it actually a security concern (XSS attempt, malicious script injection)?
2. If legitimate: add the host to the appropriate directive in `nginx-crialook.conf` (e.g., `script-src` or `connect-src`), commit + deploy + restart the 14-day clock (D-11).
3. If genuine attack: investigate. CSP-Report-Only is doing its job by surfacing the attempt; the user is unaffected.

**D-11 re-trigger:** ANY violation during the window resets the 14-day clock. The criterion is **continuous** zero-violation, not "low rate".

---

## Phase 2 — Pre-flip checklist (owner ticks ALL before flipping)

- [ ] 14 continuous days of zero CSP violations in Sentry confirmed
- [ ] No new third-party integrations added in the past 14 days (Clerk SDK update, new analytics tool, new payment provider, etc.) — if added, observation window restarts
- [ ] `/api/csp-report` endpoint health verified (Phase 0 test re-run within last 24h returns 204)
- [ ] Backup of current `/etc/nginx/sites-available/crialook` taken: `sudo cp /etc/nginx/sites-available/crialook /etc/nginx/sites-available/crialook.pre-csp-flip.$(date +%Y%m%d)`

---

## Phase 3 — Flip Report-Only → enforced

Single nginx edit + reload. Run on the production VPS as root or DEPLOY_USER:

```bash
# 1. Edit the directive in /etc/nginx/sites-available/crialook (1-character change in the header name)
sudo sed -i 's/Content-Security-Policy-Report-Only/Content-Security-Policy/' /etc/nginx/sites-available/crialook

# 2. Validate nginx config
sudo nginx -t
# Expected: "syntax is ok" + "test is successful"

# 3. Reload nginx (zero-downtime — existing connections drain, new ones use the new config)
sudo systemctl reload nginx

# 4. Verify the header is now enforced (NOT -Report-Only) by hitting the live site:
curl -sI https://crialook.com.br/ | grep -i 'content-security-policy'
# Expected: "Content-Security-Policy: default-src 'self'; ..."
# Should NOT see "-Report-Only" in the header name.
```

Also update the canonical config in the repo so the next `bash deploy-crialook.sh` doesn't revert the flip:

```bash
# On your dev machine (not the VPS):
cd Agencia-Fashion
sed -i 's/Content-Security-Policy-Report-Only/Content-Security-Policy/' nginx-crialook.conf
git diff nginx-crialook.conf  # verify only the directive name changed
git add nginx-crialook.conf
git commit -m "ops(csp): flip from Report-Only to enforced after 14-day zero-violation window"
git push
```

Mark in this doc:
- [ ] **Flip date:** ____________ (YYYY-MM-DD)
- [ ] **Repo updated + pushed:** committed in `__SHA__`

---

## Phase 4 — Post-flip monitoring (first 7 days)

Continue watching Sentry. Once enforced, violations represent:
- A real user being blocked (likely a missing source-list entry that didn't surface during Report-Only — e.g., a country-specific Clerk CDN that didn't fire for your test traffic)
- Or an actual attack the policy is now successfully blocking

Triage each. If you see real users being blocked: rollback (Phase 5).

---

## Phase 5 — Rollback procedure (revert to Report-Only)

If post-flip violations indicate real-user breakage, revert immediately:

```bash
# On the VPS:
sudo sed -i 's/Content-Security-Policy/Content-Security-Policy-Report-Only/' /etc/nginx/sites-available/crialook
sudo nginx -t && sudo systemctl reload nginx

# Verify rollback:
curl -sI https://crialook.com.br/ | grep -i 'content-security-policy'
# Expected: "Content-Security-Policy-Report-Only: ..."

# On dev machine:
cd Agencia-Fashion
sed -i 's/Content-Security-Policy/Content-Security-Policy-Report-Only/' nginx-crialook.conf
git add nginx-crialook.conf
git commit -m "ops(csp): revert flip — real-user breakage observed; restart 14-day window after fix"
git push
```

Then: investigate the violation that broke users, add the missing source to the CSP, commit, deploy, restart Phase 1 (14-day observation).

---

## Notes

- **Why a doc, not automation?** The flip is a single sed command but the *decision* to flip is human (judging Sentry data + business risk tolerance). Automating the flip would create the wrong incentive (flip too eagerly to hit a metric).
- **Re-flip after rollback?** After fixing the missing source, re-start the 14-day observation window from scratch. Do NOT count days from the original window.
- **CSP-3 reporting (`report-to`)** vs **CSP-1 reporting (`report-uri`)**: both are wired in nginx-crialook.conf (per plan 08-02). Modern Chrome/Edge use `report-to`; Firefox/Safari use `report-uri`. Both POST to the same endpoint — Sentry sees them merged.
- **DSN safety:** `/api/csp-report` is the indirection that keeps the Sentry DSN public key out of the nginx config (which is in the public repo). Don't ever switch nginx to POST directly to Sentry's ingest URL.

---

## Versioning

| Date | Editor | Change |
|------|--------|--------|
| 2026-05-04 | Phase 8 plan 08-06 | Initial doc; observation not yet started |
| (TBD) | Owner | Observation start: YYYY-MM-DD |
| (TBD) | Owner | Flip executed: YYYY-MM-DD |
