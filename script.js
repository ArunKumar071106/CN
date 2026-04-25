document.addEventListener('DOMContentLoaded', () => {
    // Tab switching
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.style.display = 'none');
            
            // Add active class to clicked
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).style.display = 'block';
        });
    });

    // Connection Simulation
    const startServerBtn = document.getElementById('start-server-btn');
    const connectClientBtn = document.getElementById('connect-client-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');
    
    const heroPanel = document.getElementById('hero-panel');
    const appPanel = document.getElementById('app-panel');
    const navActions = document.getElementById('nav-actions');

    function connect() {
        // Hide Hero, Show App
        heroPanel.style.display = 'none';
        appPanel.style.display = 'block';
        navActions.style.display = 'flex';
        
        // Add welcome message
        addMessage('System connected and ready for P2P transfer.', 'system');
    }

    function disconnect() {
        appPanel.style.display = 'none';
        navActions.style.display = 'none';
        heroPanel.style.display = 'flex';
        
        // Clear chat
        const chatContainer = document.getElementById('chat-container');
        chatContainer.innerHTML = '<div class="message system"><p>Connection established with Peer.</p></div>';
    }

    startServerBtn.addEventListener('click', () => {
        startServerBtn.textContent = 'Listening on Port 5000...';
        startServerBtn.style.opacity = '0.7';
        
        // Simulate peer connecting after 1.5s
        setTimeout(() => {
            connect();
            startServerBtn.textContent = 'Start Listening';
            startServerBtn.style.opacity = '1';
        }, 1500);
    });

    connectClientBtn.addEventListener('click', () => {
        const ip = document.getElementById('host-ip-input').value;
        if(!ip) {
            alert('Please enter a host IP address');
            return;
        }
        connectClientBtn.textContent = 'Connecting...';
        
        setTimeout(() => {
            connect();
            connectClientBtn.textContent = 'Connect to Peer';
        }, 1000);
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
        if(text) {
            addMessage(text, 'sent');
            messageInput.value = '';
            
            // Simulate reply
            setTimeout(() => {
                addMessage('Echo: ' + text, 'received');
            }, 1000 + Math.random() * 1000);
        }
    }

    sendMsgBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') sendMessage();
    });

    // File Transfer Functionality
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
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', () => {
        if(fileInput.files.length) {
            handleFile(fileInput.files[0]);
        }
    });

    function handleFile(file) {
        const size = (file.size / 1024 / 1024).toFixed(2);
        
        const transferItem = document.createElement('div');
        transferItem.className = 'transfer-item';
        
        const transferId = 'transfer-' + Date.now();
        
        transferItem.innerHTML = `
            <div class="file-icon">📁</div>
            <div class="file-details">
                <h4>${file.name}</h4>
                <span>${size} MB • Sending...</span>
                <div class="progress-bar">
                    <div class="progress-fill" id="${transferId}"></div>
                </div>
            </div>
        `;
        
        transferList.prepend(transferItem);
        
        // Simulate file transfer progress
        const progressBar = document.getElementById(transferId);
        let progress = 0;
        
        const interval = setInterval(() => {
            progress += Math.random() * 20;
            if(progress >= 100) {
                progress = 100;
                clearInterval(interval);
                transferItem.querySelector('span').textContent = `${size} MB • Completed`;
                transferItem.querySelector('span').style.color = 'var(--success)';
            }
            progressBar.style.width = `${progress}%`;
        }, 300);
    }
});
