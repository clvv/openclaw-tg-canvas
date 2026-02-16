// OpenClaw Canvas Mini App
// Vanilla JS client for Telegram WebApp

(() => {
  const tg = window.Telegram?.WebApp;

  const contentEl = document.getElementById('content');
  const connDot = document.getElementById('connDot');

  let jwt = null;
  let ws = null;
  let reconnectTimer = null;
  let connectedFlashTimer = null;

  // ---------- UI Helpers ----------
  function setConnected(isConnected) {
    connDot.classList.toggle('connected', isConnected);
  }

  function showCenter(message, withSpinner = false, buttonText = null, buttonHandler = null) {
    contentEl.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'center fade-in';

    if (withSpinner) {
      const spinner = document.createElement('div');
      spinner.className = 'spinner';
      wrap.appendChild(spinner);
    }

    const text = document.createElement('div');
    text.textContent = message;
    wrap.appendChild(text);

    if (buttonText && buttonHandler) {
      const btn = document.createElement('button');
      btn.className = 'button';
      btn.textContent = buttonText;
      btn.addEventListener('click', buttonHandler);
      wrap.appendChild(btn);
    }

    contentEl.appendChild(wrap);
  }

  function showConnectedFlash() {
    const note = document.createElement('div');
    note.style.position = 'fixed';
    note.style.top = '10px';
    note.style.left = '50%';
    note.style.transform = 'translateX(-50%)';
    note.style.background = 'var(--tg-secondary-bg)';
    note.style.color = 'var(--tg-hint)';
    note.style.padding = '6px 10px';
    note.style.borderRadius = '10px';
    note.style.fontSize = '12px';
    note.style.zIndex = '100';
    note.style.opacity = '0.95';
    note.textContent = 'Connected';
    document.body.appendChild(note);

    clearTimeout(connectedFlashTimer);
    connectedFlashTimer = setTimeout(() => {
      note.remove();
    }, 1200);
  }

  // ---------- Markdown Renderer (minimal) ----------
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function renderMarkdown(md) {
    // Simple, safe markdown conversion
    const lines = md.split('\n');
    let html = '';
    let inCodeBlock = false;
    let listType = null; // 'ul' | 'ol'

    const closeList = () => {
      if (listType) {
        html += `</${listType}>`;
        listType = null;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Code block (```) toggle
      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          closeList();
          inCodeBlock = true;
          html += '<pre><code>';
        } else {
          inCodeBlock = false;
          html += '</code></pre>';
        }
        continue;
      }

      if (inCodeBlock) {
        html += `${escapeHtml(line)}\n`;
        continue;
      }

      // Headings
      if (/^###\s+/.test(line)) {
        closeList();
        html += `<h3>${escapeHtml(line.replace(/^###\s+/, ''))}</h3>`;
        continue;
      }
      if (/^##\s+/.test(line)) {
        closeList();
        html += `<h2>${escapeHtml(line.replace(/^##\s+/, ''))}</h2>`;
        continue;
      }
      if (/^#\s+/.test(line)) {
        closeList();
        html += `<h1>${escapeHtml(line.replace(/^#\s+/, ''))}</h1>`;
        continue;
      }

      // Lists
      const ulMatch = /^-\s+/.test(line);
      const olMatch = /^\d+\.\s+/.test(line);
      if (ulMatch || olMatch) {
        const type = ulMatch ? 'ul' : 'ol';
        if (listType && listType !== type) closeList();
        if (!listType) {
          listType = type;
          html += `<${listType}>`;
        }
        const itemText = line.replace(ulMatch ? /^-\s+/ : /^\d+\.\s+/, '');
        html += `<li>${inlineMarkdown(escapeHtml(itemText))}</li>`;
        continue;
      } else {
        closeList();
      }

      // Paragraphs / blank
      if (line.trim() === '') {
        html += '<br />';
      } else {
        html += `<p>${inlineMarkdown(escapeHtml(line))}</p>`;
      }
    }

    closeList();
    return html;
  }

  function inlineMarkdown(text) {
    // bold **text**
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // italic *text*
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // inline code `code`
    text = text.replace(/`(.+?)`/g, '<code>$1</code>');
    return text;
  }

  // ---------- Rendering ----------
  function renderPayload(payload) {
    if (!payload || payload.type === 'clear') {
      showCenter('Waiting for content...');
      return;
    }

    const { format, content } = payload;
    contentEl.innerHTML = '';
    contentEl.classList.add('fade-in');

    const container = document.createElement('div');

    if (format === 'html') {
      // Trusted HTML from server (agent only)
      container.innerHTML = content || '';
    } else if (format === 'markdown') {
      container.innerHTML = renderMarkdown(content || '');
    } else {
      // text
      const pre = document.createElement('pre');
      pre.textContent = content || '';
      container.appendChild(pre);
    }

    contentEl.appendChild(container);
    setTimeout(() => contentEl.classList.remove('fade-in'), 250);
  }

  // ---------- Auth + Networking ----------
  async function authenticate() {
    const initData = tg?.initData || '';
    try {
      const res = await fetch('/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      });

      if (!res.ok) throw new Error('auth_failed');
      const data = await res.json();
      if (!data?.token) throw new Error('no_token');
      jwt = data.token;
      return true;
    } catch (e) {
      return false;
    }
  }

  async function fetchState() {
    try {
      const res = await fetch(`/state?token=${encodeURIComponent(jwt)}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  function connectWS() {
    if (!jwt) return;

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${location.host}/ws?token=${encodeURIComponent(jwt)}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setConnected(true);
      showConnectedFlash();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'ping') return;
        if (msg.type === 'clear') {
          renderPayload({ type: 'clear' });
          return;
        }
        if (msg.type === 'canvas') {
          renderPayload(msg);
        }
      } catch (e) {
        // ignore malformed message
      }
    };

    ws.onerror = () => {
      setConnected(false);
      showCenter('Connection lost. Reconnecting...', true);
    };

    ws.onclose = () => {
      setConnected(false);
      showCenter('Connection lost. Reconnecting...', true);
      scheduleReconnect();
    };
  }

  function scheduleReconnect() {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      connectWS();
    }, 3000);
  }

  // ---------- Boot ----------
  async function boot() {
    showCenter('Connecting...', true);

    const authed = await authenticate();
    if (!authed) {
      showCenter('Access denied', false, 'Close', () => tg?.close?.());
      return;
    }

    // Fetch current state before WS connect
    const state = await fetchState();
    if (state) renderPayload(state);
    else showCenter('Waiting for content...');

    connectWS();
  }

  boot();
})();
