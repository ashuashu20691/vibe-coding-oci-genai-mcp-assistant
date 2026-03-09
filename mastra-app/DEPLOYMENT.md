# Production Deployment Guide

## Option 1: PM2 (Recommended)

PM2 provides automatic restarts, monitoring, and log management.

### Install PM2

```bash
npm install -g pm2
```

### Start the app

```bash
# Build the app
npm run build

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
```

### Monitor the app

```bash
# View logs
pm2 logs mastra-app

# Monitor status
pm2 monit

# Check status
pm2 status

# Restart if needed
pm2 restart mastra-app

# Stop
pm2 stop mastra-app
```

### PM2 Features

- **Auto-restart on crash**: Automatically restarts if the app crashes
- **Memory limit**: Restarts if memory exceeds 1GB
- **Log rotation**: Automatically manages log files
- **Health monitoring**: Tracks uptime and restarts

## Option 2: Systemd Service

For Linux servers, use systemd for automatic startup and monitoring.

### Install the service

```bash
# Copy service file
sudo cp mastra-app.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable service (start on boot)
sudo systemctl enable mastra-app

# Start service
sudo systemctl start mastra-app
```

### Manage the service

```bash
# Check status
sudo systemctl status mastra-app

# View logs
sudo journalctl -u mastra-app -f

# Restart
sudo systemctl restart mastra-app

# Stop
sudo systemctl stop mastra-app
```

## Option 3: Custom Monitor Script

Use the included monitoring script for simple deployments.

```bash
# Start the app
npm run build
npm start &

# Start the monitor in background
./scripts/monitor.sh &
```

The monitor checks health every 30 seconds and restarts if 3 consecutive checks fail.

## Health Check Endpoint

The app exposes `/api/models` for health checks. Returns 200 if healthy.

```bash
# Manual health check
curl http://localhost:3000/api/models
```

## Troubleshooting

### App keeps crashing

1. Check logs: `pm2 logs mastra-app` or `sudo journalctl -u mastra-app`
2. Check memory: `pm2 monit` - increase `max_memory_restart` if needed
3. Check database connection: Verify Oracle credentials in `.env`
4. Check MCP server: Ensure SQLcl is accessible

### High memory usage

- Increase `max_memory_restart` in `ecosystem.config.js`
- Monitor with: `pm2 monit`
- Check for memory leaks in logs

### Database connection issues

- Verify wallet location and credentials
- Check TNS_ADMIN environment variable
- Test connection manually with SQLcl

### Build issues

```bash
# Clean rebuild
rm -rf .next
npm run build
```

## Production Checklist

- [ ] Set `NODE_ENV=production` in environment
- [ ] Configure proper logging directory
- [ ] Set up log rotation (PM2 handles this automatically)
- [ ] Configure firewall to allow port 3000
- [ ] Set up reverse proxy (nginx/Apache) for HTTPS
- [ ] Configure proper Oracle wallet permissions
- [ ] Test health check endpoint
- [ ] Verify auto-restart works (kill process and check if it restarts)
- [ ] Set up monitoring alerts (optional)

## Logs Location

- PM2: `./logs/` directory
- Systemd: `/var/log/syslog` or `journalctl`
- Monitor script: `./logs/monitor.log`

## Performance Tuning

### Memory

Adjust in `ecosystem.config.js`:
```javascript
max_memory_restart: '2G'  // Increase if needed
```

### Instances

For multi-core servers:
```javascript
instances: 2  // Or 'max' for all cores
exec_mode: 'cluster'
```

### Database Connection Pool

Adjust in code if needed (default is usually fine):
- Pool size: 4 connections
- Connection timeout: 60s

## Monitoring

### PM2 Web Dashboard

```bash
pm2 install pm2-server-monit
```

### Custom Monitoring

Integrate with your monitoring system using the health check endpoint:
```bash
*/5 * * * * curl -f http://localhost:3000/api/models || systemctl restart mastra-app
```

## Backup

Important files to backup:
- `.env` - Configuration
- `logs/` - Application logs
- Database (Oracle handles this)

## Updates

```bash
# Pull latest code
git pull

# Install dependencies
npm install

# Rebuild
npm run build

# Restart
pm2 restart mastra-app
# or
sudo systemctl restart mastra-app
```
