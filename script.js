document.addEventListener('DOMContentLoaded', () => {
    // Tab switching
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.style.display = 'none');
            
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).style.display = 'block';
        });
    });

    const heroPanel = document.getElementById('hero-panel');
    const appPanel = document.getElementById('app-panel');
    const navActions = document.getElementById('nav-actions');
    const localPeerIdDisplay = document.getElementById('local-peer-id');
    const copyIdBtn = document.getElementById('copy-id-btn');
    const connectClientBtn = document.getElementById('connect-client-btn');
    const remotePeerIdInput = document.getElementById('remote-peer-id');
    const disconnectBtn = document.getElementById('disconnect-btn');
    const connectedPeerIdDisplay = document.getElementById('connected-peer-id');

    let peer = null;
    let conn = null;
    let isConnected = false;

    // Generate random 6-character alphanumeric ID
    function generateId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    // Initialize PeerJS
    function initPeer() {
        const myId = generateId();
        peer = new Peer(myId, {
            debug: 2
        });

        peer.on('open', (id) => {
            localPeerIdDisplay.value = id;
        });

        peer.on('connection', (connection) => {
            if (conn && conn.open) {
                // Reject new connections if we are already connected
                connection.on('open', () => {
                    connection.send({ type: 'system', text: 'Peer is already busy.' });
                    setTimeout(() => connection.close(), 500);
                });
                return;
            }
            
            setupConnection(connection);
        });

        peer.on('error', (err) => {
            console.error('Peer error:', err);
            if (err.type === 'peer-unavailable') {
                alert("Could not find the friend's Peer ID. Make sure they are online and the ID is correct.");
            } else {
                alert(`Error: ${err.message}`);
            }
        });
    }

    initPeer();

    copyIdBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(localPeerIdDisplay.value).then(() => {
            const originalText = copyIdBtn.textContent;
            copyIdBtn.textContent = "Copied!";
            setTimeout(() => { copyIdBtn.textContent = originalText; }, 2000);
        });
    });

    connectClientBtn.addEventListener('click', () => {
        const remoteId = remotePeerIdInput.value.trim().toUpperCase();
        if(!remoteId) {
            alert('Please enter a valid Peer ID');
            return;
        }
        if(remoteId === peer.id) {
            alert('You cannot connect to yourself!');
            return;
        }

        const connection = peer.connect(remoteId, {
            reliable: true
        });

        setupConnection(connection);
    });

    function setupConnection(connection) {
        conn = connection;
        
        conn.on('open', () => {
            isConnected = true;
            connectedPeerIdDisplay.textContent = conn.peer;
            
            heroPanel.style.display = 'none';
            appPanel.style.display = 'block';
            navActions.style.display = 'flex';
            
            document.getElementById('connection-status').textContent = 'Connected';
            document.getElementById('connection-status').classList.add('connected');
            document.getElementById('connection-status').classList.remove('disconnected');
            
            addMessage('Connection established. Messages are secure and peer-to-peer.', 'system');
        });

        conn.on('data', (data) => {
            handleIncomingData(data);
        });

        conn.on('close', () => {
            disconnect(false);
        });
    }

    function disconnect(manual = true) {
        isConnected = false;
        if(conn) {
            if(manual) {
                conn.send({ type: 'system', text: 'Peer disconnected.' });
            }
            conn.close();
            conn = null;
        }
        
        appPanel.style.display = 'none';
        navActions.style.display = 'none';
        heroPanel.style.display = 'flex';
        
        const chatContainer = document.getElementById('chat-container');
        chatContainer.innerHTML = '<div class="message system"><p>Connection established. Messages are encrypted peer-to-peer.</p></div>';
        
        if(!manual) {
            alert('The connection was lost or closed by the peer.');
        }
    }

    disconnectBtn.addEventListener('click', () => disconnect(true));

    // Chat Functionality
    const messageInput = document.getElementById('message-input');
    const sendMsgBtn = document.getElementById('send-msg-btn');
    const chatContainer = document.getElementById('chat-container');

    function addMessage(text, type) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${type}`;
        msgDiv.innerHTML = `<p>${text}</p>`;
        chatContainer.appendChild(msgDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function sendMessage() {
        const text = messageInput.value.trim();
        if(text && isConnected && conn) {
            // Optimistic UI update
            messageInput.value = '';
            addMessage(text, 'sent');
            
            conn.send({
                type: 'chat',
                text: text
            });
        }
    }

    sendMsgBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') sendMessage();
    });

    // --- File Transfer Functionality ---
    const fileDropZone = document.getElementById('file-drop-zone');
    const fileInput = document.getElementById('file-input');
    const transferList = document.getElementById('transfer-list');

    // To store incoming chunks
    const incomingFiles = {};

    function handleIncomingData(data) {
        if (data.type === 'system') {
            addMessage(data.text, 'system');
        } else if (data.type === 'chat') {
            addMessage(data.text, 'received');
        } else if (data.type === 'file_start') {
            incomingFiles[data.transfer_id] = {
                filename: data.filename,
                size: data.size,
                chunks: [],
                receivedBytes: 0
            };
            
            const transferItem = document.createElement('div');
            transferItem.className = 'transfer-item';
            transferItem.id = `transfer-${data.transfer_id}`;
            transferItem.innerHTML = `
                <div class="file-icon">📥</div>
                <div class="file-details">
                    <h4>${data.filename}</h4>
                    <span>Receiving... 0%</span>
                </div>
            `;
            transferList.prepend(transferItem);
            
        } else if (data.type === 'file_chunk') {
            const fileData = incomingFiles[data.transfer_id];
            if(!fileData) return;
            
            fileData.chunks.push(data.chunk);
            fileData.receivedBytes += data.chunk.byteLength;
            
            const progress = Math.floor((fileData.receivedBytes / fileData.size) * 100);
            const transferItem = document.getElementById(`transfer-${data.transfer_id}`);
            if (transferItem && progress % 5 === 0) { // Update UI every 5%
                transferItem.querySelector('span').textContent = `Receiving... ${progress}%`;
            }
            
        } else if (data.type === 'file_complete') {
            const fileData = incomingFiles[data.transfer_id];
            if(!fileData) return;
            
            const transferItem = document.getElementById(`transfer-${data.transfer_id}`);
            if (transferItem) {
                const blob = new Blob(fileData.chunks);
                const url = URL.createObjectURL(blob);
                const size_mb = (fileData.size / 1024 / 1024).toFixed(2);
                
                transferItem.innerHTML = `
                    <div class="file-icon">📥</div>
                    <div class="file-details">
                        <h4>${fileData.filename}</h4>
                        <span>${size_mb} MB • Ready</span>
                        <br/>
                        <a href="${url}" download="${fileData.filename}" class="btn btn-primary" style="padding: 4px 8px; font-size: 0.75rem; margin-top: 5px; text-decoration: none; display: inline-block;">Save to Device</a>
                    </div>
                `;
            }
            
            // Cleanup memory
            delete incomingFiles[data.transfer_id];
        }
    }

    fileDropZone.addEventListener('click', () => fileInput.click());

    fileDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileDropZone.style.borderColor = 'var(--primary)';
        fileDropZone.style.backgroundColor = 'rgba(245, 197, 24, 0.05)';
    });

    fileDropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        fileDropZone.style.borderColor = 'var(--border-color)';
        fileDropZone.style.backgroundColor = 'var(--bg-color)';
    });

    fileDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        fileDropZone.style.borderColor = 'var(--border-color)';
        fileDropZone.style.backgroundColor = 'var(--bg-color)';
        
        if(e.dataTransfer.files.length) {
            uploadFileChunked(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', () => {
        if(fileInput.files.length) {
            uploadFileChunked(fileInput.files[0]);
        }
    });

    function uploadFileChunked(file) {
        if (!conn || !isConnected) {
            alert('Not connected to peer.');
            return;
        }

        const CHUNK_SIZE = 65536; // 64KB chunks for WebRTC optimization
        const transfer_id = 'tx_' + Math.random().toString(36).substr(2, 9);
        const size_mb = (file.size / 1024 / 1024).toFixed(2);
        
        const transferItem = document.createElement('div');
        transferItem.className = 'transfer-item';
        transferItem.id = `transfer-${transfer_id}`;
        transferItem.innerHTML = `
            <div class="file-icon">📁</div>
            <div class="file-details">
                <h4>${file.name}</h4>
                <span>${size_mb} MB • Starting...</span>
            </div>
        `;
        transferList.prepend(transferItem);

        conn.send({
            type: 'file_start',
            filename: file.name,
            size: file.size,
            transfer_id: transfer_id
        });

        let offset = 0;

        function readNextChunk() {
            const slice = file.slice(offset, offset + CHUNK_SIZE);
            const reader = new FileReader();

            reader.onload = (e) => {
                conn.send({
                    type: 'file_chunk',
                    transfer_id: transfer_id,
                    chunk: e.target.result // ArrayBuffer
                });

                offset += CHUNK_SIZE;

                if (offset < file.size) {
                    const progress = Math.floor((offset / file.size) * 100);
                    if (progress % 5 === 0) {
                        transferItem.querySelector('span').textContent = `${size_mb} MB • ${progress}%`;
                    }
                    // Timeout to yield to browser event loop
                    setTimeout(readNextChunk, 1);
                } else {
                    transferItem.querySelector('span').textContent = `${size_mb} MB • Sent`;
                    transferItem.querySelector('span').style.color = 'var(--success)';
                    
                    conn.send({
                        type: 'file_complete',
                        transfer_id: transfer_id
                    });
                }
            };
            
            reader.readAsArrayBuffer(slice);
        }

        readNextChunk();
    }
});
