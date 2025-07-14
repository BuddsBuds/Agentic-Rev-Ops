#!/bin/bash
# Demo runner script with error handling

echo "🚀 Starting Agentic RevOps Demo..."
echo "=================================="
echo ""

# Check if node is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
fi

# Run the fixed demo
echo "Running the production-ready demo..."
node demo-fixed.js

# Check exit status
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Demo completed successfully!"
else
    echo ""
    echo "❌ Demo encountered errors"
    exit 1
fi