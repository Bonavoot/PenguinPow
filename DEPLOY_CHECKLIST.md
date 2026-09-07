# Deploy checklist (protocol 3)

Packaged clients use `https://secure-beach-15962-3c882c6fcbf9.herokuapp.com/`
(`REMOTE_URL` when `import.meta.env.PROD`). Until `server-io/` is deployed they show **UPDATE REQUIRED**.

## 1. Deploy the match server
`Procfile`: `web: cd server-io && npm start` (reads Heroku `PORT`).
Confirm `cmp server-io/netProtocol.json shared/netProtocol.json` then push `server-io` to Heroku (`git push heroku HEAD:main` from the app repo).

## 2. Verify the live dyno
```
curl -sS https://secure-beach-15962-3c882c6fcbf9.herokuapp.com/health   # OK
curl -sS https://secure-beach-15962-3c882c6fcbf9.herokuapp.com/metrics  # "protocolVersion": 3
```
Wake a sleeping eco/basic dyno and retry if empty.

## 3. Build and share the packaged client
```
cd client && SKIP_BAKE=1 npm run build          # Netlify: client/netlify.toml
# from repo root — shareable Electron app:
npm run build:electron                          # or npm run electron:build
```
Root `npm run build` is a leftover `vite build` with no `index.html` — do not use it. On Linux, Windows/mac targets may need Wine/a display; ship `client/dist` or a Linux AppImage if that target finishes headless.

## 4. Watch `/metrics` in friend sessions
`net.socketReplaced`, `net.holdsExpired`, `net.matchesAbandonedDisconnected`, `eventLoopLatenessMs.p99` (alert > 10), `tickMs.p99` (keep < ~7.8).

## 5. Known blockers (do not fix now)
Eco/basic dynos sleep when idle and restart daily. Sleep looks like a dead server; a mid-session restart sends `server_shutdown` and ends every live bout. Plan deploys around friend sessions.
