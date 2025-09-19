#!/usr/bin/env bash

# Test script for code review integration
# This validates that all components are working correctly

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}🧪 Testing Code Review Integration${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

FAILED=0

# Test 1: Check if review script exists and is executable
echo -ne "1. Review script exists and is executable... "
if [ -x "scripts/claude-review.js" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    FAILED=1
fi

# Test 2: Check if git wrapper exists and is executable
echo -ne "2. Git wrapper script exists and is executable... "
if [ -x "scripts/git-add-with-review.sh" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    FAILED=1
fi

# Test 3: Check if pre-stage hook exists and is executable
echo -ne "3. Pre-stage hook exists and is executable... "
if [ -x ".husky/pre-stage" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    FAILED=1
fi

# Test 4: Check if Claude agents exist
echo -ne "4. Claude Code agents exist... "
if [ -f ".claude/agents/code-reviewer.md" ] && [ -f ".claude/agents/react-ui-reviewer.md" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    FAILED=1
fi

# Test 5: Check if review directories exist
echo -ne "5. Review directories exist... "
if [ -d ".claude/review-cache" ] && [ -d ".claude/review-reports" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠ Creating directories...${NC}"
    mkdir -p .claude/review-cache .claude/review-reports
    echo -e "${GREEN}✓${NC}"
fi

# Test 6: Check if hook configuration exists
echo -ne "6. Hook configuration exists... "
if [ -f ".claude/hooks/pre-stage-review.json" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    FAILED=1
fi

# Test 7: Test review script with --help
echo -ne "7. Review script responds to --help... "
if node scripts/claude-review.js --help > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    FAILED=1
fi

# Test 8: Test git wrapper with --help
echo -ne "8. Git wrapper responds to --help... "
if ./scripts/git-add-with-review.sh --help > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    FAILED=1
fi

# Test 9: Check npm scripts
echo -ne "9. NPM scripts configured... "
if grep -q '"review":' package.json && grep -q '"review:staged":' package.json && grep -q '"git:add":' package.json; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    FAILED=1
fi

# Test 10: Test SKIP_REVIEW environment variable
echo -ne "10. SKIP_REVIEW environment variable works... "
OUTPUT=$(SKIP_REVIEW=1 node scripts/claude-review.js 2>&1)
if echo "$OUTPUT" | grep -q "Review skipped"; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    FAILED=1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed! Code review integration is ready.${NC}"
    echo ""
    echo "Quick start commands:"
    echo "  yarn git:add <file>         # Add file with review"
    echo "  yarn review <file>          # Review file without staging"
    echo "  yarn review:staged          # Review all staged files"
    echo "  SKIP_REVIEW=1 git add .     # Skip review (emergency)"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please fix the issues above.${NC}"
    exit 1
fi