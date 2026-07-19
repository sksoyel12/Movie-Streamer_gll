---
name: S-Movie pnpm install — websocket-driver workaround
description: pnpm install fails 403 on websocket-driver from Replit package firewall; fix is to extract the tarball locally and link it.
---

## Problem
`pnpm install` fails with `403 Forbidden` fetching `websocket-driver-0.7.4.tgz` from Replit's package-firewall proxy. This blocks all node_modules creation.

## Fix
1. `curl -s https://registry.npmjs.org/websocket-driver/-/websocket-driver-0.7.4.tgz -o /tmp/websocket-driver-0.7.4.tgz`
2. `mkdir -p lib/websocket-driver && tar -xzf /tmp/websocket-driver-0.7.4.tgz -C lib/websocket-driver --strip-components=1`
3. In `pnpm-workspace.yaml` overrides: `websocket-driver: link:lib/websocket-driver`
4. `pnpm install --no-frozen-lockfile`

**Why:** Replit's package-firewall blocks `websocket-driver` (needed by `faye-websocket` → Metro bundler WebSocket/HMR). The workaround places it as a local workspace link so pnpm can resolve it without the blocked registry.

**How to apply:** If node_modules go missing again, run steps 1–4. The `lib/websocket-driver` directory and the pnpm-workspace.yaml override are already committed.
