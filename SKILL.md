---
name: tg-canvas
description: "Telegram Mini App Canvas. Renders agent-generated content (HTML, markdown) in a Telegram Mini App. Authenticated via Telegram initData — only approved users can view. Push content with `tg-canvas push` or via the /push API."
homepage: https://github.com/openclaw/tg-canvas
metadata:
  {
    "openclaw": {
      "emoji": "🖼️",
      "requires": { "bins": ["node", "cloudflared"] },
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

## Security Notes

- The `/push` endpoint is loopback-only and should not be exposed publicly.
- Mini App access is authenticated with Telegram `initData` verification and filtered by `ALLOWED_USER_IDS`.

## Commands

- `tg-canvas push` — push HTML/markdown/text/A2UI
- `tg-canvas clear` — clear the canvas
- `tg-canvas health` — check server health

## Configuration

| Variable | Required | Description |
| --- | --- | --- |
| `BOT_TOKEN` | Yes | Telegram bot token used for API calls and auth verification. |
| `ALLOWED_USER_IDS` | Yes | Comma-separated Telegram user IDs allowed to view the Mini App. |
| `JWT_SECRET` | Yes | Secret used to sign session tokens. Use a long random value. |
| `PORT` | No | Server port (default: `3721`). |
| `MINIAPP_URL` | Yes (for bot setup) | HTTPS URL of the Mini App (Cloudflare tunnel). |
| `PUSH_TOKEN` | No | Shared secret for `/push` and CLI (sent via `X-Push-Token`). |
| `TG_CANVAS_URL` | No | Base URL for the CLI (default: `http://127.0.0.1:3721`). |
