#!/usr/bin/env python3
"""
BEMS Staff App Web Development Server & API Proxy
Serves the Flutter Web bundle and proxies API calls to the live BEMS backend,
eliminating browser CORS restrictions during PC testing.
"""

import http.server
import socketserver
import urllib.request
import urllib.error
import os
import sys

PORT = 8085
WEB_DIR = os.path.join(os.path.dirname(__file__), "build", "web")
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
            if not os.path.exists(local_path) and not os.path.isfile(local_path):
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

        backends = [LIVE_BACKEND, FALLBACK_BACKEND]
        last_error = None

        for backend in backends:
            target_url = f"{backend}{self.path}"
            headers = {
                "Content-Type": self.headers.get("Content-Type", "application/json"),
                "User-Agent": "BEMS-Staff-WebProxy/1.0",
            }
            if "x-employee-id" in self.headers:
                headers["x-employee-id"] = self.headers["x-employee-id"]
            if "Authorization" in self.headers:
                headers["Authorization"] = self.headers["Authorization"]

            req = urllib.request.Request(
                target_url,
                data=body,
                headers=headers,
                method=method
            )

            try:
                with urllib.request.urlopen(req, timeout=20) as response:
                    resp_body = response.read()
                    self.send_response(response.status)
                    self._set_cors_headers()
                    self.send_header("Content-Type", response.headers.get("Content-Type", "application/json"))
                    self.send_header("Content-Length", str(len(resp_body)))
                    self.end_headers()
                    self.wfile.write(resp_body)
                    return
            except urllib.error.HTTPError as e:
                resp_body = e.read()
                self.send_response(e.code)
                self._set_cors_headers()
                self.send_header("Content-Type", e.headers.get("Content-Type", "application/json"))
                self.send_header("Content-Length", str(len(resp_body)))
                self.end_headers()
                self.wfile.write(resp_body)
                return
            except Exception as e:
                last_error = e
                continue

        # If all backends failed
        self.send_response(502)
        self._set_cors_headers()
        self.send_header("Content-Type", "application/json")
        err_json = f'{{"error": "Failed to connect to backend: {str(last_error)}"}}\n'.encode("utf-8")
        self.send_header("Content-Length", str(len(err_json)))
        self.end_headers()
        self.wfile.write(err_json)

class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

def main():
    with ThreadedHTTPServer(("", PORT), ProxyHTTPRequestHandler) as httpd:
        print(f"🚀 BEMS Staff App running at: http://localhost:{PORT}")
        print(f"🔗 Proxying /api/* requests to: {LIVE_BACKEND}")
        httpd.serve_forever()

if __name__ == "__main__":
    main()
