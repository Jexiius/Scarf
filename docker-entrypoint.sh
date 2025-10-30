#!/bin/sh
set -eu

echo "🔧 Running database migrations..."
node dist/scripts/run-migrations.js

echo "🚀 Starting application..."
exec "$@"
