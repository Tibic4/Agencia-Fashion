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

The deploy script's existing `DEPLOY_USER` conditional (lines 27-33, 73-95, 130-147 originally; refactored in plan 08-01 but the conditional logic is preserved) already supports this — it's currently the unused branch. This migration activates it and tightens sudoers.

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

The deploy script auto-registers via `pm2 startup systemd` (now validated per plan 08-01). If the smoke-test sudoers `systemctl restart crialook` reports "Unit not found", manually re-register:

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
