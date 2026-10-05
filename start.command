#!/bin/bash
# Double-click to run the poster builder locally (a server is needed so PNG export can embed fonts).
cd "$(dirname "$0")"
PORT=8765
(sleep 1 && open "http://localhost:$PORT/") &
python3 -m http.server $PORT
