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

    let SERVER_URL = '';
    if (window.location.protocol.startsWith('http')) {
        SERVER_URL = window.location.origin;
    } else {
        SERVER_URL = 'http://localhost:8000'; // fallback if opened via file://
    }

    // Set Local IP Display dynamically from backend
    const localIpDisplay = document.getElementById('local-ip-display');
    if (localIpDisplay) {
        fetch(`${SERVER_URL}/api/ip`)
            .then(response => response.json())
            .then(data => {
                if (data && data.ip) {
                    localIpDisplay.value = data.ip;
                }
            })
            .catch(err => {
                const hostname = window.location.hostname;
                if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '') {
                    localIpDisplay.value = hostname;
                } else {
                    localIpDisplay.value = 'Failed to load IP';
                }
            });
    }

    // Connection Setup
    const startServerBtn = document.getElementById('start-server-btn');
    const connectClientBtn = document.getElementById('connect-client-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');
    
    const heroPanel = document.getElementById('hero-panel');
    const appPanel = document.getElementById('app-panel');
    const navActions = document.getElementById('nav-actions');

    let socket = null;
    let isConnected = false;
    let myId = Math.random().toString(36).substr(2, 9); // Unique ID for this browser tab

    function connect() {
        heroPanel.style.display = 'none';
        appPanel.style.display = 'block';
        navActions.style.display = 'flex';
        isConnected = true;
        
        addMessage('System connecting...', 'system');
        
        socket = io(SERVER_URL);
        
        socket.on('connect', () => {
            document.getElementById('connection-status').textContent = 'Connected';
            document.getElementById('connection-status').classList.remove('disconnected');
            document.getElementById('connection-status').classList.add('connected');
            addMessage('Connected to Peer network.', 'system');
        });

        socket.on('disconnect', () => {
            document.getElementById('connection-status').textContent = 'Disconnected';
            document.getElementById('connection-status').classList.add('disconnected');
            document.getElementById('connection-status').classList.remove('connected');
            addMessage('Disconnected from Peer network.', 'system');
        });
        
        socket.on('system_message', (data) => {
            addMessage(data.text, 'system');
        });

        socket.on('chat_message', (data) => {
            if (data.sender !== myId) {
                addMessage(data.text, 'received');
            }
        });
        
        // Progress for both sender and receiver
        socket.on('file_progress', (data) => {
            const transferItem = document.getElementById(`transfer-${data.transfer_id}`);
            if (transferItem) {
                const span = transferItem.querySelector('span');
                if (data.progress < 100) {
                    span.textContent = `Transferring... ${data.progress}%`;
                } else {
                    span.textContent = `Processing...`;
                }
            } else {
                // If it's a new transfer we didn't start, show receiving UI
                const transferList = document.getElementById('transfer-list');
                const newItem = document.createElement('div');
                newItem.className = 'transfer-item';
                newItem.id = `transfer-${data.transfer_id}`;
                newItem.innerHTML = `
                    <div class="file-icon">📥</div>
                    <div class="file-details">
                        <h4>${data.filename}</h4>
                        <span>Receiving... ${data.progress}%</span>
                    </div>
                `;
                transferList.prepend(newItem);
            }
        });
        
        socket.on('file_received', (data) => {
            // Received a complete file
            const transferList = document.getElementById('transfer-list');
            const transferItem = document.createElement('div');
            transferItem.className = 'transfer-item';
            transferItem.innerHTML = `
                <div class="file-icon">📥</div>
                <div class="file-details">
                    <h4>${data.filename}</h4>
                    <span>${data.size} MB • Ready to Download</span>
                    <br/>
                    <a href="${SERVER_URL}${data.url}" download class="btn btn-primary" style="padding: 4px 8px; font-size: 0.75rem; margin-top: 5px; text-decoration: none; display: inline-block;">Download</a>
                </div>
            `;
            transferList.prepend(transferItem);
        });
    }

    function disconnect() {
        isConnected = false;
        if(socket) {
            socket.disconnect();
            socket = null;
        }
        
        appPanel.style.display = 'none';
        navActions.style.display = 'none';
        heroPanel.style.display = 'flex';
        
        const chatContainer = document.getElementById('chat-container');
        chatContainer.innerHTML = '<div class="message system"><p>Connection established with Peer.</p></div>';
    }

    startServerBtn.addEventListener('click', () => {
        // Server already running in Python, just connect via socket
        connect();
    });

    connectClientBtn.addEventListener('click', () => {
        const ip = document.getElementById('host-ip-input').value.trim();
        if(ip) {
            SERVER_URL = `http://${ip}:8000`;
        }
        connect();
    });

    disconnectBtn.addEventListener('click', disconnect);

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
        if(text && isConnected && socket) {
            // Optimistic UI update
            messageInput.value = '';
            addMessage(text, 'sent');
            
            socket.emit('chat_message', {
                text: text,
                sender: myId
            });
        }
    }

    sendMsgBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') sendMessage();
    });

    // File Transfer Functionality - Chunked Transfer
    const fileDropZone = document.getElementById('file-drop-zone');
    const fileInput = document.getElementById('file-input');
    const transferList = document.getElementById('transfer-list');

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
        if (!socket || !isConnected) {
            alert('Not connected to peer.');
            return;
        }

        const CHUNK_SIZE = 16384; // 16KB chunk size as per P2P design
        const transfer_id = 'tx_' + Math.random().toString(36).substr(2, 9);
        const size_mb = (file.size / 1024 / 1024).toFixed(2);
        
        // Setup local UI
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

        // Tell server transfer is starting
        socket.emit('file_transfer_start', {
            filename: file.name,
            size: file.size,
            transfer_id: transfer_id
        });

        // Start chunking
        let offset = 0;

        function readNextChunk() {
            const slice = file.slice(offset, offset + CHUNK_SIZE);
            const reader = new FileReader();

            reader.onload = (e) => {
                socket.emit('file_chunk', {
                    transfer_id: transfer_id,
                    chunk: e.target.result
                });

                offset += CHUNK_SIZE;

                if (offset < file.size) {
                    // Update local progress quickly
                    const progress = Math.floor((offset / file.size) * 100);
                    transferItem.querySelector('span').textContent = `${size_mb} MB • ${progress}%`;
                    
                    // read next after short delay to not overwhelm websocket
                    setTimeout(readNextChunk, 2);
                } else {
                    // Done
                    transferItem.querySelector('span').textContent = `${size_mb} MB • Sent`;
                    transferItem.querySelector('span').style.color = 'var(--success)';
                    
                    socket.emit('file_transfer_complete', {
                        transfer_id: transfer_id
                    });
                }
            };
            
            reader.onerror = (err) => {
                transferItem.querySelector('span').textContent = `Upload failed`;
                transferItem.querySelector('span').style.color = 'var(--danger)';
            };

            reader.readAsArrayBuffer(slice);
        }

        readNextChunk();
    }
});
