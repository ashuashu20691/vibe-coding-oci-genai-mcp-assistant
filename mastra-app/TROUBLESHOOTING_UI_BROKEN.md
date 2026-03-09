# Troubleshooting: UI Showing Raw Text/Code

## Problem
The browser is displaying raw HTML/JavaScript code instead of rendering the proper chat interface.

## Likely Causes

### 1. Dev Server Not Running or Crashed
The most common cause - the Next.js dev server stopped or crashed.

**Solution:**
```bash
# Stop any existing process
# Press Ctrl+C if server is running

# Restart the dev server
cd mastra-app
npm run dev
```

Wait for the message:
```
✓ Ready in X.Xs
○ Local: http://localhost:3000
```

Then refresh your browser (Cmd+R or Ctrl+R).

### 2. Browser Showing "View Source"
You might have accidentally opened the page source view.

**Solution:**
- Close the current tab
- Open a new tab
- Navigate to http://localhost:3000
- Do NOT right-click → "View Page Source"

### 3. Critical JavaScript Error
A JavaScript error is preventing React from hydrating the page.

**Solution:**
1. Open browser DevTools (F12 or Cmd+Option+I)
2. Go to the Console tab
3. Look for red error messages
4. Common errors:
   - "Hydration failed" → Clear browser cache and reload
   - "Module not found" → Run `npm install` again
   - "Syntax error" → Check recent code changes

### 4. Port Conflict
Another process might be using port 3000.

**Solution:**
```bash
# Check what's using port 3000
lsof -i :3000

# Kill the process if needed
kill -9 <PID>

# Or use a different port
PORT=3001 npm run dev
```

### 5. Build Cache Issues
The Next.js build cache might be corrupted.

**Solution:**
```bash
# Clean the build cache
rm -rf .next
rm -rf node_modules/.cache

# Restart dev server
npm run dev
```

## Quick Fix Checklist

1. ✅ Is the dev server running?
   ```bash
   # Check if you see "Ready" message in terminal
   # If not, run: npm run dev
   ```

2. ✅ Is the browser showing the correct URL?
   ```
   Should be: http://localhost:3000
   Not: file:///... or view-source:http://...
   ```

3. ✅ Are there JavaScript errors in console?
   ```
   Open DevTools (F12) → Console tab
   Look for red error messages
   ```

4. ✅ Try hard refresh
   ```
   Mac: Cmd+Shift+R
   Windows/Linux: Ctrl+Shift+R
   ```

5. ✅ Try incognito/private window
   ```
   This bypasses cache and extensions
   ```

## Step-by-Step Recovery

1. **Stop everything**
   ```bash
   # Press Ctrl+C in terminal where dev server is running
   ```

2. **Clean build artifacts**
   ```bash
   cd mastra-app
   rm -rf .next
   ```

3. **Verify dependencies**
   ```bash
   npm install
   ```

4. **Start fresh**
   ```bash
   npm run dev
   ```

5. **Wait for "Ready" message**
   ```
   ✓ Ready in X.Xs
   ```

6. **Open browser in incognito mode**
   ```
   Navigate to: http://localhost:3000
   ```

7. **Check DevTools console**
   ```
   F12 → Console tab
   Should see no red errors
   ```

## Still Not Working?

### Check Terminal Output
Look for these error patterns:

**Port in use:**
```
Error: listen EADDRINUSE: address already in use :::3000
```
Solution: Kill the process or use different port

**Module errors:**
```
Module not found: Can't resolve '@/...'
```
Solution: Run `npm install` and restart

**Syntax errors:**
```
SyntaxError: Unexpected token
```
Solution: Check recent code changes, revert if needed

### Check Browser Console
Look for these error patterns:

**Hydration errors:**
```
Hydration failed because the initial UI does not match...
```
Solution: Clear cache, hard refresh

**Network errors:**
```
Failed to load resource: net::ERR_CONNECTION_REFUSED
```
Solution: Dev server not running, start it

**Module errors:**
```
Uncaught Error: Cannot find module
```
Solution: Clear .next folder, restart dev server

## Nuclear Option

If nothing works, complete reset:

```bash
# 1. Stop dev server (Ctrl+C)

# 2. Remove all build artifacts and dependencies
cd mastra-app
rm -rf .next
rm -rf node_modules
rm -rf node_modules/.cache

# 3. Reinstall everything
npm install

# 4. Start fresh
npm run dev

# 5. Open in incognito window
# Navigate to http://localhost:3000
```

## Prevention

To avoid this in the future:

1. **Always check terminal** - Make sure dev server is running
2. **Watch for errors** - Terminal shows build errors immediately
3. **Use incognito for testing** - Avoids cache issues
4. **Keep DevTools open** - Catch JavaScript errors early
5. **Restart after big changes** - Especially after modifying config files

## Common Mistakes

❌ Opening `file:///path/to/mastra-app/...` in browser
✅ Opening `http://localhost:3000`

❌ Right-click → "View Page Source"
✅ Just navigate to the URL normally

❌ Dev server not running
✅ Terminal shows "Ready" message

❌ Using cached version
✅ Hard refresh (Cmd+Shift+R)
