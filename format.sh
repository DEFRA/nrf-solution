#!/usr/bin/env bash

source ~/.nvm/nvm.sh

failed=0

echo "Formatting frontend..."
if (cd frontend && nvm use && npm run format > /dev/null); then
    echo "✅ formatted frontend"
else
    echo "❌ error formatting frontend"
    failed=1
fi

echo "Formatting backend..."
if (cd backend && nvm use && npm run format > /dev/null); then
    echo "✅ formatted backend"
else
    echo "❌ error formatting backend"
    failed=1
fi

echo "Formatting impact-assessor..."
if (cd impact-assessor && uv run task format > /dev/null); then
    echo "✅ formatted impact-assessor"
else
    echo "❌ error formatting impact-assessor"
    failed=1
fi

if [ "$failed" -eq 1 ]; then
    echo "Some formatters failed."
    exit 1
fi

echo "Done."
