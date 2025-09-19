#!/bin/bash

# Quick test of the auto-rebuild hook system

echo "🧪 Quick Test of FileCataloger Auto-Rebuild Hooks"
echo "=================================================="
echo ""

# Test 1: Check integration script
echo "1. Testing integration script..."
export CLAUDE_HOOK_TRIGGER="manual-test"
export TOOL_NAME="Test"
export FILE_PATH="/Users/jinhu/Development/File_Cataloger_Project/FileCataloger/test.ts"

if /Users/jinhu/Development/File_Cataloger_Project/FileCataloger/.claude/hooks/scripts/integrate-auto-rebuild.sh; then
    echo "   ✅ Integration script works"
else
    echo "   ❌ Integration script failed"
fi

# Test 2: Simulate file change tracking
echo ""
echo "2. Simulating file changes..."
echo "/Users/jinhu/Development/File_Cataloger_Project/FileCataloger/src/main/index.ts" > /tmp/claude_fc_changes.log
echo "/Users/jinhu/Development/File_Cataloger_Project/FileCataloger/src/renderer/App.tsx" >> /tmp/claude_fc_changes.log

# Test 3: Run change analyzer
echo ""
echo "3. Running change analyzer..."
if node /Users/jinhu/Development/File_Cataloger_Project/FileCataloger/.claude/hooks/scripts/change-analyzer.js /tmp/claude_fc_changes.log > /tmp/test_analysis.json 2>/dev/null; then
    echo "   ✅ Analyzer completed"
    echo "   Analysis result:"
    cat /tmp/test_analysis.json | python3 -m json.tool | head -20
else
    echo "   ❌ Analyzer failed"
fi

# Cleanup
rm -f /tmp/claude_fc_changes.log /tmp/test_analysis.json

echo ""
echo "✨ Quick test complete!"