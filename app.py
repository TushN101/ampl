"""
SOQ Alert Dashboard — Minimal Flask Server
Serves static files only. All processing happens client-side.
Deploy to Vercel with vercel-serverless or any static host.
"""

from flask import Flask, render_template
import os

app = Flask(__name__)


@app.route('/')
def index():
    return render_template("index.html")


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
