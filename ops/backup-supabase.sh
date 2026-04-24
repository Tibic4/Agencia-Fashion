#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# FASE K — Backup diário do Supabase (schema + dados)
#
# Roda via cron em /etc/cron.d/crialook-backup:
#   0 3 * * * www-data /var/www/crialook/ops/backup-supabase.sh
#
# Requer:
#   - supabase CLI OU pg_dump instalado
#   - /etc/crialook/supabase.env com DB_URL=postgresql://...
#   - /var/backups/crialook/ com permissão 0700 para www-data
#   - Opcional: rclone configurado para upload em S3/Backblaze
# ═══════════════════════════════════════════════════════════

set -euo pipefail

ENV_FILE="/etc/crialook/supabase.env"
BACKUP_DIR="/var/backups/crialook"
RETENTION_DAYS=30

if [ ! -f "$ENV_FILE" ]; then
  echo "FAIL: $ENV_FILE não existe (deve conter DB_URL=postgresql://...)"
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

mkdir -p "$BACKUP_DIR"
chmod 0700 "$BACKUP_DIR"

DATE=$(date +%F-%H%M)
OUT="$BACKUP_DIR/crialook-$DATE.sql.gz"

echo "[backup] Iniciando dump → $OUT"
pg_dump --no-owner --no-privileges "$DB_URL" | gzip -9 > "$OUT"

SIZE=$(du -h "$OUT" | cut -f1)
echo "[backup] ✓ Dump salvo ($SIZE)"

# Upload para storage externo (opcional). Descomentar se rclone configurado.
# if command -v rclone >/dev/null 2>&1; then
#   rclone copy "$OUT" remote:crialook-backups/ --quiet
#   echo "[backup] ✓ Uploaded para remote"
# fi

# Retenção: remove backups > RETENTION_DAYS dias
find "$BACKUP_DIR" -name "crialook-*.sql.gz" -mtime +$RETENTION_DAYS -delete
echo "[backup] ✓ Cleanup ($RETENTION_DAYS dias de retenção)"

# Opcional: notificar Discord em caso de falha (capturado pelo systemd unit)
