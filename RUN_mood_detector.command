#!/bin/bash
# Face-Emotion Mood Detector — Vite + Express + Gemini Vision (webcam).
# Double-click to run; then open the printed http://localhost URL in your browser.
# Ctrl-C or closing this window stops the server.
cd "$(dirname "$0")"   # -> face-mood-tracker-code/

# node/npm on PATH from a double-click (nvm / homebrew)
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

echo "=== Face-Emotion Mood Detector (dev) ==="
if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: npm not found on PATH. Run 'npm run dev' from Terminal instead."
  echo "Press any key to close."; read -n1; exit 1
fi

echo ">> Starting dev server. When it prints a localhost URL, open it in your browser and allow camera access."
npm run dev

echo ""
echo "Server stopped. Press any key to close."; read -n1
