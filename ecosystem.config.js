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
      // Roda npm start (que executa "next start" via package.json).
      // É mais robusto que apontar pro binário direto porque respeita
      // qualquer wrapper futuro do package.json.
      script: "npm",
      args: "start",
      exec_mode: "fork", // 1 process. Use "cluster" se tiver >2 CPUs e 4GB+ RAM livres.
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
        // Demais envs (CLERK_SECRET_KEY, SUPABASE_*, etc) vêm do .env.local da app.
        // NUNCA commitar secrets aqui.
      },

      // Graceful shutdown window (para pipeline em andamento terminar)
      kill_timeout: 30_000,
    },
  ],
};
