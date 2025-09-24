#!/bin/bash

# Post-interrupt quality check script for FileCataloger
# Runs essential quality checks after cleanup to ensure code integrity

# Don't use 'set -e' as we want to continue even if checks fail
# We'll handle errors gracefully in each check

# Configuration
PROJECT_DIR="/Users/jinhu/Development/File_Cataloger_Project/FileCataloger"
LOG_FILE="/tmp/fc_quality_check.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Navigate to project directory
if ! cd "$PROJECT_DIR" 2>/dev/null; then
    echo -e "${RED}❌ Failed to navigate to project directory${NC}" >&2
    echo "Directory: $PROJECT_DIR" >&2
    exit 0  # Exit gracefully even on error
fi

# Verify we're in the correct directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Not in FileCataloger project directory${NC}" >&2
    echo "Current directory: $(pwd)" >&2
    exit 0  # Exit gracefully even on error
fi

# Clear previous log
> "$LOG_FILE"

echo ""
echo "🔍 Running post-interrupt quality checks..."
echo "══════════════════════════════════════════════════════"

# Initialize counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
CRITICAL_ERRORS=0
WARNINGS=0

# Function to run a check
run_check() {
    local name=$1
    local command=$2
    local emoji=$3
    local is_critical=$4

    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

    printf "${emoji} %-15s ... " "$name" || true

    # Run the command and capture output (allow failures)
    if OUTPUT=$(eval "$command" 2>&1); then
        echo -e "${GREEN}✅ Passed${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        echo "[PASSED] $name" >> "$LOG_FILE"
    else
        if [ "$is_critical" = "true" ]; then
            echo -e "${RED}❌ Failed${NC}"
            CRITICAL_ERRORS=$((CRITICAL_ERRORS + 1))
            echo "[CRITICAL ERROR] $name" >> "$LOG_FILE"

            # Show first few lines of error
            ERROR_PREVIEW=$(echo "$OUTPUT" | head -n 3 | sed 's/^/       /')
            if [ -n "$ERROR_PREVIEW" ]; then
                echo -e "${RED}$ERROR_PREVIEW${NC}"
            fi

            # Log full output
            echo "$OUTPUT" >> "$LOG_FILE"
            echo "---" >> "$LOG_FILE"
        else
            echo -e "${YELLOW}⚠️  Warning${NC}"
            WARNINGS=$((WARNINGS + 1))
            echo "[WARNING] $name" >> "$LOG_FILE"
        fi
    fi
}

# Run quality checks
run_check "TypeScript" "yarn typecheck" "📘" "true"
run_check "ESLint" "yarn lint" "🔧" "true"
run_check "Prettier" "yarn format:check" "🎨" "false"

# Additional checks if commands exist
if command -v yarn &> /dev/null; then
    # Check for security vulnerabilities
    if yarn list --depth=0 | grep -q "audit"; then
        run_check "Security" "yarn audit --level=high" "🔒" "false"
    fi
fi

echo "══════════════════════════════════════════════════════"

# Summary report
echo ""
echo "📊 Summary:"
echo "   Total checks: $TOTAL_CHECKS"
echo -e "   Passed: ${GREEN}$PASSED_CHECKS${NC}"
echo -e "   Warnings: ${YELLOW}$WARNINGS${NC}"
echo -e "   Critical errors: ${RED}$CRITICAL_ERRORS${NC}"

# Provide actionable feedback
if [ $CRITICAL_ERRORS -gt 0 ] || [ $WARNINGS -gt 0 ]; then
    echo ""
    echo "══════════════════════════════════════════════════════"
    echo "🤖 AUTOMATED FIX REQUEST FOR CLAUDE CODE:"
    echo "══════════════════════════════════════════════════════"
    echo ""

    # Create a list of commands for Claude Code to run
    CLAUDE_COMMANDS=""

    if [ $CRITICAL_ERRORS -gt 0 ]; then
        echo -e "${RED}⚠️  CRITICAL ISSUES FOUND${NC}"
        echo ""

        # Check which critical checks failed and request specific fixes
        if grep -q "\[CRITICAL ERROR\] TypeScript" "$LOG_FILE"; then
            echo "📘 TypeScript errors detected"
            CLAUDE_COMMANDS="${CLAUDE_COMMANDS}yarn typecheck\n"
        fi

        if grep -q "\[CRITICAL ERROR\] ESLint" "$LOG_FILE"; then
            echo "🔧 ESLint violations found"
            CLAUDE_COMMANDS="${CLAUDE_COMMANDS}yarn lint --fix\nyarn lint\n"
        fi
    fi

    if [ $WARNINGS -gt 0 ]; then
        if [ $CRITICAL_ERRORS -eq 0 ]; then
            echo -e "${YELLOW}⚠️  NON-CRITICAL ISSUES FOUND${NC}"
        fi
        echo ""

        if grep -q "\[WARNING\] Prettier" "$LOG_FILE"; then
            echo "🎨 Formatting issues detected"
            CLAUDE_COMMANDS="${CLAUDE_COMMANDS}yarn format\n"
        fi

        if grep -q "\[WARNING\] Security" "$LOG_FILE"; then
            echo "🔒 Security vulnerabilities found"
            CLAUDE_COMMANDS="${CLAUDE_COMMANDS}yarn audit fix\n"
        fi
    fi

    echo ""
    echo "══════════════════════════════════════════════════════"
    echo "🤖 CLAUDE CODE ACTION REQUIRED:"
    echo "══════════════════════════════════════════════════════"
    echo ""
    echo "Please run the following commands to fix all issues:"
    echo ""
    echo -e "$CLAUDE_COMMANDS" | sed 's/^/  /'

    # Also check for console.log usage
    CONSOLE_LOG_COUNT=$(grep -r "console\.log" src --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | wc -l | tr -d ' ' || echo "0")
    if [ "$CONSOLE_LOG_COUNT" -gt "0" ]; then
        echo ""
        echo "⚠️  Additionally, found $CONSOLE_LOG_COUNT console.log statements"
        echo "  Replace all console.log with Logger module (per CODE.md)"
        echo ""
        echo "  Files with console.log:"
        grep -r "console\.log" src --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | cut -d: -f1 | sort -u | head -5 | sed 's/^/    - /'
    fi

    echo ""
    echo "══════════════════════════════════════════════════════"
    echo "After fixing, run 'yarn quality:check' to verify"
    echo "══════════════════════════════════════════════════════"
else
    echo ""
    echo -e "${GREEN}✨ All quality checks passed!${NC}"
fi

echo ""

# Always exit with success (0) since this is a non-blocking hook
# The purpose is to report issues, not to fail the hook
exit 0