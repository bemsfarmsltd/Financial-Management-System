#!/usr/bin/env python3
"""
BEMS GMD AI Mobile App Web Development Server & API Proxy
Serves the Flutter Web bundle and proxies API calls to the live BEMS backend,
eliminating browser CORS restrictions during testing.
"""

import http.server
import socketserver
import urllib.request
import urllib.error
import os
import sys

PORT = 8086
WEB_DIR = os.path.join(os.path.dirname(__file__), "build", "web")
LOCAL_BACKEND = "http://localhost:3000"
LIVE_BACKEND = "https://pink-horse-318730.hostingersite.com"
FALLBACK_BACKEND = "https://bemserp.work"

class ProxyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def _set_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-employee-id, Accept")

    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors_headers()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/api/"):
            self._proxy_request("GET")
        else:
            # If path doesn't exist as static file, fallback to index.html for Flutter routing
            local_path = os.path.join(WEB_DIR, self.path.lstrip("/").split("?")[0])
            if not os.path.exists(local_path) or not os.path.isfile(local_path):
                self.path = "/index.html"
            super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/"):
            self._proxy_request("POST")
        else:
            self.send_error(405, "Method Not Allowed")

    def do_PUT(self):
        if self.path.startswith("/api/"):
            self._proxy_request("PUT")
        else:
            self.send_error(405, "Method Not Allowed")

    def do_DELETE(self):
        if self.path.startswith("/api/"):
            self._proxy_request("DELETE")
        else:
            self.send_error(405, "Method Not Allowed")

    def _proxy_request(self, method):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length > 0 else None

        backends = [LOCAL_BACKEND, LIVE_BACKEND, FALLBACK_BACKEND]
        last_error = None

        for backend in backends:
            target_url = f"{backend}{self.path}"
            try:
                headers = {k: v for k, v in self.headers.items() if k.lower() not in ["host", "content-length"]}
                req = urllib.request.Request(target_url, data=body, headers=headers, method=method)

                with urllib.request.urlopen(req, timeout=10) as response:
                    res_body = response.read()
                    self.send_response(response.status)
                    self._set_cors_headers()
                    for k, v in response.headers.items():
                        if k.lower() not in ["access-control-allow-origin", "content-length", "transfer-encoding"]:
                            self.send_header(k, v)
                    self.send_header("Content-Length", str(len(res_body)))
                    self.end_headers()
                    self.wfile.write(res_body)
                    return
            except urllib.error.HTTPError as e:
                res_body = e.read()
                self.send_response(e.code)
                self._set_cors_headers()
                for k, v in e.headers.items():
                    if k.lower() not in ["access-control-allow-origin", "content-length", "transfer-encoding"]:
                        self.send_header(k, v)
                self.send_header("Content-Length", str(len(res_body)))
                self.end_headers()
                self.wfile.write(res_body)
                return
            except Exception as e:
                last_error = e
                continue

        self.send_error(502, f"Bad Gateway: Unable to proxy to BEMS backends: {last_error}")

def run():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), ProxyHTTPRequestHandler) as httpd:
        print(f"============================================================")
        print(f"   BEMS GMD AI Web Server running at:")
        print(f"   >>> http://localhost:{PORT}")
        print(f"============================================================")
        sys.stdout.flush()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")

if __name__ == "__main__":
    run()
