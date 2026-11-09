"""Local preview only. /accounts-preview enables the local account emulator."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit
import os

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)

class Preview(SimpleHTTPRequestHandler):
    def do_GET(self):
        if urlsplit(self.path).path == '/accounts-preview':
            html = (ROOT / 'index.html').read_text()
            config = '<script>window.VA_ACCOUNT_CONFIG={apiBase:"http://127.0.0.1:8787"};</script>'
            body = html.replace('</head>', config + '</head>', 1).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            super().do_GET()

print('Local preview http://127.0.0.1:4173/ — accounts at /accounts-preview', flush=True)
ThreadingHTTPServer(('127.0.0.1', 4173), Preview).serve_forever()
