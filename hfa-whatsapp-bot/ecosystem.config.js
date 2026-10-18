/**
 * PM2 process configuration for the HFA WhatsApp bot on its dedicated EC2 t3.micro instance.
 *
 *   npm ci --omit=dev
 *   pm2 start ecosystem.config.js --env production
 *   pm2 save && pm2 startup        # restart automatically after a reboot
 *
 * Logs are JSON lines written to the files below; the CloudWatch agent ships them to the
 * log group /hfa/whatsapp-bot. Rotate them with `pm2 install pm2-logrotate`.
 */
module.exports = {
  apps: [
    {
      name: 'hfa-whatsapp-bot',
      script: 'src/server.js',
      cwd: __dirname,
      // A t3.micro has 2 vCPUs and 1 GB of RAM: one process is enough for launch traffic and keeps
      // memory headroom. Switch to exec_mode "cluster" with instances: 2 if CPU becomes the limit.
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '400M',
      autorestart: true,
      restart_delay: 2000,
      exp_backoff_restart_delay: 200,
      max_restarts: 50,
      kill_timeout: 12000, // allow the graceful shutdown in server.js to finish
      time: true,
      merge_logs: true,
      out_file: '/var/log/hfa-whatsapp-bot/out.log',
      error_file: '/var/log/hfa-whatsapp-bot/error.log',
      env: {
        NODE_ENV: 'development',
        PORT: 4009,
        LOG_LEVEL: 'debug'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 4009,
        LOG_LEVEL: 'info'
      }
    }
  ]
};
