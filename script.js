/* ═══════════════════════════════════════════════════════
   PeerLink — Full Working Script
   Matches index.html IDs exactly
═══════════════════════════════════════════════════════ */

// ── State ──────────────────────────────────────────────
let peer = null;
let conn = null;
let isConnected = false;
let myName = 'Me';
let peerName = 'Peer';
let msgCount = 0;
let filesSent = 0;
let filesRecv = 0;
const incomingFiles = {};
const CHUNK_SIZE = 65536; // 64KB — matches repo's BUF_SIZE concept

// ── Page switching ──────────────────────────────────────
function showLanding() {
  document.getElementById('landingPage').style.display = 'block';
  document.getElementById('appPage').style.display = 'none';
  document.getElementById('landingNav').style.display = 'flex';
  document.getElementById('appNav').style.display = 'none';
}

function showApp() {
  document.getElementById('landingPage').style.display = 'none';
  document.getElementById('appPage').style.display = 'block';
  document.getElementById('landingNav').style.display = 'none';
  document.getElementById('appNav').style.display = 'flex';
  document.getElementById('connectScreen').style.display = 'flex';
  document.getElementById('dashboard').style.display = 'none';
  if (!peer) initPeer();
}

// ── Navbar buttons ──────────────────────────────────────
document.getElementById('logoBtn').addEventListener('click', showLanding);
document.getElementById('launchBtn').addEventListener('click', showApp);
document.getElementById('launchBtnMobile').addEventListener('click', showApp);
document.getElementById('heroLaunchBtn').addEventListener('click', showApp);
document.getElementById('ctaLaunchBtn').addEventListener('click', showApp);
document.getElementById('footerLaunchBtn').addEventListener('click', showApp);
document.getElementById('backBtn').addEventListener('click', showLanding);
document.getElementById('disconnectBtn').addEventListener('click', disconnect);

// ── Hamburger ───────────────────────────────────────────
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('navMobile').classList.toggle('open');
});
document.querySelectorAll('.nav-mobile a').forEach(a => {
  a.addEventListener('click', () => document.getElementById('navMobile').classList.remove('open'));
});

// ── Connect screen tabs ─────────────────────────────────
function switchTab(tab) {
  document.getElementById('pane-myid').style.display = tab === 'myid' ? 'block' : 'none';
  document.getElementById('pane-connect').style.display = tab === 'connect' ? 'block' : 'none';
  document.getElementById('tab-myid').classList.toggle('active', tab === 'myid');
  document.getElementById('tab-connect').classList.toggle('active', tab === 'connect');
}

// ── Copy Peer ID ────────────────────────────────────────
function copyId() {
  const val = document.getElementById('myPeerId').value;
  if (!val || val === 'Connecting to server...') return;
  navigator.clipboard.writeText(val).then(() => {
    const btn = document.getElementById('copyBtn');
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
    showToast('Peer ID copied to clipboard!');
  });
}

// ── Init PeerJS ─────────────────────────────────────────
function initPeer() {
  // Use public PeerJS cloud server — works on Vercel with no backend
  peer = new Peer(undefined, {
    host: '0.peerjs.com',
    port: 443,
    path: '/',
    secure: true,
    debug: 0,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    }
  });

  peer.on('open', (id) => {
    document.getElementById('myPeerId').value = id;
    document.getElementById('myId').textContent = id.substring(0, 16) + '...';
    logPacket('SYS', 'Peer ID assigned: ' + id.substring(0, 12) + '...');
    showToast('Ready! Share your Peer ID.');
  });

  // Host side: incoming connection
  peer.on('connection', (connection) => {
    if (isConnected) {
      connection.on('open', () => {
        connection.send({ type: 'sys', text: 'Peer is busy.' });
        setTimeout(() => connection.close(), 500);
      });
      return;
    }
    logPacket('SYS', 'Incoming connection from ' + connection.peer.substring(0, 12) + '...');
    setupConnection(connection);
  });

  peer.on('error', (err) => {
    console.error('PeerJS error:', err);
    const errEl = document.getElementById('connectError');
    let msg = 'Connection error. ';
    if (err.type === 'peer-unavailable') msg = 'Peer not found. Make sure the other tab is open and the ID is correct.';
    else if (err.type === 'network') msg = 'Network error. Check your internet connection.';
    else if (err.type === 'server-error') msg = 'PeerJS server error. Try again in a moment.';
    else msg = err.message || 'Unknown error.';
    errEl.textContent = msg;
    errEl.style.display = 'block';
    const btn = document.getElementById('connectBtn');
    btn.textContent = '⚡ Connect';
    btn.disabled = false;
    logPacket('ERR', err.type || err.message);
  });

  peer.on('disconnected', () => {
    logPacket('SYS', 'Disconnected from signaling server');
    if (!isConnected) peer.reconnect();
  });
}

// ── Client side: connect to peer ───────────────────────
function doConnect() {
  const remoteId = document.getElementById('remotePeerId').value.trim();
  const name = document.getElementById('myUsername').value.trim() || 'User';
  const errEl = document.getElementById('connectError');
  errEl.style.display = 'none';

  if (!remoteId) { errEl.textContent = 'Please enter a Peer ID.'; errEl.style.display = 'block'; return; }
  if (peer && remoteId === peer.id) { errEl.textContent = 'You cannot connect to yourself!'; errEl.style.display = 'block'; return; }

  myName = name;
  document.getElementById('myNm').textContent = myName;

  const btn = document.getElementById('connectBtn');
  btn.textContent = 'Connecting...';
  btn.disabled = true;

  logPacket('TCP', 'Connecting to ' + remoteId.substring(0, 12) + '...');

  const connection = peer.connect(remoteId, { reliable: true, serialization: 'binary' });
  setupConnection(connection);

  // Timeout fallback
  setTimeout(() => {
    if (!isConnected) {
      errEl.textContent = 'Connection timed out. Make sure the other tab is open and the ID is correct.';
      errEl.style.display = 'block';
      btn.textContent = '⚡ Connect';
      btn.disabled = false;
      if (connection) connection.close();
      logPacket('ERR', 'Connection timeout');
    }
  }, 15000);
}

// ── Setup connection (both sides) ───────────────────────
function setupConnection(connection) {
  conn = connection;

  conn.on('open', () => {
    isConnected = true;
    logPacket('TCP', 'Connection established ✓');

    // Exchange names
    conn.send({ type: 'handshake', name: myName });

    // Update UI
    setConnected(conn.peer);
    showDashboard();
  });

  conn.on('data', (data) => {
    handleData(data);
  });

  conn.on('close', () => {
    if (isConnected) {
      isConnected = false;
      showToast('⚠️ Peer disconnected.');
      logPacket('SYS', 'Connection closed');
      setDisconnected();
    }
  });

  conn.on('error', (err) => {
    logPacket('ERR', err.message);
    showToast('Connection error: ' + err.message);
  });
}

// ── Show dashboard after connect ────────────────────────
function showDashboard() {
  document.getElementById('connectScreen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'flex';
  document.getElementById('disconnectBtn').style.display = 'inline-flex';
  updateConnPill(true);
}

function setConnected(peerId) {
  const initial = peerName.charAt(0).toUpperCase();
  document.getElementById('peerAv').textContent = initial;
  document.getElementById('chatAv').textContent = initial;
  document.getElementById('peerNm').textContent = peerName;
  document.getElementById('chatNm').textContent = peerName;
  document.getElementById('peerIdSm').textContent = peerId.substring(0, 20) + '...';
  document.getElementById('myNm').textContent = myName;
  updateConnPill(true);
}

function setDisconnected() {
  updateConnPill(false);
  document.getElementById('disconnectBtn').style.display = 'none';
  // Go back to connect screen
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('connectScreen').style.display = 'flex';
  // Reset connect button
  const btn = document.getElementById('connectBtn');
  btn.textContent = '⚡ Connect';
  btn.disabled = false;
}

function updateConnPill(connected) {
  const dot = document.getElementById('connDot');
  const label = document.getElementById('connLabel');
  dot.className = 'conn-dot ' + (connected ? 'connected' : 'disconnected');
  label.textContent = connected ? ('Connected · ' + peerName) : 'Disconnected';
}

// ── Disconnect ──────────────────────────────────────────
function disconnect() {
  if (conn) {
    try { conn.send({ type: 'sys', text: 'Peer disconnected.' }); } catch(e) {}
    conn.close();
    conn = null;
  }
  isConnected = false;
  setDisconnected();
  logPacket('SYS', 'Disconnected by user');
  showToast('Disconnected.');
}

// ── Handle incoming data ────────────────────────────────
function handleData(data) {
  if (!data || typeof data !== 'object') return;

  switch (data.type) {
    case 'handshake':
      peerName = data.name || 'Peer';
      setConnected(conn.peer);
      addSysMsg('🤝 ' + peerName + ' connected');
      logPacket('SYS', 'Handshake: ' + peerName);
      break;

    case 'chat':
      addMsg(data.text, 'recv', peerName, data.time);
      msgCount++;
      document.getElementById('statMsgs').textContent = msgCount;
      logPacket('MSG', peerName + ': ' + data.text.substring(0, 30));
      break;

    case 'sys':
      addSysMsg(data.text);
      break;

    case 'file_start':
      incomingFiles[data.id] = { name: data.name, size: data.size, chunks: [], received: 0 };
      addTransferItem(data.id, data.name, data.size, 'recv', 0);
      filesRecv++;
      document.getElementById('statRecv').textContent = filesRecv;
      logPacket('FILE', 'Receiving: ' + data.name + ' (' + fmtSize(data.size) + ')');
      addSysMsg('📥 Receiving ' + data.name + ' (' + fmtSize(data.size) + ')');
      break;

    case 'file_chunk':
      const fd = incomingFiles[data.id];
      if (!fd) return;
      fd.chunks.push(data.chunk);
      fd.received += data.chunk.byteLength;
      const pct = Math.round((fd.received / fd.size) * 100);
      updateTransferProgress(data.id, pct, fmtSize(fd.received) + ' / ' + fmtSize(fd.size));
      break;

    case 'file_done':
      const f = incomingFiles[data.id];
      if (!f) return;
      const blob = new Blob(f.chunks);
      const url = URL.createObjectURL(blob);
      finalizeTransfer(data.id, f.name, f.size, url);
      delete incomingFiles[data.id];
      logPacket('FILE', 'Received: ' + f.name + ' ✓');
      addSysMsg('✅ ' + f.name + ' received successfully');
      break;
  }
}

// ── Send message ────────────────────────────────────────
function sendMessage() {
  const input = document.getElementById('msgInput');
  const text = input.value.trim();
  if (!text) return;
  if (!isConnected || !conn) { showToast('Not connected to a peer.'); return; }

  const time = nowTime();
  addMsg(text, 'sent', myName, time);
  conn.send({ type: 'chat', text, time });
  input.value = '';
  msgCount++;
  document.getElementById('statMsgs').textContent = msgCount;
  logPacket('MSG', 'You: ' + text.substring(0, 30));
}

// ── File handling ───────────────────────────────────────
function handleFileSelect(input) {
  if (input.files.length) sendFile(input.files[0]);
  input.value = '';
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('dropZone').classList.remove('dz-over');
  if (e.dataTransfer.files.length) sendFile(e.dataTransfer.files[0]);
}

function sendFile(file) {
  if (!isConnected || !conn) { showToast('Not connected to a peer.'); return; }

  const id = 'tx_' + Math.random().toString(36).substr(2, 9);
  addTransferItem(id, file.name, file.size, 'send', 0);
  filesSent++;
  document.getElementById('statSent').textContent = filesSent;
  logPacket('FILE', 'Sending: ' + file.name + ' (' + fmtSize(file.size) + ')');
  addSysMsg('📤 Sending ' + file.name + ' (' + fmtSize(file.size) + ')');

  conn.send({ type: 'file_start', id, name: file.name, size: file.size });

  let offset = 0;

  function nextChunk() {
    const slice = file.slice(offset, offset + CHUNK_SIZE);
    const reader = new FileReader();
    reader.onload = (e) => {
      conn.send({ type: 'file_chunk', id, chunk: e.target.result });
      offset += CHUNK_SIZE;
      const pct = Math.min(100, Math.round((offset / file.size) * 100));
      updateTransferProgress(id, pct, fmtSize(Math.min(offset, file.size)) + ' / ' + fmtSize(file.size));
      if (offset < file.size) {
        setTimeout(nextChunk, 0);
      } else {
        conn.send({ type: 'file_done', id });
        markTransferDone(id, file.name, file.size);
        logPacket('FILE', 'Sent: ' + file.name + ' ✓');
        addSysMsg('✅ ' + file.name + ' sent successfully');
      }
    };
    reader.readAsArrayBuffer(slice);
  }
  nextChunk();
}

// ── Chat UI ─────────────────────────────────────────────
function addMsg(text, type, name, time) {
  const box = document.getElementById('chatMsgs');
  const d = document.createElement('div');
  d.className = 'msg-row ' + type;
  d.innerHTML = `
    <div class="msg-bubble">
      <div class="msg-name">${escHtml(name)}</div>
      <div class="msg-text">${escHtml(text)}</div>
      <div class="msg-time">${time || nowTime()}</div>
    </div>`;
  box.appendChild(d);
  box.scrollTop = box.scrollHeight;
}

function addSysMsg(text) {
  const box = document.getElementById('chatMsgs');
  const d = document.createElement('div');
  d.className = 'sys-msg';
  d.textContent = text;
  box.appendChild(d);
  box.scrollTop = box.scrollHeight;
}

function clearChat() {
  document.getElementById('chatMsgs').innerHTML = '<div class="sys-msg">🗑️ Chat cleared.</div>';
}

// ── Transfer UI ─────────────────────────────────────────
function addTransferItem(id, name, size, dir, pct) {
  const list = document.getElementById('txList');
  const noTx = list.querySelector('.no-tx');
  if (noTx) noTx.remove();

  const d = document.createElement('div');
  d.className = 'tx-item';
  d.id = 'tx-' + id;
  d.innerHTML = `
    <div class="tx-icon">${dir === 'send' ? '📤' : '📥'}</div>
    <div class="tx-info">
      <div class="tx-name">${escHtml(name)}</div>
      <div class="tx-meta" id="txmeta-${id}">${fmtSize(size)} · 0%</div>
      <div class="tx-bar"><div class="tx-fill" id="txfill-${id}" style="width:0%"></div></div>
    </div>`;
  list.prepend(d);
}

function updateTransferProgress(id, pct, label) {
  const fill = document.getElementById('txfill-' + id);
  const meta = document.getElementById('txmeta-' + id);
  if (fill) fill.style.width = pct + '%';
  if (meta) meta.textContent = label + ' · ' + pct + '%';
}

function finalizeTransfer(id, name, size, url) {
  const item = document.getElementById('tx-' + id);
  if (!item) return;
  item.querySelector('.tx-info').innerHTML = `
    <div class="tx-name">${escHtml(name)}</div>
    <div class="tx-meta done">${fmtSize(size)} · Complete ✅</div>
    <div class="tx-bar"><div class="tx-fill done" style="width:100%"></div></div>
    <a href="${url}" download="${escHtml(name)}" class="dl-btn">⬇ Save File</a>`;
}

function markTransferDone(id, name, size) {
  const item = document.getElementById('tx-' + id);
  if (!item) return;
  item.querySelector('.tx-info').innerHTML = `
    <div class="tx-name">${escHtml(name)}</div>
    <div class="tx-meta done">${fmtSize(size)} · Sent ✅</div>
    <div class="tx-bar"><div class="tx-fill done" style="width:100%"></div></div>`;
}

// ── Packet Log ──────────────────────────────────────────
function logPacket(type, msg) {
  const log = document.getElementById('packetLog');
  if (!log) return;
  const d = document.createElement('div');
  d.className = 'log-entry';
  const colors = { SYS:'#9ca3af', TCP:'#60a5fa', MSG:'#34d399', FILE:'#f59e0b', ERR:'#f87171', ACK:'#a78bfa' };
  d.innerHTML = `<span class="log-tag" style="color:${colors[type]||'#9ca3af'}">[${type}]</span> <span class="log-msg">${escHtml(msg)}</span>`;
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
  // Keep max 50 entries
  while (log.children.length > 50) log.removeChild(log.firstChild);
}

// ── Toast ───────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── Helpers ─────────────────────────────────────────────
function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Init on load ────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  showLanding();
});
