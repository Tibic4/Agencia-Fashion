/**
 * PM2 ecosystem para CriaLook em produção.
 *
 * O arquivo lê o caminho do projeto da env CRIALOOK_HOME (default: /root/Agencia-Fashion).
 * Ajuste se sua instalação estiver em outro lugar.
 *
 * Usar:
 *   pm2 start /root/Agencia-Fashion/ecosystem.config.js --env production
 *   pm2 save
 *   pm2 startup    # gera comando pra rodar app no boot da VPS
 *
 * Rotação de logs (logrotate):
 *   pm2 install pm2-logrotate
 *   pm2 set pm2-logrotate:max_size 50M
 *   pm2 set pm2-logrotate:retain 14
 */
const path = require("path");

const CRIALOOK_HOME = process.env.CRIALOOK_HOME || "/root/Agencia-Fashion";
const APP_DIR = path.join(CRIALOOK_HOME, "campanha-ia");
const LOG_DIR = process.env.CRIALOOK_LOG_DIR || "/var/log/crialook";

module.exports = {
  apps: [
    {
      name: "crialook",
      cwd: APP_DIR,

      // ── User contract (D-12, D-13, plan 08-07 + 08-08) ──
      // Today (pre-08-08): no explicit `user` field. PM2 inherits from the
      // invoking shell, which is root via deploy-crialook.sh's default
      // (DEPLOY_USER=root). scripts/check-deploy-user.sh emits WARN on this
      // state (non-blocking).
      //
      // After plan 08-08 owner-action (SSH user creation + sudoers config),
      // OWNER UNCOMMENTS the line below to make the user explicit. Then
      // scripts/check-deploy-user.sh emits OK (green), and CI can be tightened
      // to --strict mode in a follow-up phase.
      //
      // user: "crialook",
      // Roda npm start (que executa "next start" via package.json).
      // É mais robusto que apontar pro binário direto porque respeita
      // qualquer wrapper futuro do package.json.
      script: "npm",
      args: "start",
      // ⚠️ NÃO trocar pra "cluster" / instances > 1 sem antes migrar o
      // rate limiter (src/lib/rate-limit.ts) pra storage compartilhado
      // (Postgres ou Redis). O atual é Map em memória do processo —
      // multi-instância vai vazar limites em ~50% / instância e abrir
      // brecha de abuso.
      exec_mode: "fork",
      instances: 1,

      // Reinicia se consumir mais que 1.5GB (pipeline IA pode dar spike).
      // Aumentado de 1G pra 1.5G após confirmação que VPS tem 3GB+ livres.
      max_memory_restart: "1500M",

      // Backoff exponencial ao crash
      min_uptime: "30s",
      max_restarts: 10,
      restart_delay: 3000,
      autorestart: true,

      // Logs estruturados com timestamp
      out_file: path.join(LOG_DIR, "out.log"),
      error_file: path.join(LOG_DIR, "error.log"),
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,

      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
        // ── IPv6/IPv4 fix (2026-05-05) ──
        // VPS Locaweb tem IPv6 stack habilitado mas SEM rota IPv6 outbound
        // (api.anthropic.com resolve pra 2607:6bc0::10 mas Network is
        // unreachable). Node 24 happy-eyeballs (undici fetch) tenta IPv6
        // first, trava em ETIMEDOUT, NÃO faz fallback rápido pra IPv4
        // mesmo com --dns-result-order=ipv4first sozinho.
        //
        // Sintoma em prod: pipeline.ts:288 catch fire 100% pra Sonnet
        // (Anthropic SDK API call timeout) → fallback hardcoded copy
        // entregue pra todo usuário (byte-identical).
        //
        // Fix: as 2 flags juntas:
        //   --dns-result-order=ipv4first → DNS lookup retorna IPv4 primeiro
        //   --network-family-autoselection=false → desabilita happy-eyeballs
        //                                          dual-stack que ignorava
        //                                          a ordem DNS
        // Validado via teste isolado em 2026-05-05: undici fetch retorna
        // status 200 do Anthropic com ambas flags. Sem elas: ETIMEDOUT.
        NODE_OPTIONS: "--dns-result-order=ipv4first --network-family-autoselection=false",
        // Demais envs (CLERK_SECRET_KEY, SUPABASE_*, etc) vêm do .env.local da app.
        // NUNCA commitar secrets aqui.
      },

      // Graceful shutdown window (para pipeline em andamento terminar)
      kill_timeout: 30_000,
    },
  ],
};
