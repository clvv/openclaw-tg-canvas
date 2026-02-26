---
name: tg-canvas
description: "Telegram Mini App Canvas. Renders agent-generated content (HTML, markdown) in a Telegram Mini App. Authenticated via Telegram initData — only approved users can view. Push content with `tg-canvas push` or via the /push API."
homepage: https://github.com/clvv/openclaw-tg-canvas
kind: server
metadata:
  {
    "openclaw": {
      "emoji": "🖼️",
      "kind": "server",
      "requires": {
        "bins": ["node", "cloudflared"],
        "env": ["BOT_TOKEN", "ALLOWED_USER_IDS", "JWT_SECRET", "MINIAPP_URL", "PUSH_TOKEN"]
      },
      "install": [
        {
          "id": "npm",
          "kind": "npm",
          "label": "Install dependencies (npm install)"
        }
      ]
    }
  }
---

**This is a server skill.** It includes a Node.js HTTP/WebSocket server (`server.js`), a CLI (`bin/tg-canvas.js`), and a Telegram Mini App frontend (`miniapp/`). It is not instruction-only.

Telegram Mini App Canvas renders agent-generated HTML or markdown inside a Telegram Mini App, with access limited to approved user IDs and authenticated via Telegram `initData` verification. It exposes a local push endpoint and a CLI command so agents can update the live canvas without manual UI steps.

## Prerequisites

- Node.js 18+ (tested with Node 18/20/22)
- `cloudflared` for HTTPS tunnel (required by Telegram Mini Apps)
- Telegram bot token

## Setup

1. Configure environment variables (see **Configuration** below) in your shell or a `.env` file.
2. Run the bot setup script to configure the menu button:
   ```bash
   BOT_TOKEN=... MINIAPP_URL=https://xxxx.trycloudflare.com node scripts/setup-bot.js
   ```
3. Start the server:
   ```bash
   node server.js
   ```
4. Start a Cloudflare tunnel to expose the Mini App over HTTPS:
   ```bash
   cloudflared tunnel --url http://localhost:3721
   ```

## Pushing Content from the Agent

- CLI:
  ```bash
  tg-canvas push --html "<h1>Hello</h1>"
  tg-canvas push --markdown "# Hello"
  tg-canvas push --a2ui @./a2ui.json
  ```
- HTTP API:
  ```bash
  curl -X POST http://127.0.0.1:3721/push \
    -H 'Content-Type: application/json' \
    -d '{"html":"<h1>Hello</h1>"}'
  ```

## Security

**What the Cloudflare tunnel exposes publicly:**

| Endpoint | Public? | Auth |
| --- | --- | --- |
| `GET /` | ✅ | None (serves static Mini App HTML) |
| `POST /auth` | ✅ | Telegram `initData` HMAC-SHA256 verification + `ALLOWED_USER_IDS` check |
| `GET /state` | ✅ | JWT required |
| `GET /ws` | ✅ | JWT required (WebSocket upgrade) |
| `POST /push` | ❌ loopback-only | `PUSH_TOKEN` required + loopback check |
| `POST /clear` | ❌ loopback-only | `PUSH_TOKEN` required + loopback check |
| `GET /health` | ❌ loopback-only | Loopback check only (read-only, low risk) |
| `GET/WS /oc/*` | ✅ (when enabled) | JWT required; only available when `ENABLE_OPENCLAW_PROXY=true` |

> ⚠️ **Cloudflared loopback bypass:** `cloudflared` (and other local tunnels) forward remote requests by making outbound TCP connections to `localhost`. This means all requests arriving via the tunnel appear to originate from `127.0.0.1` at the socket level — completely defeating the loopback-only IP check. **`PUSH_TOKEN` is therefore required and is enforced at startup.** The loopback check is retained as an additional layer but must not be relied on as the sole protection.

**Recommendations:**
- **Set `PUSH_TOKEN`** — the server will refuse to start without it. Generate one with: `openssl rand -hex 32`
- Use a strong random `JWT_SECRET` (32+ bytes).
- Keep `BOT_TOKEN`, `JWT_SECRET`, and `PUSH_TOKEN` secret; rotate if compromised.
- The Cloudflare tunnel exposes the Mini App publicly — the `ALLOWED_USER_IDS` check in `/auth` is the primary access control gate for the canvas.
- **`ENABLE_OPENCLAW_PROXY` is off by default.** Only enable it if you need Control UI access through the Mini App and understand the implications (see below).

### OpenClaw Control UI proxy (optional)

The server can optionally proxy `/oc/*` to a local OpenClaw gateway, enabling you to access the OpenClaw Control UI through the Mini App.

**This feature is disabled by default.** To enable:

```env
ENABLE_OPENCLAW_PROXY=true
```

**Declared side-effects when enabled:**
- Reads `~/.openclaw/openclaw.json` to auto-load the gateway auth token (if `OPENCLAW_GATEWAY_TOKEN` is not set explicitly). This file contains your local OpenClaw gateway credentials.
- Injects the gateway auth token into proxied requests as an `Authorization: Bearer` header.
- Adds the Mini App origin to the gateway's allowed control-UI origins (must be done manually — see below).

To provide the token explicitly without file access:
```env
OPENCLAW_GATEWAY_TOKEN=your-gateway-token
```

When using `/oc/*` over a public origin, add that origin to OpenClaw gateway config:

```json
{
  "gateway": {
    "controlUi": {
      "allowedOrigins": ["https://your-canvas-url.example.com"]
    }
  }
}
```

## Commands

- `tg-canvas push` — push HTML/markdown/text/A2UI
- `tg-canvas clear` — clear the canvas
- `tg-canvas health` — check server health

## Configuration

| Variable | Required | Description |
| --- | --- | --- |
| `BOT_TOKEN` | Yes | Telegram bot token used for API calls and auth verification. |
| `ALLOWED_USER_IDS` | Yes | Comma-separated Telegram user IDs allowed to view the Mini App. |
| `JWT_SECRET` | Yes | Secret used to sign session tokens. Use a long random value (32+ bytes). |
| `PORT` | No | Server port (default: `3721`). |
| `MINIAPP_URL` | Yes (for bot setup) | HTTPS URL of the Mini App (Cloudflare tunnel or nginx). |
| `PUSH_TOKEN` | Yes | Shared secret for `/push` and `/clear`. Sent via `X-Push-Token` header. Required because `cloudflared` makes loopback TCP connections, bypassing IP-based loopback checks. Generate with: `openssl rand -hex 32` |
| `ENABLE_OPENCLAW_PROXY` | No | Set to `"true"` to enable Control UI proxy at `/oc/*`. **Off by default.** When enabled, the server reads `~/.openclaw/openclaw.json` for a gateway auth token if `OPENCLAW_GATEWAY_TOKEN` is not set. |
| `OPENCLAW_GATEWAY_TOKEN` | No (proxy only) | Gateway auth token for the proxied OpenClaw instance. If unset and proxy is enabled, auto-loaded from `~/.openclaw/openclaw.json`. |
| `OPENCLAW_PROXY_HOST` | No | Hostname of the local OpenClaw gateway (default: `127.0.0.1`). |
| `OPENCLAW_PROXY_PORT` | No | Port of the local OpenClaw gateway (default: `18789`). |
| `TG_CANVAS_URL` | No | Base URL for the CLI (default: `http://127.0.0.1:3721`). |
| `ENABLE_OPENCLAW_PROXY` | No | Enable `/oc/*` proxy to local OpenClaw control UI (default: `true`). |
| `OPENCLAW_PROXY_HOST` | No | Upstream OpenClaw host for `/oc/*` (default: `127.0.0.1`). |
| `OPENCLAW_PROXY_PORT` | No | Upstream OpenClaw port for `/oc/*` (default: `18789`). |
| `OPENCLAW_GATEWAY_TOKEN` | No | Optional explicit gateway token for proxied control UI requests; if unset, server loads from `~/.openclaw/openclaw.json`. |
