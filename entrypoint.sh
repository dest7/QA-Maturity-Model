#!/bin/sh
set -e

cd /workspace

echo "Installing dependencies with frozen lockfile..."
pnpm install --frozen-lockfile

if [ "$SERVICE" = "api-server" ]; then
  echo "Pushing DB schema..."
  pnpm --filter @workspace/db run db:push
fi

echo "Starting dev server for $SERVICE..."
exec pnpm --filter @workspace/$SERVICE run dev

