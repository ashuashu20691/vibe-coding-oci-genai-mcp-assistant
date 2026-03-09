# Simple Deployment (No PM2 Required)

Use systemd for automatic restart and monitoring. No additional packages needed.

## Setup

```bash
# 1. Build the app
npm run build

# 2. Update the service file with your paths
# Edit mastra-app.service and change:
# - User=opc (your username)
# - WorkingDirectory=/home/opc/mastra-app (your app path)

# 3. Install the service
sudo cp mastra-app.service /etc/systemd/system/
sudo systemctl daemon-reload

# 4. Enable auto-start on boot
sudo systemctl enable mastra-app

# 5. Start the service
sudo systemctl start mastra-app
```

## Monitor

```bash
# Check status
sudo systemctl status mastra-app

# View logs (live)
sudo journalctl -u mastra-app -f

# View recent logs
sudo journalctl -u mastra-app -n 100
```

## Manage

```bash
# Restart
sudo systemctl restart mastra-app

# Stop
sudo systemctl stop mastra-app

# Disable auto-start
sudo systemctl disable mastra-app
```

## Features

- **Auto-restart on crash**: Restarts up to 3 times per minute
- **Memory limit**: 2GB max
- **CPU limit**: 200% (2 cores)
- **Logs**: Stored in `~/mastra-app/logs/`
- **Boot startup**: Starts automatically on server reboot

## Troubleshooting

```bash
# Check if service is running
sudo systemctl is-active mastra-app

# View error logs
sudo journalctl -u mastra-app --since "1 hour ago" -p err

# Check service configuration
sudo systemctl cat mastra-app

# Reload after editing service file
sudo systemctl daemon-reload
sudo systemctl restart mastra-app
```

## Update App

```bash
# Stop service
sudo systemctl stop mastra-app

# Pull updates
git pull
npm install
npm run build

# Start service
sudo systemctl start mastra-app
```

## Logs Location

Application logs: `~/mastra-app/logs/`
- `app.log` - Standard output
- `error.log` - Error output

System logs: View with `journalctl -u mastra-app`

That's it! Your app will now run as a system service with automatic restart.
