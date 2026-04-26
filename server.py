import os
import socket
from flask import Flask, jsonify, request, send_from_directory
from flask_socketio import SocketIO, emit
from flask_cors import CORS

app = Flask(__name__, static_folder='.', static_url_path='/')
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

PORT = 8000
UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# To store file metadata temporarily while chunking
active_transfers = {}

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(path):
        return app.send_static_file(path)
    return "Not Found", 404

@app.route('/api/ip', methods=['GET'])
def get_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return jsonify({'ip': IP})

@app.route('/uploads/<path:filename>', methods=['GET'])
def download_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename, as_attachment=True)

@socketio.on('connect')
def handle_connect():
    print(f"Client connected: {request.sid}")
    emit('system_message', {'text': 'A peer has joined the network.'}, broadcast=True, include_self=False)

@socketio.on('disconnect')
def handle_disconnect():
    print(f"Client disconnected: {request.sid}")
    emit('system_message', {'text': 'A peer has left the network.'}, broadcast=True, include_self=False)

@socketio.on('chat_message')
def handle_chat_message(data):
    # Broadcast to everyone including sender, or just broadcast to others 
    # Usually UI handles optimistic update, so we broadcast to others.
    emit('chat_message', {
        'id': data.get('id', 0),
        'text': data.get('text', ''),
        'sender': data.get('sender', 'Unknown')
    }, broadcast=True, include_self=False)

@socketio.on('file_transfer_start')
def handle_file_start(data):
    filename = data.get('filename')
    total_size = data.get('size')
    transfer_id = data.get('transfer_id')
    
    # Store metadata
    active_transfers[transfer_id] = {
        'filename': filename,
        'size': total_size,
        'received': 0,
        'filepath': os.path.join(UPLOAD_FOLDER, filename)
    }
    
    # Let clients know a transfer is starting
    emit('file_progress', {
        'transfer_id': transfer_id,
        'filename': filename,
        'progress': 0
    }, broadcast=True)

@socketio.on('file_chunk')
def handle_file_chunk(data):
    transfer_id = data.get('transfer_id')
    chunk = data.get('chunk')
    
    if transfer_id in active_transfers:
        transfer = active_transfers[transfer_id]
        with open(transfer['filepath'], 'ab') as f:
            f.write(chunk)
            
        transfer['received'] += len(chunk)
        progress = int((transfer['received'] / transfer['size']) * 100)
        
        # Broadcast progress every so often to avoid flooding
        # Or just emit back to clients
        emit('file_progress', {
            'transfer_id': transfer_id,
            'filename': transfer['filename'],
            'progress': progress
        }, broadcast=True)

@socketio.on('file_transfer_complete')
def handle_file_complete(data):
    transfer_id = data.get('transfer_id')
    
    if transfer_id in active_transfers:
        transfer = active_transfers[transfer_id]
        size_mb = f"{(transfer['size'] / (1024 * 1024)):.2f}"
        
        # Broadcast the completed file so peers can download
        emit('file_received', {
            'filename': transfer['filename'],
            'size': size_mb,
            'url': f"/uploads/{transfer['filename']}"
        }, broadcast=True, include_self=False)
        
        del active_transfers[transfer_id]

if __name__ == '__main__':
    print(f"Starting PeerLink SocketIO Server on port {PORT}...")
    socketio.run(app, host='0.0.0.0', port=PORT, debug=False, allow_unsafe_werkzeug=True)
