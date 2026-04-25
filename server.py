import http.server
import socketserver
import socket
import json

PORT = 8000

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/ip':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            # Dynamically get the local network IP address
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            try:
                # This doesn't actually send a packet, but finds the default route
                s.connect(('10.255.255.255', 1))
                IP = s.getsockname()[0]
            except Exception:
                IP = '127.0.0.1'
            finally:
                s.close()
                
            response = {'ip': IP}
            self.wfile.write(json.dumps(response).encode())
        else:
            super().do_GET()

print(f"Starting server on port {PORT}...")
print(f"Please open your browser to http://localhost:{PORT}")

with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
