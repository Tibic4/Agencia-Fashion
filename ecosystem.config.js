/**
 * PM2 ecosystem para CriaLook em produção.
 *
 * Usar:
 *   cd /var/www/crialook/campanha-ia
 *   pm2 start /var/www/crialook/ecosystem.config.js --env production
 *   pm2 save && pm2 startup
 *
 * Rotação de logs (logrotate):
 *   pm2 install pm2-logrotate
 *   pm2 set pm2-logrotate:max_size 50M
 *   pm2 set pm2-logrotate:retain 14
 */
module.exports = {
  apps: [
    {
      name: "crialook",
      cwd: "/var/www/crialook/campanha-ia",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      exec_mode: "fork", // 1 process (VPS modesta). Use "cluster" se tiver >2 CPUs e 4GB+ RAM.
      instances: 1,

      // Reinicia se consumir mais que 1GB (pipeline de IA spike)
      max_memory_restart: "1G",

      // Backoff exponencial ao crash
      min_uptime: "30s",
      max_restarts: 10,
      restart_delay: 3000,
      autorestart: true,

      // Logs estruturados com timestamp
      out_file: "/var/log/crialook/out.log",
      error_file: "/var/log/crialook/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,

      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
        // Demais envs (CLERK_SECRET_KEY, SUPABASE_*, etc) devem vir do /var/www/crialook/campanha-ia/.env.local
        // ou do environment do systemd wrapper. NUNCA commitar secrets aqui.
      },

      // Graceful shutdown window (para pipeline em andamento terminar)
      kill_timeout: 30_000,
    },
  ],
};
