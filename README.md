# Telegram Mini App Canvas (OpenClaw Skill)

This package provides a Telegram Mini App that renders agent-generated HTML or markdown in a secure canvas. Only approved Telegram user IDs can view the content, and the Mini App authenticates sessions using Telegram `initData` verification.

## Quick Start

1. Clone or copy this folder into your OpenClaw workspace.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set environment variables (or create a `.env` file):
   ```bash
   export BOT_TOKEN=...
   export ALLOWED_USER_IDS=123456789
   export JWT_SECRET=...
   export PORT=3721
   ```
4. Start the server and Cloudflare tunnel:
   ```bash
   bash scripts/start.sh
   ```
5. Configure the bot menu button:
   ```bash
   BOT_TOKEN=... MINIAPP_URL=https://xxxx.trycloudflare.com node scripts/setup-bot.js
   ```

## Pushing Content from the Agent

Use the CLI or the HTTP `/push` API (loopback-only):

```bash
curl -X POST http://127.0.0.1:3721/push \
  -H 'Content-Type: application/json' \
  -d '{"html":"<h1>Hello Canvas</h1>"}'
```

See `SKILL.md` for the agent command (`tg-canvas push`) and environment details.

## Architecture

```
+-----------+        +------------------+        +---------------------+
|  Agent    |  push  |  Local server    |  HTTPS |  Telegram Mini App  |
| (OpenClaw)| -----> |  (localhost)     | -----> |  (Cloudflare URL)   |
+-----------+        +------------------+        +---------------------+
          ^                    |
          |                    | Telegram initData verification
          +--------------------+ (authorized users only)
```

## Publishing to ClawhHub

Ensure `SKILL.md`, scripts, and `.env.example` are included. Tag the repo with a version and publish according to ClawhHub guidelines.

## Security

Telegram Mini Apps pass a signed `initData` payload. The server validates this signature using your bot token and restricts access to `ALLOWED_USER_IDS`. The `/push` endpoint listens only on loopback and should never be exposed publicly.
