module.exports = {
  apps: [{
    name: 'mastra-app',
    script: 'npm',
    args: 'start',
    cwd: './',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    
    // Restart on crash
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    
    // Health check - restart if app becomes unresponsive
    listen_timeout: 10000,
    kill_timeout: 5000,
    
    // Exponential backoff restart
    exp_backoff_restart_delay: 100,
    
    // Graceful shutdown
    wait_ready: true,
    shutdown_with_message: true,
  }]
};
