---
plan_id: 08-08
phase: 8
title: ops/DEPLOY_USER_MIGRATION.md — 7-step structured owner-action SSH/sudo task list for root → crialook user cutover (D-12, D-14, D-15)
wave: 2
depends_on: ["08-01", "08-07"]
owner_action: true
files_modified:
  - ops/DEPLOY_USER_MIGRATION.md
autonomous: true
requirements: ["D-12", "D-14", "D-15"]
must_haves:
  truths:
    - "deliverable: ops/DEPLOY_USER_MIGRATION.md — pure markdown doc, no code changes (D-15). Owner SSHes to the VPS and executes the 7 numbered steps; agent provides exact paste-ready commands per D-14 'I don't have prod SSH creds'"
    - "doc structure follows the AGGRESSIVE STRUCTURED owner-action plan from CONTEXT D-12: 7 numbered sequential tasks, each with explicit SSH/sudo commands, expected output, and rollback note"
    - "the 7 steps are EXACTLY (per CONTEXT D-12): (1) Create dedicated crialook user, (2) Transfer ownership of project + log dirs, (3) Sudoers config for limited commands, (4) Update deploy-crialook.sh DEPLOY_USER env export, (5) Uncomment ecosystem.config.js user field (set up by plan 08-07), (6) Smoke test deploy from new user, (7) Rollback path doc"
    - "Step 1 - Create user: 'sudo adduser --system --group --shell /bin/bash --home /srv/crialook crialook' (matches the existing deploy-crialook.sh:76 pattern: 'useradd -r -s /usr/sbin/nologin -m -d /srv/crialook crialook' — but that uses nologin shell which prevents pm2 startup commands. Use --shell /bin/bash for sudoers commands to work)"
    - "Step 1 NOTE: the existing deploy-crialook.sh logic at line 73-80 ALREADY creates the user when DEPLOY_USER != root is set. So this manual step is REDUNDANT if owner sets DEPLOY_USER=crialook before running deploy. The doc must say: 'if you ran deploy-crialook.sh with DEPLOY_USER=crialook recently, the user already exists — verify with id crialook && skip Step 1.' Idempotency is critical"
    - "Step 2 - Transfer ownership: 'sudo chown -R crialook:crialook /srv/crialook /var/log/crialook'. If migrating from existing root install at /root/Agencia-Fashion, FIRST move the directory: 'sudo mv /root/Agencia-Fashion /srv/crialook/Agencia-Fashion && sudo chown -R crialook:crialook /srv/crialook'. Doc must call this out — moving the project directory is a non-trivial operation that requires PM2 stop first"
    - "Step 3 - Sudoers config: write /etc/sudoers.d/crialook (NOT /etc/sudoers — preserves separability) with: 'crialook ALL=(root) NOPASSWD: /usr/bin/systemctl restart crialook, /usr/bin/systemctl reload crialook, /usr/bin/systemctl status crialook, /usr/bin/nginx -s reload, /usr/bin/nginx -t, /usr/sbin/nginx -s reload, /usr/sbin/nginx -t'. Then 'sudo visudo -c -f /etc/sudoers.d/crialook' to validate, then 'sudo chmod 440 /etc/sudoers.d/crialook'"
    - "Step 4 - deploy-crialook.sh adjustment: this is REPO change, not server change. Owner edits the script to default DEPLOY_USER='crialook' (was 'root'). Provide the exact one-line sed command to apply on the dev machine: 'sed -i s/DEPLOY_USER=\\\"\\${DEPLOY_USER:-root}\\\"/DEPLOY_USER=\\\"\\${DEPLOY_USER:-crialook}\\\"/ deploy-crialook.sh' — then commit + push + git pull on server"
    - "Step 5 - ecosystem.config.js: uncomment the 'user: \"crialook\",' line that plan 08-07 added as commented-out. Provide exact sed: 'sed -i s|// user:|user:|g ecosystem.config.js' (matches plan 08-07's exact comment style). Verify by running 'bash scripts/check-deploy-user.sh' — should now print OK (green)"
    - "Step 6 - Smoke test: SSH as the new crialook user (sudo su - crialook), cd to project dir, attempt 'pm2 status' (should work — pm2 is per-user), then 'sudo systemctl restart crialook' (should succeed via sudoers), then 'sudo nginx -s reload' (should succeed), then 'curl https://crialook.com.br/api/health' returns 200. Each sub-test has its own checkbox"
    - "Step 7 - Rollback: if migration breaks anything, revert by (a) editing /etc/sudoers.d/crialook → remove or rename, (b) git revert the deploy-crialook.sh + ecosystem.config.js commits OR re-comment the user: line, (c) re-run 'bash deploy-crialook.sh' as root (DEPLOY_USER unset or =root) — this re-applies the root-owned project at /root/Agencia-Fashion. Provide the exact commands"
    - "doc has a top header explaining: 'Owner action: SSH to crialook.com.br VPS as root or sudo-capable user. Execute 7 steps in order. Each step has expected output + rollback path. Estimated time: 30-45 min. Required: ssh access + sudo on the VPS, repo write access on dev machine.'"
    - "doc has a 'Why this migration' section citing CONCERNS §10 and explaining the blast-radius improvement (Node.js + pipeline IA running as root → unprivileged crialook user; sudoers limited to specific systemctl/nginx commands)"
    - "doc has a top-level 'Pre-flight checklist' before Step 1: backup of existing deploy state, current /etc/nginx/sites-available/crialook saved, current crontab saved, knowledge of where Let's Encrypt certs live (typically /etc/letsencrypt — owned by root, no transfer needed; certbot.timer continues to renew as root)"
    - "doc has 'Post-migration verification' after Step 7: how to confirm long-term that PM2 actually runs as crialook (ps aux | grep node — uid should be crialook, not root); pm2 logs are written to /var/log/crialook/ owned by crialook; deploy-crialook.sh re-run as root still works (deploy script DOES run as root for system-level apt commands; the sudo -u crialook -H bash -c pattern at lines 141-146 already handles per-user pm2 invocation)"
    - "doc explicitly notes the gotcha: 'pm2 startup' command needs to be re-run AFTER the migration to register the systemd unit under the crialook user — the existing deploy-crialook.sh:146 already handles this via the DEPLOY_USER conditional"
    - "doc cross-references plan 08-01 (deploy-crialook.sh changes) and plan 08-07 (lint check + commented user line)"
    - "every sudo command has a brief comment explaining what it does (so the owner understands what they're pasting)"
    - "doc includes a 'Common errors' section: (a) 'pm2: command not found' as crialook user → solved by 'sudo npm install -g pm2' once the user has /bin/bash shell, (b) sudoers syntax error → visudo -c will catch, (c) systemctl restart crialook fails with 'Unit not found' → systemd unit name doesn't match, check 'pm2 startup' output and re-register"
  acceptance:
    - "test -f ops/DEPLOY_USER_MIGRATION.md exits 0"
    - "wc -l ops/DEPLOY_USER_MIGRATION.md returns at least 150 (real doc; this is the most-detailed owner-action doc in P8)"
    - "grep -c '^## ' ops/DEPLOY_USER_MIGRATION.md returns at least 8 (Pre-flight + 7 numbered steps + Post-migration + others)"
    - "grep -ic 'step 1\\|step 2\\|step 3\\|step 4\\|step 5\\|step 6\\|step 7' ops/DEPLOY_USER_MIGRATION.md returns at least 7 (all 7 steps numbered)"
    - "grep -c 'sudo ' ops/DEPLOY_USER_MIGRATION.md returns at least 10 (sudo commands throughout)"
    - "grep -c 'sudoers\\|/etc/sudoers.d' ops/DEPLOY_USER_MIGRATION.md returns at least 2 (Step 3)"
    - "grep -c 'NOPASSWD' ops/DEPLOY_USER_MIGRATION.md returns at least 1 (sudoers entry)"
    - "grep -c 'visudo' ops/DEPLOY_USER_MIGRATION.md returns at least 1 (sudoers validation)"
    - "grep -c 'adduser\\|useradd' ops/DEPLOY_USER_MIGRATION.md returns at least 1 (Step 1 user creation)"
    - "grep -c 'pm2 startup\\|systemd' ops/DEPLOY_USER_MIGRATION.md returns at least 1 (post-migration systemd re-registration)"
    - "grep -c 'rollback\\|revert\\|undo' ops/DEPLOY_USER_MIGRATION.md returns at least 2 (Step 7 + per-step rollback notes)"
    - "grep -c 'check-deploy-user.sh\\|scripts/check-deploy-user' ops/DEPLOY_USER_MIGRATION.md returns at least 1 (Step 5 verification cross-ref to plan 08-07)"
    - "grep -c 'CONCERNS.*§10\\|deploy as root' ops/DEPLOY_USER_MIGRATION.md returns at least 1 (rationale citation)"
    - "grep -c 'plan 08-01\\|plan 08-07\\|deploy-crialook.sh' ops/DEPLOY_USER_MIGRATION.md returns at least 2 (cross-refs)"
    - "grep -c '- \\[ \\]' ops/DEPLOY_USER_MIGRATION.md returns at least 8 (per-step + smoke-test checkboxes)"
    - "grep -ic 'common errors\\|troubleshoot' ops/DEPLOY_USER_MIGRATION.md returns at least 1 (Common errors section)"
---

# Plan 08-08: ops/DEPLOY_USER_MIGRATION.md — 7-step owner-action SSH/sudo migration doc

## Objective

Per D-12, D-14, D-15: produce the OWNER-ACTION doc for migrating production PM2 from running as root to running as a dedicated unprivileged `crialook` user. Per the owner's choice (CONTEXT D-12: "AGGRESSIVE plan with structured owner-action task list"), the doc has 7 numbered sequential SSH/sudo tasks with exact paste-ready commands, expected output, per-step rollback notes, and a top-level pre-flight checklist + post-migration verification + common-errors section.

The agent has NO prod SSH creds (D-14) — every step is structured for the owner to paste into their SSH session. This plan is `owner_action: true` + `autonomous: false` for the SSH/sudo execution; `autonomous: true` for the doc-writing portion.

This plan depends on:
- **Plan 08-01** (deploy-crialook.sh rollback + Discord) — the doc's Step 4 references the deploy script defaults
- **Plan 08-07** (scripts/check-deploy-user.sh + commented user: line in ecosystem.config.js) — the doc's Step 5 uncomments the line plan 08-07 added

## Truths the executor must respect

- **The agent writes the doc; the owner executes the steps.** The doc is the deliverable. No code changes in this plan (other than the doc file). The owner's SSH session is the execution surface.
- **The 7 steps are CONTEXT-locked.** Don't reorder, merge, or split them — the owner chose this exact structure.
- **Each step has: exact command(s), expected output, rollback note.** A step that says "configure sudoers" without the exact `crialook ALL=(root) NOPASSWD: ...` line is a planning failure.
- **Idempotency notes matter.** Step 1 may have already happened if owner ran `DEPLOY_USER=crialook bash deploy-crialook.sh` previously (the existing deploy-crialook.sh:73-80 creates the user). The doc must say: verify with `id crialook && skip if exists`.
- **Cite the existing deploy-crialook.sh scaffolding.** The conditional logic at lines 27-33, 73-95, 130-147 already does much of the heavy lifting; the doc points the owner at it instead of duplicating.
- **The certbot/SSL piece stays as-is.** Let's Encrypt certs in `/etc/letsencrypt/` are root-owned and managed by the system `certbot.timer` — no transfer needed; nginx (running as root for the system service) reads them. Doc must explicitly call this out so the owner doesn't try to chown the certs (would break renewal).
- **The migration is reversible.** Step 7 documents the full rollback. If anything breaks at smoke-test, the owner can git-revert the repo changes and re-run `bash deploy-crialook.sh` as root with `DEPLOY_USER` unset, restoring the prior state in <5 min.
- **Plan 08-07 added the commented-out user line in ecosystem.config.js with style `// user: "crialook",`.** Step 5's sed must match that exact pattern. Cite plan 08-07 explicitly.

## Tasks

### Task 1: Author ops/DEPLOY_USER_MIGRATION.md

<read_first>
- deploy-crialook.sh (FULL FILE — to confirm the existing DEPLOY_USER conditional at lines 27-33, 73-95, 130-147 the doc references)
- ecosystem.config.js (post-plan-08-07 — to confirm the comment style for the commented-out user: line that Step 5 uncomments)
- scripts/check-deploy-user.sh (post-plan-08-07 — to confirm the verification command Step 5 cites)
- .planning/codebase/CONCERNS.md §10 ("deploy as root") — for the rationale citation
- .planning/phases/08-ops-deploy-hardening/08-CONTEXT.md (D-12, D-14, D-15)
- .planning/phases/07-play-compliance-and-ux-completeness/07-04-play-data-safety-doc-PLAN.md (for owner-action doc structure pattern)
</read_first>

<action>
Create `ops/DEPLOY_USER_MIGRATION.md`:

```markdown
# DEPLOY_USER Migration — root → crialook (Owner Action)

**Phase 8 plan 08-08 (D-12, D-14, D-15).** Decision authority: owner. Execution: SSH session on the production VPS.

This is the **owner-action manual** for migrating production PM2 from running as root to running as a dedicated unprivileged `crialook` user. The agent (this plan) cannot execute any of these steps — they require SSH access and sudo on the production VPS, which only the owner has.

**Estimated time:** 30-45 minutes (uninterrupted).
**Risk level:** Medium. Reversible (Step 7) but requires care; PM2 + nginx restarts during the cutover briefly affect serving.
**Recommended window:** Low-traffic hours (e.g., 02:00-04:00 BRT).

---

## Why this migration

Per `.planning/codebase/CONCERNS.md §10 "deploy as root"`:
- `deploy-crialook.sh` defaults to `DEPLOY_USER=root` (line 27).
- Node.js process (`crialook` PM2 app) inherits root.
- AI pipeline (`/api/campaign/generate` SSE handler) spawned by Node also runs as root.
- A bug in any spawned-process code path → root-level filesystem access. Blast radius is the entire VPS.

After this migration:
- `crialook` is an unprivileged system user with `/bin/bash` shell (needed for sudoers commands).
- PM2 + Node + AI pipeline run as `crialook` — bug fallout is contained to `/srv/crialook/` and `/var/log/crialook/`.
- Sudoers grants `crialook` permission to ONLY: `systemctl restart/reload/status crialook` and `nginx -s reload` / `nginx -t`. Nothing else escalatable.
- Let's Encrypt certs stay in `/etc/letsencrypt/` (root-owned, system-managed) — nginx (the system service, still root) reads them; no cert transfer needed.

The deploy script's existing `DEPLOY_USER` conditional (lines 27-33, 73-95, 130-147) already supports this — it's currently the unused branch. This migration activates it and tightens sudoers.

---

## Pre-flight checklist (do BEFORE Step 1)

- [ ] SSH access to the production VPS as a sudo-capable user (typically root)
- [ ] Knowledge of repo write access on dev machine (for Step 4 + Step 5 commits)
- [ ] Backup of `/etc/nginx/sites-available/crialook`:
      `sudo cp /etc/nginx/sites-available/crialook /etc/nginx/sites-available/crialook.pre-cutover.$(date +%Y%m%d)`
- [ ] Backup of current crontab:
      `crontab -l > /root/crontab-pre-cutover.bak`
- [ ] Confirm Let's Encrypt certs are at `/etc/letsencrypt/live/crialook.com.br/`:
      `sudo ls -la /etc/letsencrypt/live/crialook.com.br/`
      Expected: `fullchain.pem` and `privkey.pem` symlinks. These STAY as-is (root-owned).
- [ ] Confirm current PM2 state:
      `pm2 status crialook`
      Expected: 1 process named `crialook`, status `online`, uptime > 0.
- [ ] Confirm current site is reachable:
      `curl -sI https://crialook.com.br/api/health | head -1`
      Expected: `HTTP/2 200`.
- [ ] If migrating from `/root/Agencia-Fashion`, plan downtime: PM2 must be stopped to safely move the directory in Step 2. Expect ~30s of 502 from nginx during the move + restart.

---

## Step 1: Create the dedicated `crialook` user

If you ran `DEPLOY_USER=crialook bash deploy-crialook.sh` previously, the user already exists — verify and skip if so:

```bash
id crialook
# If "no such user", proceed. If already exists, skip to Step 2.
```

Create the user:

```bash
sudo adduser --system --group --shell /bin/bash --home /srv/crialook crialook
# Explanation:
#   --system   : reserved UID range, no password aging, sensible defaults for service users
#   --group    : create matching `crialook` group
#   --shell /bin/bash : NEEDED for sudoers commands to work (the existing deploy-crialook.sh
#                       uses /usr/sbin/nologin which prevents `pm2 startup` from registering
#                       systemd properly). /bin/bash is fine for a service user — there's no
#                       interactive login because no password is set.
#   --home /srv/crialook : project + home dir; PM2 stores its state under ~/.pm2/
```

Verify:

```bash
id crialook
# Expected: uid=NNN(crialook) gid=NNN(crialook) groups=NNN(crialook)

ls -la /srv/crialook
# Expected: directory owned by crialook:crialook
```

**Rollback for Step 1:** `sudo deluser --remove-home crialook` (only if you didn't yet move the project into /srv/crialook in Step 2).

---

## Step 2: Transfer ownership of project + log directories

If the project is currently at `/root/Agencia-Fashion` (default for root deploys), move it:

```bash
# Stop PM2 first to avoid serving from a half-moved directory
sudo pm2 stop crialook

# Move the project (sudo because /root requires it)
sudo mv /root/Agencia-Fashion /srv/crialook/Agencia-Fashion

# Transfer ownership of project + log dirs
sudo chown -R crialook:crialook /srv/crialook /var/log/crialook

# Confirm
ls -la /srv/crialook/
ls -la /var/log/crialook/
# Expected: both owned by crialook:crialook
```

If the project is ALREADY at `/srv/crialook/Agencia-Fashion` (owner ran `DEPLOY_USER=crialook` previously), just chown:

```bash
sudo chown -R crialook:crialook /srv/crialook /var/log/crialook
```

**Note on .env.local:** The file at `/srv/crialook/Agencia-Fashion/campanha-ia/.env.local` is now owned by crialook. Verify the next.js process can read it after Step 6's smoke test.

**Rollback for Step 2:** `sudo mv /srv/crialook/Agencia-Fashion /root/Agencia-Fashion && sudo chown -R root:root /root/Agencia-Fashion /var/log/crialook`. Then re-run deploy-crialook.sh as root.

---

## Step 3: Sudoers config — limited commands only

Write `/etc/sudoers.d/crialook` (NOT `/etc/sudoers` directly — the `.d/` drop-in keeps changes separable):

```bash
sudo tee /etc/sudoers.d/crialook > /dev/null << 'SUDOERS'
# Phase 8 plan 08-08 — crialook user can run ONLY these specific commands as root.
# Any other sudo invocation as crialook → password prompt (which fails — no password set).
crialook ALL=(root) NOPASSWD: /usr/bin/systemctl restart crialook, /usr/bin/systemctl reload crialook, /usr/bin/systemctl status crialook, /usr/bin/nginx -s reload, /usr/bin/nginx -t, /usr/sbin/nginx -s reload, /usr/sbin/nginx -t
SUDOERS

# Validate the file syntax
sudo visudo -c -f /etc/sudoers.d/crialook
# Expected: "/etc/sudoers.d/crialook: parsed OK"

# Set the secure mode bits sudoers requires
sudo chmod 440 /etc/sudoers.d/crialook
```

Note the `/usr/bin` AND `/usr/sbin` paths for nginx — different distros put nginx in different locations; granting both is harmless (only one will exist).

Verify the sudoers entry works (run as crialook):

```bash
sudo su - crialook -c "sudo systemctl status crialook"
# Expected: systemctl status output (no password prompt, no permission denied)
```

**Rollback for Step 3:** `sudo rm /etc/sudoers.d/crialook` — restores the prior state (no sudo for crialook).

---

## Step 4: Update `deploy-crialook.sh` default DEPLOY_USER

This is a REPO change (not a server change). On your dev machine:

```bash
cd /path/to/Agencia-Fashion
git pull --rebase

# Update the default value of DEPLOY_USER from "root" to "crialook"
sed -i 's/DEPLOY_USER="${DEPLOY_USER:-root}"/DEPLOY_USER="${DEPLOY_USER:-crialook}"/' deploy-crialook.sh

# Verify
grep '^DEPLOY_USER=' deploy-crialook.sh
# Expected: DEPLOY_USER="${DEPLOY_USER:-crialook}"

# Commit + push
git add deploy-crialook.sh
git commit -m "ops: default DEPLOY_USER to crialook (plan 08-08 cutover)"
git push
```

Then on the VPS:

```bash
sudo su - crialook
cd /srv/crialook/Agencia-Fashion
git pull
exit  # back to root
```

**Rollback for Step 4:** `git revert HEAD` on the dev machine + push + git pull on server.

---

## Step 5: Uncomment `user: "crialook"` in `ecosystem.config.js`

Plan 08-07 added a commented-out `user: "crialook",` line in `ecosystem.config.js`. Uncomment it:

On dev machine:

```bash
cd /path/to/Agencia-Fashion

# Uncomment the line. Plan 08-07 used the exact comment style "// user:"
sed -i 's|// user: "crialook",|user: "crialook",|' ecosystem.config.js

# Verify
grep 'user:' ecosystem.config.js
# Expected: a line with `user: "crialook",` (uncommented)

# Verify the lint check now reports OK (was WARN before this step)
bash scripts/check-deploy-user.sh
# Expected: "OK: ecosystem.config.js user is 'crialook' (non-root)."
echo "exit=$?"
# Expected: exit=0

# Commit + push
git add ecosystem.config.js
git commit -m "ops: set ecosystem.config.js user: crialook explicitly (plan 08-08 cutover)"
git push
```

Then on VPS:

```bash
sudo su - crialook
cd /srv/crialook/Agencia-Fashion
git pull
exit  # back to root
```

**Rollback for Step 5:** Re-comment the line:
```bash
sed -i 's|^      user: "crialook",|      // user: "crialook",|' ecosystem.config.js
git commit + push + git pull on server
```

---

## Step 6: Smoke test the new deployment

Re-run the deploy from the new user. The script's existing DEPLOY_USER conditional handles this:

```bash
# As root (deploy-crialook.sh still needs root for apt + nginx system commands)
cd /srv/crialook/Agencia-Fashion
DEPLOY_USER=crialook bash deploy-crialook.sh
# Expected: deploy completes; PM2 process now runs as crialook; Discord notification fires (per plan 08-01)
```

Verify each smoke test below — tick each box:

- [ ] **PM2 runs as crialook:**
      `ps aux | grep '[n]ode' | head -3`
      Expected: process owner is `crialook` (NOT `root`).

- [ ] **PM2 process is online:**
      `sudo su - crialook -c "pm2 status crialook"`
      Expected: status `online`, uptime > 0.

- [ ] **Sudoers reload nginx works:**
      `sudo su - crialook -c "sudo nginx -t && sudo nginx -s reload"`
      Expected: "syntax is ok" + "test is successful" + reload completes silently.

- [ ] **Sudoers restart crialock service works:**
      `sudo su - crialook -c "sudo systemctl restart crialook"`
      (If you haven't registered the systemd unit yet, this will fail — see Step 6b below.)

- [ ] **Site is reachable:**
      `curl -sI https://crialook.com.br/api/health | head -1`
      Expected: `HTTP/2 200`.

- [ ] **Health check Discord notification fired (plan 08-01 + 08-04 wiring):**
      Check Discord channel — should see "✅ Deploy success — \`<sha>\`" notification.

- [ ] **Logs are written by crialook user:**
      `ls -la /var/log/crialook/`
      Expected: `out.log`, `error.log` owned by `crialook:crialook`.

### Step 6b: Re-register pm2 systemd unit (if needed)

The deploy script auto-registers via `pm2 startup systemd` (lines 138/146). If the smoke-test sudoers `systemctl restart crialook` reports "Unit not found", manually re-register:

```bash
sudo su - crialook
pm2 startup systemd -u crialook --hp /srv/crialook
# Copy the printed `sudo env PATH=... pm2-crialook startup` line and run it as root:
exit
sudo env PATH=... pm2-crialook startup
# Then:
sudo su - crialook -c "pm2 save"
```

**Rollback for Step 6:** see Step 7.

---

## Step 7: Rollback path (if Step 6 smoke test fails)

If anything in Step 6 breaks user-facing site:

```bash
# 1. Stop the new PM2 (as crialook) — site is down anyway
sudo su - crialook -c "pm2 stop crialook"

# 2. Revert sudoers (Step 3)
sudo rm /etc/sudoers.d/crialook

# 3. Revert ecosystem.config.js (Step 5) — re-comment the user line
cd /srv/crialook/Agencia-Fashion
git revert <sha-of-step-5-commit>  # OR git reset --hard <sha-before-step-5>
git push

# 4. Revert deploy-crialook.sh (Step 4) — set DEPLOY_USER default back to root
git revert <sha-of-step-4-commit>  # OR sed back to root
git push

# 5. Move project back (Step 2) if needed
sudo mv /srv/crialook/Agencia-Fashion /root/Agencia-Fashion
sudo chown -R root:root /root/Agencia-Fashion /var/log/crialook

# 6. Re-deploy as root
cd /root/Agencia-Fashion
git pull
DEPLOY_USER=root bash deploy-crialook.sh
# Expected: site back online, PM2 running as root (pre-migration state)

# 7. (Optional) Remove the crialook user
# sudo deluser --remove-home crialook
```

After rollback: investigate what failed. The migration can be retried after the root cause is fixed.

---

## Post-migration verification (24-48h)

After Step 6 succeeds, observe for 24-48h:

- [ ] **PM2 doesn't OOM-restart unexpectedly:** `pm2 status` shows uptime increasing.
- [ ] **Discord shows no DOWN notifications:** check the Discord channel.
- [ ] **Sentry shows no new error categories:** check Sentry for spike in errors with new tags (e.g., file permission errors that didn't exist before).
- [ ] **Disk usage stable:** `du -sh /var/log/crialook/` — pm2-logrotate (plan 08-01) caps at 50M × 14 retention = ~700M max.
- [ ] **systemctl crialook auto-starts on reboot:** if you can safely reboot the VPS, `sudo reboot && wait 60s && curl -sI https://crialook.com.br/api/health` — expected 200 within 1min of reboot.
- [ ] **Re-run lint:** `bash scripts/check-deploy-user.sh` from any clone — expected `OK` (green).
- [ ] **Consider tightening CI:** in a follow-up PR, modify `.github/workflows/ci.yml` to add `--strict` to the `deploy-user-lint` job. With ecosystem.config.js now having explicit user, the `--strict` mode catches any future regression where someone removes the user field.

---

## Common errors

### "pm2: command not found" as crialook user
PM2 was installed globally as root (per deploy-crialook.sh:66). When crialook tries to invoke pm2, the global path may not be set.

Fix:
```bash
sudo su - crialook
echo 'export PATH=/usr/lib/node_modules/.bin:/usr/local/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
which pm2
# Expected: /usr/lib/node_modules/pm2/bin/pm2 (or similar)
```

### "visudo: parse error" on Step 3
The sudoers file syntax is strict. If `sudo visudo -c -f /etc/sudoers.d/crialook` reports errors, do NOT save the file — visudo's whole point is to prevent broken sudoers from locking you out. Re-edit until parse OK.

### "Unit not found: crialook.service" on Step 6 systemctl restart
The systemd unit name from `pm2 startup systemd` doesn't always match the app name. Check actual unit name:
```bash
systemctl list-units | grep -i pm2
# Use the actual unit name in the sudoers entry instead of "crialook"
```

If the unit is named `pm2-crialook.service`, update `/etc/sudoers.d/crialook`:
```
crialook ALL=(root) NOPASSWD: /usr/bin/systemctl restart pm2-crialook.service, ...
```

### Site returns 502 Bad Gateway
PM2 process probably failed to start. Diagnose:
```bash
sudo su - crialook -c "pm2 logs crialook --lines 50"
# Look for ENOENT (path issue from move), EACCES (permission issue from chown gap), MODULE_NOT_FOUND
```

Most common: `.env.local` permissions. Fix:
```bash
sudo chown crialook:crialook /srv/crialook/Agencia-Fashion/campanha-ia/.env.local
sudo chmod 600 /srv/crialook/Agencia-Fashion/campanha-ia/.env.local
sudo su - crialook -c "pm2 restart crialook"
```

---

## Cross-references

- **Plan 08-01:** deploy-crialook.sh rollback + Discord webhook + ops cleanups. Step 4 of this doc points at deploy-crialook.sh.
- **Plan 08-07:** scripts/check-deploy-user.sh + commented-out `user:` line in ecosystem.config.js. Step 5 of this doc uncomments that line.
- **CONCERNS §10:** "deploy-crialook.sh runs as root by default" — the rationale this migration addresses.

## Versioning

| Date | Editor | Change |
|------|--------|--------|
| 2026-05-04 | Phase 8 plan 08-08 | Initial doc; migration not yet executed |
| (TBD) | Owner | Migration date: YYYY-MM-DD |
| (TBD) | Owner | Post-migration 48h verification: PASS / FAIL |
```
</action>

<verify>
```bash
test -f ops/DEPLOY_USER_MIGRATION.md && echo OK
wc -l ops/DEPLOY_USER_MIGRATION.md                                # expect ≥ 150
grep -c '^## ' ops/DEPLOY_USER_MIGRATION.md                       # expect ≥ 8
grep -ic 'step 1\|step 2\|step 3\|step 4\|step 5\|step 6\|step 7' ops/DEPLOY_USER_MIGRATION.md   # expect ≥ 7
grep -c 'sudo ' ops/DEPLOY_USER_MIGRATION.md                      # expect ≥ 10
grep -c 'NOPASSWD' ops/DEPLOY_USER_MIGRATION.md                   # expect ≥ 1
grep -c 'visudo' ops/DEPLOY_USER_MIGRATION.md                     # expect ≥ 1
grep -c 'adduser\|useradd' ops/DEPLOY_USER_MIGRATION.md           # expect ≥ 1
grep -c 'check-deploy-user.sh' ops/DEPLOY_USER_MIGRATION.md       # expect ≥ 1
grep -c 'CONCERNS.*§10\|deploy as root' ops/DEPLOY_USER_MIGRATION.md  # expect ≥ 1
grep -c 'plan 08-01\|plan 08-07' ops/DEPLOY_USER_MIGRATION.md     # expect ≥ 2
grep -c '- \[ \]' ops/DEPLOY_USER_MIGRATION.md                    # expect ≥ 8
grep -ic 'common errors' ops/DEPLOY_USER_MIGRATION.md             # expect ≥ 1
```
</verify>

## Files modified

- `ops/DEPLOY_USER_MIGRATION.md` — NEW; 7-step structured owner-action SSH/sudo migration manual with pre-flight + post-migration + common errors + per-step rollback notes (Task 1)

## Owner-action callout (D-12, D-14)

This entire plan is owner-action. The agent can write the doc but cannot:
- SSH to the production VPS
- Execute `adduser`, `chown`, `tee /etc/sudoers.d/crialook`
- Verify by running `id crialook` or `pm2 status` on the production host
- Tick the smoke-test checkboxes

The doc structures every step so the owner pastes commands without re-deriving them. After execution:
- Owner ticks the post-migration verification checkboxes (24-48h)
- Owner updates the doc's "Versioning" section with the migration date
- Owner commits the dated doc back to git as the audit trail

## Why this matters (risk if skipped)

Per CONCERNS §10: production Node.js + AI pipeline running as root means a bug in any spawned-process code path → root-level filesystem access. This migration contains the blast radius. The deploy script ALREADY supports the migration (the conditional logic at lines 27-33, 73-95, 130-147 was added defensively); this plan + 08-07's lint check + this doc activate that scaffolding through a deterministic owner-action manual. Without the doc, the owner has to derive the 7 steps from CONCERNS + the deploy script — error-prone, slow, and likely to be deferred indefinitely.
