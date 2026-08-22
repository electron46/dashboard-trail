"""Serveur statique de test pour ELEV.

Multi-thread, HTTP/1.1, envoi de chaque fichier en un seul write depuis la
memoire : le python -m http.server par defaut (mono-thread, HTTP/1.0) lache des
connexions sous les rafales d'un audit et livre des fichiers tronques.
"""
import sys, os, mimetypes, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else ".")
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8899

mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("image/svg+xml", ".svg")


class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "ElevTest/1.0"

    def log_message(self, *a):
        pass

    def _resolve(self):
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        from urllib.parse import unquote
        path = unquote(path)
        if path.endswith("/"):
            path += "index.html"
        full = os.path.abspath(os.path.join(ROOT, path.lstrip("/")))
        if not full.startswith(ROOT):
            return None
        return full if os.path.isfile(full) else None

    def _send(self, body, ctype, head_only=False):
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        if not head_only:
            self.wfile.write(body)

    def do_GET(self, head_only=False):
        full = self._resolve()
        if not full:
            body = b"404"
            self.send_response(404)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        with open(full, "rb") as f:
            body = f.read()
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
            ctype += "; charset=utf-8"
        self._send(body, ctype, head_only)

    def do_HEAD(self):
        self.do_GET(head_only=True)


if __name__ == "__main__":
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), H)
    srv.daemon_threads = True
    print("serving %s on http://127.0.0.1:%d" % (ROOT, PORT), flush=True)
    srv.serve_forever()
