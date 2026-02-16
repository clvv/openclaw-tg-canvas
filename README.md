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

## HTTPS via nginx + Let’s Encrypt (domain-based, no Cloudflare)

Use this if you already have a subdomain pointing at your VPS.

**1) Nginx HTTP config (ACME + proxy):**

```nginx
server {
  listen 80;
  listen [::]:80;
  server_name canvas.example.com;

  location ^~ /.well-known/acme-challenge/ {
    root /var/www/certbot;
    default_type text/plain;
  }

  location / {
    proxy_pass http://127.0.0.1:3721;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

```bash
sudo mkdir -p /var/www/certbot/.well-known/acme-challenge
sudo nginx -t && sudo systemctl reload nginx
```

**2) Certbot (webroot):**

```bash
sudo certbot certonly --webroot -w /var/www/certbot -d canvas.example.com \
  -m you@example.com --agree-tos --non-interactive
```

**3) Enable HTTPS + redirect (certbot can do this):**

```bash
sudo certbot --nginx -d canvas.example.com -m you@example.com --agree-tos --redirect --non-interactive
```

**4) Verify (IPv4/IPv6):**

```bash
curl -4 https://canvas.example.com/
curl -6 https://canvas.example.com/
```

If IPv6 fails, add `listen [::]:80` / `listen [::]:443` or remove the AAAA record.

## Pushing Content from the Agent

Use the CLI or the HTTP `/push` API (loopback-only):

```bash
curl -X POST http://127.0.0.1:3721/push \
  -H 'Content-Type: application/json' \
  -d '{"html":"<h1>Hello Canvas</h1>"}'
```

Other formats:

```bash
curl -X POST http://127.0.0.1:3721/push \
  -H 'Content-Type: application/json' \
  -d '{"markdown":"# Hello"}'

curl -X POST http://127.0.0.1:3721/push \
  -H 'Content-Type: application/json' \
  -d '{"a2ui": {"type":"text","text":"Hello"}}'
```

CLI examples:

```bash
tg-canvas push --html "<h1>Hello</h1>"
tg-canvas push --markdown "# Hello"
tg-canvas push --a2ui @./a2ui.json
```

See `SKILL.md` for the agent command (`tg-canvas push`) and environment details.

## Health Endpoint

```bash
curl http://127.0.0.1:3721/health
```

Returns server uptime, active WebSocket client count, and whether a canvas state exists.

## Systemd (optional)

1) Copy the unit file and adjust paths if needed:

```bash
sudo cp tg-canvas.service /etc/systemd/system/tg-canvas.service
sudo systemctl daemon-reload
```

2) Create `/etc/default/tg-canvas` or use the existing `.env` in the repo:

```bash
sudo mkdir -p /etc/tg-canvas
sudo cp .env /etc/tg-canvas/.env
```

3) Update the unit file to point at the env file location:

```ini
EnvironmentFile=/etc/tg-canvas/.env
```

4) Enable and start:

```bash
sudo systemctl enable --now tg-canvas
sudo systemctl status tg-canvas
```

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

Telegram Mini Apps pass a signed `initData` payload. The server validates this signature using your bot token, enforces `auth_date` freshness, and restricts access to `ALLOWED_USER_IDS`. JWTs are short‑lived (`JWT_TTL_SECONDS`). The `/push` endpoint listens only on loopback and should never be exposed publicly.

## Canvas Learnings (from live testing)

- **Inline scripts in injected HTML won’t run** in Telegram WebView; the renderer re‑inserts `<script>` tags to execute.
- **CORS can block direct fetches** from the Mini App; embed sanctioned widgets (e.g., TradingView) or proxy data server‑side.
- **WebSocket upgrades require nginx headers** (`Upgrade`/`Connection`), or the app will show “Connecting” loops.
- **HTTPS is mandatory** for Mini Apps.
