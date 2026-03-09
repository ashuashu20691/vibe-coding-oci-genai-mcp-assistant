# Quick Start - Production Deployment

## Install PM2

**Option 1: Global install (requires sudo)**
```bash
sudo npm install -g pm2
```

**Option 2: Local install (no sudo needed)**
```bash
npm install --save-dev pm2
```

If using local install, prefix all `pm2` commands with `npx`:
- `pm2 start` → `npx pm2 start`
- `pm2 logs` → `npx pm2 logs`
- etc.

## Deploy

```bash
# 1. Build the app
npm run build

# 2. Start with PM2
# Global install:
npm run pm2:start
# OR Local install:
npx pm2 start ecosystem.config.js

# 3. Save PM2 config (survives reboots)
pm2 save
# OR with local install:
npx pm2 save

# 4. Setup auto-start on boot (global install only)
pm2 startup
# Follow the command it outputs
```

## Monitor

```bash
# View logs in real-time
npm run pm2:logs

# Check status
pm2 status

# Monitor resources
npm run pm2:monit
```

## Manage

```bash
# Restart
npm run pm2:restart

# Stop
npm run pm2:stop

# View all PM2 apps
pm2 list
```

## Health Check

```bash
# Manual health check
npm run healthcheck

# Or with curl
curl http://localhost:3000/api/models
```

## Troubleshooting

If app crashes:
```bash
# View error logs
pm2 logs mastra-app --err

# Check if it's running
pm2 status

# Restart
pm2 restart mastra-app

# If still failing, check database connection
cat .env | grep ORACLE
```

## Auto-Restart Features

PM2 automatically restarts the app when:
- It crashes (immediate restart)
- Memory exceeds 1GB (restart with fresh memory)
- Process becomes unresponsive (after 10s timeout)

Maximum 10 restarts within 60 seconds, then it stops trying.

## Logs

Logs are stored in `./logs/`:
- `out.log` - Standard output
- `err.log` - Error output  
- `combined.log` - Both combined

View logs:
```bash
pm2 logs mastra-app
# or
tail -f logs/combined.log
```

## Update App

```bash
# Pull latest code
git pull

# Install dependencies
npm install

# Rebuild
npm run build

# Restart
npm run pm2:restart
```

Done! Your app is now running with automatic restart and monitoring.
