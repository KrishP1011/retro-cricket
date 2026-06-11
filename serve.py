#!/usr/bin/env python3
"""Dev server for Retro Cricket — serves with no-store so edits always load fresh."""
import functools
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import os
import sys


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8471
    directory = os.path.dirname(os.path.abspath(__file__))
    handler = functools.partial(NoCacheHandler, directory=directory)
    print(f"serving {directory} on http://localhost:{port}", flush=True)
    ThreadingHTTPServer(("", port), handler).serve_forever()
