#!/bin/bash
# Monitoring script to check app health and restart if needed

LOG_FILE="./logs/monitor.log"
HEALTH_CHECK_URL="http://localhost:3000/api/models"
MAX_FAILURES=3
FAILURE_COUNT=0

mkdir -p logs

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

check_health() {
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$HEALTH_CHECK_URL" 2>&1)
    
    if [ "$response" = "200" ]; then
        return 0
    else
        return 1
    fi
}

restart_app() {
    log "Restarting application..."
    
    if command -v pm2 &> /dev/null; then
        pm2 restart mastra-app
        log "App restarted via PM2"
    else
        # Fallback: kill and restart with npm
        pkill -f "next start"
        sleep 2
        cd "$(dirname "$0")/.." && npm start &
        log "App restarted via npm"
    fi
    
    FAILURE_COUNT=0
}

log "Starting health monitor..."

while true; do
    if check_health; then
        log "Health check passed"
        FAILURE_COUNT=0
    else
        FAILURE_COUNT=$((FAILURE_COUNT + 1))
        log "Health check failed (attempt $FAILURE_COUNT/$MAX_FAILURES)"
        
        if [ $FAILURE_COUNT -ge $MAX_FAILURES ]; then
            log "Max failures reached. Restarting app..."
            restart_app
        fi
    fi
    
    # Check every 30 seconds
    sleep 30
done
