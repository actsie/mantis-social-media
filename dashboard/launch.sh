#!/bin/bash

# Mantis Claw Dashboard Launcher

cd "$(dirname "$0")"

echo "🦀 Starting Mantis Claw Dashboard..."
echo ""

# Generate initial data
node generate-data.js

echo ""
echo "Opening dashboard in browser..."
open http://localhost:8765

echo ""
echo "Starting server..."
node server.js
